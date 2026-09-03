import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

import psycopg2
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.seed.run_seed import seed_database


def run_verification():
    print("=" * 70)
    print("STEP 1: DATABASE TEARDOWN & REBUILD (Zero-State Proof)")
    print("=" * 70)

    # 1. Connect to base 'postgres' db to ensure 'ledgersync' database exists cleanly
    base_url = settings.DATABASE_URL
    # Parse db name
    prefix, db_name = base_url.rsplit("/", 1)
    admin_url = f"{prefix}/postgres"

    conn = psycopg2.connect(admin_url)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    exists = cur.fetchone()
    if exists:
        # Terminate existing connections to allow drop
        cur.execute(
            """
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = %s
              AND pid <> pg_backend_pid();
        """,
            (db_name,),
        )
        cur.execute(f'DROP DATABASE "{db_name}"')
        print(f"Dropped existing database '{db_name}'.")

    cur.execute(f'CREATE DATABASE "{db_name}"')
    print(f"Created fresh database '{db_name}'.")
    cur.close()
    conn.close()

    # 2. Run Alembic upgrade head from zero
    print("\nRunning Alembic migrations from zero (upgrade head)...")
    alembic_cfg = Config("backend/alembic.ini")
    command.upgrade(alembic_cfg, "head")
    print("Alembic migrations completed successfully.")

    # 3. Run Seeder into PostgreSQL
    print("\nSeeding PostgreSQL with synthetic dataset (Faker seed = 42)...")
    seed_database()
    print("Seeding complete.")

    # 4. Verification Queries
    db = SessionLocal()
    try:
        print("\n" + "=" * 70)
        print("QUERY 1: TABLE ROW COUNTS")
        print("=" * 70)
        tables = [
            "merchant_orders",
            "gateway_payouts",
            "bank_deposits",
            "financial_adjustments",
            "tax_and_fee_lines",
            "fee_contracts",
        ]
        for tbl in tables:
            cnt = db.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
            print(f"  {tbl:<25} : {cnt} rows")

        print("\n" + "=" * 70)
        print("QUERY 2: TAX_AND_FEE_LINES LINE_TYPE DISTRIBUTION & ANOMALIES")
        print("=" * 70)

        # 2a. Line type breakdown
        q_lines = "SELECT line_type, COUNT(*) FROM tax_and_fee_lines GROUP BY line_type ORDER BY line_type;"
        for r in db.execute(text(q_lines)).fetchall():
            print(f"  Line Type: {r[0]:<10} -> {r[1]} rows")

        # 2b. Mutated bank narratives count (narratives without standard clean pattern)
        q_mutations = """
            SELECT COUNT(*)
            FROM bank_deposits
            WHERE narrative_raw NOT LIKE '%/RAZORPAY-PAYOUT/%';
        """
        mutations_count = db.execute(text(q_mutations)).scalar()
        print(f"\n  Mutated/Truncated Narratives Count    : {mutations_count} (Expected: 75)")

        # 2c. MDR Fee Leaks count: where deducted fee deviates from contracted 180 bps
        q_fee_leaks = """
            SELECT
                COUNT(*) as leak_count,
                ROUND(AVG(deducted_amount_paise::numeric / NULLIF(tax_basis_paise, 0) * 10000)) as actual_deducted_bps,
                SUM(deducted_amount_paise - expected_amount_paise) as total_leak_paise
            FROM tax_and_fee_lines
            WHERE line_type = 'MDR' AND deducted_amount_paise <> expected_amount_paise;
        """
        leak_res = db.execute(text(q_fee_leaks)).fetchone()
        print(f"  MDR Fee Leaks Count (rate <> 180 bps) : {leak_res[0]} (Expected: 10)")
        print(
            f"  Average Deducted Rate for Leaks       : {leak_res[1]} bps (Contracted: 180 bps, Injected: 250 bps)"
        )
        print(
            f"  Total Fee Leakage Amount              : {leak_res[2]} paise (INR {leak_res[2] / 100:,.2f})"
        )

        # 2d. GST Tax Variances count: where deducted GST deviates from contracted 1800 bps
        q_tax_variances = """
            SELECT
                COUNT(*) as variance_count,
                ROUND(AVG(deducted_amount_paise::numeric / NULLIF(tax_basis_paise, 0) * 10000)) as actual_deducted_tax_bps,
                SUM(deducted_amount_paise - expected_amount_paise) as total_tax_variance_paise
            FROM tax_and_fee_lines
            WHERE line_type = 'GST' AND deducted_amount_paise <> expected_amount_paise;
        """
        tax_res = db.execute(text(q_tax_variances)).fetchone()
        print(f"  GST Tax Variances Count (rate <> 18%) : {tax_res[0]} (Expected: 5)")
        print(
            f"  Average Deducted Rate for Variances   : {tax_res[1]} bps (Contracted: 1800 bps, Injected: 2800 bps)"
        )
        print(
            f"  Total Tax Variance Amount             : {tax_res[2]} paise (INR {tax_res[2] / 100:,.2f})"
        )

        # 2e. Financial adjustments count
        adj_count = db.execute(text("SELECT COUNT(*) FROM financial_adjustments")).scalar()
        print(f"  Financial Adjustments Count           : {adj_count} (Expected: 25)")

        print("\n" + "=" * 70)
        print("QUERY 3: audit_exceptions SCHEMA IN POSTGRESQL")
        print("=" * 70)
        q_schema = """
            SELECT column_name, data_type, udt_name, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'audit_exceptions'
            ORDER BY ordinal_position;
        """
        print(f"  {'COLUMN NAME':<20} {'DATA TYPE':<15} {'UDT / ENUM':<25} {'NULLABLE'}")
        print("  " + "-" * 68)
        for row in db.execute(text(q_schema)).fetchall():
            print(f"  {row[0]:<20} {row[1]:<15} {row[2]:<25} {row[3]}")

        print("\n" + "=" * 70)
        print("QUERY 4: FINANCIAL MONEY COLUMNS DATA TYPE (BIGINT paise)")
        print("=" * 70)
        q_types = """
            SELECT table_name, column_name, data_type
            FROM information_schema.columns
            WHERE (table_name IN ('merchant_orders', 'gateway_payouts', 'bank_deposits', 'tax_and_fee_lines', 'financial_adjustments'))
              AND (column_name LIKE '%paise%' OR column_name LIKE '%amount%')
            ORDER BY table_name, column_name;
        """
        print(f"  {'TABLE NAME':<25} {'COLUMN NAME':<25} {'DATA TYPE'}")
        print("  " + "-" * 65)
        for row in db.execute(text(q_types)).fetchall():
            print(f"  {row[0]:<25} {row[1]:<25} {row[2]}")

        print("\n" + "=" * 70)
        print("QUERY 5: GENERATED STORED COLUMNS VERIFICATION")
        print("=" * 70)
        q_gen = """
            SELECT table_name, column_name, generation_expression, is_generated
            FROM information_schema.columns
            WHERE is_generated = 'ALWAYS'
            ORDER BY table_name, column_name;
        """
        print(f"  {'TABLE NAME':<25} {'COLUMN NAME':<20} {'IS_GENERATED':<15} {'EXPRESSION'}")
        print("  " + "-" * 75)
        for row in db.execute(text(q_gen)).fetchall():
            print(f"  {row[0]:<25} {row[1]:<20} {row[2]:<15} {row[3]}")

    finally:
        db.close()


if __name__ == "__main__":
    run_verification()
