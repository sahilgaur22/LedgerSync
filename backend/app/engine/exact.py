import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.enums import DepositStatus, EngineType
from backend.app.models.models import BankDeposit, GatewayPayout, ReconciliationJournal


def extract_potential_utr(narrative: str) -> Optional[str]:
    """
    Extracts potential UTR token from a clean bank narrative.
    Matches standard patterns like /UTR2026.../ or CMS/NEFT/UTR.../
    """
    # Look for UTR token pattern e.g. UTR202608000001RZP or similar alphanumeric 12-25 chars
    match = re.search(r"(UTR[A-Za-z0-9]+)", narrative)
    if match:
        return match.group(1)
    return None


class ExactMatchEngine:
    """
    Deterministic Exact Match Engine:
    Matches Bank Deposits against Gateway Payouts by:
    1. Exact UTR reference match (extracted from narrative) AND
    2. Exact amount match (deposit_amount_paise == net_payout_paise).

    Idempotent: writes to reconciliation_journal with UNIQUE(deposit_id) constraint.
    """

    def __init__(self, db: Session):
        self.db = db

    def match_deposit(
        self, deposit: BankDeposit, payouts_by_utr: Dict[str, GatewayPayout]
    ) -> Optional[Tuple[GatewayPayout, float]]:
        utr_token = extract_potential_utr(deposit.narrative_raw)
        if not utr_token:
            return None

        payout = payouts_by_utr.get(utr_token)
        if payout and payout.net_payout_paise == deposit.deposit_amount_paise:
            # Exact match on both UTR and net amount
            return payout, 1.0000

        return None

    def reconcile_exact(
        self, deposits: List[BankDeposit]
    ) -> Tuple[List[ReconciliationJournal], List[BankDeposit]]:
        """
        Runs exact matching over provided deposits.
        Returns list of newly journaled matches and list of remaining unmatched deposits.
        """
        # Fetch all gateway payouts into memory for fast lookup
        payouts = self.db.scalars(select(GatewayPayout)).all()
        payouts_by_utr = {p.utr_id: p for p in payouts}

        matched_journals: List[ReconciliationJournal] = []
        unmatched_deposits: List[BankDeposit] = []

        for deposit in deposits:
            # Skip if already journaled or matched
            if deposit.status != DepositStatus.UNMATCHED:
                continue

            match_result = self.match_deposit(deposit, payouts_by_utr)
            if match_result:
                payout, confidence = match_result
                journal_entry = ReconciliationJournal(
                    deposit_id=deposit.id,
                    payout_id=payout.id,
                    engine=EngineType.EXACT.value,
                    confidence=confidence,
                )
                deposit.status = DepositStatus.EXACT_MATCHED
                matched_journals.append(journal_entry)
            else:
                unmatched_deposits.append(deposit)

        # Idempotent write: commit matches
        if matched_journals:
            self.db.add_all(matched_journals)
            self.db.commit()

        return matched_journals, unmatched_deposits
