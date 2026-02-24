"""
Hyperliquid client wrapper.

Responsibilities:
- WebSocket subscription to fundingRate and l2Book updates.
- REST-based order placement (Post-Only limit → aggressive fallback).
- Position & margin ratio queries.
- Size constraints (lot size, min notional) for the symbol universe.

Implementation notes
--------------------
- The official hyperliquid-python-sdk is used for auth and REST calls.
- WebSocket is managed manually via `websockets` for fine-grained control
  over reconnection and per-message latency.
- All public state (funding rates, order books) is stored in thread-safe
  asyncio.Queue / dict structures so the main engine can read without locking.
"""
from __future__ import annotations

import asyncio
import json
import time
from decimal import Decimal
from typing import Any, Callable, Dict, Optional

import websockets
from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants as hl_constants

from .fee_calculator import ExchangeSizeParams
from .logger import get_logger

log = get_logger(__name__)

# HL WebSocket endpoint
HL_WS_URL = "wss://api.hyperliquid.xyz/ws"
HL_MAINNET_URL = "https://api.hyperliquid.xyz"


class HyperliquidClient:
    """
    Async client for Hyperliquid perpetuals.

    Usage:
        client = HyperliquidClient(config)
        await client.start()                  # connects WebSocket
        rate = client.funding_rates["BTC"]    # live funding rate
        await client.stop()
    """

    def __init__(self, config: dict) -> None:
        self._cfg = config
        trading = config.get("trading", {})

        self.leverage: int = int(trading.get("leverage", 3))
        self.maker_timeout: float = float(trading.get("maker_timeout_seconds", 5))
        self.slippage_bps: int = int(trading.get("aggressive_slippage_bps", 5))

        # Decrypted at init time (see key_encryptor.py)
        private_key: str = config["_hl_private_key"]
        self._account = Account.from_key(private_key)
        self._wallet_address: str = self._account.address

        self._info = Info(HL_MAINNET_URL, skip_ws=True)
        self._exchange = Exchange(
            self._account,
            HL_MAINNET_URL,
            account_address=self._wallet_address,
        )

        # Live data stores (keyed by uppercase coin name, e.g. "BTC")
        self.funding_rates: Dict[str, Decimal] = {}
        self.mid_prices: Dict[str, Decimal] = {}
        self.bids: Dict[str, list] = {}  # list of [price, size]
        self.asks: Dict[str, list] = {}

        # Size constraints populated via _fetch_meta()
        self._size_params: Dict[str, ExchangeSizeParams] = {}

        self._ws: Optional[Any] = None
        self._running = False
        self._subscribed_symbols: set[str] = set()
        self._on_funding_update: Optional[Callable] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self, symbols: list[str]) -> None:
        """Connect WebSocket and subscribe to the given symbols."""
        self._running = True
        self._subscribed_symbols = {s.upper() for s in symbols}
        await self._fetch_meta()
        asyncio.create_task(self._ws_loop())
        log.info("hl_client_started", symbols=list(self._subscribed_symbols))

    async def stop(self) -> None:
        self._running = False
        if self._ws:
            await self._ws.close()

    def on_funding_update(self, callback: Callable) -> None:
        """Register a callback invoked whenever a funding rate updates."""
        self._on_funding_update = callback

    # ------------------------------------------------------------------
    # WebSocket loop
    # ------------------------------------------------------------------

    async def _ws_loop(self) -> None:
        backoff = 1.0
        while self._running:
            try:
                async with websockets.connect(
                    HL_WS_URL,
                    ping_interval=20,
                    ping_timeout=30,
                ) as ws:
                    self._ws = ws
                    backoff = 1.0
                    await self._subscribe(ws)
                    async for raw in ws:
                        await self._handle_message(raw)
            except (websockets.ConnectionClosed, OSError) as exc:
                log.warning("hl_ws_disconnected", error=str(exc), reconnect_in=backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)
            except Exception as exc:
                log.error("hl_ws_error", error=str(exc))
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60)

    async def _subscribe(self, ws: Any) -> None:
        """Send subscription frames for funding info and order books."""
        # Subscribe to all-mids for price reference
        await ws.send(json.dumps({"method": "subscribe", "subscription": {"type": "allMids"}}))

        # Subscribe to funding updates
        await ws.send(json.dumps({"method": "subscribe", "subscription": {"type": "activeAssetCtx"}}))

        # Subscribe to L2 book for each symbol
        for sym in self._subscribed_symbols:
            await ws.send(json.dumps({
                "method": "subscribe",
                "subscription": {"type": "l2Book", "coin": sym},
            }))

        log.debug("hl_subscribed", symbols=list(self._subscribed_symbols))

    async def _handle_message(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return

        channel = msg.get("channel", "")
        data = msg.get("data", {})

        if channel == "allMids":
            mids = data.get("mids", {})
            for coin, price in mids.items():
                self.mid_prices[coin] = Decimal(str(price))

        elif channel == "activeAssetCtx":
            # data is a list of {coin, ctx: {funding, ...}}
            if isinstance(data, list):
                for item in data:
                    coin = item.get("coin", "")
                    ctx = item.get("ctx", {})
                    funding = ctx.get("funding")
                    if funding is not None and coin in self._subscribed_symbols:
                        rate = Decimal(str(funding))
                        prev = self.funding_rates.get(coin)
                        self.funding_rates[coin] = rate
                        if prev != rate and self._on_funding_update:
                            self._on_funding_update(coin, rate)

        elif channel == "l2Book":
            coin = data.get("coin", "")
            if coin in self._subscribed_symbols:
                levels = data.get("levels", [[], []])
                self.bids[coin] = levels[0] if len(levels) > 0 else []
                self.asks[coin] = levels[1] if len(levels) > 1 else []

    # ------------------------------------------------------------------
    # Order placement
    # ------------------------------------------------------------------

    async def place_order(
        self,
        symbol: str,
        is_buy: bool,
        size: Decimal,
        reduce_only: bool = False,
    ) -> dict:
        """
        Place a Post-Only limit order. Falls back to aggressive limit if not
        filled within maker_timeout seconds.

        Returns the order result dict from the SDK.
        """
        mid = self.mid_prices.get(symbol)
        if mid is None:
            raise ValueError(f"No mid price available for {symbol}")

        # Post-Only limit price: bid side slightly below mid, ask side slightly above
        slippage_mult = Decimal("1") + Decimal(str(self.slippage_bps)) / Decimal("10000")
        if is_buy:
            limit_price = mid * (Decimal("1") - Decimal("0.0001"))  # 1 bp below mid
            aggressive_price = mid * slippage_mult
        else:
            limit_price = mid * (Decimal("1") + Decimal("0.0001"))  # 1 bp above mid
            aggressive_price = mid / slippage_mult

        size_float = float(size)
        limit_price_float = float(limit_price)

        log.info(
            "hl_placing_maker_order",
            symbol=symbol,
            side="buy" if is_buy else "sell",
            size=size_float,
            price=limit_price_float,
            reduce_only=reduce_only,
        )

        # Attempt Post-Only limit
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._exchange.order(
                symbol,
                is_buy,
                size_float,
                limit_price_float,
                {"limit": {"tif": "Alo"}},  # Add-Liquidity-Only (Post-Only)
                reduce_only=reduce_only,
            ),
        )

        status = result.get("response", {}).get("data", {}).get("statuses", [{}])[0]
        resting = status.get("resting")
        filled = status.get("filled")

        if filled or resting:
            log.info("hl_maker_order_placed", symbol=symbol, status=status)
            if resting:
                # Wait for fill; cancel and use aggressive if not filled in time
                oid = resting.get("oid")
                filled_result = await self._wait_for_fill_or_cancel(symbol, oid, aggressive_price, is_buy, size_float, reduce_only)
                return filled_result
            return result

        # If the Post-Only was rejected outright, go straight to aggressive
        log.warning("hl_maker_rejected_going_aggressive", symbol=symbol)
        return await self._place_aggressive(symbol, is_buy, size_float, float(aggressive_price), reduce_only)

    async def _wait_for_fill_or_cancel(
        self,
        symbol: str,
        oid: int,
        aggressive_price: Decimal,
        is_buy: bool,
        size: float,
        reduce_only: bool,
    ) -> dict:
        """Wait maker_timeout seconds; if still resting, cancel and place aggressive."""
        await asyncio.sleep(self.maker_timeout)

        # Check if order was filled
        open_orders = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._info.open_orders(self._wallet_address),
        )
        still_open = any(o.get("oid") == oid for o in open_orders)

        if not still_open:
            log.info("hl_maker_filled_before_timeout", symbol=symbol, oid=oid)
            return {"status": "filled_as_maker", "oid": oid}

        # Cancel the resting maker order
        log.info("hl_cancelling_maker_order", symbol=symbol, oid=oid)
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._exchange.cancel(symbol, oid),
        )
        return await self._place_aggressive(symbol, is_buy, size, float(aggressive_price), reduce_only)

    async def _place_aggressive(
        self,
        symbol: str,
        is_buy: bool,
        size: float,
        price: float,
        reduce_only: bool,
    ) -> dict:
        """Place an aggressive limit order (GTC, crosses the book)."""
        log.info(
            "hl_placing_aggressive_order",
            symbol=symbol,
            side="buy" if is_buy else "sell",
            size=size,
            price=price,
        )
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._exchange.order(
                symbol,
                is_buy,
                size,
                price,
                {"limit": {"tif": "Gtc"}},
                reduce_only=reduce_only,
            ),
        )
        return result

    async def close_position(self, symbol: str, is_buy: bool, size: Decimal) -> dict:
        """Close (reduce) a position at market."""
        return await self.place_order(symbol, is_buy, size, reduce_only=True)

    async def set_leverage(self, symbol: str) -> None:
        """Set cross margin leverage for the symbol."""
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._exchange.update_leverage(self.leverage, symbol, is_cross=True),
        )
        log.info("hl_leverage_set", symbol=symbol, leverage=self.leverage)

    # ------------------------------------------------------------------
    # Position & account queries
    # ------------------------------------------------------------------

    async def get_positions(self) -> list[dict]:
        """Return current open positions."""
        state = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._info.user_state(self._wallet_address),
        )
        return state.get("assetPositions", [])

    async def get_margin_ratio(self, symbol: str) -> Optional[Decimal]:
        """
        Return margin ratio for the symbol's position.
        margin_ratio = margin_used / position_value  (approximate).
        Returns None if no position found.
        """
        positions = await self.get_positions()
        for pos in positions:
            p = pos.get("position", {})
            if p.get("coin") == symbol:
                margin_used = Decimal(str(p.get("marginUsed", "0")))
                notional = Decimal(str(p.get("positionValue", "0")))
                if notional == 0:
                    return None
                return margin_used / notional
        return None

    # ------------------------------------------------------------------
    # Meta / size constraints
    # ------------------------------------------------------------------

    async def _fetch_meta(self) -> None:
        """Fetch universe metadata to populate size constraints."""
        meta = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self._info.meta(),
        )
        for asset in meta.get("universe", []):
            name = asset.get("name", "").upper()
            sz_decimals = int(asset.get("szDecimals", 4))
            lot = Decimal("1") / (Decimal("10") ** sz_decimals)
            self._size_params[name] = ExchangeSizeParams(
                symbol=name,
                lot_size=lot,
                min_notional_usdc=Decimal("10"),  # HL minimum ~$10
                max_leverage=int(asset.get("maxLeverage", 20)),
            )
        log.info("hl_meta_fetched", num_assets=len(self._size_params))

    def get_size_params(self, symbol: str) -> Optional[ExchangeSizeParams]:
        return self._size_params.get(symbol.upper())

    def get_funding_rate(self, symbol: str) -> Optional[Decimal]:
        return self.funding_rates.get(symbol.upper())

    def get_mid_price(self, symbol: str) -> Optional[Decimal]:
        return self.mid_prices.get(symbol.upper())

    @property
    def available_symbols(self) -> list[str]:
        return list(self._size_params.keys())
