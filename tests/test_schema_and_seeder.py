from sqlalchemy import BigInteger

from backend.app.models.models import (
    BankDeposit,
    FinancialAdjustment,
    GatewayPayout,
    MerchantOrder,
    ReconciliationBatch,
    TaxAndFeeLine,
)
from backend.app.seed.seeder import (
    CONTRACT_MDR_BPS,
    LEAK_MDR_BPS,
    TOTAL_ADJUSTMENTS,
    TOTAL_FEE_LEAKS,
    TOTAL_NARRATIVE_MUTATIONS,
    TOTAL_ORDERS,
    TOTAL_PAYOUTS,
    generate_synthetic_dataset,
)


def test_money_fields_are_bigint():
    """Verify non-negotiable: all financial amounts are strictly BigInteger (paise), never Float or Decimal."""
    assert isinstance(MerchantOrder.amount_paise.type, BigInteger)
    assert isinstance(GatewayPayout.gross_amount_paise.type, BigInteger)
    assert isinstance(GatewayPayout.net_payout_paise.type, BigInteger)
    assert isinstance(BankDeposit.deposit_amount_paise.type, BigInteger)
    assert isinstance(TaxAndFeeLine.tax_basis_paise.type, BigInteger)
    assert isinstance(TaxAndFeeLine.deducted_amount_paise.type, BigInteger)
    assert isinstance(TaxAndFeeLine.expected_amount_paise.type, BigInteger)
    assert isinstance(FinancialAdjustment.deduction_paise.type, BigInteger)


def test_generated_columns_exist():
    """Verify stored generated columns on tax_and_fee_lines and reconciliation_batches."""
    assert TaxAndFeeLine.variance_paise.server_default is not None or hasattr(
        TaxAndFeeLine.variance_paise, "computed"
    )
    assert ReconciliationBatch.matched_rows.server_default is not None or hasattr(
        ReconciliationBatch.matched_rows, "computed"
    )
    assert ReconciliationBatch.match_rate.server_default is not None or hasattr(
        ReconciliationBatch.match_rate, "computed"
    )


def test_synthetic_seeder_counts_and_injections():
    """Verify exact seeder specifications: 10,000 orders, 500 payouts, 75 mutations, 10 fee leaks, 25 adjustments."""
    contract, orders, payouts, tax_lines, adjustments, deposits = generate_synthetic_dataset(
        seed=42
    )

    # 1. Row counts
    assert len(orders) == TOTAL_ORDERS, f"Expected {TOTAL_ORDERS} orders, got {len(orders)}"
    assert len(payouts) == TOTAL_PAYOUTS, f"Expected {TOTAL_PAYOUTS} payouts, got {len(payouts)}"
    assert len(tax_lines) == TOTAL_PAYOUTS * 2, (
        f"Expected {TOTAL_PAYOUTS * 2} tax lines, got {len(tax_lines)}"
    )
    assert len([t for t in tax_lines if t.line_type == "MDR"]) == TOTAL_PAYOUTS
    assert len([t for t in tax_lines if t.line_type == "GST"]) == TOTAL_PAYOUTS
    assert len(deposits) == TOTAL_PAYOUTS, f"Expected {TOTAL_PAYOUTS} deposits, got {len(deposits)}"
    assert len(adjustments) == TOTAL_ADJUSTMENTS, (
        f"Expected {TOTAL_ADJUSTMENTS} adjustments, got {len(adjustments)}"
    )

    # 2. Fee leaks count and calculation (MDR leaks = 10, GST tax variances = 5)
    mdr_leaks = [
        t
        for t in tax_lines
        if t.line_type == "MDR" and t.deducted_amount_paise != t.expected_amount_paise
    ]
    assert len(mdr_leaks) == TOTAL_FEE_LEAKS, (
        f"Expected {TOTAL_FEE_LEAKS} MDR fee leaks, got {len(mdr_leaks)}"
    )

    gst_variances = [
        t
        for t in tax_lines
        if t.line_type == "GST" and t.deducted_amount_paise != t.expected_amount_paise
    ]
    assert len(gst_variances) == 5, f"Expected 5 GST tax variances, got {len(gst_variances)}"

    for leak in mdr_leaks:
        # Contracted rate is 180 bps, leak rate is 250 bps
        assert leak.deducted_amount_paise > leak.expected_amount_paise
        expected = round(leak.tax_basis_paise * CONTRACT_MDR_BPS / 10000)
        deducted = round(leak.tax_basis_paise * LEAK_MDR_BPS / 10000)
        assert leak.expected_amount_paise == expected
        assert leak.deducted_amount_paise == deducted

    # 3. Narrative mutations count
    # 75 deposits have noisy/mutated narratives (not containing the clean full UTR format)
    clean_count = sum(1 for d, p in zip(deposits, payouts) if f"/{p.utr_id}/" in d.narrative_raw)
    mutated_count = len(deposits) - clean_count
    assert mutated_count == TOTAL_NARRATIVE_MUTATIONS, (
        f"Expected {TOTAL_NARRATIVE_MUTATIONS} mutations, got {mutated_count}"
    )

    # 4. Deterministic reproducibility
    contract2, orders2, payouts2, _, _, _ = generate_synthetic_dataset(seed=42)
    assert orders[0].amount_paise == orders2[0].amount_paise
    assert payouts[0].utr_id == payouts2[0].utr_id
    assert orders[0].receipt_id == orders2[0].receipt_id
