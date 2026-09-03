import uuid

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    Computed,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import JSON, Uuid

from backend.app.core.database import Base
from backend.app.models.enums import (
    BatchStatus,
    DepositStatus,
    ExceptionStatus,
    OrderStatus,
    ResolutionType,
)

# Cross-dialect JSON type
JSONType = JSONB().with_variant(JSON(), "sqlite")
UUIDType = PG_UUID(as_uuid=True).with_variant(Uuid(), "sqlite")


class MerchantOrder(Base):
    __tablename__ = "merchant_orders"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    payout_id = Column(UUIDType, ForeignKey("gateway_payouts.id", ondelete="SET NULL"), nullable=True)
    receipt_id = Column(Text, nullable=False)
    amount_paise = Column(BigInteger, nullable=False)
    status = Column(Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.PENDING)
    merchant_id = Column(UUIDType, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="chk_merchant_orders_amount_paise"),
        UniqueConstraint("merchant_id", "receipt_id", name="uq_merchant_orders_merchant_receipt"),
    )


class GatewayPayout(Base):
    __tablename__ = "gateway_payouts"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    utr_id = Column(Text, nullable=False, unique=True)
    gross_amount_paise = Column(BigInteger, nullable=False)
    net_payout_paise = Column(BigInteger, nullable=False)
    payout_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class BankDeposit(Base):
    __tablename__ = "bank_deposits"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    narrative_raw = Column(Text, nullable=False)
    narrative_hash = Column(Text, nullable=False)
    deposit_amount_paise = Column(BigInteger, nullable=False)
    deposit_date = Column(DateTime(timezone=True), nullable=False, index=True)
    status = Column(Enum(DepositStatus, name="deposit_status"), nullable=False, default=DepositStatus.UNMATCHED)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "narrative_hash",
            "deposit_amount_paise",
            "deposit_date",
            name="uq_bank_deposits_hash_amount_date",
        ),
        Index("idx_bank_deposits_date", "deposit_date"),
    )


class FeeContract(Base):
    __tablename__ = "fee_contracts"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    merchant_id = Column(UUIDType, nullable=False)
    mdr_rate_bps = Column(Integer, nullable=False)
    tax_rate_bps = Column(Integer, nullable=False)
    effective_from = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TaxAndFeeLine(Base):
    __tablename__ = "tax_and_fee_lines"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    payout_id = Column(UUIDType, ForeignKey("gateway_payouts.id", ondelete="CASCADE"), nullable=False)
    line_type = Column(Text, nullable=False)
    tax_basis_paise = Column(BigInteger, nullable=False)
    deducted_amount_paise = Column(BigInteger, nullable=False)
    expected_amount_paise = Column(BigInteger, nullable=False)
    variance_paise = Column(
        BigInteger,
        Computed("deducted_amount_paise - expected_amount_paise", persisted=True),
    )


class FinancialAdjustment(Base):
    __tablename__ = "financial_adjustments"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    payout_id = Column(UUIDType, ForeignKey("gateway_payouts.id", ondelete="CASCADE"), nullable=True)
    order_id = Column(UUIDType, ForeignKey("merchant_orders.id", ondelete="SET NULL"), nullable=True)
    type = Column(Text, nullable=False)
    deduction_paise = Column(BigInteger, nullable=False)


class ReconciliationJournal(Base):
    __tablename__ = "reconciliation_journal"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    deposit_id = Column(UUIDType, ForeignKey("bank_deposits.id", ondelete="CASCADE"), nullable=False, unique=True)
    payout_id = Column(UUIDType, ForeignKey("gateway_payouts.id", ondelete="SET NULL"), nullable=True)
    engine = Column(Text, nullable=False)
    confidence = Column(Numeric(5, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AuditException(Base):
    __tablename__ = "audit_exceptions"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    source_id = Column(UUIDType, nullable=False)
    type = Column(Text, nullable=False)
    resolution_type = Column(Enum(ResolutionType, name="resolution_type"), nullable=False)
    ai_hypothesis = Column(Text, nullable=True)
    evidence_refs = Column(JSONType, nullable=True)
    confidence = Column(Numeric(5, 4), nullable=True)
    status = Column(Enum(ExceptionStatus, name="exception_status"), nullable=False, default=ExceptionStatus.OPEN)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    exact_matches = Column(Integer, nullable=False, default=0)
    fuzzy_matches = Column(Integer, nullable=False, default=0)
    subset_matches = Column(Integer, nullable=False, default=0)
    exceptions = Column(Integer, nullable=False, default=0)
    rows_processed = Column(Integer, nullable=False, default=0)
    total_rows = Column(Integer, nullable=False)
    execution_ms = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default=BatchStatus.RUNNING.value)
    matched_rows = Column(
        Integer,
        Computed("exact_matches + fuzzy_matches + subset_matches", persisted=True),
    )
    match_rate = Column(
        Numeric(5, 4),
        Computed(
            "CASE WHEN total_rows > 0 THEN (exact_matches + fuzzy_matches + subset_matches)::numeric / total_rows ELSE 0 END",
            persisted=True,
        ),
    )
