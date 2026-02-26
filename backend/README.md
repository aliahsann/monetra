# AI Financial Co-Pilot Backend (FastAPI)

## What this is
A hackathon-grade FastAPI backend that:

- Uploads CSV bank transactions into Supabase
- Classifies transactions via an OpenAI-compatible LLM
- Generates plain-English insights
- Provides a simple chat endpoint the frontend can call

## Setup

### 1) Create `.env` in `backend/`

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=...
LLM_MODEL=gpt-4o-mini

CORS_ALLOW_ORIGINS=http://localhost:3000
```

Notes:
- Use the **Supabase service role** key (no auth in this MVP).
- `LLM_BASE_URL` can point to any OpenAI-compatible server.

### 2) Install deps

```
pip install -r requirements.txt
```

### 3) Run the server

```
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `POST /upload-transactions` (multipart form CSV)
- `POST /classify` (classifies most recent transactions)
- `GET /insights?period=this_month`
- `POST /chat` body: `{ "question": "Where is my money going?" }`
