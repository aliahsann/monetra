from __future__ import annotations

import json
from typing import Any

import httpx

from .config import settings


class LLMError(RuntimeError):
    pass


async def _post_openai_compatible(payload: dict[str, Any]) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
        )
        if r.status_code >= 400:
            raise LLMError(f"LLM HTTP {r.status_code}: {r.text}")
        return r.json()


async def _post_gemini(prompt: str) -> dict[str, Any]:
    # Gemini Generative Language API (native)
    # Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=API_KEY
    base = settings.llm_base_url.rstrip("/") if settings.llm_base_url else "https://generativelanguage.googleapis.com/v1beta"
    model = (settings.gemini_model or settings.llm_model or "gemini-2.0-flash").strip()
    
    # Ensure model name is correctly formatted for Gemini API
    # The expected format is: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=API_KEY
    model_name = (settings.gemini_model or settings.llm_model or "gemini-2.0-flash").strip()
    if model_name.startswith("models/"):
        model_name = model_name.replace("models/", "")
        
    url = f"{base}/models/{model_name}:generateContent"
    params = {"key": settings.llm_api_key}
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
        },
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, params=params, json=payload)
        if r.status_code >= 400:
            raise LLMError(
                f"Gemini HTTP {r.status_code}: {r.text}. "
                f"URL: {url}, Model: {model}. "
                f"Tip: ensure LLM_MODEL is a valid Gemini model name (e.g. gemini-2.0-flash) "
                "and LLM_BASE_URL is https://generativelanguage.googleapis.com/v1beta"
            )
        return r.json()


def _extract_text_openai(resp: dict[str, Any]) -> str:
    try:
        return resp["choices"][0]["message"]["content"]
    except Exception as e:
        raise LLMError(f"Unexpected OpenAI-compatible response shape: {e}")


def _extract_text_gemini(resp: dict[str, Any]) -> str:
    try:
        # candidates[0].content.parts[0].text
        return resp["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        raise LLMError(f"Unexpected Gemini response shape: {e}")


async def _generate_text(system: str | None, user: str, temperature: float) -> str:
    provider = (settings.llm_provider or "openai_compatible").strip().lower()
    if provider == "gemini":
        # Gemini does not have a separate system role in this minimal payload; we inline it.
        prefix = f"{system.strip()}\n\n" if system else ""
        resp = await _post_gemini(prefix + user)
        return _extract_text_gemini(resp).strip()

    payload = {
        "model": settings.llm_model,
        "messages": ([{"role": "system", "content": system}] if system else [])
        + [{"role": "user", "content": user}],
        "temperature": temperature,
    }
    resp = await _post_openai_compatible(payload)
    return _extract_text_openai(resp).strip()


def _json_only(text: str) -> Any:
    s = text.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.lower().startswith("json"):
            s = s[4:].strip()
    try:
        return json.loads(s)
    except Exception:
        start = s.find("{")
        end = s.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(s[start : end + 1])
        raise


def rule_based_classify(description: str, amount: float) -> dict[str, Any] | None:
    """Fast, deterministic classification using keyword mapping and regex."""
    desc_lower = description.lower()
    is_income = amount > 0

    # 1. Direct Keyword Mappings (High Confidence)
    mappings = [
        ({"aws", "amazon web services", "azure", "gcp", "google cloud", "heroku", "digitalocean"}, "Subscription", "Cloud Services"),
        ({"google ads", "meta ads", "facebook ads", "linkedin ads"}, "Advertising", "Digital Marketing"),
        ({"shell", "bp", "station", "fuel", "gas", "petrol"}, "Fuel", "Fuel Station"),
        ({"hardware", "bunnings", "tool", "screwfix", "home depot"}, "Tools", "Hardware Store"),
        ({"zoom", "slack", "microsoft 365", "adobe", "canva", "netflix", "spotify"}, "Subscription", "SaaS"),
        ({"uber", "taxi", "bolt", "rail", "train"}, "Travel", "Transport"),
    ]

    for keywords, exp_type, default_entity in mappings:
        if any(k in desc_lower for k in keywords):
            return {
                "type": "expense",
                "entity": default_entity,
                "expense_type": exp_type,
                "tags": ["auto-rule-matched"],
                "confidence": 0.9
            }

    # 2. Income Logic
    if is_income or any(k in desc_lower for k in ["payment from", "invoice", "transfer in"]):
        import re
        entity = "Unknown Customer"
        name_match = re.search(r"(?:payment\s*-\s*|from\s*|to\s*)([\w\s]+)", description, re.IGNORECASE)
        if name_match:
            entity = name_match.group(1).strip()
            
        return {
            "type": "income",
            "entity": entity,
            "revenue_stream": "Customer Payment",
            "tags": ["auto-rule-matched"],
            "confidence": 0.8
        }

    return None

async def classify_transaction(description: str, amount: float) -> dict[str, Any]:
    # --- Step 1: Try Rule-Based Engine (Fast & Free) ---
    rule_result = rule_based_classify(description, amount)
    if rule_result:
        return rule_result

    # --- Step 2: Fallback to AI Brain (Google Gemini) ---
    prompt = (
        "You are classifying bank transactions for a small business.\n\n"
        f'Transaction:\n"{description}" | Amount: {amount}\n\n'
        "Look for recurring indicators or known SaaS/Utility names.\n\n"
        "Return JSON only:\n"
        "{\n"
        "  \"type\": \"income | expense\",\n"
        "  \"entity\": \"customer or supplier name\",\n"
        "  \"expense_type\": \"Fuel | Tools | Subcontractor | Subscription | Advertising | Travel | Other\",\n"
        "  \"revenue_stream\": \"optional\",\n"
        "  \"tags\": [\"recurring\" if it looks like a subscription/bill, else others],\n"
        "  \"confidence\": 0.0\n"
        "}"
    )

    try:
        text = await _generate_text(
            system="You are a helpful assistant. Output must be valid JSON only.",
            user=prompt,
            temperature=0.2,
        )
        data = _json_only(text)
        if not isinstance(data, dict):
            raise LLMError("Classifier did not return a JSON object")
        return data
    except LLMError as e:
        # Step 3: Emergency Fallback (Heuristic guess on error)
        if "429" in str(e) or "500" in str(e):
            return {
                "type": "income" if amount > 0 else "expense",
                "entity": "Unknown",
                "expense_type": "Other",
                "tags": ["fallback-on-error"],
                "confidence": 0.3
            }
        raise


async def explain_insight(raw: str) -> str:
    prompt = (
        "Explain this financial insight to a small business owner in one short sentence.\n"
        "No accounting terms.\n"
        "Friendly tone.\n\n"
        f"Insight: {raw}"
    )
    text = await _generate_text(
        system="Reply with a single short sentence.",
        user=prompt,
        temperature=0.4,
    )
    return text.strip().strip('"')


async def chat_answer(context: str, question: str) -> str:
    """Gets an answer from the LLM based on financial context."""
    system = (
        "You are an AI Financial Co-Pilot for a micro business. "
        "Do not use accounting jargon. Be direct and practical. "
        "When you mention numbers, keep them simple.\n\n"
        "Special Ability: 'What-If' Scenarios.\n"
        "If the user asks about a potential purchase or hiring decision, "
        "check the 'Runway' and 'Net' in the context. "
        "Explain how the decision impacts their cash buffer weeks."
    )
    user_prompt = f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer concisely based ONLY on the context above."
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            return await _generate_text(system=system, user=user_prompt, temperature=0.5)
        except LLMError as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 2 # 2s, 4s backoff
                logger.warning(f"LLM 429 hit, retrying in {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_time)
                continue
            raise e


async def generate_weekly_advisor_summary(context: str) -> str:
    prompt = (
        "You are a friendly AI Financial Advisor for a small business owner.\n"
        "Based on the following context, provide 3 short, actionable, and friendly pieces of advice.\n"
        "Do not use accounting jargon. Focus on practical growth and safety.\n"
        "Format as a simple bulleted list.\n\n"
        f"Context:\n{context}"
    )
    text = await _generate_text(
        system="Reply with 3 actionable tips only.",
        user=prompt,
        temperature=0.6,
    )
    return text.strip()

async def extract_intent(user_message: str) -> dict[str, Any]:
    """Uses LLM to analyze intent from user message for financial computation."""
    system = "You are a financial query planner. Convert the user question into structured JSON intent."
    user_prompt = (
        "EXAMPLES:\n"
        "User: What is my biggest expense?\n"
        "Response: {\"intent\": \"top_expense_category\"}\n\n"
        "User: Can I afford a $2000 purchase?\n"
        "Response: {\"intent\": \"affordability_check\", \"amount\": 2000}\n\n"
        "User: How much did I spend this month?\n"
        "Response: {\"intent\": \"total_expenses\"}\n\n"
        "Return JSON only based on the question: " + user_message
    )
    
    try:
        text = await _generate_text(system=system, user=user_prompt, temperature=0.1)
        data = _json_only(text)
        if not isinstance(data, dict):
             return {"intent": "unknown"}
        return data
    except Exception:
        # Minimal extraction for fallback
        msg_lower = user_message.lower()
        if "spend" in msg_lower or "expense" in msg_lower:
            if "last" in msg_lower or "latest" in msg_lower or "recent" in msg_lower:
                return {"intent": "last_transaction", "filter": "out"}
            return {"intent": "total_expenses"}
        if "earn" in msg_lower or "income" in msg_lower:
            if "last" in msg_lower or "latest" in msg_lower or "recent" in msg_lower:
                return {"intent": "last_transaction", "filter": "in"}
            return {"intent": "total_income"}
        if "balance" in msg_lower: return {"intent": "balance"}
        if "last" in msg_lower or "latest" in msg_lower or "recent" in msg_lower: return {"intent": "last_transaction"}
        return {"intent": "unknown"}

async def generate_answer(user_message: str, result: dict[str, Any]) -> str:
    """Explains a computed financial result in a friendly way to the user."""
    system = (
        "You are an AI Financial Strategist. Explain the computed result clearly.\n"
        "If 'strategic_context' is provided, use it to give more insightful advice. "
        "For example, if the user asks 'Can I afford X?' and they have the cash, check the 'current_net_margin'. "
        "If the margin is low, warn them about over-spending.\n\n"
        "Be concise, friendly, and practical."
    )
    user_prompt = f"User Question: {user_message}\nData Result: {json.dumps(result)}\n\nAnswer:"
    
    try:
        return await _generate_text(system=system, user=user_prompt, temperature=0.4)
    except Exception:
        # User-friendly fallback if AI is over-quota
        msg = "I've calculated this directly from your records:\n\n"
        if "total_expenses" in result: msg += f"• **Total Expenses**: PKR {result['total_expenses']:,.2f}\n"
        if "total_income" in result: msg += f"• **Total Income**: PKR {result['total_income']:,.2f}\n"
        if "balance" in result: msg += f"• **Balance**: PKR {result['balance']:,.2f}\n"
        if "last_transaction" in result:
            lt = result["last_transaction"]
            msg += f"• **Last Transaction**: {lt['description']} (PKR {lt['amount']:,.2f}) on {lt['date']}\n"
        
        msg += "\n*Note: I'm currently in 'Precision Mode' because my AI reasoning is hitting capacity, but these numbers are 100% accurate from your database.*"
        return msg
