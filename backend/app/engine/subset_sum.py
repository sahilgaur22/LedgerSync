import time
import uuid
from datetime import timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.enums import ExceptionStatus, ResolutionType
from backend.app.models.models import AuditException, GatewayPayout, MerchantOrder


class SubsetSumTimeoutError(Exception):
    pass


def solve_subset_sum_dp(
    target_paise: int,
    candidates: List[Tuple[uuid.UUID, int]],
    timeout_ms: int = 200,
) -> Optional[List[uuid.UUID]]:
    """
    Amount-bounded DP subset-sum solver over integer paise amounts.
    Enforces a strict timeout (timeout_ms).
    Returns list of order IDs summing EXACTLY to target_paise, or None.
    """
    total_avail = sum(amt for _, amt in candidates)
    if total_avail < target_paise:
        return None
    if total_avail == target_paise:
        return [oid for oid, _ in candidates]

    start_time = time.perf_counter()
    timeout_sec = timeout_ms / 1000.0

    # dp[sum] = tuple of order_ids achieving this sum
    dp: Dict[int, Tuple[uuid.UUID, ...]] = {0: ()}

    # Sort candidates descending for faster branch pruning
    sorted_candidates = sorted(candidates, key=lambda x: x[1], reverse=True)

    for oid, amount in sorted_candidates:
        if time.perf_counter() - start_time > timeout_sec or len(dp) > 50000:
            raise SubsetSumTimeoutError("DP search exceeded timeout")

        if amount > target_paise:
            continue

        # Check existing sums
        new_entries: Dict[int, Tuple[uuid.UUID, ...]] = {}
        for prev_sum, path in list(dp.items()):
            if (len(new_entries) & 511 == 0) and (time.perf_counter() - start_time > timeout_sec):
                raise SubsetSumTimeoutError("DP search exceeded timeout")

            new_sum = prev_sum + amount
            if new_sum == target_paise:
                return list(path + (oid,))
            if new_sum < target_paise and new_sum not in dp:
                new_entries[new_sum] = path + (oid,)

        dp.update(new_entries)

    return None


def greedy_local_search_fallback(
    target_paise: int,
    candidates: List[Tuple[uuid.UUID, int]],
    timeout_ms: int = 50,
) -> Optional[List[uuid.UUID]]:
    """
    Fallback heuristic: greedy largest-amount-first followed by 1-swap local search.
    Never accepts 'close enough': ONLY returns if exact sum == target_paise.
    """
    start_time = time.perf_counter()
    timeout_sec = timeout_ms / 1000.0

    # Sort descending
    sorted_candidates = sorted(candidates, key=lambda x: x[1], reverse=True)

    # 1. Greedy pass
    chosen: List[Tuple[uuid.UUID, int]] = []
    current_sum = 0
    remaining: List[Tuple[uuid.UUID, int]] = []

    for oid, amt in sorted_candidates:
        if current_sum + amt <= target_paise:
            chosen.append((oid, amt))
            current_sum += amt
            if current_sum == target_paise:
                return [x[0] for x in chosen]
        else:
            remaining.append((oid, amt))

    # 2. Local 1-swap: try swapping one item in 'chosen' with one item in 'remaining'
    gap = target_paise - current_sum

    for c_idx, (c_id, c_amt) in enumerate(chosen):
        if time.perf_counter() - start_time > timeout_sec:
            break
        # We need an item in remaining with amount = c_amt + gap
        needed = c_amt + gap
        for r_id, r_amt in remaining:
            if r_amt == needed:
                # Exact swap found!
                swap_res = [x[0] for x in chosen if x[0] != c_id] + [r_id]
                return swap_res

    return None


class BoundedSubsetSumMatcher:
    """
    Time-windowed Bounded Subset-Sum Matching Engine.
    1. Prunes merchant_orders to [payout_date - settlement_window, payout_date].
    2. Runs amount-bounded DP knapsack with hard timeout (200ms).
    3. Falls back to greedy local search heuristic.
    4. If still unresolved, creates audit_exception with type SUBSET_SUM_TIMEOUT.
    """

    def __init__(self, db: Session, settlement_window_days: int = 3, timeout_ms: int = 200):
        self.db = db
        self.settlement_window_days = settlement_window_days
        self.timeout_ms = timeout_ms

    def match_orders_to_payout(self, payout: GatewayPayout) -> Optional[List[uuid.UUID]]:
        window_start = payout.payout_date - timedelta(days=self.settlement_window_days)
        window_end = payout.payout_date

        # Step 1: Time-window pruning
        stmt = select(MerchantOrder.id, MerchantOrder.amount_paise).where(
            MerchantOrder.created_at >= window_start,
            MerchantOrder.created_at <= window_end,
            MerchantOrder.payout_id == payout.id,
        )
        orders = self.db.execute(stmt).all()
        candidates = [(row[0], row[1]) for row in orders]

        if not candidates:
            return None

        # Step 2: Amount-bounded DP with hard timeout
        try:
            matched_ids = solve_subset_sum_dp(
                target_paise=payout.gross_amount_paise,
                candidates=candidates,
                timeout_ms=self.timeout_ms,
            )
            if matched_ids:
                return matched_ids
        except SubsetSumTimeoutError:
            pass  # Fall through to heuristic

        # Step 3: Fallback to greedy + local search heuristic
        matched_ids = greedy_local_search_fallback(
            target_paise=payout.gross_amount_paise,
            candidates=candidates,
            timeout_ms=50,
        )
        if matched_ids:
            return matched_ids

        # Step 4: Record unresolved exception — never block batch
        exc = AuditException(
            source_id=payout.id,
            type="SUBSET_SUM_TIMEOUT",
            resolution_type=ResolutionType.AI_RESEARCHED,
            evidence_refs={"payout_id": str(payout.id), "gross_paise": payout.gross_amount_paise},
            confidence=None,
            status=ExceptionStatus.OPEN,
        )
        self.db.add(exc)
        self.db.commit()

        return None
