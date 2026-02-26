from __future__ import annotations

import csv
import io
from datetime import date
from typing import Any

from dateutil.parser import parse as parse_dt


def _norm_amount(v: Any) -> float:
    if v is None:
        return 0.0
    s = str(v).strip().replace(",", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return float(s)


def _norm_date(v: Any) -> date:
    d = parse_dt(str(v)).date()
    return d


def parse_transactions_csv(content: bytes, source: str = "csv") -> list[dict[str, Any]]:
    text = content.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []

    for raw in reader:
        if not raw:
            continue

        desc = (raw.get("description") or raw.get("Description") or raw.get("narration") or raw.get("Narration") or "").strip()
        if not desc:
            continue

        # Handle separate Debit/Credit columns vs single Amount column
        debit = _norm_amount(raw.get("Debit") or raw.get("debit"))
        credit = _norm_amount(raw.get("Credit") or raw.get("credit"))
        amt_raw = raw.get("amount") or raw.get("Amount")
        
        if amt_raw:
            amount = _norm_amount(amt_raw)
        elif debit != 0:
            amount = -abs(debit)
        elif credit != 0:
            amount = abs(credit)
        else:
            amount = 0.0

        dt_raw = raw.get("date") or raw.get("Date") or raw.get("transaction_date")
        dt = _norm_date(dt_raw)

        counterparty = (raw.get("counterparty") or raw.get("Counterparty") or raw.get("merchant") or raw.get("Merchant") or "").strip() or None

        direction = raw.get("direction") or raw.get("Direction")
        if direction:
            direction = direction.strip().lower()
            direction = "in" if direction in {"in", "income", "credit", "cr"} else "out"
        else:
            # If no explicit direction, rely on amount sign
            # Negative amount or explicit 'debit' column means 'out'
            direction = "in" if amount > 0 else "out"

        rows.append(
            {
                "date": dt.isoformat(),
                "amount": float(abs(amount)),
                "description": desc,
                "counterparty": counterparty,
                "direction": direction,
                "source": source,
            }
        )

    return rows
