"""
Hyperliquid × Aster — Settlement-Scheduled Funding Rate Arbitrage Bot
2026 Edition

Strategy overview
-----------------
Both Hyperliquid and Aster settle funding at the SAME time at every
8-hour boundary (00:00 / 08:00 / 16:00 UTC):
  - HL  : settles every 1 hour → always settles at these 8h boundaries too
  - Aster: settles every 8 hours for most pairs (BTC, ETH, SOL, BNB, ...)

At each 8-hour settlement window, one exchange's funding rate is higher
than the other.  We go SHORT on the high-rate side (collect funding) and
LONG on the low-rate side (pay less or receive), delta-neutral.

Execution timeline per cycle
-----------------------------
  T - 60s  Evaluate: check funding rates on all symbols. Pick best spread.
  T - 15s  Enter:    open both legs simultaneously (MARKET orders).
  T + 00s  Funding is collected/paid by both exchanges automatically.
  T + 15s  Exit:     close both legs simultaneously (MARKET orders).
  T + 30s  Report:   calculate P&L and send Telegram notification.
  T + 8h   Repeat.

Simulation mode
---------------
Set `simulation.enabled: true` in config.yaml to run without placing
any real orders.  Live market data is used; P&L is tracked hypothetically.
Telegram notifications include a [SIM] prefix.  No keys are required.

Key corrections vs. previous version
--------------------------------------
  1. Aster uses Binance-compatible REST API (https://fapi.asterdex.com),
     NOT web3 / smart contract calls.
  2. Aster default funding interval = 8h (not 1h as previously assumed).
  3. Fee rates corrected: HL maker 0.015%, Aster maker 0.005%.
  4. Strategy timing is settlement-driven, not continuous-scan.
"""
from __future__ import annotations

import asyncio
import datetime
import getpass
import os
import signal
import sys
import time
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

from utils.aster_client import AsterClient
from utils.fee_calculator import ArbOpportunity, FeeCalculator
from utils.hl_client import HyperliquidClient
from utils.logger import configure_logging, get_logger
from utils.risk_manager import CloseReason, Position, RiskManager
from utils.telegram_notifier import TelegramNotifier

CONFIG_PATH = Path(__file__).parent / "config.yaml"

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------

def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        cfg = yaml.safe_load(f)

    sim_mode: bool = cfg.get("simulation", {}).get("enabled", True)

    if sim_mode:
        # Simulation mode: no keys required
        cfg["_hl_private_key"] = ""
        cfg["_aster_api_key"] = ""
        cfg["_aster_api_secret"] = ""
        cfg["_telegram_bot_token"] = ""
        log.info("config_loaded_simulation_mode")
        return cfg

    # Live mode: decrypt all credentials
    from utils._crypto import decrypt as _decrypt

    password = os.environ.get("ARB_KEY_PASSWORD") or getpass.getpass(
        "Key decryption password: "
    )

    hl_enc = cfg["hyperliquid"].get("private_key_encrypted", "")
    aster_key_enc = cfg["aster"].get("api_key_encrypted", "")
    aster_sec_enc = cfg["aster"].get("api_secret_encrypted", "")
    tg_enc = cfg.get("telegram", {}).get("bot_token_encrypted", "")

    missing = []
    if not hl_enc:
        missing.append("hyperliquid.private_key_encrypted")
    if not aster_key_enc:
        missing.append("aster.api_key_encrypted")
    if not aster_sec_enc:
        missing.append("aster.api_secret_encrypted")

    if missing:
        sys.exit(
            "[FATAL] Missing encrypted credentials in config.yaml:\n  "
            + "\n  ".join(missing)
            + "\nRun: python utils/key_encryptor.py"
        )

    try:
        cfg["_hl_private_key"] = _decrypt(hl_enc, password)
        cfg["_aster_api_key"] = _decrypt(aster_key_enc, password)
        cfg["_aster_api_secret"] = _decrypt(aster_sec_enc, password)
        cfg["_telegram_bot_token"] = _decrypt(tg_enc, password) if tg_enc else ""
    except ValueError:
        sys.exit("[FATAL] Wrong decryption password or corrupted key.")

    log.info("config_loaded_live_mode")
    return cfg


# ---------------------------------------------------------------------------
# Arbitrage bot
# ---------------------------------------------------------------------------

class ArbitrageBot:

    def __init__(self, config: dict) -> None:
        self._cfg = config
        trading = config.get("trading", {})

        self._sim_mode: bool = config.get("simulation", {}).get("enabled", True)
        self._symbols: List[str] = config.get("symbols", {}).get("whitelist", ["BTC", "ETH"])
        self._blacklist: set = {s.upper() for s in config.get("symbols", {}).get("blacklist", [])}

        # Timing (seconds relative to settlement)
        self._evaluate_before: int = int(trading.get("evaluate_seconds_before_settlement", 60))
        self._entry_before: int = int(trading.get("entry_seconds_before_settlement", 15))
        self._exit_after: int = int(trading.get("exit_seconds_after_settlement", 15))

        self._max_open: int = int(trading.get("max_open_positions", 2))
        self._total_capital: Decimal = Decimal(str(trading.get("total_capital_usdc", 166)))

        # Clients
        self._hl = HyperliquidClient(config)
        self._aster = AsterClient(config)
        self._fee_calc = FeeCalculator(config)
        self._risk = RiskManager(config)
        self._telegram = TelegramNotifier(config)

        # State
        self._open_positions: Dict[str, Position] = {}  # symbol → Position
        self._total_pnl: Decimal = Decimal("0")
        self._trade_count: int = 0
        self._running = False

        # Simulated balance (for Telegram reports in SIM mode)
        self._sim_hl_balance: Decimal = self._total_capital / 2
        self._sim_aster_balance: Decimal = self._total_capital / 2

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        self._running = True

        tradeable = [s for s in self._symbols if s.upper() not in self._blacklist]

        await self._hl.start(tradeable)
        await self._aster.start(tradeable)
        await asyncio.sleep(3)   # Let WebSocket/poll deliver first data
        await self._risk.start()

        mode_label = "SIMULATION" if self._sim_mode else "LIVE TRADING"
        log.info(
            "bot_started",
            mode=mode_label,
            symbols=tradeable,
            capital_usdc=float(self._total_capital),
        )
        await self._telegram.notify_startup(self._sim_mode, float(self._total_capital))

    async def stop(self) -> None:
        self._running = False
        await asyncio.gather(
            self._hl.stop(),
            self._aster.stop(),
            self._risk.stop(),
            return_exceptions=True,
        )
        await self._telegram.notify_shutdown(self._total_pnl, self._trade_count)
        log.info(
            "bot_stopped",
            total_pnl=float(self._total_pnl),
            trade_count=self._trade_count,
        )

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        await self.start()
        try:
            while self._running:
                await self._run_settlement_cycle()
        except asyncio.CancelledError:
            pass
        finally:
            await self.stop()

    async def _run_settlement_cycle(self) -> None:
        """
        Execute one full settlement cycle:
          sleep → evaluate → sleep → enter → sleep → exit → report → repeat
        """
        # 1. Determine next Aster settlement time
        settlement_ms = self._get_next_settlement_ms()
        if settlement_ms is None:
            log.info("waiting_for_aster_data", sleep_seconds=15)
            await asyncio.sleep(15)
            return

        settlement_dt = datetime.datetime.utcfromtimestamp(settlement_ms / 1000)
        now_ms = int(time.time() * 1000)
        wait_to_evaluate = max(0, (settlement_ms - self._evaluate_before * 1000 - now_ms) / 1000)

        log.info(
            "next_settlement",
            settlement_utc=settlement_dt.strftime("%Y-%m-%d %H:%M:%S"),
            sleep_until_evaluate_s=round(wait_to_evaluate, 1),
        )

        # 2. Sleep until T-60s
        if wait_to_evaluate > 0:
            await asyncio.sleep(wait_to_evaluate)

        if not self._running:
            return

        # 3. Evaluate opportunities
        if len(self._open_positions) >= self._max_open or not self._risk.can_open_new():
            log.info("cycle_skipped_gates_blocked")
            await self._sleep_until_ms(settlement_ms + self._exit_after * 1000 + 5000)
            return

        opp = await self._find_best_opportunity()

        if opp is None or not opp.is_profitable:
            spread_info = (
                f"best spread {float(opp.net_spread)*100:.4f}% < "
                f"threshold {float(self._fee_calc.min_net_spread)*100:.4f}%"
                if opp else "no data available"
            )
            log.info("cycle_skipped_no_opportunity", reason=spread_info)
            next_cycle_dt = settlement_dt + datetime.timedelta(hours=8)
            await self._telegram.notify_skipped(
                reason=spread_info,
                next_check_utc=next_cycle_dt - datetime.timedelta(seconds=self._evaluate_before),
            )
            # Sleep until this settlement is past (to avoid immediate re-evaluation)
            await self._sleep_until_ms(settlement_ms + self._exit_after * 1000 + 5000)
            return

        # 4. Notify about upcoming opportunity
        await self._telegram.notify_opportunity(
            symbol=opp.symbol,
            hl_rate=opp.hl_funding_rate,
            aster_rate=opp.aster_funding_rate,
            net_spread=opp.net_spread,
            expected_profit_usdc=opp.expected_profit_usdc,
            settlement_utc=settlement_dt,
        )

        # 5. Sleep until T-15s (entry window)
        await self._sleep_until_ms(settlement_ms - self._entry_before * 1000)
        if not self._running:
            return

        # 6. Execute both legs simultaneously
        position = await self._execute_entry(opp, settlement_ms)
        if position is None:
            # Entry failed; wait out this settlement
            await self._sleep_until_ms(settlement_ms + self._exit_after * 1000 + 5000)
            return

        await self._telegram.notify_entry(
            symbol=position.symbol,
            hl_side="LONG" if position.hl_is_long else "SHORT",
            aster_side="SHORT" if position.hl_is_long else "LONG",
            hl_size=position.hl_size,
            aster_size=position.aster_size,
            hl_price=position.entry_hl_price,
            aster_price=position.entry_aster_price,
            notional_usdc=position.hl_notional,
        )

        # 7. Sleep until T+15s (exit window)
        await self._sleep_until_ms(settlement_ms + self._exit_after * 1000)
        if not self._running:
            return

        # 8. Close both legs and calculate P&L
        pnl_breakdown = await self._execute_exit(position)
        self._total_pnl += pnl_breakdown["net_pnl"]
        self._trade_count += 1

        # Update simulated balances
        half_pnl = pnl_breakdown["net_pnl"] / 2
        self._sim_hl_balance += half_pnl
        self._sim_aster_balance += half_pnl

        # Report
        hl_bal, aster_bal = await self._get_balances()
        await self._telegram.notify_settlement(
            symbol=position.symbol,
            hl_funding_captured=pnl_breakdown["hl_funding"],
            aster_funding_captured=pnl_breakdown["aster_funding"],
            fees_paid=pnl_breakdown["fees"],
            net_pnl=pnl_breakdown["net_pnl"],
            total_session_pnl=self._total_pnl,
            hl_balance=hl_bal,
            aster_balance=aster_bal,
        )

        # Small pause before the next cycle
        await asyncio.sleep(5)

    # ------------------------------------------------------------------
    # Opportunity finding
    # ------------------------------------------------------------------

    async def _find_best_opportunity(self) -> Optional[ArbOpportunity]:
        """Evaluate all tradeable symbols and return the best opportunity."""
        best: Optional[ArbOpportunity] = None

        for symbol in self._symbols:
            sym = symbol.upper()
            if sym in self._blacklist or sym in self._open_positions:
                continue

            hl_rate = self._hl.get_funding_rate(sym)
            aster_rate = self._aster.get_funding_rate(sym)
            hl_price = self._hl.get_mid_price(sym)
            aster_price = self._aster.get_mid_price(sym)

            if any(v is None for v in [hl_rate, aster_rate, hl_price, aster_price]):
                log.debug("symbol_data_missing", symbol=sym)
                continue
            if hl_price == 0 or aster_price == 0:
                continue

            # Determine direction: SHORT the high-rate side, LONG the low-rate side
            # hl_is_long = True  → HL LONG + Aster SHORT → collect Aster funding (if Aster > HL)
            # hl_is_long = False → HL SHORT + Aster LONG → collect HL funding (if HL > Aster)
            hl_is_long = aster_rate > hl_rate

            opp = ArbOpportunity(
                symbol=sym,
                hl_funding_rate=hl_rate,
                aster_funding_rate=aster_rate,
                hl_is_long=hl_is_long,
                hl_price=hl_price,
                aster_price=aster_price,
                funding_interval_hours=Decimal(
                    str(self._cfg["aster"].get("default_funding_interval_hours", 8))
                ),
            )
            self._fee_calc.evaluate(opp)

            if not opp.is_profitable:
                continue

            # Compute sizes
            hl_params = self._hl.get_size_params(sym)
            aster_params = self._aster.get_size_params(sym)
            if not hl_params or not aster_params:
                continue

            self._fee_calc.compute_sizes(opp, hl_params, aster_params)
            if not opp.is_profitable:
                continue

            if best is None or opp.net_spread > best.net_spread:
                best = opp

        return best

    # ------------------------------------------------------------------
    # Entry execution
    # ------------------------------------------------------------------

    async def _execute_entry(
        self,
        opp: ArbOpportunity,
        settlement_ms: int,
    ) -> Optional[Position]:
        """
        Open both legs simultaneously.
        In simulation mode: no real orders; record entry prices only.
        Returns Position on success, None on failure.
        """
        symbol = opp.symbol
        hl_is_long = opp.hl_is_long
        aster_is_long = not hl_is_long

        log.info(
            "executing_entry",
            symbol=symbol,
            sim=self._sim_mode,
            hl_side="LONG" if hl_is_long else "SHORT",
            aster_side="LONG" if aster_is_long else "SHORT",
            hl_size=float(opp.hl_size),
            aster_size=float(opp.aster_size),
            net_spread=float(opp.net_spread),
        )

        if self._sim_mode:
            # Simulation: just record entry, no real orders
            hl_filled = True
            aster_filled = True
        else:
            # Live: set leverage then submit both legs in parallel
            try:
                await self._hl.set_leverage(symbol)
            except Exception as exc:
                log.warning("hl_set_leverage_failed", symbol=symbol, error=str(exc))

            hl_result, aster_result = await asyncio.gather(
                self._hl.place_order(symbol, hl_is_long, opp.hl_size),
                self._aster.place_order(symbol, aster_is_long, opp.aster_size),
                return_exceptions=True,
            )

            hl_filled = not isinstance(hl_result, Exception)
            aster_filled = not isinstance(aster_result, Exception)

            if isinstance(hl_result, Exception):
                log.error("hl_entry_failed", symbol=symbol, error=str(hl_result))
            if isinstance(aster_result, Exception):
                log.error("aster_entry_failed", symbol=symbol, error=str(aster_result))

        # Check for leg imbalance (one side filled, other did not)
        if self._risk.check_leg_imbalance(symbol, hl_filled, aster_filled):
            await self._emergency_unwind(symbol, hl_filled, aster_filled, opp)
            await self._telegram.notify_error(
                error=f"Leg imbalance on {symbol} — emergency unwind triggered",
                context="Entry Failure",
            )
            return None

        if not (hl_filled and aster_filled):
            log.warning("both_legs_failed", symbol=symbol)
            return None

        pos_id = f"{symbol}_{int(time.time())}"
        pos = Position(
            id=pos_id,
            symbol=symbol,
            hl_is_long=hl_is_long,
            hl_size=opp.hl_size,
            aster_size=opp.aster_size,
            hl_notional=opp.hl_notional,
            aster_notional=opp.aster_notional,
            entry_spread=opp.net_spread,
            entry_hl_price=opp.hl_price,
            entry_aster_price=opp.aster_price,
            settlement_time_ms=settlement_ms,
        )
        self._risk.register_open(pos)
        self._open_positions[symbol] = pos

        log.info(
            "entry_complete",
            pos_id=pos_id,
            symbol=symbol,
            hl_price=float(opp.hl_price),
            aster_price=float(opp.aster_price),
        )
        return pos

    # ------------------------------------------------------------------
    # Exit execution
    # ------------------------------------------------------------------

    async def _execute_exit(self, pos: Position) -> dict:
        """
        Close both legs simultaneously.
        In simulation mode: no real orders; prices from market data.
        Returns a P&L breakdown dict.
        """
        symbol = pos.symbol
        hl_is_long = pos.hl_is_long

        # Snapshot prices at exit
        exit_hl_price = self._hl.get_mid_price(symbol) or pos.entry_hl_price
        exit_aster_price = self._aster.get_mid_price(symbol) or pos.entry_aster_price
        pos.exit_hl_price = exit_hl_price
        pos.exit_aster_price = exit_aster_price

        log.info(
            "executing_exit",
            symbol=symbol,
            sim=self._sim_mode,
            exit_hl_price=float(exit_hl_price),
            exit_aster_price=float(exit_aster_price),
        )

        if not self._sim_mode:
            hl_result, aster_result = await asyncio.gather(
                self._hl.close_position(symbol, not hl_is_long, pos.hl_size),
                self._aster.close_position(symbol, hl_is_long, pos.aster_size),
                return_exceptions=True,
            )
            if isinstance(hl_result, Exception):
                log.error("hl_exit_failed", symbol=symbol, error=str(hl_result))
                await self._telegram.notify_error(
                    f"HL exit failed for {symbol}: {hl_result}", "Exit Error"
                )
            if isinstance(aster_result, Exception):
                log.error("aster_exit_failed", symbol=symbol, error=str(aster_result))
                await self._telegram.notify_error(
                    f"Aster exit failed for {symbol}: {aster_result}", "Exit Error"
                )

        # P&L calculation
        pnl = self._calculate_pnl(pos, exit_hl_price, exit_aster_price)

        pos.close_reason = CloseReason.SETTLEMENT_SCHEDULED
        self._risk.register_close(pos.id, pnl["net_pnl"])
        self._open_positions.pop(symbol, None)

        log.info(
            "exit_complete",
            pos_id=pos.id,
            symbol=symbol,
            net_pnl=float(pnl["net_pnl"]),
            hl_funding=float(pnl["hl_funding"]),
            aster_funding=float(pnl["aster_funding"]),
            fees=float(pnl["fees"]),
        )
        return pnl

    def _calculate_pnl(
        self,
        pos: Position,
        exit_hl_price: Decimal,
        exit_aster_price: Decimal,
    ) -> dict:
        """
        Compute realised P&L for a completed round trip.

        P&L components:
          1. Funding captured at settlement:
             - HL:    funding_rate × hl_notional    (sign depends on direction)
             - Aster: funding_rate × aster_notional  (sign depends on direction)
          2. Price change P&L:
             - HL LONG:   (exit - entry) × hl_size      → positive if price up
             - Aster SHORT: (entry - exit) × aster_size → positive if price down
             These cancel if sizes are equal; small residual from sizing diff.
          3. Round-trip fees: taker × 2 × notional for each exchange.

        Note: For positions held only 30 seconds, funding dominates.
        Price change is minimal and largely delta-neutral.
        """
        hl_rate = self._hl.get_funding_rate(pos.symbol) or Decimal("0")
        aster_rate = self._aster.get_funding_rate(pos.symbol) or Decimal("0")

        # Funding P&L
        # If hl_is_long: we pay HL funding and receive Aster funding (Aster > HL direction)
        # Funding payment: positive = received by us, negative = paid by us
        if pos.hl_is_long:
            hl_funding = -hl_rate * pos.hl_notional        # long pays if rate > 0
            aster_funding = aster_rate * pos.aster_notional  # short receives if rate > 0
        else:
            hl_funding = hl_rate * pos.hl_notional           # short receives if rate > 0
            aster_funding = -aster_rate * pos.aster_notional  # long pays if rate > 0

        # Price change P&L (should be near-zero for delta-neutral 30s hold)
        if pos.hl_is_long:
            hl_price_pnl = (exit_hl_price - pos.entry_hl_price) * pos.hl_size
            aster_price_pnl = (pos.entry_aster_price - exit_aster_price) * pos.aster_size
        else:
            hl_price_pnl = (pos.entry_hl_price - exit_hl_price) * pos.hl_size
            aster_price_pnl = (exit_aster_price - pos.entry_aster_price) * pos.aster_size

        # Fees: taker open + taker close on both exchanges
        fees = self._fee_calc.compute_round_trip_fees_usdc(pos.hl_notional)

        net_pnl = hl_funding + aster_funding + hl_price_pnl + aster_price_pnl - fees

        return {
            "hl_funding": hl_funding,
            "aster_funding": aster_funding,
            "hl_price_pnl": hl_price_pnl,
            "aster_price_pnl": aster_price_pnl,
            "fees": fees,
            "net_pnl": net_pnl,
        }

    # ------------------------------------------------------------------
    # Emergency unwind (leg imbalance)
    # ------------------------------------------------------------------

    async def _emergency_unwind(
        self,
        symbol: str,
        hl_filled: bool,
        aster_filled: bool,
        opp: ArbOpportunity,
    ) -> None:
        """Close whichever leg filled to eliminate naked exposure."""
        log.critical("emergency_unwind_start", symbol=symbol)
        if self._sim_mode:
            log.info("emergency_unwind_sim_no_action", symbol=symbol)
            return

        tasks = []
        if hl_filled:
            tasks.append(
                self._hl.close_position(symbol, not opp.hl_is_long, opp.hl_size)
            )
        if aster_filled:
            tasks.append(
                self._aster.close_position(symbol, opp.hl_is_long, opp.aster_size)
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                log.critical(
                    "emergency_unwind_failed",
                    symbol=symbol,
                    leg=i,
                    error=str(r),
                )
            else:
                log.info("emergency_unwind_leg_closed", symbol=symbol, leg=i)

    # ------------------------------------------------------------------
    # Balance helpers
    # ------------------------------------------------------------------

    async def _get_balances(self) -> Tuple[Decimal, Decimal]:
        if self._sim_mode:
            return self._sim_hl_balance, self._sim_aster_balance

        hl_bal = Decimal("0")
        aster_bal = Decimal("0")
        try:
            hl_state = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self._hl._info.user_state(self._hl._wallet_address),
            )
            hl_bal = Decimal(str(
                hl_state.get("crossMarginSummary", {}).get("accountValue", "0")
            ))
        except Exception as exc:
            log.warning("hl_balance_fetch_failed", error=str(exc))

        try:
            aster_bal = await self._aster.get_balance()
        except Exception as exc:
            log.warning("aster_balance_fetch_failed", error=str(exc))

        return hl_bal, aster_bal

    # ------------------------------------------------------------------
    # Timing helpers
    # ------------------------------------------------------------------

    def _get_next_settlement_ms(self) -> Optional[int]:
        """
        Get the soonest upcoming settlement time (ms UTC) across all symbols.
        Uses Aster's nextFundingTime as the authoritative source.
        HL always settles at the top of every hour, so it's guaranteed to
        settle at the same instant.
        """
        candidates = []
        for sym in self._symbols:
            t = self._aster.get_next_funding_time(sym.upper())
            if t and t > int(time.time() * 1000) + 30_000:  # must be > 30s away
                candidates.append(t)

        if not candidates:
            return None

        # Return the soonest settlement
        return min(candidates)

    async def _sleep_until_ms(self, target_ms: int) -> None:
        """Sleep until the given UTC millisecond timestamp."""
        now_ms = int(time.time() * 1000)
        wait_s = max(0, (target_ms - now_ms) / 1000)
        if wait_s > 0:
            await asyncio.sleep(wait_s)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    cfg = load_config()

    log_cfg = cfg.get("logging", {})
    configure_logging(
        level=log_cfg.get("level", "INFO"),
        log_file=log_cfg.get("log_file", "logs/arb_bot.log"),
        max_bytes=int(log_cfg.get("max_bytes", 10_485_760)),
        backup_count=int(log_cfg.get("backup_count", 5)),
        json_logs=bool(log_cfg.get("json_logs", False)),
    )

    bot = ArbitrageBot(cfg)

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
