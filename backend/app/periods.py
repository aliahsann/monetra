from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class Period:
    name: str
    start: date
    end: date


def this_month(today: date | None = None) -> Period:
    t = today or date.today()
    start = date(t.year, t.month, 1)
    if t.month == 12:
        next_month = date(t.year + 1, 1, 1)
    else:
        next_month = date(t.year, t.month + 1, 1)
    end = next_month - timedelta(days=1)
    return Period(name="this_month", start=start, end=end)


def last_month(today: date | None = None) -> Period:
    t = today or date.today()
    first_this = date(t.year, t.month, 1)
    last_day_prev = first_this - timedelta(days=1)
    start = date(last_day_prev.year, last_day_prev.month, 1)
    end = last_day_prev
    return Period(name="last_month", start=start, end=end)
