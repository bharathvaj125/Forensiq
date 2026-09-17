# backend/ — Core Backend (FastAPI)

**Purpose:** The transactional/read API that owns the system of record
(SAD Section 2.2 "Core Backend API"). Handles cases, accused, victims,
officers, RBAC, collaboration, reports, notifications, and audit.
It is the ONLY service that writes to the relational database.

**Responsibility:** Enforce RBAC + jurisdiction scoping on every request,
orchestrate calls into the AI Engine (never re-implement AI logic here),
and persist all AI outputs for audit purposes (`ai_model_runs`).

## Structure
- `app/main.py` — FastAPI entrypoint
- `app/core/` — settings, security (JWT), shared dependencies, RBAC rules
- `app/api/v1/endpoints/` — one file per SAD module (cases, hotspot, network, ...)
- `app/models/` — SQLAlchemy ORM models (mirrors the finalized schema + new platform tables)
- `app/schemas/` — Pydantic request/response contracts
- `app/crud/` — jurisdiction-scoped data access layer
- `app/services/` — business logic + AI Engine orchestration
- `app/middleware/` — auth, jurisdiction-scope injection, audit hook
- `app/tasks/` — Celery background jobs (reports, notifications)
- `alembic/` — database migrations (the live schema source of truth)
- `tests/` — unit + integration tests

## Run locally
```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Full endpoint-by-file mapping: see `PROJECT_STRUCTURE.md` at the repo root.

## Phase 4: Similar Case Finder

1. An authorised investigator calls `POST /api/v1/intelligence/embeddings/backfill`
   to prepare embeddings for visible case narratives.
2. `GET /api/v1/intelligence/cases/{case_id}/similar` returns cosine-ranked,
   jurisdiction-scoped matches with plain-language factors explaining the match.

The embedding model and version are configured through `EMBEDDING_MODEL_NAME`
and `EMBEDDING_MODEL_VERSION`. The configured LaBSE model emits 768 dimensions,
which matches the pgvector column.
