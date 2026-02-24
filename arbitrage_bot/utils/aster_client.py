"""
Aster Perpetuals DEX client (EVM / BNB Chain).

Architecture
------------
Aster is an on-chain perpetuals protocol.  We interact with it via:
  1. web3.py  — read contract state, build & send transactions.
  2. JSON-RPC polling (no native WS feed) — for funding rate & position data.

Because Aster does not have an official Python SDK (as of 2026), this module
implements a generic EVM perp client.  You MUST update:
  - ASTER_ROUTER_ABI  (the actual contract ABI from Aster's docs/GitHub)
  - Contract addresses in config.yaml

2026 Yield-Bearing Margin Support
----------------------------------
If the margin asset is asBNB or USDF the contract may require:
  - ERC-20 `approve()` before deposit.
  - A separate vault deposit call before opening a position.
The `_ensure_margin_approved()` helper handles this.

Gas Guard
---------
Before every write transaction we check current base-fee.  If it exceeds
`max_gas_gwei` (config) the transaction is rejected and the caller receives
a GasLimitExceededError.
"""
from __future__ import annotations

import asyncio
import json
import time
from decimal import Decimal
from typing import Any, Dict, Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import AsyncWeb3, Web3
from web3.exceptions import ContractLogicError
from web3.middleware import ExtraDataToPOAMiddleware

from .fee_calculator import ExchangeSizeParams
from .logger import get_logger

log = get_logger(__name__)


class GasLimitExceededError(Exception):
    """Raised when the network gas price exceeds the configured threshold."""


# ---------------------------------------------------------------------------
# Minimal ABI — covers the functions we actually call.
# Replace with the full Aster router ABI from their official repository.
# ---------------------------------------------------------------------------
ASTER_ROUTER_ABI = json.loads("""
[
  {
    "name": "openPosition",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "_indexToken",  "type": "address"},
      {"name": "_collateralToken", "type": "address"},
      {"name": "_isLong",      "type": "bool"},
      {"name": "_collateralAmount", "type": "uint256"},
      {"name": "_leverage",    "type": "uint256"}
    ],
    "outputs": [{"name": "positionKey", "type": "bytes32"}]
  },
  {
    "name": "closePosition",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "_indexToken",      "type": "address"},
      {"name": "_collateralToken", "type": "address"},
      {"name": "_isLong",          "type": "bool"},
      {"name": "_sizeDelta",       "type": "uint256"}
    ],
    "outputs": []
  },
  {
    "name": "getPosition",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      {"name": "_account",         "type": "address"},
      {"name": "_indexToken",      "type": "address"},
      {"name": "_collateralToken", "type": "address"},
      {"name": "_isLong",          "type": "bool"}
    ],
    "outputs": [
      {"name": "size",           "type": "uint256"},
      {"name": "collateral",     "type": "uint256"},
      {"name": "averagePrice",   "type": "uint256"},
      {"name": "entryFundingRate","type": "uint256"},
      {"name": "hasProfit",      "type": "bool"},
      {"name": "realisedPnl",    "type": "int256"}
    ]
  },
  {
    "name": "getFundingRate",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      {"name": "_indexToken", "type": "address"}
    ],
    "outputs": [
      {"name": "longFundingRate",  "type": "int256"},
      {"name": "shortFundingRate", "type": "int256"}
    ]
  },
  {
    "name": "getMaxPrice",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "_token", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}]
  },
  {
    "name": "getMinPrice",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "_token", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}]
  }
]
""")

ERC20_ABI = json.loads("""
[
  {
    "name": "approve",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount",  "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}]
  },
  {
    "name": "allowance",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      {"name": "owner",   "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "outputs": [{"name": "", "type": "uint256"}]
  },
  {
    "name": "decimals",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint8"}]
  },
  {
    "name": "balanceOf",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"name": "account", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}]
  }
]
""")

# Precision used by most EVM token contracts
WEI_PER_USDC = Decimal("1000000")        # USDC = 6 decimals
PRICE_PRECISION = Decimal("10") ** 30    # Aster price precision (typical GMX-style)


class AsterClient:
    """
    Async client for Aster perpetuals on BNB Chain.

    Usage:
        client = AsterClient(config)
        await client.start(token_map)           # {symbol: token_address}
        rate = client.funding_rates["BTC"]      # live funding rate
        await client.stop()
    """

    def __init__(self, config: dict) -> None:
        self._cfg = config
        aster_cfg = config["aster"]
        trading = config.get("trading", {})

        self.leverage: int = int(trading.get("leverage", 3))
        self.max_gas_gwei: int = int(config.get("risk", {}).get("max_gas_gwei", 30))
        self.max_gas_open: int = int(config.get("risk", {}).get("max_gas_gwei_open", 20))
        self.maker_timeout: float = float(trading.get("maker_timeout_seconds", 5))

        # Web3 setup
        self._w3 = Web3(Web3.HTTPProvider(aster_cfg["rpc_url"]))
        self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        private_key: str = config["_aster_private_key"]
        self._account: LocalAccount = Account.from_key(private_key)
        self._wallet = self._account.address

        self._router = self._w3.eth.contract(
            address=Web3.to_checksum_address(aster_cfg["router_contract"]),
            abi=ASTER_ROUTER_ABI,
        )

        margin_addr = aster_cfg.get("margin_asset_address", "")
        self._margin_token = self._w3.eth.contract(
            address=Web3.to_checksum_address(margin_addr),
            abi=ERC20_ABI,
        ) if margin_addr else None
        self._margin_asset = aster_cfg.get("margin_asset", "USDF")
        self._margin_decimals: int = 6  # populated in start()

        # Live data (populated by polling loop)
        self.funding_rates: Dict[str, Decimal] = {}
        self.mid_prices: Dict[str, Decimal] = {}

        # token_address → symbol mapping (set in start())
        self._token_map: Dict[str, str] = {}   # symbol → address
        self._size_params: Dict[str, ExchangeSizeParams] = {}

        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self, token_map: Dict[str, str]) -> None:
        """
        token_map: {"BTC": "0x...", "ETH": "0x...", ...}
        Launches the background polling loop.
        """
        self._token_map = {k.upper(): Web3.to_checksum_address(v) for k, v in token_map.items()}
        self._running = True

        # Fetch margin token decimals
        if self._margin_token:
            self._margin_decimals = self._margin_token.functions.decimals().call()

        # Populate size params (conservative defaults; update per Aster docs)
        for sym in self._token_map:
            self._size_params[sym] = ExchangeSizeParams(
                symbol=sym,
                lot_size=Decimal("0.001"),         # 3 decimal places
                min_notional_usdc=Decimal("10"),
                max_leverage=50,
            )

        asyncio.create_task(self._poll_loop())
        log.info("aster_client_started", symbols=list(self._token_map.keys()))

    async def stop(self) -> None:
        self._running = False

    # ------------------------------------------------------------------
    # Background polling loop (replaces WebSocket — Aster uses RPC calls)
    # ------------------------------------------------------------------

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self._refresh_all()
            except Exception as exc:
                log.error("aster_poll_error", error=str(exc))
            await asyncio.sleep(5)  # Poll every 5 seconds

    async def _refresh_all(self) -> None:
        """Update funding rates and prices for all tracked tokens."""
        loop = asyncio.get_event_loop()
        for sym, addr in self._token_map.items():
            try:
                # Prices (max = ask, min = bid; mid = average)
                max_p, min_p = await asyncio.gather(
                    loop.run_in_executor(
                        None, lambda a=addr: self._router.functions.getMaxPrice(a).call()
                    ),
                    loop.run_in_executor(
                        None, lambda a=addr: self._router.functions.getMinPrice(a).call()
                    ),
                )
                mid = (Decimal(str(max_p)) + Decimal(str(min_p))) / (2 * PRICE_PRECISION)
                self.mid_prices[sym] = mid

                # Funding rates
                long_rate, short_rate = await loop.run_in_executor(
                    None,
                    lambda a=addr: self._router.functions.getFundingRate(a).call(),
                )
                # Store funding rate as fraction per funding period.
                # Aster returns signed int256 (positive = longs pay shorts).
                # Normalize to the same unit as HL (per-period fraction).
                self.funding_rates[sym] = Decimal(str(long_rate)) / Decimal("1e18")

            except Exception as exc:
                log.warning("aster_refresh_failed", symbol=sym, error=str(exc))

    # ------------------------------------------------------------------
    # Gas check
    # ------------------------------------------------------------------

    def _current_gas_gwei(self) -> Decimal:
        base_fee = self._w3.eth.gas_price  # in wei
        return Decimal(str(base_fee)) / Decimal("1e9")

    def _check_gas(self, threshold_gwei: int) -> None:
        current = self._current_gas_gwei()
        if current > threshold_gwei:
            raise GasLimitExceededError(
                f"Gas {float(current):.1f} Gwei exceeds limit {threshold_gwei} Gwei"
            )

    # ------------------------------------------------------------------
    # Margin approval helper (for yield-bearing asBNB / USDF)
    # ------------------------------------------------------------------

    async def _ensure_margin_approved(self, amount_wei: int) -> None:
        """Ensure the router has sufficient allowance for the margin token."""
        if not self._margin_token:
            return
        loop = asyncio.get_event_loop()
        current = await loop.run_in_executor(
            None,
            lambda: self._margin_token.functions.allowance(
                self._wallet, self._router.address
            ).call(),
        )
        if current < amount_wei:
            log.info("aster_approving_margin_token", asset=self._margin_asset, amount=amount_wei)
            await self._send_tx(
                self._margin_token.functions.approve(
                    self._router.address, 2**256 - 1  # max approve
                )
            )

    # ------------------------------------------------------------------
    # Order placement
    # ------------------------------------------------------------------

    async def place_order(
        self,
        symbol: str,
        is_long: bool,
        size_usdc: Decimal,
        reduce_only: bool = False,
    ) -> dict:
        """
        Open (or close) a position on Aster.

        Note: Aster uses a collateral + leverage model.
          collateral = size_usdc / leverage
        The `reduce_only` flag triggers closePosition instead.
        """
        self._check_gas(self.max_gas_open if not reduce_only else self.max_gas_gwei)

        token_addr = self._token_map.get(symbol.upper())
        if not token_addr:
            raise ValueError(f"Symbol {symbol} not in token_map")

        margin_addr = self._margin_token.address if self._margin_token else token_addr
        collateral_amount_decimal = size_usdc / Decimal(str(self.leverage))
        collateral_wei = int(collateral_amount_decimal * Decimal("10") ** self._margin_decimals)
        size_wei = int(size_usdc * Decimal("10") ** self._margin_decimals)

        if not reduce_only:
            await self._ensure_margin_approved(collateral_wei)
            log.info(
                "aster_opening_position",
                symbol=symbol,
                is_long=is_long,
                collateral_usdc=float(collateral_amount_decimal),
                leverage=self.leverage,
            )
            tx_receipt = await self._send_tx(
                self._router.functions.openPosition(
                    token_addr,
                    margin_addr,
                    is_long,
                    collateral_wei,
                    self.leverage,
                )
            )
        else:
            log.info("aster_closing_position", symbol=symbol, is_long=is_long)
            tx_receipt = await self._send_tx(
                self._router.functions.closePosition(
                    token_addr,
                    margin_addr,
                    is_long,
                    size_wei,
                )
            )

        return {"tx_hash": tx_receipt["transactionHash"].hex(), "receipt": tx_receipt}

    async def close_position(self, symbol: str, is_long: bool, size_usdc: Decimal) -> dict:
        return await self.place_order(symbol, is_long, size_usdc, reduce_only=True)

    # ------------------------------------------------------------------
    # Position & margin queries
    # ------------------------------------------------------------------

    async def get_position(self, symbol: str, is_long: bool) -> Optional[dict]:
        """Return position data dict or None if no position exists."""
        token_addr = self._token_map.get(symbol.upper())
        if not token_addr:
            return None
        margin_addr = self._margin_token.address if self._margin_token else token_addr
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: self._router.functions.getPosition(
                    self._wallet, token_addr, margin_addr, is_long
                ).call(),
            )
            size, collateral, avg_price, entry_funding, has_profit, pnl = result
            return {
                "size": Decimal(str(size)) / (Decimal("10") ** self._margin_decimals),
                "collateral": Decimal(str(collateral)) / (Decimal("10") ** self._margin_decimals),
                "avg_price": Decimal(str(avg_price)) / PRICE_PRECISION,
                "has_profit": has_profit,
                "pnl": Decimal(str(pnl)) / (Decimal("10") ** self._margin_decimals),
            }
        except (ContractLogicError, Exception) as exc:
            log.warning("aster_get_position_failed", symbol=symbol, error=str(exc))
            return None

    async def get_margin_ratio(self, symbol: str, is_long: bool) -> Optional[Decimal]:
        """
        Approximate margin ratio = collateral / size.
        A lower value means more leveraged / closer to liquidation.
        """
        pos = await self.get_position(symbol, is_long)
        if not pos or pos["size"] == 0:
            return None
        return pos["collateral"] / pos["size"]

    async def get_margin_asset_apy(self) -> Decimal:
        """
        Fetch the base yield of the margin asset (asBNB / USDF).
        In production this would call the Aster vault/staking contract.
        Falls back to the config-provided value.
        """
        cfg_apy = self._cfg["aster"].get("margin_asset_base_apy", -1)
        if cfg_apy != -1:
            return Decimal(str(cfg_apy))
        # Placeholder: implement on-chain call to yield vault when ABI is available
        log.warning("aster_margin_apy_not_configured_using_zero")
        return Decimal("0")

    # ------------------------------------------------------------------
    # Transaction helper
    # ------------------------------------------------------------------

    async def _send_tx(self, contract_fn: Any) -> dict:
        """Build, sign, and broadcast a transaction. Returns the receipt."""
        loop = asyncio.get_event_loop()
        nonce = await loop.run_in_executor(
            None,
            lambda: self._w3.eth.get_transaction_count(self._wallet, "pending"),
        )
        gas_price = self._w3.eth.gas_price

        tx = contract_fn.build_transaction({
            "from": self._wallet,
            "nonce": nonce,
            "gasPrice": gas_price,
        })

        # Estimate gas
        try:
            gas_est = await loop.run_in_executor(None, lambda: self._w3.eth.estimate_gas(tx))
            tx["gas"] = int(gas_est * 1.2)  # 20% buffer
        except Exception:
            tx["gas"] = 500_000

        signed = self._account.sign_transaction(tx)
        tx_hash = await loop.run_in_executor(
            None, lambda: self._w3.eth.send_raw_transaction(signed.rawTransaction)
        )
        log.info("aster_tx_sent", tx_hash=tx_hash.hex())

        receipt = await loop.run_in_executor(
            None, lambda: self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        )
        if receipt["status"] != 1:
            raise RuntimeError(f"Aster transaction reverted: {tx_hash.hex()}")
        log.info("aster_tx_confirmed", tx_hash=tx_hash.hex(), block=receipt["blockNumber"])
        return receipt

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_size_params(self, symbol: str) -> Optional[ExchangeSizeParams]:
        return self._size_params.get(symbol.upper())

    def get_funding_rate(self, symbol: str) -> Optional[Decimal]:
        return self.funding_rates.get(symbol.upper())

    def get_mid_price(self, symbol: str) -> Optional[Decimal]:
        return self.mid_prices.get(symbol.upper())

    def gas_ok_for_open(self) -> bool:
        try:
            self._check_gas(self.max_gas_open)
            return True
        except GasLimitExceededError:
            return False
