"""
Aster Perpetuals REST API client.

Aster DEX uses a Binance-compatible REST API:
  Base URL : https://fapi.asterdex.com
  Auth     : X-MBX-APIKEY header + HMAC-SHA256 signature (same as Binance Futures)

Public endpoints (no auth):
  GET /fapi/v3/premiumIndex  → mark price, funding rate, nextFundingTime
  GET /fapi/v3/exchangeInfo  → symbol specs (lot size, min notional)
  GET /fapi/v3/ticker/price  → latest price

Private endpoints (API key + signature required):
  POST /fapi/v3/order        → place order
  GET  /fapi/v3/positionRisk → current positions
  GET  /fapi/v3/account      → wallet balance

In simulation mode (no API key), only public endpoints are called.

Key facts from official docs:
  - Most pairs (BTC, ETH, SOL, BNB) settle every 8 hours: 00:00, 08:00, 16:00 UTC
  - ASTER/USDT settles every 4 hours (recently changed from 1h)
  - Taker: 0.040%  Maker: 0.005%  (VIP 1 / default)
  - nextFundingTime is returned in every premiumIndex response (ms UTC)
  - The API imposes a 15-second timing deviation — positions opened at exactly
    the settlement second may be charged for the PREVIOUS period. This is why
    we enter 15 seconds BEFORE the settlement, not at the settlement second.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import time
from decimal import Decimal
from typing import Dict, List, Optional

import aiohttp

from .fee_calculator import ExchangeSizeParams
from .logger import get_logger

log = get_logger(__name__)

ASTER_API_URL = "https://fapi.asterdex.com"

# How often to refresh funding rates / prices via REST (seconds).
_POLL_INTERVAL = 10


class AsterClient:
    """
    Async client for Aster perpetuals (Pro Mode — CLOB order book).

    Usage (live):
        client = AsterClient(config)
        await client.start(["BTC", "ETH"])
        rate   = client.get_funding_rate("BTC")    # Decimal, e.g. 0.0001
        price  = client.get_mid_price("BTC")       # Decimal, e.g. 95000
        next_t = client.get_next_funding_time("BTC")  # int, ms UTC
        await client.stop()

    Usage (simulation — no API key needed):
        Same as above; place_order / close_position raise NotImplementedError
        in sim mode, which is caught and ignored by the bot.
    """

    def __init__(self, config: dict) -> None:
        self._cfg = config
        aster_cfg = config.get("aster", {})
        trading = config.get("trading", {})

        self._api_url: str = aster_cfg.get("api_url", ASTER_API_URL).rstrip("/")
        self._api_key: str = config.get("_aster_api_key", "")
        self._api_secret: str = config.get("_aster_api_secret", "")
        self._sim_mode: bool = config.get("simulation", {}).get("enabled", True)

        self.leverage: int = int(trading.get("leverage", 3))

        # Live data — keyed by uppercase symbol (no USDT suffix), e.g. "BTC"
        self.funding_rates: Dict[str, Decimal] = {}
        self.mid_prices: Dict[str, Decimal] = {}
        self.next_funding_times: Dict[str, int] = {}  # ms UTC timestamp
        self._size_params: Dict[str, ExchangeSizeParams] = {}

        self._session: Optional[aiohttp.ClientSession] = None
        self._symbols: List[str] = []
        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self, symbols: List[str]) -> None:
        """Connect and start polling. symbols = ["BTC", "ETH", ...]"""
        self._symbols = [s.upper() for s in symbols]
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=10),
        )
        self._running = True

        # Fetch symbol specs from exchangeInfo (lot sizes, min notional)
        await self._fetch_exchange_info()

        # Do an immediate poll so data is available before the bot runs
        await self._refresh_all()

        # Start background polling loop
        asyncio.create_task(self._poll_loop())
        log.info("aster_client_started", symbols=self._symbols, sim=self._sim_mode)

    async def stop(self) -> None:
        self._running = False
        if self._session and not self._session.closed:
            await self._session.close()

    # ------------------------------------------------------------------
    # Background polling loop
    # ------------------------------------------------------------------

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self._refresh_all()
            except Exception as exc:
                log.warning("aster_poll_error", error=str(exc))
            await asyncio.sleep(_POLL_INTERVAL)

    async def _refresh_all(self) -> None:
        """Refresh funding rates, mark prices, and next settlement times."""
        for symbol in self._symbols:
            try:
                data = await self._get(
                    "/fapi/v3/premiumIndex",
                    params={"symbol": f"{symbol}USDT"},
                )
                if not isinstance(data, dict):
                    continue

                funding_rate = data.get("lastFundingRate", "0")
                mark_price = data.get("markPrice", "0")
                next_t = data.get("nextFundingTime", 0)

                self.funding_rates[symbol] = Decimal(str(funding_rate))
                self.mid_prices[symbol] = Decimal(str(mark_price))
                self.next_funding_times[symbol] = int(next_t)

            except Exception as exc:
                log.warning("aster_refresh_symbol_failed", symbol=symbol, error=str(exc))

    async def _fetch_exchange_info(self) -> None:
        """Fetch symbol lot sizes and minimum notional from exchangeInfo."""
        try:
            data = await self._get("/fapi/v3/exchangeInfo")
            if not isinstance(data, dict):
                return

            for sym_info in data.get("symbols", []):
                # Aster uses BTCUSDT format; extract base symbol
                raw_symbol: str = sym_info.get("symbol", "")
                if not raw_symbol.endswith("USDT"):
                    continue
                base = raw_symbol[:-4].upper()  # "BTCUSDT" → "BTC"
                if base not in self._symbols:
                    continue

                lot_size = Decimal("0.001")
                min_notional = Decimal("5")

                for f in sym_info.get("filters", []):
                    if f.get("filterType") == "LOT_SIZE":
                        lot_size = Decimal(str(f.get("stepSize", "0.001")))
                    elif f.get("filterType") == "MIN_NOTIONAL":
                        min_notional = Decimal(str(f.get("minNotional", "5")))

                self._size_params[base] = ExchangeSizeParams(
                    symbol=base,
                    lot_size=lot_size,
                    min_notional_usdc=min_notional,
                    max_leverage=100,
                )

            log.info("aster_exchange_info_fetched", symbols=list(self._size_params.keys()))

        except Exception as exc:
            log.warning("aster_exchange_info_failed", error=str(exc))
            # Fall back to conservative defaults for whitelisted symbols
            for sym in self._symbols:
                if sym not in self._size_params:
                    self._size_params[sym] = ExchangeSizeParams(
                        symbol=sym,
                        lot_size=Decimal("0.001"),
                        min_notional_usdc=Decimal("5"),
                        max_leverage=100,
                    )

    # ------------------------------------------------------------------
    # Order placement (live mode only)
    # ------------------------------------------------------------------

    async def place_order(
        self,
        symbol: str,
        is_long: bool,
        size: Decimal,
        reduce_only: bool = False,
    ) -> dict:
        """
        Place a MARKET order on Aster.

        In the T-15s entry window we need guaranteed fill speed, so we always
        use MARKET orders rather than attempting Post-Only limits.

        Args:
            symbol:      Base symbol, e.g. "BTC"
            is_long:     True = BUY, False = SELL
            size:        Order quantity in base asset (e.g. 0.001 BTC)
            reduce_only: True when closing an existing position

        Returns:
            dict with order result from the Aster API
        """
        if self._sim_mode:
            raise NotImplementedError("place_order called in simulation mode")

        side = "BUY" if is_long else "SELL"
        params: dict = {
            "symbol": f"{symbol.upper()}USDT",
            "side": side,
            "type": "MARKET",
            "quantity": str(size),
        }
        if reduce_only:
            params["reduceOnly"] = "true"

        log.info(
            "aster_placing_order",
            symbol=symbol,
            side=side,
            size=float(size),
            reduce_only=reduce_only,
        )
        result = await self._post("/fapi/v3/order", params)
        log.info("aster_order_placed", symbol=symbol, result=result)
        return result

    async def close_position(self, symbol: str, is_long: bool, size: Decimal) -> dict:
        """Close an open position (reverses the direction)."""
        # To close a LONG we SELL; to close a SHORT we BUY
        close_is_long = not is_long
        return await self.place_order(symbol, close_is_long, size, reduce_only=True)

    # ------------------------------------------------------------------
    # Account queries (live mode only)
    # ------------------------------------------------------------------

    async def get_position(self, symbol: str) -> Optional[dict]:
        """Return current position for `symbol` or None if flat."""
        if self._sim_mode:
            return None

        data = await self._get(
            "/fapi/v3/positionRisk",
            params={"symbol": f"{symbol.upper()}USDT"},
            signed=True,
        )
        if not isinstance(data, list) or not data:
            return None

        pos = data[0]
        amt = Decimal(str(pos.get("positionAmt", "0")))
        if amt == 0:
            return None

        return {
            "size": abs(amt),
            "is_long": amt > 0,
            "entry_price": Decimal(str(pos.get("entryPrice", "0"))),
            "mark_price": Decimal(str(pos.get("markPrice", "0"))),
            "unrealized_pnl": Decimal(str(pos.get("unRealizedProfit", "0"))),
            "margin": Decimal(str(pos.get("isolatedMargin", "0"))),
        }

    async def get_balance(self) -> Decimal:
        """Return total USDT wallet balance."""
        if self._sim_mode:
            return Decimal(str(self._cfg["trading"].get("total_capital_usdc", 166))) / 2

        data = await self._get("/fapi/v3/account", signed=True)
        if isinstance(data, dict):
            return Decimal(str(data.get("totalWalletBalance", "0")))
        return Decimal("0")

    async def get_margin_ratio(self, symbol: str, is_long: bool) -> Optional[Decimal]:
        """Return margin ratio = margin / position_size. None if no position."""
        pos = await self.get_position(symbol)
        if pos is None:
            return None
        if pos["mark_price"] == 0:
            return None
        notional = pos["size"] * pos["mark_price"]
        if notional == 0:
            return None
        return pos["margin"] / notional

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    def _sign(self, query_string: str) -> str:
        return hmac.new(
            self._api_secret.encode("utf-8"),
            query_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    async def _get(
        self,
        path: str,
        params: Optional[dict] = None,
        signed: bool = False,
    ) -> any:
        params = dict(params or {})
        if signed:
            params["timestamp"] = int(time.time() * 1000)
            qs = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
            params["signature"] = self._sign(qs)

        headers = {}
        if self._api_key:
            headers["X-MBX-APIKEY"] = self._api_key

        async with self._session.get(
            f"{self._api_url}{path}",
            params=params,
            headers=headers,
        ) as resp:
            data = await resp.json()
            if resp.status != 200:
                log.warning("aster_api_error", path=path, status=resp.status, data=data)
            return data

    async def _post(self, path: str, params: dict) -> dict:
        params = dict(params)
        params["timestamp"] = int(time.time() * 1000)
        qs = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        params["signature"] = self._sign(qs)

        headers = {"X-MBX-APIKEY": self._api_key}

        async with self._session.post(
            f"{self._api_url}{path}",
            data=params,
            headers=headers,
        ) as resp:
            data = await resp.json()
            if resp.status not in (200, 201):
                raise RuntimeError(f"Aster POST {path} failed ({resp.status}): {data}")
            return data

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_funding_rate(self, symbol: str) -> Optional[Decimal]:
        return self.funding_rates.get(symbol.upper())

    def get_mid_price(self, symbol: str) -> Optional[Decimal]:
        return self.mid_prices.get(symbol.upper())

    def get_next_funding_time(self, symbol: str) -> Optional[int]:
        """Returns the next settlement timestamp in milliseconds UTC."""
        return self.next_funding_times.get(symbol.upper())

    def get_size_params(self, symbol: str) -> Optional[ExchangeSizeParams]:
        return self._size_params.get(symbol.upper())

    def gas_ok_for_open(self) -> bool:
        # Aster uses REST API — no gas considerations.
        return True
