from __future__ import annotations

from datetime import date, datetime
from typing import Any, Iterable

from supabase import Client, create_client

from .config import settings


def get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_supabase_anon() -> Client:
    if not settings.supabase_anon_key:
        raise RuntimeError("SUPABASE_ANON_KEY is required for user-scoped Supabase access")
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_for_jwt(jwt: str) -> Client:
    sb = get_supabase_anon()
    sb.postgrest.auth(jwt)
    return sb


async def insert_transactions(sb: Client, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    resp = sb.table("transactions").insert(rows).execute()
    data = resp.data or []
    return data


async def fetch_transactions(sb: Client, limit: int = 500) -> list[dict[str, Any]]:
    resp = sb.table("transactions").select("*").order("date", desc=True).limit(limit).execute()
    return resp.data or []


async def insert_classifications(sb: Client, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    resp = sb.table("classified_transactions").upsert(rows, on_conflict="transaction_id").execute()
    return len(resp.data or [])


async def insert_insights(sb: Client, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    resp = sb.table("insights").insert(rows).execute()
    return len(resp.data or [])


async def fetch_recent_insights(sb: Client, period: str | None, limit: int = 10) -> list[dict[str, Any]]:
    query = sb.table("insights").select("*")
    if period:
        query = query.eq("period", period)
    resp = query.order("created_at", desc=True).limit(limit).execute()
    return resp.data or []


async def fetch_period_summary(sb: Client, period_start: date, period_end: date) -> dict[str, float]:
    resp = (
        sb.table("transactions")
        .select("amount,direction,date")
        .gte("date", period_start.isoformat())
        .lte("date", period_end.isoformat())
        .execute()
    )
    rows = resp.data or []
    cash_in = sum(r["amount"] for r in rows if r.get("direction") == "in")
    cash_out = sum(r["amount"] for r in rows if r.get("direction") == "out")
    net = cash_in - cash_out
    return {"cash_in": float(cash_in), "cash_out": float(cash_out), "net": float(net)}


async def fetch_top_customers(sb: Client, period_start: date, period_end: date) -> list[dict[str, Any]]:
    resp = (
        sb.table("classified_transactions")
        .select("entity,type,transaction_id,transactions!inner(amount,date,direction)")
        .eq("type", "income")
        .gte("transactions.date", period_start.isoformat())
        .lte("transactions.date", period_end.isoformat())
        .execute()
    )
    rows = resp.data or []

    totals: dict[str, float] = {}
    for r in rows:
        entity = (r.get("entity") or "Unknown").strip() or "Unknown"
        amt = float((r.get("transactions") or {}).get("amount") or 0)
        totals[entity] = totals.get(entity, 0.0) + amt

    sorted_entities = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    return [{"entity": e, "revenue": v} for e, v in sorted_entities]


async def fetch_expense_totals_by_type(sb: Client, period_start: date, period_end: date) -> dict[str, float]:
    resp = (
        sb.table("classified_transactions")
        .select("expense_type,type,transactions!inner(amount,date)")
        .eq("type", "expense")
        .gte("transactions.date", period_start.isoformat())
        .lte("transactions.date", period_end.isoformat())
        .execute()
    )
    rows = resp.data or []
    totals: dict[str, float] = {}
    for r in rows:
        k = r.get("expense_type") or "Other"
        amt = float((r.get("transactions") or {}).get("amount") or 0)
        totals[k] = totals.get(k, 0.0) + amt
    return totals


async def fetch_top_suppliers(sb: Client, period_start: date, period_end: date) -> list[dict[str, Any]]:
    resp = (
        sb.table("classified_transactions")
        .select("entity,type,transaction_id,transactions!inner(amount,date,direction)")
        .eq("type", "expense")
        .gte("transactions.date", period_start.isoformat())
        .lte("transactions.date", period_end.isoformat())
        .execute()
    )
    rows = resp.data or []

    totals: dict[str, float] = {}
    for r in rows:
        entity = (r.get("entity") or "Unknown").strip() or "Unknown"
        amt = float((r.get("transactions") or {}).get("amount") or 0)
        totals[entity] = totals.get(entity, 0.0) + amt

    sorted_entities = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    return [{"entity": e, "expense": v} for e, v in sorted_entities]


async def fetch_historical_cash_flow(sb: Client, limit_days: int = 90) -> list[dict[str, Any]]:
    resp = (
        sb.table("transactions")
        .select("amount,direction,date")
        .order("date", desc=True)
        .limit(500)
        .execute()
    )
    return resp.data or []


async def fetch_recurring_expenses(sb: Client, limit: int = 50) -> list[dict[str, Any]]:
    # Improved recurring detection: same entity appearing in multiple months with similar amounts
    resp = (
        sb.table("classified_transactions")
        .select("entity,transaction_id,transactions!inner(amount,date)")
        .eq("type", "expense")
        .execute()
    )
    rows = resp.data or []
    
    entity_history: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        entity = r["entity"]
        if entity not in entity_history:
            entity_history[entity] = []
        entity_history[entity].append({
            "amount": float(r["transactions"]["amount"]),
            "date": r["transactions"]["date"]
        })
    
    recurring = []
    for entity, history in entity_history.items():
        if len(history) < 2:
            continue
            
        # Group by month
        months = sorted({h["date"][:7] for h in history})
        if len(months) < 2:
            continue
            
        # Calculate average amount and variance
        amounts = [h["amount"] for h in history]
        avg_amount = sum(amounts) / len(amounts)
        
        # Simple variance check: if most amounts are within 20% of average
        consistent_amounts = [a for a in amounts if abs(a - avg_amount) / (avg_amount or 1) < 0.2]
        
        if len(consistent_amounts) >= 2 and len(months) >= 2:
            recurring.append({
                "name": entity,
                "amount": avg_amount,
                "frequency": "Monthly" if len(months) >= len(history) * 0.8 else "Recurring"
            })
    
    return sorted(recurring, key=lambda x: x["amount"], reverse=True)[:limit]
