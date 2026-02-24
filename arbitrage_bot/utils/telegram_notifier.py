"""
Telegram notification module for the arbitrage bot.

Sends structured messages in Traditional Chinese (or English) to a
Telegram chat/group. Used to report:
  - 🎯  Opportunity detected (T-60s)
  - ⚡  Entry executed (both legs opened)
  - ✅/❌  Settlement result (funding captured, P&L, wallet balances)
  - 🚨  Critical errors

In simulation mode all messages are prefixed with [SIM].

Configuration (config.yaml):
  telegram:
    enabled: true
    bot_token_encrypted: "<encrypted token>"
    chat_id: "<your chat_id>"
    language: "zh"  # or "en"
"""
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Optional

import aiohttp

from .logger import get_logger

log = get_logger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


class TelegramNotifier:
    """
    Async Telegram notifier.

    All send methods are fire-and-forget (errors are logged but not raised)
    so that notification failures never interrupt the trading loop.
    """

    def __init__(self, config: dict) -> None:
        tg_cfg = config.get("telegram", {})
        self._enabled: bool = tg_cfg.get("enabled", False)
        self._bot_token: str = config.get("_telegram_bot_token", "")
        self._chat_id: str = str(tg_cfg.get("chat_id", ""))
        self._lang: str = tg_cfg.get("language", "zh")
        self._sim_mode: bool = config.get("simulation", {}).get("enabled", True)

        # Disable if token or chat_id is missing
        if not self._bot_token or not self._chat_id:
            self._enabled = False

    # ------------------------------------------------------------------
    # Public notification methods
    # ------------------------------------------------------------------

    async def notify_opportunity(
        self,
        symbol: str,
        hl_rate: Decimal,
        aster_rate: Decimal,
        net_spread: Decimal,
        expected_profit_usdc: Decimal,
        settlement_utc: datetime.datetime,
    ) -> None:
        """Called at T-60s when a profitable opportunity is found."""
        if self._lang == "zh":
            msg = (
                f"{self._sim_prefix()}🎯 <b>套利機會</b>\n"
                f"幣種：{symbol}/USDT\n"
                f"HL 資金費率：{float(hl_rate)*100:.4f}%\n"
                f"Aster 資金費率：{float(aster_rate)*100:.4f}%\n"
                f"淨利差（扣費後）：{float(net_spread)*100:.4f}%\n"
                f"預估利潤：<b>${float(expected_profit_usdc):.4f} USDC</b>\n"
                f"結算時間（UTC）：{settlement_utc.strftime('%H:%M:%S')}\n"
                f"⏱ 約 60 秒後進場"
            )
        else:
            msg = (
                f"{self._sim_prefix()}🎯 <b>Opportunity Found</b>\n"
                f"Symbol: {symbol}/USDT\n"
                f"HL Rate: {float(hl_rate)*100:.4f}%\n"
                f"Aster Rate: {float(aster_rate)*100:.4f}%\n"
                f"Net Spread: {float(net_spread)*100:.4f}%\n"
                f"Est. Profit: <b>${float(expected_profit_usdc):.4f} USDC</b>\n"
                f"Settlement (UTC): {settlement_utc.strftime('%H:%M:%S')}\n"
                f"⏱ Entry in ~60s"
            )
        await self._send(msg)

    async def notify_entry(
        self,
        symbol: str,
        hl_side: str,
        aster_side: str,
        hl_size: Decimal,
        aster_size: Decimal,
        hl_price: Decimal,
        aster_price: Decimal,
        notional_usdc: Decimal,
    ) -> None:
        """Called immediately after both legs are opened (T-15s)."""
        if self._lang == "zh":
            msg = (
                f"{self._sim_prefix()}⚡ <b>進場執行</b>\n"
                f"幣種：{symbol}/USDT\n"
                f"HL：{hl_side} {float(hl_size):.4f} @ ${float(hl_price):,.2f}\n"
                f"Aster：{aster_side} {float(aster_size):.4f} @ ${float(aster_price):,.2f}\n"
                f"名義倉位：${float(notional_usdc):,.2f} USDC\n"
                f"⏱ 15 秒後結算並平倉"
            )
        else:
            msg = (
                f"{self._sim_prefix()}⚡ <b>Entry Executed</b>\n"
                f"Symbol: {symbol}/USDT\n"
                f"HL: {hl_side} {float(hl_size):.4f} @ ${float(hl_price):,.2f}\n"
                f"Aster: {aster_side} {float(aster_size):.4f} @ ${float(aster_price):,.2f}\n"
                f"Notional: ${float(notional_usdc):,.2f} USDC\n"
                f"⏱ Settlement + close in 15s"
            )
        await self._send(msg)

    async def notify_settlement(
        self,
        symbol: str,
        hl_funding_captured: Decimal,
        aster_funding_captured: Decimal,
        fees_paid: Decimal,
        net_pnl: Decimal,
        total_session_pnl: Decimal,
        hl_balance: Decimal,
        aster_balance: Decimal,
    ) -> None:
        """Called after both legs are closed (T+15s) with full P&L breakdown."""
        profit = net_pnl >= 0
        emoji = "✅" if profit else "❌"

        if self._lang == "zh":
            msg = (
                f"{self._sim_prefix()}{emoji} <b>結算完成 — {symbol}/USDT</b>\n"
                f"\n"
                f"資金費收入：\n"
                f"  HL：${float(hl_funding_captured):+.4f}\n"
                f"  Aster：${float(aster_funding_captured):+.4f}\n"
                f"手續費：-${float(fees_paid):.4f}\n"
                f"─────────────────\n"
                f"本次損益：<b>${float(net_pnl):+.4f} USDC</b>\n"
                f"累計損益：<b>${float(total_session_pnl):+.4f} USDC</b>\n"
                f"\n"
                f"帳戶餘額：\n"
                f"  HL：${float(hl_balance):.2f}\n"
                f"  Aster：${float(aster_balance):.2f}\n"
                f"  合計：${float(hl_balance + aster_balance):.2f}"
            )
        else:
            msg = (
                f"{self._sim_prefix()}{emoji} <b>Settlement — {symbol}/USDT</b>\n"
                f"\n"
                f"Funding Captured:\n"
                f"  HL: ${float(hl_funding_captured):+.4f}\n"
                f"  Aster: ${float(aster_funding_captured):+.4f}\n"
                f"Fees Paid: -${float(fees_paid):.4f}\n"
                f"─────────────────\n"
                f"Trade P&L: <b>${float(net_pnl):+.4f} USDC</b>\n"
                f"Session P&L: <b>${float(total_session_pnl):+.4f} USDC</b>\n"
                f"\n"
                f"Balances:\n"
                f"  HL: ${float(hl_balance):.2f}\n"
                f"  Aster: ${float(aster_balance):.2f}\n"
                f"  Total: ${float(hl_balance + aster_balance):.2f}"
            )
        await self._send(msg)

    async def notify_skipped(
        self,
        reason: str,
        next_check_utc: Optional[datetime.datetime] = None,
    ) -> None:
        """Called when a settlement cycle is skipped (spread too low, etc.)."""
        if not self._enabled:
            return

        next_str = ""
        if next_check_utc:
            next_str = f"\n下次評估：{next_check_utc.strftime('%H:%M UTC')}" if self._lang == "zh" \
                else f"\nNext check: {next_check_utc.strftime('%H:%M UTC')}"

        msg = (
            f"{self._sim_prefix()}⏩ 跳過本次週期\n原因：{reason}{next_str}"
            if self._lang == "zh"
            else f"{self._sim_prefix()}⏩ Cycle skipped\nReason: {reason}{next_str}"
        )
        await self._send(msg)

    async def notify_error(self, error: str, context: str = "") -> None:
        """Called on critical errors (leg imbalance, API failures, etc.)."""
        prefix = f"{context}: " if context else ""
        msg = f"🚨 <b>錯誤</b>\n{prefix}{error}" if self._lang == "zh" \
            else f"🚨 <b>Error</b>\n{prefix}{error}"
        await self._send(msg)

    async def notify_startup(self, sim_mode: bool, capital_usdc: float) -> None:
        """Called once at bot startup."""
        mode_str = "📝 模擬模式" if sim_mode else "🔴 實盤模式"
        if self._lang == "zh":
            msg = (
                f"🤖 <b>套利機器人啟動</b>\n"
                f"模式：{mode_str}\n"
                f"資金：${capital_usdc:.2f} USDC\n"
                f"策略：HL × Aster 資金費率套利\n"
                f"結算週期：每 8 小時（00:00 / 08:00 / 16:00 UTC）"
            )
        else:
            msg = (
                f"🤖 <b>Arbitrage Bot Started</b>\n"
                f"Mode: {'[SIM] Paper Trading' if sim_mode else '🔴 Live Trading'}\n"
                f"Capital: ${capital_usdc:.2f} USDC\n"
                f"Strategy: HL × Aster Funding Rate Arbitrage\n"
                f"Settlement: Every 8h (00:00 / 08:00 / 16:00 UTC)"
            )
        await self._send(msg)

    async def notify_shutdown(self, total_pnl: Decimal, trade_count: int) -> None:
        """Called on graceful shutdown."""
        if self._lang == "zh":
            msg = (
                f"🛑 <b>機器人已停止</b>\n"
                f"本次交易次數：{trade_count}\n"
                f"累計損益：<b>${float(total_pnl):+.4f} USDC</b>"
            )
        else:
            msg = (
                f"🛑 <b>Bot Stopped</b>\n"
                f"Trades this session: {trade_count}\n"
                f"Session P&L: <b>${float(total_pnl):+.4f} USDC</b>"
            )
        await self._send(msg)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _sim_prefix(self) -> str:
        return "[SIM] " if self._sim_mode else ""

    async def _send(self, text: str) -> None:
        """Fire-and-forget: send a Telegram message. Never raises."""
        if not self._enabled:
            return
        try:
            url = TELEGRAM_API.format(token=self._bot_token)
            payload = {
                "chat_id": self._chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            }
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                async with session.post(url, json=payload) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        log.warning(
                            "telegram_send_failed",
                            status=resp.status,
                            body=body[:200],
                        )
        except Exception as exc:
            log.warning("telegram_send_error", error=str(exc))
