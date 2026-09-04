import logging
import time
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "CLOSED"  # Normal operation: requests flow to AI service
    OPEN = "OPEN"  # Tripped: requests fail immediately and trigger fallback
    HALF_OPEN = "HALF_OPEN"  # Testing recovery: trial request permitted


class CircuitBreakerOpenError(Exception):
    """Raised when an operation is attempted while the circuit breaker is OPEN."""

    pass


class CircuitBreaker:
    """
    Circuit Breaker with Exponential Backoff for External AI Service Resilience.
    - Prevents downstream cascading failures when Gemini is throttled (429) or unavailable (503).
    - If 5 consecutive failures occur, transitions to OPEN for recovery_timeout seconds (60.0s).
    - Graceful degradation: routes unresolved rows to PENDING_HUMAN_REVIEW with AI_SERVICE_DOWN.
    - Deterministic engines (exact, fuzzy, subset-sum) are completely decoupled and continue unhindered.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout_seconds: float = 60.0,
        name: str = "GeminiAgentCircuitBreaker",
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds

        self.state: CircuitState = CircuitState.CLOSED
        self.failure_count: int = 0
        self.last_failure_time: Optional[float] = None
        self.last_state_change_time: float = time.time()

    def can_execute(self) -> bool:
        """
        Determines whether an execution is permitted based on circuit state.
        """
        if self.state == CircuitState.CLOSED:
            return True

        now = time.time()
        if self.state == CircuitState.OPEN:
            # Check if cooldown timeout has expired
            if now - self.last_state_change_time >= self.recovery_timeout_seconds:
                logger.info(
                    "[%s] Recovery timeout (%.1fs) elapsed. Transitioning from OPEN -> HALF_OPEN.",
                    self.name,
                    self.recovery_timeout_seconds,
                )
                self.state = CircuitState.HALF_OPEN
                self.last_state_change_time = now
                return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            return True

        return False

    def record_success(self) -> None:
        """
        Records a successful AI call. Resets failure counters and closes circuit if half-open.
        """
        if self.state != CircuitState.CLOSED:
            logger.info("[%s] Call succeeded. Transitioning to CLOSED.", self.name)
            self.state = CircuitState.CLOSED
            self.last_state_change_time = time.time()

        self.failure_count = 0
        self.last_failure_time = None

    def record_failure(self, error: Optional[Exception] = None) -> None:
        """
        Records an AI call failure. Increments failure count and trips to OPEN if threshold exceeded.
        """
        self.failure_count += 1
        self.last_failure_time = time.time()
        logger.warning(
            "[%s] Call failure recorded (count: %d/%d). Error: %s",
            self.name,
            self.failure_count,
            self.failure_threshold,
            error,
        )

        if self.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN):
            if self.failure_count >= self.failure_threshold:
                logger.error(
                    "[%s] Failure threshold (%d) exceeded! TRIPPING CIRCUIT TO OPEN.",
                    self.name,
                    self.failure_threshold,
                )
                self.state = CircuitState.OPEN
                self.last_state_change_time = time.time()

    def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """
        Executes a callable under circuit breaker protection.
        Throws CircuitBreakerOpenError if circuit is OPEN.
        """
        if not self.can_execute():
            raise CircuitBreakerOpenError(
                f"Circuit breaker '{self.name}' is OPEN. External AI service is unavailable."
            )

        try:
            result = func(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure(e)
            raise


# Global singleton instance for AI agent calls
ai_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout_seconds=60.0)
