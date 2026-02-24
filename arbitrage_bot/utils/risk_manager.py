"""
Risk management module for the Hyperliquid <> Aster arbitrage bot.

Responsibilities
----------------
1. Margin ratio monitoring — force-close either leg if it drops below threshold.
2. Position age limit — close positions held longer than max_position_age_hours.
3. Spread reversal detection — close when net spread can no longer cover costs.
4. Maximum drawdown circuit breaker — halt the bot if total PnL hits the limit.
5. Gas guard — pause new entries when BNB Chain gas is too high.
6. Leg imbalance detection — alert if one side was filled but the other was not.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum, auto
from typing import Dict, Optional, TYPE_CHECKING

from .logger import get_logger

if TYPE_CHECKING:
    from .hl_client import HyperliquidClient
    from .aster_client import AsterClient

log = get_logger(__name__)


class CloseReason(Enum):
    MARGIN_TOO_LOW = auto()
    SPREAD_REVERSED = auto()
    MAX_AGE_EXCEEDED = auto()
    DRAWDOWN_LIMIT = auto()
    MANUAL = auto()


@dataclass
class Position:
    """Tracks a single arb pair (one HL leg + one Aster leg)."""
    id: str                             # unique identifier e.g. "BTC_1706123456"
    symbol: str
    hl_is_long: bool                    # True if HL side is long
    hl_size: Decimal                    # base asset units
    aster_size_usdc: Decimal            # USDC notional on Aster
    open_time: float = field(default_factory=time.time)

    entry_spread: Decimal = Decimal("0")
    entry_hl_price: Decimal = Decimal("0")
    entry_aster_price: Decimal = Decimal("0")
    realised_pnl_usdc: Decimal = Decimal("0")

    # Lifecycle state
    is_open: bool = True
    close_reason: Optional[CloseReason] = None
    close_time: Optional[float] = None

    @property
    def age_hours(self) -> float:
        return (time.time() - self.open_time) / 3600


class RiskManager:
    """
    Periodically checks all open positions and triggers closes when needed.

    Usage:
        rm = RiskManager(config, hl_client, aster_client)
        asyncio.create_task(rm.monitor_loop())
        # To check if opening a new position is allowed:
        if rm.can_open_new():
            ...
        # Register a close callback:
        rm.on_close_required(callback)  # callback(pos, reason)
    """

    def __init__(
        self,
        config: dict,
        hl_client: "HyperliquidClient",
        aster_client: "AsterClient",
    ) -> None:
        self._cfg = config
        self._hl = hl_client
        self._aster = aster_client

        risk = config.get("risk", {})
        trading = config.get("trading", {})

        self.min_margin_ratio = Decimal(str(risk.get("min_margin_ratio", "0.20")))
        self.max_position_age_hours = float(risk.get("max_position_age_hours", 48))
        self.max_gas_gwei = int(risk.get("max_gas_gwei", 30))
        self.pause_on_high_gas: bool = risk.get("pause_on_high_gas", True)
        self.max_drawdown_fraction = Decimal(str(risk.get("max_drawdown_fraction", "0.10")))
        self.spread_close_ratio = Decimal(str(trading.get("spread_close_ratio", "0.30")))

        total_capital = Decimal(str(config["trading"]["total_capital_usdc"]))
        self.max_drawdown_usdc = total_capital * self.max_drawdown_fraction

        # Open positions registry  {position_id: Position}
        self.positions: Dict[str, Position] = {}
        self.total_realised_pnl: Decimal = Decimal("0")

        self._close_callback = None
        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        self._running = True
        asyncio.create_task(self._monitor_loop())
        log.info("risk_manager_started")

    async def stop(self) -> None:
        self._running = False

    def on_close_required(self, callback) -> None:
        """
        Register a coroutine callback invoked when a position must be closed.
        Signature: async def callback(pos: Position, reason: CloseReason) -> None
        """
        self._close_callback = callback

    # ------------------------------------------------------------------
    # Position registry
    # ------------------------------------------------------------------

    def register_open(self, pos: Position) -> None:
        self.positions[pos.id] = pos
        log.info(
            "position_registered",
            pos_id=pos.id,
            symbol=pos.symbol,
            hl_is_long=pos.hl_is_long,
            entry_spread=float(pos.entry_spread),
        )

    def register_close(self, pos_id: str, realised_pnl: Decimal) -> None:
        pos = self.positions.get(pos_id)
        if pos:
            pos.is_open = False
            pos.close_time = time.time()
            pos.realised_pnl_usdc = realised_pnl
            self.total_realised_pnl += realised_pnl
            log.info(
                "position_closed",
                pos_id=pos_id,
                symbol=pos.symbol,
                realised_pnl=float(realised_pnl),
                total_pnl=float(self.total_realised_pnl),
                reason=pos.close_reason.name if pos.close_reason else "UNKNOWN",
            )

    # ------------------------------------------------------------------
    # Gate checks (called before opening a new position)
    # ------------------------------------------------------------------

    def can_open_new(self) -> bool:
        """Returns False if the bot should not open any new positions."""
        # Circuit breaker: drawdown limit
        if self.total_realised_pnl < -self.max_drawdown_usdc:
            log.warning(
                "new_position_blocked_drawdown",
                total_pnl=float(self.total_realised_pnl),
                limit=float(self.max_drawdown_usdc),
            )
            return False

        # Circuit breaker: gas
        if self.pause_on_high_gas and not self._aster.gas_ok_for_open():
            log.warning("new_position_blocked_high_gas")
            return False

        return True

    # ------------------------------------------------------------------
    # Background monitor
    # ------------------------------------------------------------------

    async def _monitor_loop(self) -> None:
        while self._running:
            open_positions = [p for p in self.positions.values() if p.is_open]
            for pos in open_positions:
                await self._check_position(pos)
            await asyncio.sleep(10)

    async def _check_position(self, pos: Position) -> None:
        symbol = pos.symbol

        # 1. Age limit
        if pos.age_hours > self.max_position_age_hours:
            log.warning(
                "position_age_exceeded",
                pos_id=pos.id,
                age_hours=pos.age_hours,
                limit=self.max_position_age_hours,
            )
            await self._trigger_close(pos, CloseReason.MAX_AGE_EXCEEDED)
            return

        # 2. HL margin check
        hl_ratio = await self._hl.get_margin_ratio(symbol)
        if hl_ratio is not None and hl_ratio < self.min_margin_ratio:
            log.warning(
                "hl_margin_too_low",
                pos_id=pos.id,
                symbol=symbol,
                margin_ratio=float(hl_ratio),
                threshold=float(self.min_margin_ratio),
            )
            await self._trigger_close(pos, CloseReason.MARGIN_TOO_LOW)
            return

        # 3. Aster margin check
        aster_ratio = await self._aster.get_margin_ratio(symbol, is_long=not pos.hl_is_long)
        if aster_ratio is not None and aster_ratio < self.min_margin_ratio:
            log.warning(
                "aster_margin_too_low",
                pos_id=pos.id,
                symbol=symbol,
                margin_ratio=float(aster_ratio),
                threshold=float(self.min_margin_ratio),
            )
            await self._trigger_close(pos, CloseReason.MARGIN_TOO_LOW)
            return

        # 4. Spread reversal
        current_spread = await self._get_current_spread(symbol)
        if current_spread is not None:
            min_viable = pos.entry_spread * self.spread_close_ratio
            if current_spread < min_viable:
                log.info(
                    "spread_reversed_closing",
                    pos_id=pos.id,
                    symbol=symbol,
                    current_spread=float(current_spread),
                    min_viable=float(min_viable),
                    entry_spread=float(pos.entry_spread),
                )
                await self._trigger_close(pos, CloseReason.SPREAD_REVERSED)
                return

    async def _get_current_spread(self, symbol: str) -> Optional[Decimal]:
        hl_rate = self._hl.get_funding_rate(symbol)
        aster_rate = self._aster.get_funding_rate(symbol)
        if hl_rate is None or aster_rate is None:
            return None
        return abs(aster_rate - hl_rate)

    async def _trigger_close(self, pos: Position, reason: CloseReason) -> None:
        if not pos.is_open:
            return
        pos.close_reason = reason
        if self._close_callback:
            try:
                await self._close_callback(pos, reason)
            except Exception as exc:
                log.error("close_callback_error", pos_id=pos.id, error=str(exc))

    # ------------------------------------------------------------------
    # Leg imbalance detection
    # ------------------------------------------------------------------

    async def check_leg_imbalance(
        self,
        symbol: str,
        hl_filled: bool,
        aster_filled: bool,
    ) -> bool:
        """
        Returns True if there is a dangerous single-leg exposure.
        If one side filled but not the other, logs a critical alert.
        """
        if hl_filled and not aster_filled:
            log.critical(
                "leg_imbalance_hl_filled_aster_not",
                symbol=symbol,
                action="MANUAL_INTERVENTION_REQUIRED",
            )
            return True
        if aster_filled and not hl_filled:
            log.critical(
                "leg_imbalance_aster_filled_hl_not",
                symbol=symbol,
                action="MANUAL_INTERVENTION_REQUIRED",
            )
            return True
        return False

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def summary(self) -> dict:
        open_pos = [p for p in self.positions.values() if p.is_open]
        return {
            "open_positions": len(open_pos),
            "total_realised_pnl_usdc": float(self.total_realised_pnl),
            "max_drawdown_usdc": float(self.max_drawdown_usdc),
            "positions": [
                {
                    "id": p.id,
                    "symbol": p.symbol,
                    "age_hours": round(p.age_hours, 2),
                    "entry_spread": float(p.entry_spread),
                }
                for p in open_pos
            ],
        }
