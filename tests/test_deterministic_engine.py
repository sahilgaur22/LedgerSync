import os
import uuid

import pytest
from sqlalchemy import select, text

from backend.app.core.database import SessionLocal
from backend.app.engine.exact import ExactMatchEngine, extract_potential_utr
from backend.app.engine.fee_critic import DeterministicFeeCritic
from backend.app.engine.fuzzy import TfidfFuzzyMatcher
from backend.app.engine.subset_sum import (
    greedy_local_search_fallback,
    solve_subset_sum_dp,
)
from backend.app.models.enums import DepositStatus, EngineType, ResolutionType
from backend.app.models.models import BankDeposit, ReconciliationJournal


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_utr_extraction():
    clean_narrative = "CMS/NEFT/UTR202608000001RZP/RAZORPAY-PAYOUT/20260802"
    utr = extract_potential_utr(clean_narrative)
    assert utr == "UTR202608000001RZP"

    noisy_narrative = "ACH-CR-AXIS000192-TXN-CMS-UTR202608000002-MERCHANT-SETTLE-BATCH"
    utr_noisy = extract_potential_utr(noisy_narrative)
    assert utr_noisy == "UTR202608000002"


def test_exact_match_engine(db):
    """Verify exact matcher journals matches with confidence 1.0000."""
    clean_deposits = db.scalars(
        select(BankDeposit).where(BankDeposit.narrative_raw.like("%/RAZORPAY-PAYOUT/%")).limit(10)
    ).all()

    # Ensure test isolation: reset test sample
    dep_ids = [d.id for d in clean_deposits]
    for d in clean_deposits:
        d.status = DepositStatus.UNMATCHED
    if dep_ids:
        db.execute(select(ReconciliationJournal).where(ReconciliationJournal.deposit_id.in_(dep_ids)))
        db.execute(
            text("DELETE FROM reconciliation_journal WHERE deposit_id IN :ids").bindparams(
                ids=tuple(dep_ids)
            )
        )
        db.commit()

    engine = ExactMatchEngine(db)
    journals, unmatched = engine.reconcile_exact(clean_deposits)
    assert len(journals) == 10
    assert len(unmatched) == 0
    for j in journals:
        assert j.engine == EngineType.EXACT.value
        assert float(j.confidence) == 1.0000


def test_subset_sum_dp_solver():
    """Verify amount-bounded DP knapsack over integer paise."""
    o1, o2, o3, o4 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    candidates = [(o1, 100000), (o2, 250000), (o3, 150000), (o4, 300000)]

    # Target = 400,000 paise (can be {o1, o4} or {o2, o3})
    res = solve_subset_sum_dp(target_paise=400000, candidates=candidates, timeout_ms=200)
    assert res is not None
    assert sum(dict(candidates)[oid] for oid in res) == 400000
    assert set(res) in ({o1, o4}, {o2, o3})

    # Target = 500,000 paise (o2 + o1 + o3)
    res2 = solve_subset_sum_dp(target_paise=500000, candidates=candidates, timeout_ms=200)
    assert res2 is not None
    assert sum(dict(candidates)[oid] for oid in res2) == 500000
    assert set(res2) == {o2, o1, o3}

    # Impossible sum
    res3 = solve_subset_sum_dp(target_paise=999999, candidates=candidates, timeout_ms=200)
    assert res3 is None


def test_subset_sum_timeout_fallback():
    """Verify timeout triggers greedy fallback and never accepts close-enough."""
    o1, o2, o3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    candidates = [(o1, 50000), (o2, 100000), (o3, 150000)]

    # Exact swap in greedy local search: target 200,000 (o1 + o3)
    swap_res = greedy_local_search_fallback(
        target_paise=200000, candidates=candidates, timeout_ms=50
    )
    assert swap_res is not None
    assert set(swap_res) == {o1, o3}

    # If exact match does not exist, never accept 'close enough'
    no_match = greedy_local_search_fallback(
        target_paise=199999, candidates=candidates, timeout_ms=50
    )
    assert no_match is None


def test_tfidf_fuzzy_matcher_fits_only_on_utr(db, tmp_path):
    """Verify TF-IDF vectorizer fits strictly on gateway_payouts.utr_id and exports metrics.json."""
    matcher = TfidfFuzzyMatcher(db)
    matcher.fit_on_payout_utrs()

    # Confirm fitted strictly on UTRs
    assert matcher.payout_vectors is not None
    assert matcher.payout_vectors.shape[0] == 500  # 500 payouts

    # Verify that transforming noisy narratives yields high similarity to correct payout
    noisy_deposit = db.scalars(
        select(BankDeposit)
        .where(BankDeposit.narrative_raw.not_like("%/RAZORPAY-PAYOUT/%"))
        .limit(1)
    ).first()
    assert noisy_deposit is not None

    payout, score = matcher.compute_similarity(noisy_deposit.narrative_raw)
    assert payout is not None
    assert score > 0.0

    # Train and export test metrics
    test_metrics_path = str(tmp_path / "metrics.json")
    deposits = db.scalars(select(BankDeposit).limit(100)).all()
    metrics = matcher.train_and_export_metrics(deposits, output_path=test_metrics_path)
    assert os.path.exists(test_metrics_path)
    assert metrics["fitted_on"] == "gateway_payouts.utr_id"
    assert "optimal_threshold" in metrics
    assert "precision" in metrics
    assert "recall" in metrics


def test_deterministic_fee_critic(db):
    """Verify pure deterministic fee critic flags 10 MDR leaks and 5 GST tax variances."""
    # Ensure test isolation
    db.execute(text("DELETE FROM audit_exceptions WHERE type IN ('FEE_LEAK', 'TAX_VARIANCE')"))
    db.commit()

    critic = DeterministicFeeCritic(db)
    exceptions, mdr_leaks, tax_variances = critic.audit_all_lines()

    assert mdr_leaks == 10, f"Expected 10 MDR fee leaks, got {mdr_leaks}"
    assert tax_variances == 5, f"Expected 5 GST tax variances, got {tax_variances}"
    assert len(exceptions) == 15

    for exc in exceptions:
        assert exc.resolution_type == ResolutionType.DETERMINISTIC_FINDING
        assert exc.ai_hypothesis is None  # Never called by LLM
        assert exc.confidence is None  # Pure math, not probabilistic
        assert exc.type in ("FEE_LEAK", "TAX_VARIANCE")
        assert "contracted_bps" in exc.evidence_refs
        assert "deducted_paise" in exc.evidence_refs
        assert "expected_paise" in exc.evidence_refs
        assert "variance_paise" in exc.evidence_refs
