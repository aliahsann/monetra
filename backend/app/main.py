from __future__ import annotations

from datetime import date
from typing import Any

from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from fastapi import FastAPI, File, HTTPException, UploadFile, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from .config import settings
from .csv_parse import parse_transactions_csv
from .llm import LLMError, chat_answer, classify_transaction, explain_insight, generate_weekly_advisor_summary
from .models import ChatRequest, ChatResponse, ClassifyResponse, EntityMetric, HealthMetrics, InsightsResponse, RecurringMetric, UploadResponse
from .periods import last_month, this_month
from .mongodb import (
    MongoDB,
    fetch_expense_totals_by_type,
    fetch_period_summary,
    fetch_recent_insights,
    fetch_top_customers,
    fetch_top_suppliers,
    fetch_transactions,
    fetch_historical_cash_flow,
    fetch_recurring_expenses,
    insert_classifications,
    insert_insights,
    insert_transactions,
)
from .auth import get_current_user_id, get_password_hash, verify_password, create_access_token


import logging

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
        inserted = await insert_transactions(user_id, rows)
        logger.info(f"Inserted {len(inserted)} transactions into DB")
    except Exception as e:
        logger.error(f"DB insert error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to insert transactions: {e}")

    cash_in = sum(float(r["amount"]) for r in rows if r.get("direction") == "in")
    cash_out = sum(float(r["amount"]) for r in rows if r.get("direction") == "out")
    net = cash_in - cash_out

    return UploadResponse(
        summary={
            "cash_in": round(cash_in, 2), 
            "cash_out": round(cash_out, 2), 
            "net": round(net, 2)
        }, 
        inserted=len(inserted)
    )


@app.post("/classify", response_model=ClassifyResponse)
async def classify(limit: int = 100, user_id: str = Depends(get_current_user_id)):
    logger.info(f"Starting classification for up to {limit} transactions")
    txs = await fetch_transactions(user_id, limit=limit)
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
                "transaction_id": ObjectId(t.get("id")),
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
        latest_txs = await fetch_transactions(user_id, limit=1)
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
        sum_this = await fetch_period_summary(user_id, p_this.start, p_this.end)
        sum_last = await fetch_period_summary(user_id, p_last.start, p_last.end)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {e}")

    # --- Intelligence Layer: Health & Runway ---
    try:
        historical = await fetch_historical_cash_flow(user_id, limit_days=90)
        total_cash = sum_this.get("cash_in", 0) - sum_this.get("cash_out", 0)
        # Simple runway calculation: average monthly burn
        avg_monthly_burn = float(sum_last.get("cash_out") or sum_this.get("cash_out") or 1000.0)
        runway_weeks = (total_cash / (avg_monthly_burn / 4.33)) if avg_monthly_burn > 0 else 52.0
        
        # Health Score logic
        score = 75 # default
        if sum_this.get("net", 0) > 0: score += 15
        if runway_weeks > 12: score += 10
        if sum_this.get("cash_out", 0) > sum_last.get("cash_out", 0) * 1.2: score -= 20
        score = max(0, min(100, score))
        
        status = "Healthy" if score > 80 else "Stable" if score > 50 else "At Risk"
        
        health = HealthMetrics(
            score=score,
            status=status,
            runway_weeks=round(max(0, runway_weeks), 1),
            cash_reserve=float(total_cash)
        )
    except Exception:
        health = HealthMetrics(score=0, status="Unknown", runway_weeks=0, cash_reserve=0)

    # --- Intelligence Layer: Top Entities ---
    try:
        raw_top_cust = await fetch_top_customers(user_id, p_this.start, p_this.end)
        total_in = sum_this.get("cash_in") or 1.0
        top_customers = [
            EntityMetric(name=c["entity"], amount=c["revenue"], percentage=round((c["revenue"]/total_in)*100, 1))
            for c in raw_top_cust[:3]
        ]
        
        raw_top_supp = await fetch_top_suppliers(user_id, p_this.start, p_this.end)
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
    if float(sum_this.get("cash_out") or 0.0) > float(sum_this.get("cash_in") or 0.0) and float(sum_this.get("cash_in") or 0.0) > 0:
        insights_raw.append({"type": "spend_over_income", "severity": "high", "raw": "You spent more than you earned this month."})

    # Pattern 3: top customer revenue > 60%
    try:
        top = await fetch_top_customers(user_id, p_this.start, p_this.end)
    except Exception:
        top = []
    total_rev = sum(x["revenue"] for x in top) if top else 0.0
    if top and total_rev > 0:
        share = top[0]["revenue"] / total_rev
        if share > 0.6:
            pct = round(share * 100)
            insights_raw.append({"type": "customer_concentration", "severity": "medium", "raw": f"Most of your income came from {top[0]['entity']} (about {pct}%)."})

    # Pattern 4: Anomaly Detection - Unusual spending spike
    try:
        exp_by_type = await fetch_expense_totals_by_type(user_id, p_this.start, p_this.end)
        exp_by_type_last = await fetch_expense_totals_by_type(user_id, p_last.start, p_last.end)
        for cat, amt in exp_by_type.items():
            last_amt = exp_by_type_last.get(cat, 0)
            if last_amt > 0 and amt > last_amt * 1.5:
                pct = round(((amt - last_amt) / last_amt) * 100)
                insights_raw.append({
                    "type": "anomaly_spike",
                    "severity": "high",
                    "raw": f"Unusual {cat} spike: spent ${round(amt)}, which is {pct}% higher than last month."
                })
    except Exception:
        pass

    # Pattern 5: Large Transaction Alert
    try:
        all_txs = await fetch_transactions(user_id, limit=100)
        large_threshold = 2000 # Example threshold
        seen_large_descriptions = set()
        for tx in all_txs:
            desc = tx.get("description")
            if tx.get("direction") == "out" and float(tx.get("amount") or 0) > large_threshold:
                if desc not in seen_large_descriptions:
                    insights_raw.append({
                        "type": "large_expense",
                        "severity": "medium",
                        "raw": f"Large expense detected: ${round(tx['amount'])} for {desc}."
                    })
                    seen_large_descriptions.add(desc)
    except Exception:
        pass

    # Optional: biggest expense type
    try:
        exp_by_type = await fetch_expense_totals_by_type(user_id, p_this.start, p_this.end)
        if exp_by_type:
            k, v = sorted(exp_by_type.items(), key=lambda x: x[1], reverse=True)[0]
            insights_raw.append({"type": "top_expense", "severity": "low", "raw": f"Your biggest expense area this month looks like {k} (about ${round(v)})."})
    except Exception:
        pass

    # Turn raw into one-sentence messages using AI
    saved_rows: list[dict[str, Any]] = []
    
    # Fetch existing insights for this period to avoid duplicates
    try:
        existing_insights = await fetch_recent_insights(user_id, period=period, limit=100)
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
        recent = await fetch_recent_insights(user_id, period=period, limit=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch insights: {e}")

    # If no insights were found for the requested period, fallback to any available insights
    if not recent:
        try:
            recent = await fetch_recent_insights(user_id, period=None, limit=10)
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
        health=health,
        top_customers=top_customers,
        top_suppliers=top_suppliers,
        advisor_summary=advisor_summary,
        recurring_expenses=recurring_expenses
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    question = (req.message or req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Provide 'message' (frontend) or 'question'.")

    # Determine the reference date based on the latest transaction
    try:
        latest_txs = await fetch_transactions(user_id, limit=100) # Fetch more for context
        if latest_txs:
            ref_date = date.fromisoformat(latest_txs[0]["date"])
        else:
            ref_date = date.today()
    except Exception:
        ref_date = date.today()
        latest_txs = []

    p_this = this_month(today=ref_date)
    p_last = last_month(today=ref_date)
    
    try:
        summary = await fetch_period_summary(user_id, p_this.start, p_this.end)
        recent_insights = await fetch_recent_insights(user_id, period="this_month", limit=8)
        
        # Add Health and Runway context for What-If analysis
        total_cash = summary.get("cash_in", 0) - summary.get("cash_out", 0)
        avg_monthly_burn = float((await fetch_period_summary(user_id, p_last.start, p_last.end)).get("cash_out") or summary.get("cash_out") or 1000.0)
        runway_weeks = (total_cash / (avg_monthly_burn / 4.33)) if avg_monthly_burn > 0 else 52.0
    except Exception as e:
        logger.error(f"Failed to load context for chat: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load context: {e}")

    # Build a strictly data-driven context including specific transactions
    tx_details = ""
    for t in latest_txs[:50]: # Provide last 50 transactions for deep-dive questions
        tx_details += f"- {t['date']}: {t['description']} | ${t['amount']} ({t['direction']})\n"

    context = (
        f"STRICT INSTRUCTION: Base your answer ONLY on the following data. If asked about a specific entity or amount, look through the 'Transaction List' below.\n\n"
        f"Current Month: {ref_date.strftime('%B %Y')}\n"
        f"Totals for this month: Cash In ${round(summary['cash_in'])}, Cash Out ${round(summary['cash_out'])}, Net ${round(summary['net'])}\n"
        f"Cash Reserve: ${round(total_cash)}\n"
        f"Estimated Runway: {round(runway_weeks, 1)} weeks\n\n"
        f"Transaction List (Latest 50):\n{tx_details}\n"
        f"Recent Insights:\n"
    )
    for ins in recent_insights:
        context += f"- {ins.get('message')}\n"

    if req.history:
        context += "\nConversation so far:\n"
        for h in req.history[-12:]:
            role = (h.get("role") or "").strip()
            content = (h.get("content") or "").strip()
            if role and content:
                context += f"- {role}: {content}\n"

    try:
        reply = await chat_answer(context=context, question=question)
    except LLMError as e:
        if "429" in str(e):
            logger.warning("Gemini rate limit hit, using structured fallback.")
            # Structured fallback logic for common questions
            q_lower = question.lower()
            if "cash in" in q_lower or "revenue" in q_lower:
                reply = f"You've brought in ${round(summary['cash_in'])} this month. Your top customer contributed a significant portion of that."
            elif "cash out" in q_lower or "spent" in q_lower or "expense" in q_lower:
                reply = f"You've spent ${round(summary['cash_out'])} this month. I've noticed some large expenses that you might want to review in the 'Critical Insights' section."
            elif "runway" in q_lower or "how long" in q_lower:
                reply = f"Based on your current cash reserve of ${round(total_cash)}, your estimated runway is about {round(runway_weeks, 1)} weeks."
            elif "net" in q_lower or "profit" in q_lower:
                reply = f"Your net change for this month is ${round(summary['net'])}. This factors into your overall health score of {round(runway_weeks * 5)} (estimated)."
            else:
                reply = f"I'm currently experiencing high demand, but I can tell you that your net change this month is ${round(summary['net'])} and your runway is {round(runway_weeks, 1)} weeks. Ask me specifically about 'cash in', 'cash out', or 'runway' for more details."
        else:
            raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {e}")

    return ChatResponse(reply=reply)
