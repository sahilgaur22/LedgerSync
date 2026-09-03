"""initial_schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-08-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enums
    order_status_enum = sa.Enum("PENDING", "SETTLED", "DISPUTED", "REFUNDED", name="order_status")
    deposit_status_enum = sa.Enum(
        "UNMATCHED",
        "EXACT_MATCHED",
        "FUZZY_MATCHED",
        "SUBSET_MATCHED",
        "EXCEPTION",
        name="deposit_status",
    )
    exception_status_enum = sa.Enum(
        "OPEN",
        "AI_TRIAGED",
        "PENDING_HUMAN_REVIEW",
        "RESOLVED",
        "ESCALATED",
        name="exception_status",
    )
    resolution_type_enum = sa.Enum("DETERMINISTIC_FINDING", "AI_RESEARCHED", name="resolution_type")

    # 2. gateway_payouts
    op.create_table(
        "gateway_payouts",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("utr_id", sa.Text(), nullable=False),
        sa.Column("gross_amount_paise", sa.BigInteger(), nullable=False),
        sa.Column("net_payout_paise", sa.BigInteger(), nullable=False),
        sa.Column("payout_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("utr_id"),
    )

    # 3. merchant_orders
    op.create_table(
        "merchant_orders",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("payout_id", sa.Uuid(), nullable=True),
        sa.Column("receipt_id", sa.Text(), nullable=False),
        sa.Column("amount_paise", sa.BigInteger(), nullable=False),
        sa.Column("status", order_status_enum, server_default="PENDING", nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_paise > 0", name="chk_merchant_orders_amount_paise"),
        sa.ForeignKeyConstraint(["payout_id"], ["gateway_payouts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "merchant_id", "receipt_id", name="uq_merchant_orders_merchant_receipt"
        ),
    )

    # 4. bank_deposits
    op.create_table(
        "bank_deposits",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("narrative_raw", sa.Text(), nullable=False),
        sa.Column("narrative_hash", sa.Text(), nullable=False),
        sa.Column("deposit_amount_paise", sa.BigInteger(), nullable=False),
        sa.Column("deposit_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", deposit_status_enum, server_default="UNMATCHED", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "narrative_hash",
            "deposit_amount_paise",
            "deposit_date",
            name="uq_bank_deposits_hash_amount_date",
        ),
    )
    op.create_index("idx_bank_deposits_date", "bank_deposits", ["deposit_date"])

    # 5. fee_contracts
    op.create_table(
        "fee_contracts",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("mdr_rate_bps", sa.Integer(), nullable=False),
        sa.Column("tax_rate_bps", sa.Integer(), nullable=False),
        sa.Column(
            "effective_from",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 6. tax_and_fee_lines
    op.create_table(
        "tax_and_fee_lines",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("payout_id", sa.Uuid(), nullable=False),
        sa.Column("line_type", sa.Text(), nullable=False),
        sa.Column("tax_basis_paise", sa.BigInteger(), nullable=False),
        sa.Column("deducted_amount_paise", sa.BigInteger(), nullable=False),
        sa.Column("expected_amount_paise", sa.BigInteger(), nullable=False),
        sa.Column(
            "variance_paise",
            sa.BigInteger(),
            sa.Computed("deducted_amount_paise - expected_amount_paise", persisted=True),
        ),
        sa.ForeignKeyConstraint(["payout_id"], ["gateway_payouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. financial_adjustments
    op.create_table(
        "financial_adjustments",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("payout_id", sa.Uuid(), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("deduction_paise", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["merchant_orders.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["payout_id"], ["gateway_payouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. reconciliation_journal
    op.create_table(
        "reconciliation_journal",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("deposit_id", sa.Uuid(), nullable=False),
        sa.Column("payout_id", sa.Uuid(), nullable=True),
        sa.Column("engine", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=5, scale=4), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["deposit_id"], ["bank_deposits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payout_id"], ["gateway_payouts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deposit_id"),
    )

    # 9. audit_exceptions
    op.create_table(
        "audit_exceptions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("resolution_type", resolution_type_enum, nullable=False),
        sa.Column("ai_hypothesis", sa.Text(), nullable=True),
        sa.Column("evidence_refs", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("confidence", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("status", exception_status_enum, server_default="OPEN", nullable=False),
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 10. reconciliation_batches
    op.create_table(
        "reconciliation_batches",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("exact_matches", sa.Integer(), server_default="0", nullable=False),
        sa.Column("fuzzy_matches", sa.Integer(), server_default="0", nullable=False),
        sa.Column("subset_matches", sa.Integer(), server_default="0", nullable=False),
        sa.Column("exceptions", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rows_processed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("execution_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="RUNNING", nullable=False),
        sa.Column(
            "matched_rows",
            sa.Integer(),
            sa.Computed("exact_matches + fuzzy_matches + subset_matches", persisted=True),
        ),
        sa.Column(
            "match_rate",
            sa.Numeric(precision=5, scale=4),
            sa.Computed(
                "CASE WHEN total_rows > 0 THEN (exact_matches + fuzzy_matches + subset_matches)::numeric / total_rows ELSE 0 END",
                persisted=True,
            ),
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("reconciliation_batches")
    op.drop_table("audit_exceptions")
    op.drop_table("reconciliation_journal")
    op.drop_table("financial_adjustments")
    op.drop_table("tax_and_fee_lines")
    op.drop_table("fee_contracts")
    op.drop_index("idx_bank_deposits_date", table_name="bank_deposits")
    op.drop_table("bank_deposits")
    op.drop_table("merchant_orders")
    op.drop_table("gateway_payouts")

    op.execute("DROP TYPE IF EXISTS resolution_type")
    op.execute("DROP TYPE IF EXISTS exception_status")
    op.execute("DROP TYPE IF EXISTS deposit_status")
    op.execute("DROP TYPE IF EXISTS order_status")
