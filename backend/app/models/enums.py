import enum


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    SETTLED = "SETTLED"
    DISPUTED = "DISPUTED"
    REFUNDED = "REFUNDED"


class DepositStatus(str, enum.Enum):
    UNMATCHED = "UNMATCHED"
    EXACT_MATCHED = "EXACT_MATCHED"
    FUZZY_MATCHED = "FUZZY_MATCHED"
    SUBSET_MATCHED = "SUBSET_MATCHED"
    EXCEPTION = "EXCEPTION"


class ExceptionStatus(str, enum.Enum):
    OPEN = "OPEN"
    AI_TRIAGED = "AI_TRIAGED"
    PENDING_HUMAN_REVIEW = "PENDING_HUMAN_REVIEW"
    RESOLVED = "RESOLVED"
    ESCALATED = "ESCALATED"


class ResolutionType(str, enum.Enum):
    DETERMINISTIC_FINDING = "DETERMINISTIC_FINDING"
    AI_RESEARCHED = "AI_RESEARCHED"


class BatchStatus(str, enum.Enum):
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    RESUMED = "RESUMED"


class EngineType(str, enum.Enum):
    EXACT = "EXACT"
    FUZZY = "FUZZY"
    SUBSET_SUM = "SUBSET_SUM"
    AI_ASSISTED = "AI_ASSISTED"
