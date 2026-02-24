"""
Hyperliquid <> Aster Cross-Exchange Funding Rate Arbitrage Bot
2026 Edition — optimised for 166 USDC small-capital accounts.

Startup sequence
----------------
1. Load & decrypt config  (ARB_KEY_PASSWORD env var required)
2. Initialise HL client   (WebSocket + REST)
3. Initialise Aster client (web3.py polling)
4. Start RiskManager monitor loop
5. Run main arbitrage scan loop

Execution model
---------------
- Uses asyncio.gather() for ALL dual-leg order submissions to minimise
  leg-in risk (both orders are sent in the same event-loop tick).
- Maker-first: Post-Only limits are tried; if not filled in N seconds the
  bot cancels and re-submits an aggressive limit at mid ± slippage_bps.
- Delta-neutral: HL long + Aster short  OR  HL short + Aster long.

Fee model (per brief)
----------------------
Expected_Profit = (Funding_Rate_Diff × Hours)
                − (0.00045 × 2 × Leverage + 0.0004 × 2 × Leverage)
                − gas_cost / notional
"""
from __future__ import annotations

import asyncio
import base64
import getpass
import os
import signal
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import Dict, Optional

import yaml
from cryptography.fernet import Fernet, InvalidToken

from utils.logger import configure_logging, get_logger
from utils.fee_calculator import ArbOpportunity, FeeCalculator
from utils.hl_client import HyperliquidClient
from utils.aster_client import AsterClient, GasLimitExceededError
from utils.risk_manager import CloseReason, Position, RiskManager

# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

CONFIG_PATH = Path(__file__).parent / "config.yaml"

log = get_logger(__name__)


def _load_raw_config() -> dict:
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)


def _decrypt_key(encrypted: str, fernet: Fernet) -> str:
    try:
        return fernet.decrypt(encrypted.encode()).decode()
    except InvalidToken:
        sys.exit("[FATAL] Incorrect decryption password or corrupted key.")


def load_config() -> dict:
    """
    Load config.yaml and decrypt private keys using the password stored in
    the ARB_KEY_PASSWORD environment variable (or prompt interactively).
    """
    cfg = _load_raw_config()

    password = os.environ.get("ARB_KEY_PASSWORD")
    if not password:
        password = getpass.getpass("Enter key decryption password: ")

    # Derive a Fernet key from the password (simple SHA-256 + base64 scheme)
    import hashlib
    key_bytes = hashlib.sha256(password.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    fernet = Fernet(fernet_key)

    hl_enc = cfg.get("hyperliquid", {}).get("private_key_encrypted", "")
    aster_enc = cfg.get("aster", {}).get("private_key_encrypted", "")

    if not hl_enc or not aster_enc:
        sys.exit(
            "[FATAL] private_key_encrypted fields are empty in config.yaml.\n"
            "Run:  python utils/key_encryptor.py  to encrypt your keys first."
        )

    cfg["_hl_private_key"] = _decrypt_key(hl_enc, fernet)
    cfg["_aster_private_key"] = _decrypt_key(aster_enc, fernet)
    return cfg


# ---------------------------------------------------------------------------
# Token map — maps symbol names to Aster index token addresses.
# Populate this from Aster's official token list.
# ---------------------------------------------------------------------------
DEFAULT_TOKEN_MAP: Dict[str, str] = {
    "BTC":  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",  # WBTC placeholder
    "ETH":  "0x4200000000000000000000000000000000000006",  # WETH placeholder
    "SOL":  "0x...",
    "BNB":  "0x...",
    "ARB":  "0x...",
}


# ---------------------------------------------------------------------------
# Main arbitrage engine
# ---------------------------------------------------------------------------

class ArbitrageBot:

    def __init__(self, config: dict) -> None:
        self._cfg = config
        trading = config.get("trading", {})

        self.max_open_positions: int = int(trading.get("max_open_positions", 2))
        self.blacklist: set[str] = {s.upper() for s in config.get("blacklist_symbols", [])}
        self.whitelist: set[str] = {s.upper() for s in config.get("whitelist_symbols", [])}

        self._hl = HyperliquidClient(config)
        self._aster = AsterClient(config)
        self._fee_calc = FeeCalculator(config)
        self._risk = RiskManager(config, self._hl, self._aster)

        self._risk.on_close_required(self._on_close_required)

        self._open_positions: Dict[str, Position] = {}
        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        self._running = True

        # Bootstrap HL WebSocket + meta
        candidates = self._get_candidate_symbols_initial()
        await self._hl.start(candidates)

        # Bootstrap Aster polling (pass only the symbols we have addresses for)
        aster_token_map = {s: a for s, a in DEFAULT_TOKEN_MAP.items() if a and "0x." not in a}
        await self._aster.start(aster_token_map)

        # Small delay to let first WebSocket messages arrive
        await asyncio.sleep(3)

        await self._risk.start()
        log.info("arbitrage_bot_started")

    async def stop(self) -> None:
        self._running = False
        log.info("arbitrage_bot_stopping")
        await asyncio.gather(self._hl.stop(), self._aster.stop(), self._risk.stop())

    # ------------------------------------------------------------------
    # Main scan loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        await self.start()
        try:
            while self._running:
                await self._scan_and_execute()
                await asyncio.sleep(2)  # scan every 2 seconds
        except asyncio.CancelledError:
            pass
        finally:
            await self.stop()

    async def _scan_and_execute(self) -> None:
        """Find the best opportunity and execute if conditions are met."""
        if len(self._open_positions) >= self.max_open_positions:
            return

        if not self._risk.can_open_new():
            return

        best = await self._find_best_opportunity()
        if best is None:
            return

        log.info(
            "opportunity_found",
            symbol=best.symbol,
            net_spread=float(best.net_spread),
            expected_profit_usdc=float(best.expected_profit_usdc),
            hl_is_long=best.hl_is_long,
        )

        await self._execute(best)

    # ------------------------------------------------------------------
    # Opportunity scanner
    # ------------------------------------------------------------------

    async def _find_best_opportunity(self) -> Optional[ArbOpportunity]:
        symbols = self._get_tradeable_symbols()
        best: Optional[ArbOpportunity] = None

        for sym in symbols:
            # Skip already open positions
            if sym in self._open_positions:
                continue

            opp = await self._evaluate_symbol(sym)
            if opp is None or not opp.is_profitable:
                continue

            # Include Aster margin asset yield in total return
            margin_apy = await self._aster.get_margin_asset_apy()
            adjusted = self._fee_calc.margin_asset_adjusted_spread(
                opp.net_spread,
                margin_apy,
                opp.funding_interval_hours,
            )
            opp.net_spread = adjusted  # reflect yield bonus

            if best is None or opp.net_spread > best.net_spread:
                best = opp

        return best

    async def _evaluate_symbol(self, symbol: str) -> Optional[ArbOpportunity]:
        hl_rate = self._hl.get_funding_rate(symbol)
        aster_rate = self._aster.get_funding_rate(symbol)
        hl_price = self._hl.get_mid_price(symbol)
        aster_price = self._aster.get_mid_price(symbol)

        if any(v is None for v in [hl_rate, aster_rate, hl_price, aster_price]):
            return None

        # Determine direction: go long on the side with negative funding (you receive)
        # HL long + Aster short → when HL funding < 0 (longs receive) AND Aster > 0 (shorts receive)
        # Otherwise flip.
        if aster_rate > hl_rate:
            hl_is_long = True   # HL longs receive; Aster shorts receive
        else:
            hl_is_long = False  # HL shorts receive; Aster longs receive

        opp = ArbOpportunity(
            symbol=symbol,
            hl_funding_rate=hl_rate,
            aster_funding_rate=aster_rate,
            hl_is_long=hl_is_long,
            hl_price=hl_price,
            aster_price=aster_price,
            funding_interval_hours=Decimal(str(
                self._cfg["trading"].get("aster_funding_interval_hours", 8)
            )),
        )

        # Evaluate fees and spread
        self._fee_calc.evaluate(opp)
        if not opp.is_profitable:
            return opp

        # Compute aligned sizes
        hl_params = self._hl.get_size_params(symbol)
        aster_params = self._aster.get_size_params(symbol)
        if not hl_params or not aster_params:
            return None

        self._fee_calc.compute_sizes(opp, hl_params, aster_params)
        return opp

    # ------------------------------------------------------------------
    # Trade execution (atomic-like with asyncio.gather)
    # ------------------------------------------------------------------

    async def _execute(self, opp: ArbOpportunity) -> None:
        """
        Submit both legs simultaneously using asyncio.gather.
        If either leg fails, attempt to unwind the other.
        """
        symbol = opp.symbol
        hl_is_long = opp.hl_is_long
        aster_is_long = not hl_is_long  # always delta-neutral

        log.info(
            "executing_arb",
            symbol=symbol,
            hl_side="LONG" if hl_is_long else "SHORT",
            aster_side="LONG" if aster_is_long else "SHORT",
            hl_size=float(opp.hl_size),
            aster_notional=float(opp.aster_notional),
        )

        # Set leverage before ordering (idempotent if already set)
        try:
            await self._hl.set_leverage(symbol)
        except Exception as exc:
            log.warning("hl_set_leverage_failed", symbol=symbol, error=str(exc))

        # --- Simultaneous dual-leg submission ---
        hl_result = None
        aster_result = None
        hl_filled = False
        aster_filled = False

        try:
            hl_task = self._hl.place_order(symbol, hl_is_long, opp.hl_size)
            aster_task = self._aster.place_order(symbol, aster_is_long, opp.aster_notional)

            results = await asyncio.gather(hl_task, aster_task, return_exceptions=True)
            hl_result, aster_result = results

            hl_filled = not isinstance(hl_result, Exception)
            aster_filled = not isinstance(aster_result, Exception)

        except Exception as exc:
            log.error("execute_gather_error", symbol=symbol, error=str(exc))
            return

        # Log any individual failures
        if isinstance(hl_result, Exception):
            log.error("hl_order_failed", symbol=symbol, error=str(hl_result))
        if isinstance(aster_result, Exception):
            log.error("aster_order_failed", symbol=symbol, error=str(aster_result))

        # Check for dangerous single-leg exposure
        imbalance = await self._risk.check_leg_imbalance(symbol, hl_filled, aster_filled)
        if imbalance:
            # One leg filled but not the other — emergency unwind the filled side
            await self._emergency_unwind(symbol, hl_filled, aster_filled, opp)
            return

        if not (hl_filled and aster_filled):
            log.warning("both_legs_failed", symbol=symbol)
            return

        # Register the position with the risk manager
        pos_id = f"{symbol}_{int(time.time())}"
        pos = Position(
            id=pos_id,
            symbol=symbol,
            hl_is_long=hl_is_long,
            hl_size=opp.hl_size,
            aster_size_usdc=opp.aster_notional,
            entry_spread=opp.net_spread,
            entry_hl_price=opp.hl_price,
            entry_aster_price=opp.aster_price,
        )
        self._risk.register_open(pos)
        self._risk.positions[pos_id] = pos
        self._open_positions[symbol] = pos

        log.info(
            "position_opened",
            pos_id=pos_id,
            symbol=symbol,
            hl_side="LONG" if hl_is_long else "SHORT",
            aster_side="LONG" if aster_is_long else "SHORT",
            entry_spread=float(opp.net_spread),
            expected_profit_usdc=float(opp.expected_profit_usdc),
        )

    async def _emergency_unwind(
        self,
        symbol: str,
        hl_filled: bool,
        aster_filled: bool,
        opp: ArbOpportunity,
    ) -> None:
        """Close whichever leg was filled to restore delta-neutral state."""
        log.critical("emergency_unwind", symbol=symbol)
        if hl_filled:
            try:
                await self._hl.close_position(symbol, not opp.hl_is_long, opp.hl_size)
                log.info("hl_emergency_unwind_ok", symbol=symbol)
            except Exception as exc:
                log.critical("hl_emergency_unwind_failed", symbol=symbol, error=str(exc))
        if aster_filled:
            try:
                await self._aster.close_position(symbol, not opp.hl_is_long, opp.aster_notional)
                log.info("aster_emergency_unwind_ok", symbol=symbol)
            except Exception as exc:
                log.critical("aster_emergency_unwind_failed", symbol=symbol, error=str(exc))

    # ------------------------------------------------------------------
    # Close handler (called by RiskManager)
    # ------------------------------------------------------------------

    async def _on_close_required(self, pos: Position, reason: CloseReason) -> None:
        symbol = pos.symbol
        log.info(
            "closing_position",
            pos_id=pos.id,
            symbol=symbol,
            reason=reason.name,
        )

        hl_close_task = self._hl.close_position(
            symbol,
            is_buy=not pos.hl_is_long,  # reverse the open direction
            size=pos.hl_size,
        )
        aster_close_task = self._aster.close_position(
            symbol,
            is_long=pos.hl_is_long,  # Aster side was opposite
            size_usdc=pos.aster_size_usdc,
        )

        results = await asyncio.gather(hl_close_task, aster_close_task, return_exceptions=True)
        hl_res, aster_res = results

        if isinstance(hl_res, Exception):
            log.error("hl_close_failed", pos_id=pos.id, error=str(hl_res))
        if isinstance(aster_res, Exception):
            log.error("aster_close_failed", pos_id=pos.id, error=str(aster_res))

        # Approximate PnL (funding received minus fees; exact calc needs trade history)
        realised_pnl = Decimal("0")  # TODO: pull from trade receipts
        self._risk.register_close(pos.id, realised_pnl)
        self._open_positions.pop(symbol, None)

    # ------------------------------------------------------------------
    # Symbol filtering
    # ------------------------------------------------------------------

    def _get_tradeable_symbols(self) -> list[str]:
        hl_symbols = set(self._hl.available_symbols)
        aster_symbols = set(self._aster._token_map.keys())
        common = hl_symbols & aster_symbols

        if self.whitelist:
            common &= self.whitelist

        return sorted(common - self.blacklist)

    def _get_candidate_symbols_initial(self) -> list[str]:
        """
        Best-effort symbol list for HL WebSocket subscription at startup.
        We subscribe to all non-blacklisted symbols to ensure funding rate
        data is available when the first scan runs.
        """
        if self.whitelist:
            return sorted(self.whitelist)
        # Default to the most liquid perpetuals to keep WS overhead low
        return [
            "BTC", "ETH", "SOL", "BNB", "ARB", "OP", "AVAX",
            "LINK", "MATIC", "SUI", "APT", "INJ", "TIA",
        ]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    cfg = load_config()

    # Configure logging from config
    log_cfg = cfg.get("logging", {})
    configure_logging(
        level=log_cfg.get("level", "INFO"),
        log_file=log_cfg.get("log_file", "logs/arb_bot.log"),
        max_bytes=int(log_cfg.get("max_bytes", 10_485_760)),
        backup_count=int(log_cfg.get("backup_count", 5)),
        json_logs=bool(log_cfg.get("json_logs", False)),
    )

    bot = ArbitrageBot(cfg)

    # Graceful shutdown on SIGINT / SIGTERM
    loop = asyncio.get_event_loop()

    def _shutdown(sig_name: str) -> None:
        log.info("shutdown_signal_received", signal=sig_name)
        bot._running = False

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda s=sig.name: _shutdown(s))

    try:
        await bot.run()
    except Exception as exc:
        log.critical("bot_crashed", error=str(exc), exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())
