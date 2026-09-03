import hashlib
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Tuple

from faker import Faker

from backend.app.models.enums import DepositStatus, OrderStatus
from backend.app.models.models import (
    BankDeposit,
    FeeContract,
    FinancialAdjustment,
    GatewayPayout,
    MerchantOrder,
    TaxAndFeeLine,
)

FAKE_SEED = 42
TOTAL_ORDERS = 10000
TOTAL_PAYOUTS = 500
TOTAL_NARRATIVE_MUTATIONS = 75
TOTAL_FEE_LEAKS = 10
TOTAL_ADJUSTMENTS = 25
TOTAL_TAX_VARIANCES = 5
CONTRACT_MDR_BPS = 180  # 1.8%
CONTRACT_TAX_BPS = 1800  # 18%
LEAK_MDR_BPS = 250  # 2.5% (anomalous rate)
LEAK_TAX_BPS = 2800  # 28% (anomalous tax rate)


def compute_narrative_hash(narrative: str) -> str:
    return hashlib.sha256(narrative.encode("utf-8")).hexdigest()


def generate_synthetic_dataset(
    seed: int = FAKE_SEED,
) -> Tuple[
    FeeContract,
    List[MerchantOrder],
    List[GatewayPayout],
    List[TaxAndFeeLine],
    List[FinancialAdjustment],
    List[BankDeposit],
]:
    random.seed(seed)
    Faker.seed(seed)

    merchant_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    base_time = datetime(2026, 8, 1, 9, 0, 0, tzinfo=timezone.utc)

    # 1. Fee Contract
    contract = FeeContract(
        id=uuid.uuid4(),
        merchant_id=merchant_id,
        mdr_rate_bps=CONTRACT_MDR_BPS,
        tax_rate_bps=CONTRACT_TAX_BPS,
        effective_from=base_time - timedelta(days=60),
    )

    # 2. Generate 500 Gateway Payouts and distribute 10,000 orders
    # Each payout aggregates ~20 orders (with realistic variance)
    payouts: List[GatewayPayout] = []
    tax_lines: List[TaxAndFeeLine] = []
    orders: List[MerchantOrder] = []
    adjustments: List[FinancialAdjustment] = []

    # Designate indices for fee leaks (10 fee leaks)
    fee_leak_indices = set(random.sample(range(TOTAL_PAYOUTS), TOTAL_FEE_LEAKS))

    # Designate indices for tax variances (5 tax variances on GST)
    tax_variance_indices = set(random.sample(range(TOTAL_PAYOUTS), TOTAL_TAX_VARIANCES))

    # Designate indices for adjustments (25 adjustments)
    adjustment_payout_indices = set(random.sample(range(TOTAL_PAYOUTS), TOTAL_ADJUSTMENTS))

    # Distribute 10,000 orders across 500 payouts (average 20 orders per payout)
    orders_per_payout = [20] * TOTAL_PAYOUTS
    # Randomly jitter slightly while preserving sum = 10,000
    for _ in range(300):
        idx_from = random.randint(0, TOTAL_PAYOUTS - 1)
        idx_to = random.randint(0, TOTAL_PAYOUTS - 1)
        if orders_per_payout[idx_from] > 10 and orders_per_payout[idx_to] < 35:
            orders_per_payout[idx_from] -= 1
            orders_per_payout[idx_to] += 1

    order_counter = 0

    for p_idx in range(TOTAL_PAYOUTS):
        payout_id = uuid.uuid4()
        utr_id = f"UTR202608{p_idx + 1:06d}RZP"
        payout_date = base_time + timedelta(days=(p_idx % 28) + 1, hours=random.randint(1, 12))

        # Generate orders for this payout
        payout_order_count = orders_per_payout[p_idx]
        payout_orders: List[MerchantOrder] = []
        gross_amount_paise = 0

        for _ in range(payout_order_count):
            order_counter += 1
            # Realistic ticket size: Rs 500 to Rs 25,000 (50,000 to 2,500,000 paise)
            amount_paise = random.randint(500, 25000) * 100
            order_created = payout_date - timedelta(
                days=random.randint(0, 2),
                hours=random.randint(1, 23),
                minutes=random.randint(0, 59),
            )
            order = MerchantOrder(
                id=uuid.uuid4(),
                payout_id=payout_id,
                receipt_id=f"rcpt_ord_{order_counter:06d}",
                amount_paise=amount_paise,
                status=OrderStatus.SETTLED,
                merchant_id=merchant_id,
                created_at=order_created,
                updated_at=order_created,
            )
            payout_orders.append(order)
            gross_amount_paise += amount_paise

        orders.extend(payout_orders)

        # 1. MDR Line (checked against fee_contracts.mdr_rate_bps)
        expected_mdr_paise = round(gross_amount_paise * CONTRACT_MDR_BPS / 10000)
        if p_idx in fee_leak_indices:
            deducted_mdr_paise = round(gross_amount_paise * LEAK_MDR_BPS / 10000)
        else:
            deducted_mdr_paise = expected_mdr_paise

        tax_line_mdr = TaxAndFeeLine(
            id=uuid.uuid4(),
            payout_id=payout_id,
            line_type="MDR",
            tax_basis_paise=gross_amount_paise,
            deducted_amount_paise=deducted_mdr_paise,
            expected_amount_paise=expected_mdr_paise,
        )
        tax_lines.append(tax_line_mdr)

        # 2. GST Line (18% on MDR, checked against fee_contracts.tax_rate_bps)
        # DESIGN DECISION: GST tax_basis is intentionally set to expected_mdr_paise rather than
        # deducted_mdr_paise to keep MDR leaks and GST tax variances strictly orthogonal and non-compounding.
        # This prevents an MDR rate leak from causing a cascading phantom tax variance, ensuring FEE_LEAK
        # solely reflects MDR rate deviations and TAX_VARIANCE solely reflects tax rate misapplications (e.g. 28% vs 18%).
        expected_gst_paise = round(expected_mdr_paise * CONTRACT_TAX_BPS / 10000)
        if p_idx in tax_variance_indices:
            deducted_gst_paise = round(expected_mdr_paise * LEAK_TAX_BPS / 10000)
        else:
            deducted_gst_paise = expected_gst_paise

        tax_line_gst = TaxAndFeeLine(
            id=uuid.uuid4(),
            payout_id=payout_id,
            line_type="GST",
            tax_basis_paise=expected_mdr_paise,
            deducted_amount_paise=deducted_gst_paise,
            expected_amount_paise=expected_gst_paise,
        )
        tax_lines.append(tax_line_gst)

        # Injected adjustments (25 adjustments total)
        total_adjustment_paise = 0
        if p_idx in adjustment_payout_indices and payout_orders:
            adj_order = payout_orders[0]
            adj_type = random.choice(["CHARGEBACK", "REFUND"])
            adj_amount = round(adj_order.amount_paise * random.uniform(0.5, 1.0))
            adjustment = FinancialAdjustment(
                id=uuid.uuid4(),
                payout_id=payout_id,
                order_id=adj_order.id,
                type=adj_type,
                deduction_paise=adj_amount,
            )
            adjustments.append(adjustment)
            total_adjustment_paise = adj_amount

        net_payout_paise = (
            gross_amount_paise - deducted_mdr_paise - deducted_gst_paise - total_adjustment_paise
        )

        payout = GatewayPayout(
            id=payout_id,
            utr_id=utr_id,
            gross_amount_paise=gross_amount_paise,
            net_payout_paise=net_payout_paise,
            payout_date=payout_date,
            created_at=payout_date,
        )
        payouts.append(payout)

    # 3. Generate 500 Bank Deposits corresponding to the payouts
    # Include 75 narrative mutations
    mutation_indices = set(random.sample(range(TOTAL_PAYOUTS), TOTAL_NARRATIVE_MUTATIONS))
    deposits: List[BankDeposit] = []

    for p_idx, payout in enumerate(payouts):
        deposit_date = payout.payout_date + timedelta(hours=random.randint(2, 6))

        if p_idx in mutation_indices:
            # 75 Narrative mutations: noisy, truncated, or obfuscated UTR tokens
            mutation_kind = p_idx % 3
            if mutation_kind == 0:
                # Truncate UTR by dropping last 4 characters
                truncated_utr = payout.utr_id[:-4]
                raw_narrative = (
                    f"CMS/NEFT/{truncated_utr}/RZP-SETTLEMENT/NOREF-{random.randint(1000, 9999)}"
                )
            elif mutation_kind == 1:
                # Heavy bank noise prefix and suffix
                raw_narrative = (
                    f"ACH-CR-AXIS000192-TXN-CMS-{payout.utr_id[:12]}-MERCHANT-SETTLE-BATCH"
                )
            else:
                # Partial UTR embedded without slashes
                raw_narrative = f"NEFT CR {payout.utr_id[3:15]} RAZORPAY SOFTWARE PRIVATE LTD SETTL"
        else:
            # Clean standard bank narrative with exact UTR
            raw_narrative = (
                f"CMS/NEFT/{payout.utr_id}/RAZORPAY-PAYOUT/{deposit_date.strftime('%Y%m%d')}"
            )

        narrative_hash = compute_narrative_hash(raw_narrative)

        deposit = BankDeposit(
            id=uuid.uuid4(),
            narrative_raw=raw_narrative,
            narrative_hash=narrative_hash,
            deposit_amount_paise=payout.net_payout_paise,
            deposit_date=deposit_date,
            status=DepositStatus.UNMATCHED,
            created_at=deposit_date,
            updated_at=deposit_date,
        )
        deposits.append(deposit)

    return contract, orders, payouts, tax_lines, adjustments, deposits
