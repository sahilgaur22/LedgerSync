from typing import List, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.enums import ExceptionStatus, ResolutionType
from backend.app.models.models import AuditException, FeeContract, TaxAndFeeLine


class DeterministicFeeCritic:
    """
    Pure Deterministic Fee Critic:
    Performs exact basis-point integer math against active fee_contracts.
    Zero ML model in this path.

    - MDR check: expected_mdr = round(tax_basis_paise * mdr_rate_bps / 10,000)
      If deducted <> expected -> flags FEE_LEAK
    - GST check: expected_gst = round(tax_basis_paise * tax_rate_bps / 10,000)
      If deducted <> expected -> flags TAX_VARIANCE

    All flagged exceptions are tagged resolution_type = DETERMINISTIC_FINDING with ai_hypothesis = None.
    """

    def __init__(self, db: Session, tolerance_paise: int = settings.TOLERANCE_PAISE):
        self.db = db
        self.tolerance_paise = tolerance_paise

    def audit_all_lines(self) -> Tuple[List[AuditException], int, int]:
        """
        Scans all tax_and_fee_lines against active fee_contracts.
        Returns (created_exceptions, total_mdr_leaks, total_tax_variances).
        """
        # Fetch active fee contract
        contract = self.db.scalars(
            select(FeeContract).order_by(FeeContract.effective_from.desc())
        ).first()
        if not contract:
            return [], 0, 0

        # Fetch all lines
        lines = self.db.scalars(select(TaxAndFeeLine)).all()

        created_exceptions: List[AuditException] = []
        mdr_leaks_count = 0
        tax_variances_count = 0

        # Existing exceptions to avoid duplicates
        existing_source_ids = set(self.db.scalars(select(AuditException.source_id)).all())

        for line in lines:
            if line.line_type == "MDR":
                expected_fee_paise = round(line.tax_basis_paise * contract.mdr_rate_bps / 10000)
                variance = line.deducted_amount_paise - expected_fee_paise

                if abs(variance) > self.tolerance_paise:
                    mdr_leaks_count += 1
                    if line.id not in existing_source_ids:
                        exc = AuditException(
                            source_id=line.id,
                            type="FEE_LEAK",
                            resolution_type=ResolutionType.DETERMINISTIC_FINDING,
                            ai_hypothesis=None,  # Pure computed fact: nothing to hypothesize
                            evidence_refs={
                                "line_id": str(line.id),
                                "payout_id": str(line.payout_id),
                                "contract_id": str(contract.id),
                                "contracted_bps": contract.mdr_rate_bps,
                                "deducted_paise": line.deducted_amount_paise,
                                "expected_paise": expected_fee_paise,
                                "variance_paise": variance,
                            },
                            confidence=None,  # No confidence score for deterministic findings
                            status=ExceptionStatus.OPEN,
                        )
                        created_exceptions.append(exc)
                        existing_source_ids.add(line.id)

            elif line.line_type == "GST":
                expected_tax_paise = round(line.tax_basis_paise * contract.tax_rate_bps / 10000)
                variance = line.deducted_amount_paise - expected_tax_paise

                if abs(variance) > self.tolerance_paise:
                    tax_variances_count += 1
                    if line.id not in existing_source_ids:
                        exc = AuditException(
                            source_id=line.id,
                            type="TAX_VARIANCE",
                            resolution_type=ResolutionType.DETERMINISTIC_FINDING,
                            ai_hypothesis=None,  # Pure computed fact
                            evidence_refs={
                                "line_id": str(line.id),
                                "payout_id": str(line.payout_id),
                                "contract_id": str(contract.id),
                                "contracted_bps": contract.tax_rate_bps,
                                "deducted_paise": line.deducted_amount_paise,
                                "expected_paise": expected_tax_paise,
                                "variance_paise": variance,
                            },
                            confidence=None,
                            status=ExceptionStatus.OPEN,
                        )
                        created_exceptions.append(exc)
                        existing_source_ids.add(line.id)

        if created_exceptions:
            self.db.add_all(created_exceptions)
            self.db.commit()

        return created_exceptions, mdr_leaks_count, tax_variances_count
