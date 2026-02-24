"""
Fee calculator for the Hyperliquid <> Aster arbitrage bot.

Key design decisions
--------------------
1.  All fee arithmetic uses Python's `Decimal` to avoid floating-point drift
    that could silently eat into the 166u capital.
2.  The "full round-trip" cost model counts:
        OPEN  leg: 2 × fill events  (1 on HL, 1 on Aster)
        CLOSE leg: 2 × fill events  (1 on HL, 1 on Aster)
    Formula per the brief:
        Expected_Profit = (Funding_Rate_Diff × Hours)
                        − (hl_fee × 2 × leverage + aster_fee × 2 × leverage)
                        − gas_cost_usdc / notional
3.  Size alignment rounds DOWN to the exchange's lot-size to avoid
    "insufficient margin" rejects on small-capital accounts.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from decimal import ROUND_DOWN, Decimal, getcontext
from typing import Optional

from .logger import get_logger

# High precision to handle micro-lot rounding correctly
getcontext().prec = 28

log = get_logger(__name__)


@dataclass
class FeeConfig:
    hl_maker_fee: Decimal = Decimal("0.00020")
    hl_taker_fee: Decimal = Decimal("0.00045")
    aster_maker_fee: Decimal = Decimal("0.00030")
    aster_taker_fee: Decimal = Decimal("0.00040")
    aster_gas_cost_usdc: Decimal = Decimal("0.15")
    fee_safety_buffer: Decimal = Decimal("0.0002")

    @classmethod
    def from_dict(cls, d: dict) -> "FeeConfig":
        return cls(
            hl_maker_fee=Decimal(str(d.get("hl_maker_fee", "0.00020"))),
            hl_taker_fee=Decimal(str(d.get("hl_taker_fee", "0.00045"))),
            aster_maker_fee=Decimal(str(d.get("aster_maker_fee", "0.00030"))),
            aster_taker_fee=Decimal(str(d.get("aster_taker_fee", "0.00040"))),
            aster_gas_cost_usdc=Decimal(str(d.get("aster_gas_cost_usdc", "0.15"))),
            fee_safety_buffer=Decimal(str(d.get("fee_safety_buffer", "0.0002"))),
        )


@dataclass
class ArbOpportunity:
    """Represents a detected arbitrage opportunity."""
    symbol: str
    hl_funding_rate: Decimal       # per funding period (e.g. 0.0001 = 0.01%)
    aster_funding_rate: Decimal
    hl_is_long: bool               # True if HL side goes LONG
    hl_price: Decimal
    aster_price: Decimal
    funding_interval_hours: Decimal = Decimal("8")

    # Populated by FeeCalculator.evaluate()
    gross_spread: Decimal = Decimal("0")
    total_fee_cost: Decimal = Decimal("0")
    net_spread: Decimal = Decimal("0")
    expected_profit_usdc: Decimal = Decimal("0")
    is_profitable: bool = False

    # Order sizing (populated by FeeCalculator.compute_sizes())
    hl_size: Decimal = Decimal("0")       # in base asset
    aster_size: Decimal = Decimal("0")    # in base asset
    hl_notional: Decimal = Decimal("0")   # in USDC
    aster_notional: Decimal = Decimal("0")


@dataclass
class ExchangeSizeParams:
    """Per-symbol size constraints from the exchange."""
    symbol: str
    lot_size: Decimal          # minimum increment (e.g. 0.0001 BTC)
    min_notional_usdc: Decimal # minimum order value in USDC
    max_leverage: int = 20


class FeeCalculator:
    """
    Calculates fees, spread profitability, and size alignment for arb trades.
    """

    def __init__(self, config: dict) -> None:
        trading = config.get("trading", {})
        fees_cfg = config.get("fees", {})

        self.leverage = Decimal(str(trading.get("leverage", 3)))
        self.capital_hl = Decimal(str(
            config["trading"]["total_capital_usdc"]
            * config["trading"]["capital_split_hl"]
        ))
        self.capital_aster = Decimal(str(
            config["trading"]["total_capital_usdc"]
            * config["trading"]["capital_split_aster"]
        ))
        self.fees = FeeConfig.from_dict(fees_cfg)
        self.min_spread_to_open = Decimal(str(
            trading.get("min_spread_to_open", "0.0055")
        ))

    # ------------------------------------------------------------------
    # Core spread evaluation
    # ------------------------------------------------------------------

    def evaluate(
        self,
        opp: ArbOpportunity,
        use_maker: bool = True,
    ) -> ArbOpportunity:
        """
        Fills in gross_spread, total_fee_cost, net_spread, expected_profit_usdc,
        and is_profitable on the opportunity object.

        The full round-trip fee formula (from brief):
            fee_cost = (hl_fee × 2 + aster_fee × 2) × leverage
        where hl_fee and aster_fee are the WORSE of maker/taker depending on
        whether we expect to be filled as maker.

        We apply maker fees for open (Post-Only) and taker fees for close
        (force close is always aggressive), giving us:
            open_fee  = hl_maker + aster_maker   (best case)
            close_fee = hl_taker + aster_taker   (worst case — conservative)
        """
        hl_fee_open = self.fees.hl_maker_fee if use_maker else self.fees.hl_taker_fee
        hl_fee_close = self.fees.hl_taker_fee
        aster_fee_open = self.fees.aster_maker_fee if use_maker else self.fees.aster_taker_fee
        aster_fee_close = self.fees.aster_taker_fee

        # Fee cost as fraction of notional × leverage
        fee_fraction = (
            (hl_fee_open + hl_fee_close + aster_fee_open + aster_fee_close)
            * self.leverage
        )

        # Gas cost as fraction of the total notional
        notional_per_side = self.capital_hl * self.leverage
        gas_fraction = self.fees.aster_gas_cost_usdc / notional_per_side

        total_fee_fraction = fee_fraction + gas_fraction + self.fees.fee_safety_buffer

        # Funding rate differential (absolute value — we pick direction so it's positive)
        hl_rate = opp.hl_funding_rate
        aster_rate = opp.aster_funding_rate
        gross_spread = abs(aster_rate - hl_rate)

        net_spread = gross_spread - total_fee_fraction

        # Expected profit in USDC over one funding period
        notional_both = notional_per_side  # symmetric capital allocation
        expected_profit = net_spread * notional_both

        opp.gross_spread = gross_spread
        opp.total_fee_cost = total_fee_fraction
        opp.net_spread = net_spread
        opp.expected_profit_usdc = expected_profit
        opp.is_profitable = net_spread > self.min_spread_to_open

        log.debug(
            "spread_evaluation",
            symbol=opp.symbol,
            gross_spread=float(gross_spread),
            fee_fraction=float(fee_fraction),
            gas_fraction=float(gas_fraction),
            net_spread=float(net_spread),
            expected_profit_usdc=float(expected_profit),
            is_profitable=opp.is_profitable,
        )
        return opp

    # ------------------------------------------------------------------
    # Size alignment (key for 166u small-capital accounts)
    # ------------------------------------------------------------------

    def compute_sizes(
        self,
        opp: ArbOpportunity,
        hl_params: ExchangeSizeParams,
        aster_params: ExchangeSizeParams,
    ) -> ArbOpportunity:
        """
        Calculates the aligned order size for both exchanges such that:
        1. Both sides represent roughly equal notional USD value.
        2. Each size is a valid multiple of the exchange's lot_size.
        3. Each notional meets the exchange's min_notional requirement.
        4. The size is achievable with the allocated capital × leverage.

        Returns the opportunity with hl_size, aster_size, hl_notional,
        aster_notional populated. Sets is_profitable=False if sizing fails.
        """
        # Maximum notional we can open on each side
        max_notional_hl = self.capital_hl * self.leverage
        max_notional_aster = self.capital_aster * self.leverage

        # Raw sizes in base asset (before lot alignment)
        raw_hl_size = max_notional_hl / opp.hl_price
        raw_aster_size = max_notional_aster / opp.aster_price

        # Align DOWN to lot size using Decimal to avoid float rounding
        aligned_hl = self._floor_to_lot(raw_hl_size, hl_params.lot_size)
        aligned_aster = self._floor_to_lot(raw_aster_size, aster_params.lot_size)

        # Use the SMALLER of the two (keep delta-neutral)
        # Convert aster size to HL lot equivalence to compare notionals
        hl_notional = aligned_hl * opp.hl_price
        aster_notional = aligned_aster * opp.aster_price

        if hl_notional < aster_notional:
            # HL side is the binding constraint; scale aster down to match
            aligned_aster = self._floor_to_lot(
                hl_notional / opp.aster_price, aster_params.lot_size
            )
        else:
            aligned_hl = self._floor_to_lot(
                aster_notional / opp.hl_price, hl_params.lot_size
            )

        # Recompute final notionals
        hl_notional = aligned_hl * opp.hl_price
        aster_notional = aligned_aster * opp.aster_price

        # Validate minimum notional
        if hl_notional < hl_params.min_notional_usdc:
            log.warning(
                "size_too_small",
                symbol=opp.symbol,
                exchange="hyperliquid",
                notional=float(hl_notional),
                min_required=float(hl_params.min_notional_usdc),
            )
            opp.is_profitable = False
            return opp

        if aster_notional < aster_params.min_notional_usdc:
            log.warning(
                "size_too_small",
                symbol=opp.symbol,
                exchange="aster",
                notional=float(aster_notional),
                min_required=float(aster_params.min_notional_usdc),
            )
            opp.is_profitable = False
            return opp

        opp.hl_size = aligned_hl
        opp.aster_size = aligned_aster
        opp.hl_notional = hl_notional
        opp.aster_notional = aster_notional

        log.info(
            "sizes_computed",
            symbol=opp.symbol,
            hl_size=float(aligned_hl),
            hl_notional=float(hl_notional),
            aster_size=float(aligned_aster),
            aster_notional=float(aster_notional),
            leverage=float(self.leverage),
        )
        return opp

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _floor_to_lot(size: Decimal, lot: Decimal) -> Decimal:
        """Floor `size` to the nearest valid multiple of `lot`."""
        if lot <= 0:
            return size
        # Use integer arithmetic on the lot scale to avoid Decimal pitfalls
        quantized = (size / lot).to_integral_value(rounding=ROUND_DOWN) * lot
        return quantized

    def annualised_yield(
        self,
        net_spread_per_period: Decimal,
        periods_per_year: int,
    ) -> Decimal:
        """Convert a per-period net spread to an annualised percentage yield."""
        return net_spread_per_period * periods_per_year * Decimal("100")

    def margin_asset_adjusted_spread(
        self,
        net_spread: Decimal,
        margin_asset_apy: Decimal,
        funding_interval_hours: Decimal,
    ) -> Decimal:
        """
        Adjust net spread to include yield earned on the margin asset
        (e.g. asBNB / USDF) over one funding period.

        apy is annual (e.g. 0.05 for 5%). Convert to per-period yield:
            period_yield = apy × (interval_hours / 8760)
        """
        period_yield = margin_asset_apy * (funding_interval_hours / Decimal("8760"))
        return net_spread + period_yield
