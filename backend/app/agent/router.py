import logging
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.agent.client import GeminiResearchAgent, query_candidate_payouts_readonly
from backend.app.core.circuit_breaker import CircuitBreakerOpenError, ai_circuit_breaker
from backend.app.models.enums import ExceptionStatus, ResolutionType
from backend.app.models.models import AuditException, BankDeposit

logger = logging.getLogger(__name__)


class ExceptionRouter:
    """
    Architectural Exception Router:
    Enforces the fundamental separation between deterministic findings and AI-researched exceptions.

    1. DETERMINISTIC_FINDING (FEE_LEAK, TAX_VARIANCE):
       - Generated via basis-point math against fee_contracts.
       - NEVER invokes Gemini (zero LLM token spend, zero hallucinations).
       - ai_hypothesis remains None, confidence remains None.

    2. AI_RESEARCHED (UNMATCHED_DEPOSIT, SUBSET_SUM_TIMEOUT):
       - Genuinely ambiguous cases that failed all deterministic engines.
       - Protected by CircuitBreaker against external AI throttling or outages.
       - If circuit breaker trips, gracefully falls back to PENDING_HUMAN_REVIEW with AI_SERVICE_DOWN.
       - Rejects hypotheses lacking verifiable evidence_refs.
    """

    def __init__(self, db: Session, ai_agent: Optional[GeminiResearchAgent] = None):
        self.db = db
        self.ai_agent = ai_agent or GeminiResearchAgent()

    def route_and_process_exception(self, exception: AuditException) -> AuditException:
        """
        Routes an exception based on resolution_type with circuit breaker protection.
        """
        # Rule 1: Gate deterministic findings away from Gemini
        if exception.resolution_type == ResolutionType.DETERMINISTIC_FINDING:
            logger.info(
                "Exception %s is DETERMINISTIC_FINDING (%s). Bypassing AI agent.",
                exception.id,
                exception.type,
            )
            exception.ai_hypothesis = None
            exception.confidence = None
            return exception

        # Rule 2: Route AI_RESEARCHED exceptions to Gemini (with circuit breaker protection)
        if exception.resolution_type == ResolutionType.AI_RESEARCHED:
            # Query source bank deposit
            deposit = self.db.get(BankDeposit, exception.source_id)
            if not deposit:
                logger.warning(
                    "Source deposit %s not found for exception %s",
                    exception.source_id,
                    exception.id,
                )
                return exception

            # Read-only query for candidate payouts
            candidates = query_candidate_payouts_readonly(self.db, deposit)

            try:
                # Execute under circuit breaker protection
                ai_result = ai_circuit_breaker.call(
                    self.ai_agent.research_exception, deposit, candidates
                )

                hypothesis = ai_result.get("hypothesis")
                confidence = ai_result.get("confidence")
                evidence_refs = ai_result.get("evidence_refs", {})

                # Validation Rule: Reject hypothesis if confidence is provided without evidence_refs
                if confidence is not None and not evidence_refs.get("matched_payout_id"):
                    logger.warning(
                        "AI hypothesis for exception %s lacks verifiable matched_payout_id. Dropping confidence.",
                        exception.id,
                    )
                    confidence = None
                    hypothesis = (
                        "Hypothesis rejected: missing verifiable evidence_refs to candidate payout."
                    )

                exception.ai_hypothesis = hypothesis
                exception.confidence = confidence
                current_refs = exception.evidence_refs or {}
                current_refs.update(evidence_refs)
                exception.evidence_refs = current_refs
                exception.status = ExceptionStatus.OPEN

            except (CircuitBreakerOpenError, Exception) as e:
                # Circuit breaker tripped or external API failure: Graceful fallback
                logger.warning(
                    "Circuit breaker active or AI failure for exception %s: %s. Falling back to PENDING_HUMAN_REVIEW.",
                    exception.id,
                    e,
                )
                exception.ai_hypothesis = "External AI service unavailable (Circuit Breaker OPEN). Routed for human investigation."
                exception.confidence = None
                fallback_refs = exception.evidence_refs or {}
                fallback_refs.update(
                    {
                        "fallback_reason": "AI_SERVICE_DOWN",
                        "circuit_state": ai_circuit_breaker.state.value,
                    }
                )
                exception.evidence_refs = fallback_refs
                exception.status = ExceptionStatus.PENDING_HUMAN_REVIEW

            return exception

        return exception

    def process_all_open_exceptions(self) -> Dict[str, int]:
        """
        Processes all open exceptions in the database according to routing policy.
        Returns counts of deterministic findings vs AI-researched exceptions processed.
        """
        exceptions = self.db.scalars(
            select(AuditException).where(AuditException.status == ExceptionStatus.OPEN)
        ).all()

        deterministic_count = 0
        ai_researched_count = 0

        for exc in exceptions:
            if exc.resolution_type == ResolutionType.DETERMINISTIC_FINDING:
                deterministic_count += 1
                self.route_and_process_exception(exc)
            elif exc.resolution_type == ResolutionType.AI_RESEARCHED:
                ai_researched_count += 1
                self.route_and_process_exception(exc)

        self.db.commit()

        return {
            "deterministic_processed": deterministic_count,
            "ai_researched_processed": ai_researched_count,
            "total_processed": len(exceptions),
        }
