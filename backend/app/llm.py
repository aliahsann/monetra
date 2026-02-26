from __future__ import annotations

import json
from typing import Any

import httpx

from .config import settings


class LLMError(RuntimeError):
    pass


async def _post_openai_compatible(payload: dict[str, Any]) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=45) as client:
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
    async with httpx.AsyncClient(timeout=45) as client:
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


async def classify_transaction(description: str, amount: float) -> dict[str, Any]:
    prompt = (
        "You are classifying bank transactions for a small electrician business.\n\n"
        f'Transaction:\n"{description}" | Amount: {amount}\n\n'
        "Look for recurring indicators like 'Monthly', 'Subscription', 'Bill', or known SaaS/Utility names.\n\n"
        "Return JSON only:\n"
        "{\n"
        "  \"type\": \"income | expense\",\n"
        "  \"entity\": \"customer or supplier name\",\n"
        "  \"expense_type\": \"Fuel | Tools | Subcontractor | Subscription | Other\",\n"
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
        if "429" in str(e):
            # Deterministic fallback for 429 errors
            desc_lower = description.lower()
            is_income = amount > 0 # This might need better logic based on direction if available
            
            # Simple keyword matching for fallback
            entity = "Unknown"
            expense_type = "Other"
            
            if "fuel" in desc_lower or "shell" in desc_lower or "bp" in desc_lower:
                entity = "Fuel Station"
                expense_type = "Fuel"
            elif "tool" in desc_lower or "hardware" in desc_lower or "bunnings" in desc_lower:
                entity = "Tool Shop"
                expense_type = "Tools"
            elif "sub" in desc_lower or "contract" in desc_lower:
                entity = "Subcontractor"
                expense_type = "Subcontractor"
            elif "netflix" in desc_lower or "adobe" in desc_lower or "google" in desc_lower:
                entity = "Subscription Service"
                expense_type = "Subscription"
            
            return {
                "type": "income" if is_income else "expense",
                "entity": entity,
                "expense_type": expense_type if not is_income else None,
                "revenue_stream": "Service" if is_income else None,
                "tags": ["auto-classified-fallback"],
                "confidence": 0.5
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
    system = (
        "You are an AI Financial Co-Pilot for a micro business. "
        "Do not use accounting jargon. Be direct and practical. "
        "When you mention numbers, keep them simple.\n\n"
        "Special Ability: 'What-If' Scenarios.\n"
        "If the user asks about a potential purchase or hiring decision, "
        "check the 'Runway' and 'Net' in the context. "
        "Explain how the decision impacts their cash buffer weeks."
    )
    user = f"Context:\n{context}\n\nQuestion: {question}"
    return await _generate_text(system=system, user=user, temperature=0.5)


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
