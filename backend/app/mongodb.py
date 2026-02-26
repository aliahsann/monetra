from __future__ import annotations

from datetime import datetime, timezone, date
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import Any

from .config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

    @classmethod
    async def connect(cls):
        if cls.client is None:
            cls.client = AsyncIOMotorClient(settings.mongodb_uri)
            cls.db = cls.client[settings.mongodb_db_name]
            # Create indexes
            await cls.db.users.create_index("email", unique=True)
            await cls.db.transactions.create_index([("user_id", 1), ("date", -1)])
            await cls.db.classified_transactions.create_index("transaction_id", unique=True)
            await cls.db.insights.create_index([("user_id", 1), ("period", 1)])

    @classmethod
    async def close(cls):
        if cls.client:
            cls.client.close()
            cls.client = None

def get_db():
    return MongoDB.db

# Helper to convert MongoDB document to serializable dict
def fix_id(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

async def insert_transactions(user_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    db = get_db()
    for row in rows:
        row["user_id"] = user_id
        row["created_at"] = datetime.now(timezone.utc)
    
    result = await db.transactions.insert_many(rows)
    # Return the inserted rows with their new IDs
    inserted_docs = await db.transactions.find({"_id": {"$in": result.inserted_ids}}).to_list(length=len(rows))
    return [fix_id(d) for d in inserted_docs]

async def fetch_transactions(user_id: str, limit: int = 500) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db.transactions.find({"user_id": user_id}).sort("date", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [fix_id(d) for d in docs]

async def insert_classifications(user_id: str, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    db = get_db()
    count = 0
    for row in rows:
        row["user_id"] = user_id
        row["updated_at"] = datetime.now(timezone.utc)
        res = await db.classified_transactions.update_one(
            {"transaction_id": row["transaction_id"]},
            {"$set": row},
            upsert=True
        )
        if res.upserted_id or res.modified_count:
            count += 1
    return count

async def insert_insights(user_id: str, rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    db = get_db()
    for row in rows:
        row["user_id"] = user_id
        row["created_at"] = datetime.now(timezone.utc)
    result = await db.insights.insert_many(rows)
    return len(result.inserted_ids)

async def fetch_recent_insights(user_id: str, period: str | None, limit: int = 10) -> list[dict[str, Any]]:
    db = get_db()
    query = {"user_id": user_id}
    if period:
        query["period"] = period
    cursor = db.insights.find(query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [fix_id(d) for d in docs]

async def fetch_period_summary(user_id: str, period_start: date, period_end: date) -> dict[str, float]:
    db = get_db()
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "date": {
                    "$gte": period_start.isoformat(),
                    "$lte": period_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$direction",
                "total": {"$sum": "$amount"}
            }
        }
    ]
    cursor = db.transactions.aggregate(pipeline)
    results = await cursor.to_list(length=2)
    
    cash_in = 0.0
    cash_out = 0.0
    for res in results:
        if res["_id"] == "in":
            cash_in = res["total"]
        else:
            cash_out = res["total"]
            
    return {"cash_in": float(cash_in), "cash_out": float(cash_out), "net": float(cash_in - cash_out)}

async def fetch_top_customers(user_id: str, period_start: date, period_end: date) -> list[dict[str, Any]]:
    db = get_db()
    # MongoDB join equivalent (lookup)
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "type": "income"
            }
        },
        {
            "$lookup": {
                "from": "transactions",
                "localField": "transaction_id",
                "foreignField": "_id",
                "as": "tx"
            }
        },
        {"$unwind": "$tx"},
        {
            "$match": {
                "tx.date": {
                    "$gte": period_start.isoformat(),
                    "$lte": period_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$entity",
                "revenue": {"$sum": "$tx.amount"}
            }
        },
        {"$sort": {"revenue": -1}},
        {"$limit": 5},
        {"$project": {"entity": "$_id", "revenue": 1, "_id": 0}}
    ]
    # Note: transaction_id in classified_transactions might need to be ObjectId
    # In this implementation, we'll need to ensure transaction_id is stored correctly.
    cursor = db.classified_transactions.aggregate(pipeline)
    return await cursor.to_list(length=5)

async def fetch_expense_totals_by_type(user_id: str, period_start: date, period_end: date) -> dict[str, float]:
    db = get_db()
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "type": "expense"
            }
        },
        {
            "$lookup": {
                "from": "transactions",
                "localField": "transaction_id",
                "foreignField": "_id",
                "as": "tx"
            }
        },
        {"$unwind": "$tx"},
        {
            "$match": {
                "tx.date": {
                    "$gte": period_start.isoformat(),
                    "$lte": period_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$expense_type",
                "total": {"$sum": "$tx.amount"}
            }
        }
    ]
    cursor = db.classified_transactions.aggregate(pipeline)
    results = await cursor.to_list(length=20)
    return {res["_id"] or "Other": float(res["total"]) for res in results}

async def fetch_top_suppliers(user_id: str, period_start: date, period_end: date) -> list[dict[str, Any]]:
    db = get_db()
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "type": "expense"
            }
        },
        {
            "$lookup": {
                "from": "transactions",
                "localField": "transaction_id",
                "foreignField": "_id",
                "as": "tx"
            }
        },
        {"$unwind": "$tx"},
        {
            "$match": {
                "tx.date": {
                    "$gte": period_start.isoformat(),
                    "$lte": period_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$entity",
                "expense": {"$sum": "$tx.amount"}
            }
        },
        {"$sort": {"expense": -1}},
        {"$limit": 5},
        {"$project": {"entity": "$_id", "expense": 1, "_id": 0}}
    ]
    cursor = db.classified_transactions.aggregate(pipeline)
    return await cursor.to_list(length=5)

async def fetch_historical_cash_flow(user_id: str, limit_days: int = 90) -> list[dict[str, Any]]:
    db = get_db()
    cursor = db.transactions.find({"user_id": user_id}).sort("date", -1).limit(500)
    docs = await cursor.to_list(length=500)
    return [fix_id(d) for d in docs]

async def fetch_recurring_expenses(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    db = get_db()
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "type": "expense"
            }
        },
        {
            "$lookup": {
                "from": "transactions",
                "localField": "transaction_id",
                "foreignField": "_id",
                "as": "tx"
            }
        },
        {"$unwind": "$tx"},
        {
            "$group": {
                "_id": "$entity",
                "history": {
                    "$push": {
                        "amount": "$tx.amount",
                        "date": "$tx.date"
                    }
                }
            }
        }
    ]
    cursor = db.classified_transactions.aggregate(pipeline)
    rows = await cursor.to_list(length=1000)
    
    recurring = []
    for r in rows:
        entity = r["_id"]
        history = r["history"]
        if len(history) < 2:
            continue
            
        months = sorted({h["date"][:7] for h in history})
        if len(months) < 2:
            continue
            
        amounts = [h["amount"] for h in history]
        avg_amount = sum(amounts) / len(amounts)
        consistent_amounts = [a for a in amounts if abs(a - avg_amount) / (avg_amount or 1) < 0.2]
        
        if len(consistent_amounts) >= 2 and len(months) >= 2:
            recurring.append({
                "name": entity,
                "amount": float(avg_amount),
                "frequency": "Monthly" if len(months) >= len(history) * 0.8 else "Recurring"
            })
    
    return sorted(recurring, key=lambda x: x["amount"], reverse=True)[:limit]
