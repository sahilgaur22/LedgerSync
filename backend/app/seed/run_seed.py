import os
import sys

import pandas as pd

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.app.core.database import SessionLocal
from backend.app.seed.seeder import generate_synthetic_dataset


def export_to_csv(output_dir: str = "data"):
    os.makedirs(output_dir, exist_ok=True)
    contract, orders, payouts, tax_lines, adjustments, deposits = generate_synthetic_dataset()

    # Orders CSV
    orders_data = [
        {
            "id": str(o.id),
            "payout_id": str(o.payout_id) if o.payout_id else "",
            "receipt_id": o.receipt_id,
            "amount_paise": o.amount_paise,
            "status": o.status.value,
            "merchant_id": str(o.merchant_id),
            "created_at": o.created_at.isoformat(),
            "updated_at": o.updated_at.isoformat(),
        }
        for o in orders
    ]
    pd.DataFrame(orders_data).to_csv(os.path.join(output_dir, "merchant_orders.csv"), index=False)

    # Payouts CSV
    payouts_data = [
        {
            "id": str(p.id),
            "utr_id": p.utr_id,
            "gross_amount_paise": p.gross_amount_paise,
            "net_payout_paise": p.net_payout_paise,
            "payout_date": p.payout_date.isoformat(),
            "created_at": p.created_at.isoformat(),
        }
        for p in payouts
    ]
    pd.DataFrame(payouts_data).to_csv(os.path.join(output_dir, "gateway_payouts.csv"), index=False)

    # Bank Deposits CSV (the external bank statement of 500 rows!)
    deposits_data = [
        {
            "id": str(d.id),
            "narrative_raw": d.narrative_raw,
            "narrative_hash": d.narrative_hash,
            "deposit_amount_paise": d.deposit_amount_paise,
            "deposit_date": d.deposit_date.isoformat(),
            "status": d.status.value,
            "created_at": d.created_at.isoformat(),
            "updated_at": d.updated_at.isoformat(),
        }
        for d in deposits
    ]
    pd.DataFrame(deposits_data).to_csv(os.path.join(output_dir, "bank_deposits.csv"), index=False)

    # Tax & Fee Lines CSV
    tax_data = [
        {
            "id": str(t.id),
            "payout_id": str(t.payout_id),
            "line_type": t.line_type,
            "tax_basis_paise": t.tax_basis_paise,
            "deducted_amount_paise": t.deducted_amount_paise,
            "expected_amount_paise": t.expected_amount_paise,
        }
        for t in tax_lines
    ]
    pd.DataFrame(tax_data).to_csv(os.path.join(output_dir, "tax_and_fee_lines.csv"), index=False)

    # Financial Adjustments CSV
    adj_data = [
        {
            "id": str(a.id),
            "payout_id": str(a.payout_id) if a.payout_id else "",
            "order_id": str(a.order_id) if a.order_id else "",
            "type": a.type,
            "deduction_paise": a.deduction_paise,
        }
        for a in adjustments
    ]
    pd.DataFrame(adj_data).to_csv(
        os.path.join(output_dir, "financial_adjustments.csv"), index=False
    )

    # Fee Contract CSV
    contract_data = [
        {
            "id": str(contract.id),
            "merchant_id": str(contract.merchant_id),
            "mdr_rate_bps": contract.mdr_rate_bps,
            "tax_rate_bps": contract.tax_rate_bps,
            "effective_from": contract.effective_from.isoformat(),
        }
    ]
    pd.DataFrame(contract_data).to_csv(os.path.join(output_dir, "fee_contracts.csv"), index=False)

    print(f"Generated synthetic CSV datasets in '{output_dir}':")
    print(f"  - Orders: {len(orders)} rows")
    print(f"  - Payouts: {len(payouts)} rows")
    print(f"  - Bank Deposits: {len(deposits)} rows")
    print(f"  - Tax and Fee Lines: {len(tax_lines)} rows")
    print(f"  - Financial Adjustments: {len(adjustments)} rows")
    print(f"  - Fee Contracts: {len(contract_data)} row")


def seed_database():
    db = SessionLocal()
    try:
        from sqlalchemy import func, select

        from backend.app.models.models import BankDeposit
        existing_count = db.scalar(select(func.count(BankDeposit.id))) or 0
        if existing_count >= 500:
            print(f"Database already seeded ({existing_count} deposits found). Skipping seed.")
            return

        contract, orders, payouts, tax_lines, adjustments, deposits = generate_synthetic_dataset()
        db.add(contract)
        db.commit()

        # Add payouts and all tax lines
        db.add_all(payouts)
        db.add_all(tax_lines)
        db.commit()

        # Add orders in chunks
        chunk_size = 1000
        for i in range(0, len(orders), chunk_size):
            db.add_all(orders[i : i + chunk_size])
            db.commit()

        # Add adjustments
        db.add_all(adjustments)
        db.commit()

        # Add deposits
        db.add_all(deposits)
        db.commit()

        print("Database successfully seeded with synthetic dataset.")
    finally:
        db.close()


if __name__ == "__main__":
    export_to_csv()
