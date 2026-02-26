from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


Severity = Literal["positive", "medium", "high", "low"]


class TransactionIn(BaseModel):
    date: date
    amount: float
    description: str
    counterparty: str | None = None
    direction: Literal["in", "out"]
    source: str = "csv"


class UploadResponse(BaseModel):
    summary: dict[str, float]
    inserted: int


class ClassifiedTransactionOut(BaseModel):
    transaction_id: Any
    type: Literal["income", "expense"]
    entity: str
    expense_type: Literal["Fuel", "Tools", "Subcontractor", "Subscription", "Other"] | None = None
    revenue_stream: str | None = None
    tags: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


class ClassifyResponse(BaseModel):
    classified: int


class Insight(BaseModel):
    type: str
    message: str
    severity: Severity
    period: str
    created_at: datetime | None = None


class EntityMetric(BaseModel):
    name: str
    amount: float
    percentage: float

class HealthMetrics(BaseModel):
    score: int
    status: str
    runway_weeks: float
    cash_reserve: float

class RecurringMetric(BaseModel):
    name: str
    amount: float
    frequency: str

class InsightsResponse(BaseModel):
    insights: list[Insight]
    summary_this: dict[str, float] | None = None
    summary_last: dict[str, float] | None = None
    health: HealthMetrics | None = None
    top_customers: list[EntityMetric] | None = None
    top_suppliers: list[EntityMetric] | None = None
    advisor_summary: str | None = None
    recurring_expenses: list[RecurringMetric] | None = None


class ChatRequest(BaseModel):
    question: str | None = None
    message: str | None = None
    history: list[dict[str, Any]] | None = None


class ChatResponse(BaseModel):
    reply: str
