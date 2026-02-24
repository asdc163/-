"""
Fee calculator for the Hyperliquid <> Aster funding rate arbitrage bot.

Key design decisions
--------------------
1.  All fee arithmetic uses Python's `Decimal` to avoid floating-point drift
    that could silently eat into the 166u capital.

2.  The settlement-timed strategy uses MARKET orders on both legs (enter at
    T-15s, close at T+15s) to guarantee fill speed. This means we always pay
    taker fees for both open and close, on both exchanges:

        Total fee fraction = (hl_taker + aster_taker) × 2

    At 3x leverage on 166 USDC total capital:
        Notional per side  = 83 × 3 = 249 USDC
        Total fee in USDC  = 0.00085 × 2 × 249 = $0.42 per round trip

3.  Minimum profitable spread threshold:
        min_net_spread = fees + safety_buffer
        At Tier-0 rates: (0.00045 + 0.00040) × 2 + 0.0001 ≈ 0.0018

4.  Aster does NOT charge gas on REST API orders (no blockchain transactions).

5.  Correct fee tiers (from official docs, Feb 2026):
        HL  : Maker 0.015% / Taker 0.045%   (Tier 0)
        Aster: Maker 0.005% / Taker 0.040%   (VIP 1 / default Pro Mode)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_DOWN, Decimal, getcontext
from typing import Optional

from .logger import get_logger

# High precision to handle micro-lot rounding correctly
getcontext().prec = 28

log = get_logger(__name__)


@dataclass
class FeeConfig:
    # Hyperliquid fee tiers (Tier 0 defaults)
    hl_maker_fee: Decimal = Decimal("0.00015")   # 0.015%
    hl_taker_fee: Decimal = Decimal("0.00045")   # 0.045%
    # Aster Pro Mode fee tiers (VIP 1 / default)
    aster_maker_fee: Decimal = Decimal("0.00005")  # 0.005%
    aster_taker_fee: Decimal = Decimal("0.00040")  # 0.040%
    # Extra buffer for minor slippage / price rounding
    fee_safety_buffer: Decimal = Decimal("0.0001")

    @classmethod
    def from_dict(cls, d: dict) -> "FeeConfig":
        return cls(
            hl_maker_fee=Decimal(str(d.get("hl_maker_fee", "0.00015"))),
            hl_taker_fee=Decimal(str(d.get("hl_taker_fee", "0.00045"))),
            aster_maker_fee=Decimal(str(d.get("aster_maker_fee", "0.00005"))),
            aster_taker_fee=Decimal(str(d.get("aster_taker_fee", "0.00040"))),
            fee_safety_buffer=Decimal(str(d.get("fee_safety_buffer", "0.0001"))),
        )


@dataclass
class ArbOpportunity:
    """Represents a detected arbitrage opportunity at a settlement window."""
    symbol: str
    hl_funding_rate: Decimal        # per HL funding period (1h), fraction e.g. 0.0001
    aster_funding_rate: Decimal     # per Aster funding period (8h), fraction
    hl_is_long: bool                # True → HL side is LONG, Aster side is SHORT
    hl_price: Decimal               # Mark price at evaluation time
    aster_price: Decimal
    funding_interval_hours: Decimal = Decimal("8")  # Aster settlement interval

    # Populated by FeeCalculator.evaluate()
    gross_spread: Decimal = Decimal("0")        # |aster_rate - hl_rate_8h_equiv|
    total_fee_fraction: Decimal = Decimal("0")  # as fraction of notional
    net_spread: Decimal = Decimal("0")          # gross_spread - fees
    expected_profit_usdc: Decimal = Decimal("0")
    is_profitable: bool = False

    # Order sizing (populated by FeeCalculator.compute_sizes())
    hl_size: Decimal = Decimal("0")       # base asset quantity
    aster_size: Decimal = Decimal("0")    # base asset quantity
    hl_notional: Decimal = Decimal("0")   # USDC
    aster_notional: Decimal = Decimal("0")


@dataclass
class ExchangeSizeParams:
    """Per-symbol size constraints from the exchange."""
    symbol: str
    lot_size: Decimal           # minimum size increment (e.g. 0.001 BTC)
    min_notional_usdc: Decimal  # minimum order value
    max_leverage: int = 100


class FeeCalculator:
    """
    Calculates fees, spread profitability, and size alignment for arb trades.

    Settlement-timed strategy note
    --------------------------------
    We hold a position for only ~30 seconds (T-15s to T+15s). The funding
    is captured exactly once at the settlement instant.  Price P&L should
    theoretically cancel across the two delta-neutral legs.

    Net P&L per trade:
        = (aster_funding_rate × aster_notional)       # funding received/paid on Aster
        + (hl_funding_rate × hl_notional)              # funding received/paid on HL
        - (hl_taker × 2 + aster_taker × 2) × notional # round-trip fees
    """

    def __init__(self, config: dict) -> None:
        trading = config.get("trading", {})
        fees_cfg = config.get("fees", {})

        self.leverage = Decimal(str(trading.get("leverage", 3)))
        total_cap = Decimal(str(config["trading"]["total_capital_usdc"]))
        split_hl = Decimal(str(config["trading"].get("capital_split_hl", 0.5)))
        split_aster = Decimal(str(config["trading"].get("capital_split_aster", 0.5)))

        self.capital_hl = total_cap * split_hl
        self.capital_aster = total_cap * split_aster
        self.fees = FeeConfig.from_dict(fees_cfg)
        self.min_net_spread = Decimal(str(
            trading.get("min_net_spread", "0.0018")
        ))

    # ------------------------------------------------------------------
    # Core spread evaluation
    # ------------------------------------------------------------------

    def evaluate(self, opp: ArbOpportunity) -> ArbOpportunity:
        """
        Compute gross_spread, fees, net_spread, expected_profit_usdc,
        and is_profitable on the opportunity object.

        We always use MARKET orders (taker) for both open and close to
        guarantee fill inside the 15-second entry window.

        Fee formula (round-trip, both legs):
            fee_fraction = (hl_taker + aster_taker) × 2

        The Aster funding rate (8h) is compared directly to the HL funding
        rate (1h). Because both exchanges settle at the SAME moment at each
        8-hour boundary, we collect:
            - HL: 1h funding rate × HL notional
            - Aster: 8h funding rate × Aster notional
        The 8h Aster rate is already the cumulative amount for that period,
        NOT an hourly rate. No normalization needed.
        """
        # Always taker for both open and close (speed required)
        fee_fraction = (
            (self.fees.hl_taker_fee + self.fees.aster_taker_fee) * Decimal("2")
            + self.fees.fee_safety_buffer
        )

        # Both exchanges settle at the same instant at the 8-hour mark.
        # gross_spread = absolute difference between what we receive vs. pay.
        # We pick the direction such that aster_rate > hl_rate (see main.py).
        gross_spread = abs(opp.aster_funding_rate - opp.hl_funding_rate)

        net_spread = gross_spread - fee_fraction

        # Expected profit in USDC (use the smaller notional to be conservative)
        notional = min(
            self.capital_hl * self.leverage,
            self.capital_aster * self.leverage,
        )
        expected_profit = net_spread * notional

        opp.gross_spread = gross_spread
        opp.total_fee_fraction = fee_fraction
        opp.net_spread = net_spread
        opp.expected_profit_usdc = expected_profit
        opp.is_profitable = net_spread > self.min_net_spread

        log.debug(
            "spread_evaluation",
            symbol=opp.symbol,
            gross_spread=float(gross_spread),
            fee_fraction=float(fee_fraction),
            net_spread=float(net_spread),
            expected_profit_usdc=float(expected_profit),
            is_profitable=opp.is_profitable,
        )
        return opp

    # ------------------------------------------------------------------
    # Size alignment
    # ------------------------------------------------------------------

    def compute_sizes(
        self,
        opp: ArbOpportunity,
        hl_params: ExchangeSizeParams,
        aster_params: ExchangeSizeParams,
    ) -> ArbOpportunity:
        """
        Calculate aligned order sizes for both exchanges so that:
          1. Both sides have equal notional (delta-neutral).
          2. Each size is a valid lot-size multiple.
          3. Each notional meets the exchange minimum.
          4. Size is achievable with capital × leverage.
        """
        max_notional_hl = self.capital_hl * self.leverage
        max_notional_aster = self.capital_aster * self.leverage

        raw_hl_size = max_notional_hl / opp.hl_price
        raw_aster_size = max_notional_aster / opp.aster_price

        aligned_hl = self._floor_to_lot(raw_hl_size, hl_params.lot_size)
        aligned_aster = self._floor_to_lot(raw_aster_size, aster_params.lot_size)

        hl_notional = aligned_hl * opp.hl_price
        aster_notional = aligned_aster * opp.aster_price

        # Both sides trade the same underlying asset at nearly identical prices.
        # Use the SMALLER quantity for both sides to guarantee delta-neutrality.
        # This avoids a lot-size rounding bug where trying to match notionals
        # across slightly different prices can floor the second side down by a
        # full lot (e.g. 0.002 → 0.001 BTC), creating a 2:1 imbalance.
        if aligned_hl != aligned_aster:
            min_qty = min(aligned_hl, aligned_aster)
            aligned_hl = min_qty
            aligned_aster = min_qty

        hl_notional = aligned_hl * opp.hl_price
        aster_notional = aligned_aster * opp.aster_price

        # Validate minimums
        if hl_notional < hl_params.min_notional_usdc:
            log.warning(
                "hl_size_below_minimum",
                symbol=opp.symbol,
                notional=float(hl_notional),
                min_required=float(hl_params.min_notional_usdc),
            )
            opp.is_profitable = False
            return opp

        if aster_notional < aster_params.min_notional_usdc:
            log.warning(
                "aster_size_below_minimum",
                symbol=opp.symbol,
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
        )
        return opp

    def compute_round_trip_fees_usdc(self, notional: Decimal) -> Decimal:
        """Return total fee cost in USDC for a complete round trip."""
        return (
            (self.fees.hl_taker_fee + self.fees.aster_taker_fee)
            * Decimal("2")
            * notional
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _floor_to_lot(size: Decimal, lot: Decimal) -> Decimal:
        if lot <= 0:
            return size
        return (size / lot).to_integral_value(rounding=ROUND_DOWN) * lot

    def annualised_yield(
        self,
        net_spread_per_period: Decimal,
        periods_per_year: int,
    ) -> Decimal:
        return net_spread_per_period * periods_per_year * Decimal("100")
