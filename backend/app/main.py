from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from fastapi import FastAPI, File, HTTPException, UploadFile, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from .config import settings
from .csv_parse import parse_transactions_csv
from .models import ChatRequest, ChatResponse, ClassifyResponse, EntityMetric, HealthMetrics, InsightsResponse, RecurringMetric, UploadResponse, VisualsResponse, ManualTransactionRequest
from .periods import last_month, this_month
from .mongodb import (
    MongoDB,
    fetch_expense_totals_by_type,
    fetch_recurring_expenses,
    insert_classifications,
    insert_insights,
    insert_transactions,
    fetch_all_transactions,
    execute_intent,
    fetch_latest_batch_id,
    fetch_latest_batch_summary,
    fetch_daily_trends,
    fetch_expense_distribution,
    fetch_lifetime_summary,
    fetch_period_summary,
)
from .llm import (
    LLMError,
    chat_answer,
    classify_transaction,
    explain_insight,
    generate_weekly_advisor_summary,
    extract_intent,
    generate_answer,
)
from .auth import get_current_user_id, get_password_hash, verify_password, create_access_token


import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Financial Co-Pilot API")

# Add CORS middleware early
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class GoogleToken(BaseModel):
    credential: str

@app.on_event("startup")
async def startup_db_client():
    await MongoDB.connect()

@app.on_event("shutdown")
async def shutdown_db_client():
    await MongoDB.close()

# CORS configuration is now handled above for better visibility

# Auth Endpoints
@app.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate):
    db = MongoDB.db
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = {
        "email": user.email,
        "hashed_password": hashed_password,
        "created_at": date.today().isoformat()
    }
    result = await db.users.insert_one(new_user)
    return {"id": str(result.inserted_id), "email": user.email}

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = MongoDB.db
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/google", response_model=Token)
async def google_auth(token_data: GoogleToken):
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    
    try:
        # Verify the Google ID token
        logger.info(f"--- START GOOGLE AUTH VERIFICATION ---")
        logger.info(f"Credential length: {len(token_data.credential)}")
        logger.info(f"Verifying Google token for client_id: {settings.google_client_id}")
        
        idinfo = id_token.verify_oauth2_token(
            token_data.credential, 
            google_requests.Request(), 
            settings.google_client_id
        )
        
        logger.info(f"Google token verified successfully!")
        logger.info(f"Email: {idinfo.get('email')}")
        logger.info(f"Issuer: {idinfo.get('iss')}")
        
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.error(f"Invalid issuer: {idinfo['iss']}")
            raise ValueError('Wrong issuer.')

        email = idinfo['email']
        db = MongoDB.db
        
        # Check if user exists, if not create
        user = await db.users.find_one({"email": email})
        if not user:
            logger.info(f"Creating new user for email: {email}")
            new_user = {
                "email": email,
                "google_id": idinfo['sub'],
                "created_at": date.today().isoformat()
            }
            result = await db.users.insert_one(new_user)
            user_id = str(result.inserted_id)
        else:
            logger.info(f"Existing user found for email: {email}")
            user_id = str(user["_id"])
            # Update google_id if not present
            if "google_id" not in user:
                logger.info(f"Updating google_id for user: {user_id}")
                await db.users.update_one({"_id": user["_id"]}, {"$set": {"google_id": idinfo['sub']}})

        access_token = create_access_token(data={"sub": user_id})
        logger.info(f"--- GOOGLE AUTH SUCCESSFUL ---")
        return {"access_token": access_token, "token_type": "bearer"}
        
    except ValueError as e:
        logger.error(f"Google auth validation error (ValueError): {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during Google auth: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Authentication failed")

@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "AI Financial Co-Pilot API is running"}


@app.post("/add-transaction")
async def add_transaction(req: ManualTransactionRequest, user_id: str = Depends(get_current_user_id)):
    logger.info(f"Manual transaction entry: {req.description} ({req.amount})")
    row = {
        "date": req.date,
        "amount": float(req.amount),
        "description": req.description,
        "direction": req.direction,
        "source": "manual"
    }
    try:
        batch_id = datetime.now(timezone.utc).isoformat()
        inserted = await insert_transactions(user_id, [row], batch_id=batch_id)
        tx_id_str = inserted[0]["id"]
        classification = {
            "transaction_id": ObjectId(tx_id_str),
            "entity": req.description,
            "type": "income" if req.direction == "in" else "expense",
            "expense_type": req.category if req.direction == "out" else None,
            "revenue_stream": req.category if req.direction == "in" else None,
            "tags": ["manual"],
            "confidence": 1.0,
        }
        await insert_classifications(user_id, [classification])
        return {"status": "success", "id": tx_id_str, "batch_id": batch_id}
    except Exception as e:
        logger.error(f"Manual add failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add transaction: {e}")

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/upload-transactions", response_model=UploadResponse)
async def upload_transactions(file: UploadFile = File(...), user_id: str = Depends(get_current_user_id)):
    logger.info(f"Received file upload: {file.filename}")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")

    content = await file.read()
    try:
        rows = parse_transactions_csv(content, source="csv")
        logger.info(f"Parsed {len(rows)} rows from CSV")
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="No valid transaction rows found")

    try:
        batch_id = datetime.now(timezone.utc).isoformat()
        inserted = await insert_transactions(user_id, rows, batch_id=batch_id)
        logger.info(f"Inserted {len(inserted)} transactions into DB")
    except Exception as e:
        logger.error(f"DB insert error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to insert transactions: {e}")

    cash_in = sum(float(r["amount"]) for r in rows if r.get("direction") == "in")
    cash_out = sum(float(r["amount"]) for r in rows if r.get("direction") == "out")
    net = cash_in - cash_out

    logger.info(f"Upload complete. Summary prepared: {cash_in}/{cash_out}")
    return UploadResponse(
        summary={
            "cash_in": float(round(cash_in, 2)), 
            "cash_out": float(round(cash_out, 2)), 
            "net": float(round(net, 2))
        }, 
        inserted=int(len(inserted))
    )


@app.post("/classify", response_model=ClassifyResponse)
async def classify(limit: int = 100, user_id: str = Depends(get_current_user_id)):
    logger.info(f"Starting classification for up to {limit} transactions")
    # This endpoint should probably use fetch_latest_batch_transactions
    # For now, it uses the old fetch_transactions which might not be batch-specific
    txs = await MongoDB.db.transactions.find({"user_id": user_id, "classification": {"$exists": False}}).limit(limit).to_list(length=limit)
    if not txs:
        logger.info("No transactions to classify")
        return ClassifyResponse(classified=0)

    out_rows: list[dict[str, Any]] = []

    for t in txs:
        try:
            logger.info(f"Classifying: {t.get('description')}")
            c = await classify_transaction(t.get("description") or "", float(t.get("amount") or 0))
            logger.info(f"Classification result: {c.get('entity')} - {c.get('type')}")
        except LLMError as e:
            logger.error(f"LLM Error: {e}")
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:
            logger.error(f"Unexpected error in classify: {e}")
            raise HTTPException(status_code=500, detail=f"Classification error: {e}")

        out_rows.append(
            {
                "transaction_id": ObjectId(t.get("_id")),
                "entity": c.get("entity") or "Unknown",
                "type": c.get("type") or ("income" if t.get("direction") == "in" else "expense"),
                "expense_type": c.get("expense_type"),
                "revenue_stream": c.get("revenue_stream"),
                "tags": c.get("tags") or [],
                "confidence": float(c.get("confidence") or 0.0),
            }
        )

    try:
        n = await insert_classifications(user_id, out_rows)
        logger.info(f"Successfully saved {n} classifications")
    except Exception as e:
        logger.error(f"Failed to save classifications: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save classifications: {e}")

    return ClassifyResponse(classified=n)


@app.get("/insights", response_model=InsightsResponse)
async def insights(period: str = "this_month", user_id: str = Depends(get_current_user_id)):
    # Determine the reference date based on the latest transaction
    try:
        latest_txs = await MongoDB.db.transactions.find({"user_id": user_id}).sort("date", -1).limit(1).to_list(length=1)
        if latest_txs:
            # Parse the date string from the database (assuming ISO format YYYY-MM-DD)
            ref_date = date.fromisoformat(latest_txs[0]["date"])
            logger.info(f"Using latest transaction date as reference: {ref_date}")
        else:
            ref_date = date.today()
    except Exception as e:
        logger.error(f"Error fetching latest transaction date: {e}")
        ref_date = date.today()

    p_this = this_month(today=ref_date)
    p_last = last_month(today=ref_date)

    try:
        # Use PERIOD summary for both current and last month
        sum_this = await fetch_period_summary(user_id, p_this.start, p_this.end)
        sum_last = await fetch_period_summary(user_id, p_last.start, p_last.end)
        
        # LIFETIME summary for the total balance
        sum_total = await fetch_lifetime_summary(user_id)
    except Exception as e:
        logger.error(f"Summary fetch error: {e}")
        sum_this = {"cash_in": 0.0, "cash_out": 0.0, "net": 0.0}
        sum_last = {"cash_in": 0.0, "cash_out": 0.0, "net": 0.0}
        sum_total = {"cash_in": 0.0, "cash_out": 0.0, "net": 0.0}

    # Ensure all values are floats for Pydantic
    for d in [sum_this, sum_last, sum_total]:
        for k in ["cash_in", "cash_out", "net"]:
            d[k] = float(d.get(k) or 0.0)

    # --- Intelligence Layer: Health & Runway ---
    try:
        # Use batch summary for metrics
        total_cash = sum_this.get("cash_in", 0) - sum_this.get("cash_out", 0)
        
        # Simple health score logic based on latest batch performance
        score = 75 # default
        if sum_this.get("net", 0) > 0: score += 15
        
        # We calculate status but keep it simple
        status = "Healthy" if score > 80 else "Stable" if score > 50 else "At Risk"
        
        health = HealthMetrics(
            score=score,
            status=status,
            runway_weeks=12.0, # Defaulting for strict file mode unless we want to use last month
            cash_reserve=float(total_cash)
        )
    except Exception:
        health = HealthMetrics(score=0, status="Unknown", runway_weeks=0, cash_reserve=0)

    # --- Intelligence Layer: Top Entities ---
    try:
        latest_batch_id = await fetch_latest_batch_id(user_id)
        raw_top_cust = await MongoDB.db.transactions.aggregate([
            {"$match": {"user_id": user_id, "batch_id": latest_batch_id, "direction": "in", "classification.entity": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$classification.entity", "revenue": {"$sum": "$amount"}}},
            {"$sort": {"revenue": -1}},
            {"$project": {"entity": "$_id", "revenue": "$revenue", "_id": 0}}
        ]).to_list(length=3)
        total_in = sum_this.get("cash_in") or 1.0
        top_customers = [
            EntityMetric(name=c["entity"], amount=c["revenue"], percentage=round((c["revenue"]/total_in)*100, 1))
            for c in raw_top_cust[:3]
        ]
        
        raw_top_supp = await MongoDB.db.transactions.aggregate([
            {"$match": {"user_id": user_id, "batch_id": latest_batch_id, "direction": "out", "classification.entity": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$classification.entity", "expense": {"$sum": "$amount"}}},
            {"$sort": {"expense": -1}},
            {"$project": {"entity": "$_id", "expense": "$expense", "_id": 0}}
        ]).to_list(length=3)
        total_out = sum_this.get("cash_out") or 1.0
        top_suppliers = [
            EntityMetric(name=s["entity"], amount=s["expense"], percentage=round((s["expense"]/total_out)*100, 1))
            for s in raw_top_supp[:3]
        ]
        
        recurring_raw = await fetch_recurring_expenses(user_id)
        recurring_expenses = [
            RecurringMetric(name=r["name"], amount=r["amount"], frequency=r["frequency"])
            for r in recurring_raw[:5]
        ]
    except Exception:
        top_customers = []
        top_suppliers = []
        recurring_expenses = []

    insights_raw: list[dict[str, Any]] = []

    # Pattern 1: expenses increased > 15%
    last_exp = float(sum_last.get("cash_out") or 0.0)
    this_exp = float(sum_this.get("cash_out") or 0.0)
    if last_exp > 0 and this_exp > last_exp * 1.15:
        pct = round(((this_exp - last_exp) / last_exp) * 100)
        insights_raw.append({"type": "expense_increase", "severity": "medium", "raw": f"Your spending is up about {pct}% versus last month."})

    # Pattern 2: expenses > income
    total_in = float(sum_this.get("cash_in") or 0.0)
    total_out = float(sum_this.get("cash_out") or 0.0)
    if total_out > total_in and total_in > 0:
        insights_raw.append({"type": "spend_over_income", "severity": "high", "raw": "You spent more than you earned this month."})

    # Pattern 3: Profit Margin Analysis (Heuristic Rule)
    if total_in > 0:
        margin = ((total_in - total_out) / total_in) * 100
        if margin < 20:
             insights_raw.append({
                 "type": "low_margin", 
                 "severity": "medium", 
                 "raw": f"Your profit margin is currently {round(margin)}%. Aim for at least 20% to build a safe buffer."
             })

    # Pattern 4: Customer Concentration (Risk Rule)
    if top_customers and top_customers[0].percentage > 50:
        insights_raw.append({
            "type": "concentration_risk",
            "severity": "high",
            "raw": f"High risk detected: {top_customers[0].name} accounts for {top_customers[0].percentage}% of your revenue. Consider diversifying."
        })

    # Pattern 5: Large Transaction Alert
    try:
        # Scan latest batch for large outliers
        latest_batch_id = await fetch_latest_batch_id(user_id)
        batch_txs = await MongoDB.db.transactions.find({"user_id": user_id, "batch_id": latest_batch_id}).limit(500).to_list(length=500)
        large_threshold = total_out * 0.1 # 10% of total spend
        if large_threshold < 1000: large_threshold = 1000
        
        seen_large_descriptions = set()
        for tx in [t for t in batch_txs if t.get("direction") == "out"]:
            desc = tx.get("description")
            amt = float(tx.get("amount") or 0)
            if amt > large_threshold:
                if desc not in seen_large_descriptions:
                    insights_raw.append({
                        "type": "large_expense",
                        "severity": "medium",
                        "raw": f"Large expense detected: ${round(amt)} for {desc}."
                    })
                    seen_large_descriptions.add(desc)
    except Exception:
        pass

    # Turn raw into one-sentence messages using AI
    saved_rows: list[dict[str, Any]] = []
    
    # Fetch existing insights for this period to avoid duplicates
    try:
        existing_insights = await MongoDB.db.insights.find({"user_id": user_id, "period": period}).limit(100).to_list(length=100)
        existing_messages = {ins["message"] for ins in existing_insights}
    except Exception:
        existing_messages = set()

    for r in insights_raw:
        try:
            # Round amounts in the raw string for consistency before AI explanation
            # e.g. "spent $123.456" -> "spent $123.46"
            raw_msg = r["raw"]
            import re
            def round_match(match):
                val = float(match.group(1))
                return f"${round(val, 2)}"
            raw_msg = re.sub(r"\$([0-9.]+)", round_match, raw_msg)
            
            msg = await explain_insight(raw_msg)
        except Exception:
            msg = r["raw"]
            
        if msg not in existing_messages:
            saved_rows.append({"type": r["type"], "message": msg, "severity": r["severity"], "period": period})
            existing_messages.add(msg)

    try:
        if saved_rows:
            await insert_insights(user_id, saved_rows)
    except Exception as e:
        logger.error(f"Failed to save insights: {e}")
        # Continue anyway so we can return what we have

    # Fetch recent insights for this period
    try:
        recent = await MongoDB.db.insights.find({"user_id": user_id, "period": period}).sort("timestamp", -1).limit(10).to_list(length=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch insights: {e}")

    # If no insights were found for the requested period, fallback to any available insights
    if not recent:
        try:
            recent = await MongoDB.db.insights.find({"user_id": user_id}).sort("timestamp", -1).limit(10).to_list(length=10)
        except Exception:
            recent = []

    # --- Intelligence Layer: Advisor Summary ---
    try:
        advisor_context = f"Health Score: {health.score}/100 ({health.status}). Runway: {health.runway_weeks} weeks. "
        advisor_context += f"Net Change this month: ${round(sum_this.get('net', 0))}. "
        if top_customers:
            advisor_context += f"Top Customer: {top_customers[0].name}. "
        if top_suppliers:
            advisor_context += f"Top Supplier: {top_suppliers[0].name}. "
        
        advisor_summary = await generate_weekly_advisor_summary(advisor_context)
    except Exception:
        advisor_summary = "Keep focusing on growing your customer base and maintaining your cash buffer. You're doing great!"

    return InsightsResponse(
        insights=recent,
        summary_this=sum_this,
        summary_last=sum_last,
        summary_total=sum_total,
        health=health,
        top_customers=top_customers,
        top_suppliers=top_suppliers,
        advisor_summary=advisor_summary,
        recurring_expenses=recurring_expenses
    )


@app.get("/analytics/visuals", response_model=VisualsResponse)
async def get_visuals(user_id: str = Depends(get_current_user_id)):
    try:
        trends = await fetch_daily_trends(user_id)
        distribution = await fetch_expense_distribution(user_id)
        return VisualsResponse(trends=trends, distribution=distribution)
    except Exception as e:
        logger.error(f"Visuals error: {e}")
        return VisualsResponse(trends=[], distribution=[])

@app.get("/transactions")
async def get_transactions(user_id: str = Depends(get_current_user_id)):
    txs = await fetch_all_transactions(user_id)
    return txs

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    question = (req.message or req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Provide 'message' (frontend) or 'question'.")

    # --- Step 1: Extract Intent (Low Token usage) ---
    try:
        intent = await extract_intent(question)
    except Exception as e:
        logger.error(f"Intent extraction failed: {e}")
        intent = {"intent": "unknown"}

    # --- Step 2: Execute Deterministic Financial Logic ---
    try:
        # We use batch summary for AI context or period summary? Period is better for accuracy
        # But execute_intent used to take batch_id. Let's make it work with period or latest.
        batch_id = await fetch_latest_batch_id(user_id)
        if not batch_id:
             return ChatResponse(reply="I don't see any data to analyze. Please upload a file or add a transaction.")
             
        # Deterministically compute based on latest batch isolation (old logic) or refactor?
        # Let's use simple logic for now:
        res_summary = await fetch_latest_batch_summary(user_id)
        
        # Simple intent logic directly here for speed
        intent_type = intent.get("intent")
        result = {"message": "Computed from your latest data."}
        if intent_type == "total_expenses": result = {"total_expenses": res_summary["cash_out"]}
        elif intent_type == "total_income": result = {"total_income": res_summary["cash_in"]}
        elif intent_type == "balance": result = {"balance": res_summary["net"]}
        elif intent_type == "last_transaction":
            filter_dir = intent.get("filter")
            q = {"user_id": user_id}
            if filter_dir: q["direction"] = filter_dir
            
            last_tx = await MongoDB.db.transactions.find(q).sort("date", -1).limit(1).to_list(length=1)
            if last_tx:
                result = {"last_transaction": {
                    "date": last_tx[0]["date"],
                    "amount": last_tx[0]["amount"],
                    "description": last_tx[0]["description"],
                    "direction": last_tx[0]["direction"]
                }}
            else:
                result = {"message": "No transactions found to show as 'last'."}
        elif intent_type == "affordability_check":
            target = float(intent.get("amount") or 0)
            result = {"balance": res_summary["net"], "target_purchase": target, "can_afford": res_summary["net"] >= target}
    except Exception as e:
        logger.error(f"Financial engine failure: {e}")
        return ChatResponse(reply="I encountered an error calculating those numbers.")

    # --- Step 3: Strategic Context Injection (RAG-lite) ---
    try:
        summary = await fetch_latest_batch_summary(user_id)
        strategic_context = {
            "business_health": "Stable",
            "current_net_margin": round(((summary['cash_in'] - summary['cash_out']) / summary['cash_in'] * 100)) if summary['cash_in'] > 0 else 0,
            "total_income": summary['cash_in'],
            "total_expenses": summary['cash_out']
        }
        enriched_result = {**result, "strategic_context": strategic_context}
        answer = await generate_answer(question, enriched_result)
        return ChatResponse(reply=answer)
    except Exception as e:
        logger.error(f"Final chat stage failed: {e}")
        return ChatResponse(reply="I found the info but had trouble explaining it. Check your dashboard metrics!")

# Data Management Endpoints
class UpdateEmailRequest(BaseModel):
    email: EmailStr

@app.post("/auth/update-email")
async def update_email(req: UpdateEmailRequest, user_id: str = Depends(get_current_user_id)):
    db = MongoDB.db
    # Check if email is already taken
    existing = await db.users.find_one({"email": req.email})
    if existing and str(existing["_id"]) != user_id:
        raise HTTPException(status_code=400, detail="Email already in use")
    
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"email": req.email}})
    return {"status": "success", "email": req.email}

@app.post("/data/clear")
async def clear_data_endpoint(user_id: str = Depends(get_current_user_id)):
    from .mongodb import clear_user_data
    success = await clear_user_data(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear data")
    return {"status": "success", "message": "All user data cleared"}
