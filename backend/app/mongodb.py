from __future__ import annotations

from datetime import datetime, timezone, date, timedelta
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
def fix_id(doc: Any) -> Any:
    if isinstance(doc, list):
        return [fix_id(item) for item in doc]
    if isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            if k == "_id":
                new_doc["id"] = str(v)
            elif isinstance(v, ObjectId):
                new_doc[k] = str(v)
            else:
                new_doc[k] = fix_id(v)
        return new_doc
    return doc

async def insert_transactions(user_id: str, rows: list[dict[str, Any]], batch_id: str | None = None) -> list[dict[str, Any]]:
    db = get_db()
    if not batch_id:
        batch_id = datetime.now(timezone.utc).isoformat()
        
    for row in rows:
        row["user_id"] = user_id
        row["batch_id"] = batch_id
        row["created_at"] = datetime.now(timezone.utc)
    
    result = await db.transactions.insert_many(rows)
    # Return the inserted rows with their new IDs
    inserted_docs = await db.transactions.find({"_id": {"$in": result.inserted_ids}}).to_list(length=len(rows))
    return [fix_id(d) for d in inserted_docs]

async def fetch_latest_batch_id(user_id: str) -> str | None:
    db = get_db()
    # Sort by created_at AND _id to be absolutely sure of the latest
    latest_tx = await db.transactions.find_one({"user_id": user_id}, sort=[("created_at", -1), ("_id", -1)])
    return latest_tx.get("batch_id") if latest_tx else None

async def fetch_latest_batch_transactions(user_id: str, limit: int = 1000) -> list[dict[str, Any]]:
    db = get_db()
    batch_id = await fetch_latest_batch_id(user_id)
    if not batch_id:
        return await fetch_transactions(user_id, limit)
    
    cursor = db.transactions.find({"user_id": user_id, "batch_id": batch_id}).sort("date", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [fix_id(d) for d in docs]

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
        
        # Ensure transaction_id is an ObjectId
        if "transaction_id" in row and not isinstance(row["transaction_id"], ObjectId):
            row["transaction_id"] = ObjectId(row["transaction_id"])
            
        # Store in classified_transactions collection
        res = await db.classified_transactions.update_one(
            {"transaction_id": row["transaction_id"]},
            {"$set": row},
            upsert=True
        )
        if res.upserted_id or res.modified_count:
            count += 1
            
        # ALSO embed the classification into the transaction document
        # so that /insights and /transactions can query it efficiently
        classification_embed = {
            "entity": row.get("entity"),
            "type": row.get("type"),
            "expense_type": row.get("expense_type"),
            "revenue_stream": row.get("revenue_stream"),
            "tags": row.get("tags", []),
            "confidence": row.get("confidence", 0.0),
        }
        await db.transactions.update_one(
            {"_id": row["transaction_id"]},
            {"$set": {"classification": classification_embed}}
        )
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

async def fetch_lifetime_summary(user_id: str) -> dict[str, float]:
    db = get_db()
    pipeline = [
        {"$match": {"user_id": user_id}},
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
        if res["_id"] == "in": cash_in = res["total"]
        else: cash_out = res["total"]
    return {"cash_in": float(cash_in), "cash_out": float(cash_out), "net": float(cash_in - cash_out)}

async def fetch_latest_batch_summary(user_id: str) -> dict[str, float]:
    db = get_db()
    batch_id = await fetch_latest_batch_id(user_id)
    if not batch_id:
        return {"cash_in": 0.0, "cash_out": 0.0, "net": 0.0}
    
    pipeline = [
        {"$match": {"user_id": user_id, "batch_id": batch_id}},
        {"$group": {"_id": "$direction", "total": {"$sum": "$amount"}}}
    ]
    cursor = db.transactions.aggregate(pipeline)
    results = await cursor.to_list(length=2)
    cash_in = 0.0
    cash_out = 0.0
    for res in results:
        if res["_id"] == "in": cash_in = res["total"]
        else: cash_out = res["total"]
    return {"cash_in": float(cash_in), "cash_out": float(cash_out), "net": float(cash_in - cash_out)}

async def fetch_latest_batch_top_customers(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    batch_id = await fetch_latest_batch_id(user_id)
    if not batch_id: return []
    
    pipeline = [
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
                "tx.user_id": user_id,
                "tx.batch_id": batch_id,
                "type": "income"
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
    cursor = db.classified_transactions.aggregate(pipeline)
    return await cursor.to_list(length=5)
    cursor = db.classified_transactions.aggregate(pipeline)
    return await cursor.to_list(length=5)

async def fetch_latest_batch_top_suppliers(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    batch_id = await fetch_latest_batch_id(user_id)
    if not batch_id: return []
    
    pipeline = [
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
                "tx.user_id": user_id,
                "tx.batch_id": batch_id,
                "type": "expense"
            }
        },
        {"$group": {
            "_id": "$entity",
            "expense": {"$sum": "$tx.amount"}
        }},
        {"$sort": {"expense": -1}},
        {"$limit": 5},
        {"$project": {"entity": "$_id", "expense": 1, "_id": 0}}
    ]
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

async def fetch_daily_trends(user_id: str, days: int = 30) -> list[dict[str, Any]]:
    db = get_db()
    # Show last 30 days of data regardless of month boundary
    start_date = (date.today() - timedelta(days=90)).isoformat()
    match_query = {"user_id": user_id, "date": {"$gte": start_date}}
    
    pipeline = [
        {"$match": match_query},
        {
            "$group": {
                "_id": "$date",
                "income": {"$sum": {"$cond": [{"$eq": ["$direction", "in"]}, "$amount", 0]}},
                "expense": {"$sum": {"$cond": [{"$eq": ["$direction", "out"]}, "$amount", 0]}}
            }
        },
        {"$sort": {"_id": 1}},
        {
            "$project": {
                "date": "$_id",
                "income": {"$round": ["$income", 2]},
                "expense": {"$round": ["$expense", 2]},
                "_id": 0
            }
        }
    ]
    cursor = db.transactions.aggregate(pipeline)
    return await cursor.to_list(length=100)

async def fetch_expense_distribution(user_id: str, days: int = 30) -> list[dict[str, Any]]:
    db = get_db()
    start_date = (date.today() - timedelta(days=90)).isoformat()
    match_query = {"tx.user_id": user_id, "tx.date": {"$gte": start_date}}
    
    pipeline = [
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
                **match_query,
                "type": "expense"
            }
        },
        {
            "$group": {
                "_id": "$expense_type",
                "value": {"$sum": "$tx.amount"}
            }
        },
        {
            "$project": {
                "name": {"$ifNull": ["$_id", "Other"]},
                "value": {"$round": ["$value", 2]},
                "_id": 0
            }
        },
        {"$sort": {"value": -1}}
    ]
    cursor = db.classified_transactions.aggregate(pipeline)
    return await cursor.to_list(length=20)

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

async def fetch_all_transactions(user_id: str, limit: int = 1000) -> list[dict[str, Any]]:
    db = get_db()
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$sort": {"date": -1, "created_at": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "classified_transactions",
                "localField": "_id",
                "foreignField": "transaction_id",
                "as": "classification_lookup"
            }
        },
        {
            "$addFields": {
                "classification": {
                    "$cond": {
                        "if": {"$and": [{"$gt": [{"$size": "$classification_lookup"}, 0]}]},
                        "then": {"$arrayElemAt": ["$classification_lookup", 0]},
                        "else": "$classification" # Keep embedded if exists
                    }
                }
            }
        },
        {"$project": {"classification_lookup": 0}}
    ]
    cursor = db.transactions.aggregate(pipeline)
    docs = await cursor.to_list(length=limit)
    return [fix_id(d) for d in docs]

async def execute_intent(user_id: str, intent: dict[str, Any], batch_id: str) -> dict[str, Any]:
    # Placeholder for backward compatibility
    return {}

async def clear_user_data(user_id: str) -> bool:
    db = get_db()
    try:
        # Delete transactions
        await db.transactions.delete_many({"user_id": user_id})
        # Delete classifications - classifications use user_id from line 93 of insert_classifications
        await db.classified_transactions.delete_many({"user_id": user_id})
        # Delete insights
        await db.insights.delete_many({"user_id": user_id})
        return True
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error clearing user data: {e}")
        return False
