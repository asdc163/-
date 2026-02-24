"""
Risk management for the settlement-timed arbitrage bot.

Because the strategy holds positions for only ~30 seconds (T-15s to T+15s),
most traditional risk concerns are irrelevant:
  - No age-limit check needed (positions are never held more than 1 minute)
  - No gas check needed (Aster uses REST API, no blockchain gas)
  - No spread-reversal monitor needed (we close at a fixed time)

What remains:
  1. Drawdown circuit breaker — halt the bot if total P&L hits the limit.
  2. Leg imbalance detection — if one side fills but not the other,
     log a critical alert and trigger emergency unwind.
  3. Pre-entry gate — confirm drawdown limit before each new entry.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum, auto
from typing import Callable, Dict, Optional

from .logger import get_logger

log = get_logger(__name__)


class CloseReason(Enum):
    SETTLEMENT_SCHEDULED = auto()   # normal close at T+15s
    DRAWDOWN_LIMIT = auto()         # circuit breaker tripped
    LEG_IMBALANCE = auto()          # emergency unwind after partial fill
    MANUAL = auto()                 # operator-triggered


@dataclass
class Position:
    """Tracks a single arb round trip (HL leg + Aster leg)."""
    id: str                          # e.g. "BTC_1706123456"
    symbol: str
    hl_is_long: bool                 # True = HL LONG, Aster SHORT
    hl_size: Decimal                 # base asset quantity on HL
    aster_size: Decimal              # base asset quantity on Aster
    hl_notional: Decimal             # USDC notional
    aster_notional: Decimal
    entry_spread: Decimal            # net_spread at decision time
    entry_hl_price: Decimal
    entry_aster_price: Decimal
    settlement_time_ms: int          # target Aster settlement timestamp
    open_time: float = field(default_factory=time.time)

    # Filled after close
    is_open: bool = True
    close_reason: Optional[CloseReason] = None
    close_time: Optional[float] = None
    realised_pnl_usdc: Decimal = Decimal("0")

    # Prices captured just before close (for P&L calculation)
    exit_hl_price: Decimal = Decimal("0")
    exit_aster_price: Decimal = Decimal("0")

    @property
    def age_seconds(self) -> float:
        return time.time() - self.open_time


class RiskManager:
    """
    Lightweight risk manager for 30-second hold positions.

    Responsibilities:
      - Drawdown circuit breaker
      - Leg imbalance detection
      - Position registry (open/close tracking)
      - Session P&L aggregation
    """

    def __init__(self, config: dict) -> None:
        risk = config.get("risk", {})
        trading = config.get("trading", {})

        total_capital = Decimal(str(config["trading"]["total_capital_usdc"]))
        max_dd_frac = Decimal(str(risk.get("max_drawdown_fraction", "0.10")))
        self.max_drawdown_usdc: Decimal = total_capital * max_dd_frac
        self.min_margin_ratio: Decimal = Decimal(str(risk.get("min_margin_ratio", "0.20")))

        # Open positions registry  {position_id: Position}
        self.positions: Dict[str, Position] = {}
        self.total_realised_pnl: Decimal = Decimal("0")
        self.trade_count: int = 0

        self._close_callback: Optional[Callable] = None

    # ------------------------------------------------------------------
    # Lifecycle (no-op for simplified risk manager — no background task)
    # ------------------------------------------------------------------

    async def start(self) -> None:
        log.info("risk_manager_started")

    async def stop(self) -> None:
        pass

    def on_close_required(self, callback: Callable) -> None:
        """Register callback: async def cb(pos, reason) → None"""
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
            hl_size=float(pos.hl_size),
            aster_size=float(pos.aster_size),
            entry_spread=float(pos.entry_spread),
        )

    def register_close(self, pos_id: str, realised_pnl: Decimal) -> None:
        pos = self.positions.get(pos_id)
        if pos:
            pos.is_open = False
            pos.close_time = time.time()
            pos.realised_pnl_usdc = realised_pnl
            self.total_realised_pnl += realised_pnl
            self.trade_count += 1
            log.info(
                "position_closed",
                pos_id=pos_id,
                symbol=pos.symbol,
                age_seconds=round(pos.age_seconds, 1),
                realised_pnl=float(realised_pnl),
                total_pnl=float(self.total_realised_pnl),
                reason=pos.close_reason.name if pos.close_reason else "UNKNOWN",
            )

    # ------------------------------------------------------------------
    # Pre-entry gate
    # ------------------------------------------------------------------

    def can_open_new(self) -> bool:
        """Returns False if the bot has hit the drawdown limit."""
        if self.total_realised_pnl < -self.max_drawdown_usdc:
            log.warning(
                "new_entry_blocked_drawdown_limit",
                total_pnl=float(self.total_realised_pnl),
                limit=-float(self.max_drawdown_usdc),
            )
            return False
        return True

    # ------------------------------------------------------------------
    # Leg imbalance detection
    # ------------------------------------------------------------------

    def check_leg_imbalance(
        self,
        symbol: str,
        hl_filled: bool,
        aster_filled: bool,
    ) -> bool:
        """
        Returns True (and logs critical alert) if exactly one leg filled.
        A partial fill creates naked directional exposure.
        """
        if hl_filled and not aster_filled:
            log.critical(
                "LEG_IMBALANCE: HL filled but Aster did NOT fill",
                symbol=symbol,
                action="emergency_unwind_hl_required",
            )
            return True
        if aster_filled and not hl_filled:
            log.critical(
                "LEG_IMBALANCE: Aster filled but HL did NOT fill",
                symbol=symbol,
                action="emergency_unwind_aster_required",
            )
            return True
        return False

    # ------------------------------------------------------------------
    # Summary / status
    # ------------------------------------------------------------------

    def summary(self) -> dict:
        open_pos = [p for p in self.positions.values() if p.is_open]
        return {
            "open_positions": len(open_pos),
            "trade_count": self.trade_count,
            "total_realised_pnl_usdc": float(self.total_realised_pnl),
            "max_drawdown_usdc": float(self.max_drawdown_usdc),
            "positions": [
                {
                    "id": p.id,
                    "symbol": p.symbol,
                    "age_seconds": round(p.age_seconds, 1),
                    "hl_side": "LONG" if p.hl_is_long else "SHORT",
                    "entry_spread": float(p.entry_spread),
                }
                for p in open_pos
            ],
        }
