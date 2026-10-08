# Forensiq — Complete Project Documentation

*An AI-powered crime intelligence platform for case triage, risk scoring, anomaly detection, hotspot mapping, co-offending network analysis, semantic case search, and conversational querying.*

This document is the single, exhaustive reference for the project: what it is, how it's built, every module and endpoint, the full debugging history, deployment setup, and known open issues. It complements two other documents in this repo:

- [`README.md`](./README.md) — short public-facing overview
- [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md) — feature-by-feature audit/verification log

---

> **Update, 2026-10-08.** Sections 12, 20, 21 and 22 were rewritten to match the system as it is now. Sections 5, 9-11, 13 and 19 are a historical record and may describe earlier behaviour (for example the Predictive module being placeholder-driven, the 97% risk-model accuracy, Isolation Forest anomaly detection and the 3-band risk output); `README.md` and `FEATURE_CHECKLIST.md` are the current source of truth.

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Team](#2-team)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Development History (Full Timeline)](#5-development-history-full-timeline)
6. [Backend — Directory Structure](#6-backend--directory-structure)
7. [Backend — Configuration & Environment Variables](#7-backend--configuration--environment-variables)
8. [Backend — Application Startup Sequence](#8-backend--application-startup-sequence)
9. [Backend — Database Models](#9-backend--database-models)
10. [Backend — API Endpoints (Full Reference)](#10-backend--api-endpoints-full-reference)
11. [Backend — Services Layer](#11-backend--services-layer)
12. [Backend — Machine Learning Subsystem (Deep Dive)](#12-backend--machine-learning-subsystem-deep-dive)
13. [Backend — Middleware & Security](#13-backend--middleware--security)
14. [Frontend — Directory Structure](#14-frontend--directory-structure)
15. [Frontend — Modules (Pages)](#15-frontend--modules-pages)
16. [Frontend — Services (API Client Layer)](#16-frontend--services-api-client-layer)
17. [Frontend — Internationalization](#17-frontend--internationalization)
18. [Deployment Architecture](#18-deployment-architecture)
19. [Full Bug History & Fixes](#19-full-bug-history--fixes)
20. [ML Evaluation Results](#20-ml-evaluation-results)
21. [Known Issues / Not Yet Done](#21-known-issues--not-yet-done)
22. [Security Considerations](#22-security-considerations)
23. [Local Development Setup](#23-local-development-setup)
24. [Appendix: Full Git Commit Log](#24-appendix-full-git-commit-log)

---

## 1. Project Overview

Forensiq gives police investigators a single platform to:

- Register and manage FIR-style criminal cases
- Get an AI-generated risk score (Low/Medium/High) for each case with an explanation of which factors drove it
- See statistically anomalous cases flagged for review
- View geographic crime hotspots on a map
- Explore a graph of co-offending relationships between accused individuals, with community detection to surface possible gangs/syndicates
- Search historical cases by semantic similarity of the case narrative, not just keyword match
- Ask a conversational assistant natural-language questions about the case database
- Coordinate across police stations and jurisdictions, delegate tasks, and collaborate with external agencies (CBI, ED, FSL, etc.) under granular access control
- Generate case reports (PDF/CSV/Excel/DOCX) and track court case status

The project began as a fork of an existing open-source crime-records codebase (originally built for a hackathon under Karnataka State Police branding, repo `Datathon-2026`). Rather than treat the forked demo as finished, the team ran a systematic feature-by-feature audit and found that several "AI-powered" features were silently non-functional — they rendered plausible output in the UI while actually running dead/fallback/fabricated logic underneath. Every one of those was diagnosed with a direct reproduction, fixed, and re-verified (full detail in [§19](#19-full-bug-history--fixes) and [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md)). The project was then rebranded to **Forensiq** and redeployed on a fresh cloud stack.

Forensiq is also the subject of a Project-Based Learning (PBL) report and poster for the Machine Learning course (CS3505), which document the risk-scoring model's evaluation methodology and results academically.

## 2. Team

| Name | Role |
| :--- | :--- |
| Bharathvaj S | ML Systems & Backend Lead — backend architecture, ML pipeline debugging, cloud deployment |
| Adhithyan R | Evaluation & Documentation Lead — model evaluation, testing, documentation, diagrams |

## 3. High-Level Architecture

```
┌────────────────────────────┐
│   React 18 + TypeScript     │
│   Frontend (Vercel)         │
└──────────────┬───────────────┘
               │ HTTPS / REST (Axios, JWT bearer)
               ▼
┌────────────────────────────┐
│   FastAPI Backend            │
│   (Render, Docker, Oregon)   │
│   ┌─────────────────────┐   │
│   │ API Routers (v1)     │   │
│   │ Services layer        │   │
│   │ ML models (sklearn)   │   │
│   └─────────────────────┘   │
└─────┬────────────────┬──────┘
      │                │
      ▼                ▼
┌───────────────┐  ┌─────────────────────┐
│ PostgreSQL 17   │  │  Google Gemini API   │
│ + pgvector       │  │  (gemini-3.6-flash,  │
│ + PostGIS         │  │  gemini-embedding-  │
│ (Supabase,        │  │  001)                │
│ ap-south-1)        │  └─────────────────────┘
└───────────────┘
```

Request flow for an AI-backed feature (e.g., risk scoring): browser → Axios client (attaches JWT) → FastAPI endpoint → dependency-injected auth/permission check → service layer function → either a locally-loaded scikit-learn model (`.joblib` artifact) or an outbound call to the Gemini API → result persisted/returned → audit log entry written via SQLAlchemy event listener.

## 4. Technology Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| Frontend framework | React 18 + TypeScript | Vite build tool |
| Frontend styling | Tailwind CSS | |
| Frontend state/data | @tanstack/react-query, zustand, axios | |
| Frontend visualization | echarts, echarts-for-react, recharts, cytoscape (network graph), leaflet + mapbox-gl (maps) | |
| Frontend routing | react-router-dom v6 | |
| Backend framework | FastAPI 0.115 (Python 3.13) | Uvicorn ASGI server |
| ORM | SQLAlchemy 2.0 | |
| Validation | Pydantic v2 | |
| Auth | python-jose (JWT), passlib + bcrypt (password hashing) | |
| Database | PostgreSQL 17 | Managed via Supabase |
| Vector search | pgvector (>=0.3.6) | 768-dim cosine similarity |
| Geospatial | PostGIS | |
| ML | scikit-learn (RandomForestClassifier, IsolationForest, KernelDensity), NetworkX (greedy modularity, PageRank), NumPy, pandas, joblib | |
| LLM / embeddings | Google Gemini API — `gemini-3.6-flash` (generation), `gemini-embedding-001` truncated to 768-dim (embeddings) | |
| Reports | reportlab (PDF) | |
| Background jobs | Celery + Redis (configured; optional) | |
| Containerization | Docker | Backend Dockerfile |
| Hosting | Render (backend), Vercel (frontend), Supabase (database) | |

## 5. Development History (Full Timeline)

The project evolved through a sequence of real, individually-verified fixes (see [§24](#24-appendix-full-git-commit-log) for the exact commit list). Narrative order:

1. **Initial commit** — forked the existing "KSP Crime Intelligence Platform" hackathon codebase as a starting point.
2. **Login flow, auth bypass, SQLite portability** — removed a code path that fabricated a synthetic admin `User` object whenever no valid JWT was supplied (instead of correctly rejecting the request with 401); fixed primary-key types so the same models work on both SQLite (local dev) and PostgreSQL (production).
3. **Dead scaffold files removed** — cleaned up placeholder files left over from the original repo template that were never wired to anything.
4. **Officer appointment failure and AI assistant branding** — fixed a broken officer-creation flow and corrected assistant labeling.
5. **Audit trail never capturing the acting officer** — root-caused to `get_current_user` being declared as a synchronous function used inside an async FastAPI request path. Sync dependencies run in a thread pool with a *copied* context, so Python's `contextvars` (used to stash "who is making this request" for the audit logger) never propagated back to the async request handler. Fixed by making the dependency `async def`.
6. **The real ML risk-scoring model never actually running** — the single most significant bug found. `scorer.py`'s inference function computed `probabilities` from the trained RandomForest but never assigned the derived `score` variable — a `NameError`-class bug — so every request silently fell through to a crude two-feature fallback heuristic, while the UI still labeled the result "AI Risk Score."
7. **Anomaly detection and hotspot prediction also discarding real ML output** — the same class of bug: both services computed a correct result dictionary from a real Isolation Forest / KDE model, but never assigned it to the variable the endpoint actually returned, so the API sent back incomplete/empty output despite the model running correctly.
8. **Undefined `timedelta` crash in forecast fallback; deduped imports** — a missing import that would `NameError` on a specific fallback code path in the crime-trend forecaster; also cleaned up duplicate imports across network endpoint/service files.
9. **Startup `ALTER TABLE` running before the tables exist on a fresh DB** — the lifespan startup hook ran a patch-column `ALTER TABLE` block *before* `Base.metadata.create_all()`, so a brand-new database (no pre-existing tables) would fail that step. Reordered to run after schema creation.
10. **Pointed production frontend at the new Render + Supabase backend** — migrated the live stack off the original Zoho Catalyst deployment onto Render (backend) + Vercel (frontend) + Supabase (database).
11. **Allowed the deployed Vercel frontend through CORS** — `allow_origin_regex` didn't include `vercel.app`; confirmed via a direct OPTIONS preflight curl showing no `access-control-allow-origin` header, then fixed the regex.
12. **Rebrand from KSP/Karnataka State Police to Forensiq** — systemic rebrand across the login page, sidebar, translations (English + Kannada), page titles, and multiple module headers.
13. **Wired up real Gemini LLM and fixed MO similarity search entirely** — replaced a fake SHA-256-hash "embedding" function (which reshaped hash bytes into a vector, giving semantically meaningless similarity results) with real Google Gemini embeddings, added the missing `pgvector` dependency, and migrated the live database column from a silently-substituted `JSON` type to a true `vector(768)` column.
14. **Fixed fake Configure Access save, translation keys, remaining rebrand spots** — the admin panel's "Configure Access" modal appeared to save role/permission changes but never called a real endpoint; wired it to a genuine `PATCH /admin/users/{id}/role` call, added missing translation keys, and swept remaining old-branding strings.
15. **Fixed severe N+1 query bug in CSV export making it take 10+ minutes** — added `selectinload` eager loading for `accused_list` and `evidence_items` instead of lazy-loading them per-case in a loop.
16. **Fixed the Predictive AI command assistant — also fully fake** — discovered late (after the above fixes) that the separate assistant surfaced in the Predictive module was still keyword-matching against hardcoded strings with fabricated statistics (e.g., a hardcoded "210 repeat offenders" figure). Rebuilt it to gather genuine aggregate SQL results first, then hand that grounded context to Gemini.

Subsequent to this git history, the team also produced the PBL academic report and poster (see the top-level project folder), which required an honest, held-out-test-set evaluation of the risk-scoring model — this evaluation is *not* part of the production codebase; it's a standalone script written specifically to produce trustworthy, reproducible numbers for the report (see [§20](#20-ml-evaluation-results)).

## 6. Backend — Directory Structure

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── router.py                 # Aggregates all endpoint routers under /api/v1
│   │   └── endpoints/                # One file per resource (see §10)
│   ├── core/
│   │   ├── config.py                 # Settings (env vars), DB URL discovery
│   │   ├── dependencies.py           # get_current_user, get_db, permission checks, rate limiting
│   │   ├── exceptions.py             # Custom exception types
│   │   └── handlers.py               # Exception handlers
│   ├── db/
│   │   ├── base.py / base_class.py   # SQLAlchemy declarative base
│   │   ├── session.py                # Engine + SessionLocal
│   │   └── init_db.py                # seed_database()
│   ├── middleware/
│   │   ├── audit_listeners.py        # SQLAlchemy event listeners for audit logging
│   │   └── audit_hook.py             # AuditLoggingMiddleware (HTTP-level)
│   ├── models/                       # SQLAlchemy ORM models (see §9)
│   ├── schemas/                      # Pydantic request/response schemas
│   ├── services/                     # Business logic layer (see §11)
│   └── ml/models/                    # ML model training + inference code (see §12)
├── alembic/                          # DB migration scaffolding
├── backfill_risk_scores.py           # One-off script to backfill AIRiskScore on existing cases
├── seed_supabase.py                  # Seeds the Supabase database with synthetic data
├── requirements.txt
└── Dockerfile
```

## 7. Backend — Configuration & Environment Variables

Defined in `app/core/config.py` via `pydantic-settings`. **Important quirk:** several settings (`JWT_SECRET_KEY`, `LLM_API_KEY`, `DATABASE_URL` resolution) read from `os.getenv()` directly at class-body evaluation time, which happens *before* pydantic-settings' own `.env` file loading takes effect. In practice this means a local `.env` file is **not** sufficient for local runs — the variables must be exported as real shell environment variables before starting Uvicorn. This is not an issue in production (Render injects real environment variables directly).

| Variable | Purpose | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` (or `POSTGRES_URL` / `SQLALCHEMY_DATABASE_URI` / `CATALYST_DATABASE_URL`) | Postgres connection string | Falls back to a local SQLite file if unset (dev only) |
| `JWT_SECRET_KEY` | Signs/verifies access & refresh tokens | Must be a real secret in production |
| `JWT_ALGORITHM` | `HS256` | fixed |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 15 | |
| `JWT_REFRESH_TOKEN_EXPIRE_HOURS` | 8 | |
| `CORS_ALLOWED_ORIGINS` | Legacy setting; actual CORS is enforced via a regex in `main.py`, not this var | |
| `LLM_API_KEY` (or `GEMINI_API_KEY`) | Google Gemini API key | |
| `LLM_PROVIDER` | `"gemini"` | |
| `LLM_MODEL` | `"gemini-3.6-flash"` | |
| `EMBEDDING_MODEL_NAME` | `"gemini-embedding-001"` | |
| `EMBEDDING_MODEL_VERSION` | `"phase4-gemini-768d-v1"` | version tag stored per embedding row |
| `REDIS_URL` | Optional — Celery broker / cache | Not required for core features to work |
| `VITE_API_BASE_URL` (frontend) | Backend API base URL | Set per environment (`.env.development` / `.env.production` / Vercel dashboard) |

`.env.example` at the repo root is a legacy template from the original fork (references Anthropic/Claude as the LLM provider, LaBSE embeddings, MinIO object storage, and Redis-backed Celery) — several of those are no longer accurate for the current Gemini-based setup and are not required to run the app; it's kept as a reference for the full set of variables the original architecture anticipated, not as an exact list of what's live today.

## 8. Backend — Application Startup Sequence

On boot (`app/main.py`, FastAPI `lifespan`):

1. Register SQLAlchemy audit-log event listeners.
2. Connect to the database; if PostgreSQL, run `CREATE EXTENSION IF NOT EXISTS vector;` and `CREATE EXTENSION IF NOT EXISTS postgis;` (both idempotent).
3. `Base.metadata.create_all(bind=engine)` — creates any missing tables.
4. If PostgreSQL, run a small set of `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements that patch columns onto a pre-existing older database (a no-op on a fresh DB, since step 3 already includes them). This step was fixed to run *after* table creation (previously ran before, breaking on fresh databases).
5. In a background thread: seed the database with synthetic data if empty, then backfill `AIRiskScore` on any cases missing it.
6. CORS middleware, an audit-logging HTTP middleware, and a security-headers middleware (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`) are registered before the router.
7. `/uploads` is mounted as a static file directory for evidence attachments.
8. Centralized exception handlers registered for custom exceptions, DB integrity errors, validation errors, and unhandled exceptions.
9. `/` and `/health` provide simple liveness/DB-connectivity checks for the hosting platform.

## 9. Backend — Database Models

Grouped by domain (35 model files total):

**Core case data**
`case_master` (the central case record — see full field list below), `accused`, `victim`, `witness`, `evidence`, `vehicle`, `case_annotation`, `case_assignment`, `criminal_relationship`, `case_embedding` (pgvector column).

**Reference / lookup tables**
`state`, `district`, `police_station`, `unit_type`, `crime_type`, `crime_sub_type`, `gravity_offence`, `case_category`, `case_status_master`, `section`, `act`.

**Users, roles, access control**
`user`, `officer`, `role`, `permission`, `role_permission`, `user_jurisdiction`.

**External collaboration**
`external_agency`, `external_agency_officer`, `collaboration_request`, `collaboration_access`.

**Operations**
`task_delegation`, `notification`, `court_case`, `report_job`.

**AI / observability**
`ai_model_run` (logs every ML inference: model name, version, output summary), `audit_log`.

### `case_master` — core entity fields

```
CaseMasterID, CrimeNo, CaseNo, CrimeRegisteredDate,
PolicePersonID → officer, PoliceStationID → police_station,
CaseCategoryID, GravityOffenceID, CrimeMajorHeadID, CrimeMinorHeadID,
CaseStatusID, CourtID,
IncidentFromDate, IncidentToDate, InfoReceivedPSDate,
latitude, longitude, BriefFacts (free text),
InvestigationPriority, AIRiskScore, CaseSensitivity,
UpdatedAt, CreatedBy → users, UpdatedBy → users
```
Relationships (all cascade-delete): `assignments`, `annotations`, `accused_list`, `victims`, `witnesses`, `evidence_items`, `vehicles`, `embeddings`.

All primary keys use `BigInteger().with_variant(Integer, "sqlite")` so the same model definitions work against both SQLite (local dev fallback) and PostgreSQL (production) without separate schemas.

## 10. Backend — API Endpoints (Full Reference)

All routes are prefixed with `/api/v1`. Grouped by router file:

**auth.py**
- `POST /auth/login` — user login
- `POST /auth/refresh` — refresh access token
- `POST /auth/logout`
- `GET /auth/me` — current user profile

**admin.py**
- `POST /admin/users` — create platform user
- `GET /admin/users` — list platform users
- `PATCH /admin/users/{user_id}/role` — update user security role
- `POST /admin/jurisdictions` — assign user jurisdiction override

**cases.py**
- `GET /cases` — list cases (paginated)
- `GET /cases/districts-and-stations` — district/station hierarchy
- `GET /cases/station-command-center` — station analytics
- `GET /cases/{case_id}` — case details
- `GET /cases/{case_id}/accused` · `/victims` · `/evidence` · `/vehicles` · `/witnesses`
- `POST /cases` — register case
- `PUT /cases/{case_id}/status` — transition case status
- `PUT /cases/{case_id}/priority`
- `POST /cases/{case_id}/witnesses` — record witness statement
- `POST /cases/{case_id}/annotations` · `DELETE /cases/annotations/{id}`
- `POST /cases/{case_id}/assignments` · `DELETE /cases/assignments/{id}`
- `POST /cases/{case_id}/evidence` · `POST /cases/{case_id}/upload-evidence`

**intelligence.py** (core AI endpoints)
- `GET /intelligence/anomalies` — detect case anomalies (Isolation Forest)
- `GET /intelligence/offenders/{accused_id}/repeat-offender-matches`
- `GET /intelligence/forecast/crime-trend`
- `POST /intelligence/embeddings/backfill` — build case embeddings (Gemini)
- `GET /intelligence/cases/{case_id}/similar` — semantic similarity search (pgvector)
- `GET /intelligence/cases/{case_id}/predict` — risk score prediction (RandomForest)
- `POST /intelligence/risk-scores/backfill`

**hotspot.py**
- `GET /hotspot/predicted` — predicted hotspots
- `GET /hotspot` — current hotspots (KDE)

**network.py**
- `GET /network/graph` — full co-offending graph
- `GET /network/gangs` — community detection (greedy modularity)
- `POST /network/relationships` · `PUT /network/relationships/{id}/verify`

**predictive.py**
- `GET /predictive/dashboard` — predictive analytics + explainability dashboard
- `GET /predictive/hotspots` — KDE hotspot rankings
- `GET /predictive/patrol-strategy`
- `GET /predictive/early-warnings`
- `POST /predictive/assistant-query` — command-center chatbot query

**assistant.py**
- `POST /assistant/query` — general AI assistant query

**reports.py**
- `GET /reports/cases/{case_id}/summary`
- `POST /reports/cases/{case_id}/generate` · `POST /reports/compile`
- `GET /reports/history` · `GET /reports/jobs/{id}` · `GET /reports/jobs/{id}/download`
- `GET /reports/export/csv` · `/export/excel/{case_id}` · `/export/docx/{case_id}`

**collaboration.py**
- `POST /collaboration/officer-login` — external agency officer auth (CBI/NIA/ED/FSL)
- `GET/POST /collaboration/agencies`, `/agency-officers`
- `POST /collaboration/officer-request` — request access
- `GET /collaboration/ai-recommendation/{case_id}`
- `GET /collaboration/requests` · `POST .../approve` · `POST .../reject`
- `GET /collaboration/external-workspace`
- `GET /collaboration/audit-logs`

**task_delegation.py**
- `POST /tasks` — appoint task
- `GET /tasks/assigned-by-me` · `/assigned-to-me`
- `PUT /tasks/{id}/status`
- `GET /tasks/subordinate-officers`

**officers.py**
- `GET /officers` — list · `GET /officers/{id}`

**court.py**
- `GET /court/cases` · `POST /court/cases`

**notifications.py**
- `GET /notifications` · `PUT /notifications/{id}/read` · `DELETE /notifications/{id}` · `DELETE /notifications` (clear all)

**search.py**
- `GET /search` — unified search across cases/accused/etc.

**audit.py**
- `GET /audit` — list audit logs

## 11. Backend — Services Layer

| Service | Responsibility |
| :--- | :--- |
| `intelligence_service.py` | Anomaly detection, embedding generation (Gemini), semantic similarity search |
| `hotspot_service.py` | KDE hotspot computation |
| `predictive_service.py` / `risk_scoring/scorer.py` | Risk score inference, assistant-query orchestration |
| `assistant_service.py` | Builds DB-grounded context, calls Gemini for natural-language answers |
| `network_service.py` | Builds co-offending graph, runs community detection + PageRank |
| `gemini_client.py` | Thin wrapper around the Google Gemini API (`generate_content`, `embed_texts`) |
| `report_service.py` | Case report/export generation (CSV, PDF, Excel, DOCX) |
| `case_service.py` | Case CRUD business logic |
| `auth_service.py` | Login, token issuance/refresh |
| `officer_service.py` | Officer management |
| `assignment_service.py` | Investigator assignment to cases |
| `annotation_service.py` | Case annotations/notes |
| `witness_service.py` | Witness statement recording |
| `relationship_service.py` | Accused-to-accused relationship links |
| `collaboration_service.py` | External agency access requests/approvals |
| `notification_service.py` | In-app notifications |
| `station_command_service.py` | Station-level analytics |
| `audit_service.py` | Reads audit log entries |
| `ai_audit_service.py` | Logs every AI/ML inference run (`ai_model_run` table) — model name, version, summary |

## 12. Backend — Machine Learning Subsystem (current state, 2026-10-08)

Nothing here returns a value that was not computed from the database rows passed in. Evaluation numbers are in `docs/MODEL_EVALUATION.md` (regenerate with `python scripts/evaluate_models.py`).

### 12.1 Risk scoring (`app/ml/models/risk_scoring/`, `app/ml/features.py`)
- `RandomForestClassifier` trained on the dataset's own `RiskLabel` (Low / Medium / High / Severe) from `CrimeCases_AI.csv`, version `risk-rf-v4-real-labels`.
- Features available for any case (including a newly registered one): heinous flag, reporting delay (hours), number of accused / victims / evidence items / vehicles, incident hour and weekday, repeat-accused flag, crime major head, crime minor head, case category.
- Score = estimated probability of High or Severe; level = most probable class. 5-fold cross-validated accuracy 53.6% against 48.1% for always predicting the most common class; ROC-AUC (High or Severe) 0.895.
- Explanation: Saabas-style decision-path attribution (each feature's contribution to the estimated probability), written as sentences with the case's values and the typical value. It is **not** SHAP.
- Stored scores for the seeded cases are in-sample (the model was trained on them); a newly registered FIR is scored out-of-sample. `InvestigationPriority` is set from the level only when no priority exists, so an officer's manual priority is never overwritten.

### 12.2 Anomaly detection (`ml/models/anomaly/`)
Robust modified z-score (median and MAD) on reporting delay, cutoff 3.5; each finding reports its z-score.

### 12.3 Hotspots (`ml/models/hotspot/`, version `kde-hotspot-v3`)
Gaussian KDE over geocoded incidents. The bandwidth is chosen by 5-fold cross-validated log-likelihood; centres are picked greedily by density and kept at least two radii (0.07 degrees, about 7.8 km) apart so hotspots do not overlap. Each hotspot reports its FIR count, open cases, High/Severe lift over the average share, repeat-offender profiles, top crimes and the busiest 6-hour window. The dataset's coordinates cluster within about 3 km of each town, so the resolution is town level.

### 12.4 Repeat offenders and gang networks (`ml/models/repeat_offender/`, `ml/models/network_gang/`)
- A person's identity is the recorded `CriminalProfileID`; a gradient-boosting pairwise linkage model proposes probable matches for accused without one.
- Networks: edges between recorded repeat offenders from co-accused cases, shared vehicles, same home district (weight chosen by F1 against the hidden gang labels, so agreement is optimistic), recorded gang ids and stored links; communities by greedy modularity; leader by PageRank.

### 12.5 Forecast and early warnings (`ml/models/forecasting/`, `services/analytics.py`)
Ridge regression on daily registrations with a backtest (forecast the last 30 days from earlier data); early warnings are one-sided Poisson tests of the last 30 days against the previous six 30-day periods, Bonferroni-corrected across all crime-head and district tests, plus repeat-offender activity and BNSS 187 overdue investigations (90 days heinous, 60 days other).

### 12.6 Similar cases (`services/intelligence_service.py`)
Gemini `gemini-embedding-001` truncated to 768 dimensions, stored in pgvector, cosine search. Coverage is reported with each result.

### 12.7 Assistant (`services/assistant_service.py`, `assistant_tools.py`, `gemini_client.py`)
A function-calling agent: the model chooses among read-only, jurisdiction-scoped database tools and answers from their results. Free-tier quotas are per model per day, so a chain of models (`LLM_MODELS`) is tried with cooldowns taken from the API's retry hints; when none is available the user is told when to retry.

## 13. Backend — Middleware & Security

- **CORS:** `allow_origin_regex` matches `*.vercel.app`, `*.onslate.in` (legacy), `*.catalystappsail.in` (legacy), and any `localhost` port.
- **Audit logging:** `AuditLoggingMiddleware` (HTTP-level) + SQLAlchemy event listeners (`audit_listeners.py`) record who did what; depends on `get_current_user` correctly propagating via `contextvars` (see fix in §5/§19).
- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block` added to every response.
- **Rate limiting:** a `rate_limit_dependency` is applied globally at the FastAPI app level.
- **Auth:** JWT access tokens (15 min expiry) + refresh tokens (8 hr expiry), `HS256`, bcrypt-hashed passwords.
- **RBAC:** permission checks (`verify_permission`) gate sensitive endpoints (e.g., `users:manage` for role updates).
- **Known bug fixed:** an auth-bypass path that fabricated a synthetic admin `User` when no valid token was present has been removed; missing/invalid credentials now correctly return HTTP 401.

## 14. Frontend — Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── routes/AppRoutes.tsx, ProtectedRoute.tsx
│   │   └── providers/AuthProvider.tsx, LanguageContext
│   ├── components/
│   │   ├── layout/AppShell.tsx (sidebar + top-level shell)
│   │   └── common/ (Sidebar, cards, tables, modals)
│   ├── modules/          # One folder per page (see §15)
│   ├── services/         # API client layer (see §16)
│   └── locales/translations.ts   # English + Kannada strings
├── index.html
├── vite.config.ts
└── package.json
```

## 15. Frontend — Modules (Pages)

| Module | Route | Purpose |
| :--- | :--- | :--- |
| `auth` | `/login` | Login page |
| `dashboard` | `/dashboard`, `/workspace` | Executive dashboard + personal workspace tabs |
| `investigation` | `/cases`, `/cases/:id` | Case list and case detail/investigation view |
| `hotspot` | `/map`, `/hotspots` | GIS map view and hotspot dashboard |
| `network` | `/network` | Co-offending network graph (cytoscape) |
| `predictive` | `/predictive` | Risk scoring, anomaly, forecasting, assistant chat dashboard |
| `court` | `/court` | Court case monitoring |
| `collaboration` | `/collaboration` | External agency access requests |
| `delegation` | `/delegation` | Task delegation to subordinate officers |
| `reports` | `/reports` | Report generation/export/history |
| `admin` | `/admin` | User/role/jurisdiction management |
| `assistant` | *(embedded component, not a standalone route)* | Chat UI reused within other modules |

## 16. Frontend — Services (API Client Layer)

One TypeScript file per backend resource, mirroring the endpoint groups in §10: `authService`, `caseService`, `intelligenceService`, `hotspotService`, `networkService`, `predictiveService`, `assistantService`, `reportService`, `collaborationService`, `courtService`, `taskService`, `notificationService`, `stationService`, `searchService`, `auditService`, `adminService`. All route through `apiClient.ts` (Axios instance), which attaches the JWT bearer token to every request — including the refresh-retry path (previously used an insecure query-param token fallback, now removed).

## 17. Frontend — Internationalization

`src/locales/translations.ts` provides English and Kannada strings for all UI labels. During the rebrand, missing keys (`tab_audit`, `btn_request`) were added and system-title strings were updated from "KSP"/"Karnataka State Police" wording to "FORENSIQ" / "AI Crime Intelligence Platform" in both languages.

## 18. Deployment Architecture

| Component | Platform | Region | Notes |
| :--- | :--- | :--- | :--- |
| Frontend | Vercel | Global CDN | https://forensiq-black.vercel.app — `VITE_API_BASE_URL` set as a Vercel dashboard Config variable (a committed `.env.production` file was found to not be reliably picked up by Vercel's build) |
| Backend | Render | Oregon (US) | Docker container; `https://forensiq-g12e.onrender.com/api/v1` |
| Database | Supabase | ap-south-1 (Mumbai) | PostgreSQL 17 + pgvector + PostGIS |

**Known latency issue (unresolved):** the backend (Oregon) and database (Mumbai) are in different regions, adding real network round-trip latency (~3s per request has been observed). A migration plan to move the Render service to a Singapore region (closer to Mumbai) is scoped but not yet executed — see `FEATURE_CHECKLIST.md` §9.

## 19. Full Bug History & Fixes

This is the complete list of substantive bugs found and fixed during development, each confirmed via direct reproduction (a script, a curl call, or a live UI test), not assumed from reading code:

1. **Auth bypass** — fabricated admin user on missing/invalid token → now correctly returns 401.
2. **Risk scoring silently using a fallback heuristic** — missing score assignment in `scorer.py` → fixed; verified via held-out test evaluation (48.0% → 97.0% accuracy).
3. **Anomaly detection returning incomplete output** — missing result assignment → fixed.
4. **Hotspot prediction returning incomplete output** — same class of bug → fixed.
5. **Fake semantic search (SHA-256 "embeddings")** — replaced with real Gemini embeddings.
6. **pgvector silently substituted with JSON** — missing dependency caused a silent fallback that broke real vector queries → dependency added, column migrated.
7. **Fake conversational assistant (hardcoded fabricated stats + dead httpx call to a non-existent service)** — replaced with a real, DB-grounded Gemini integration.
8. **Audit trail not capturing the acting user** — sync dependency inside an async path broke `contextvars` propagation → made `async def`.
9. **N+1 query bug in CSV export** (10+ minute export times) — fixed with `selectinload` eager loading.
10. **Fake "Configure Access" save in the admin panel** — UI appeared to save role changes but called nothing real → wired to a genuine `PATCH /admin/users/{id}/role` endpoint.
11. **Missing `timedelta` import** — crashed a forecast fallback path → fixed.
12. **Startup `ALTER TABLE` ordering bug** — broke fresh-database bootstraps → reordered after `create_all()`.
13. **CORS blocking the live Vercel frontend** — `allow_origin_regex` didn't include `vercel.app` → fixed.
14. **Vercel not picking up the committed `.env.production`** — root-caused by comparing built JS bundle contents between local and Vercel builds → fixed by setting the env var directly in the Vercel dashboard.
15. **Hardcoded/leaked database credentials** — removed from `config.py`'s default value and from two throwaway test scripts (`test_conn.py`, `test_ip.py`), which were deleted.
16. **`numpy.float64` breaking psycopg2** on the risk score write path (worked on SQLite, failed on real Postgres) → explicit `float()` cast added.

## 20. ML Evaluation Results

See `docs/MODEL_EVALUATION.md`. In short: the risk model is a useful ranker (AUC 0.895 for High or Severe) but a weak four-way classifier (53.6% accuracy against a 48.1% majority-class baseline). The 97% figure reported in earlier versions of this document was a model recovering the rule used to generate the original fork's labels and has been withdrawn; so has any claim that anomaly detection could not be scored (the dataset has `AnomalyLabel`, `IsRepeatOffenderGroundTruth` and `HiddenGangID`, and `evaluate_models.py` scores against them).

## 21. Known Issues / Not Yet Done

- **Semantic search coverage:** 931 of 5,000 cases are embedded; the Gemini free tier allows about 1,000 embeddings a day. Run `python scripts/backfill_embeddings.py` daily; new FIRs are not embedded on creation yet.
- **Render region:** Oregon API with a Mumbai database adds ~70 ms per query (a few seconds for analytics). Caching hides most of it; moving the service to Singapore would remove it.
- **Free-tier sleep:** Render sleeps when idle (up to a minute to wake); Supabase pauses an idle project after about a week. Use an uptime pinger on `/health` to keep both awake.
- **Data limits:** synthetic data; coordinates cluster per town; no court names; case-category names absent; 228 future-dated registrations are excluded from analytics.
- **Frontend bundle** is one large chunk (no route-level code splitting).
- **Authorization policy to confirm:** `cases:create` is granted to Admin and SHO only (SCRB officers cannot register FIRs); `SHO` sees every case statewide (see `STATEWIDE_ROLES`).
- The PBL report and poster were produced before the models were retrained and quote the old risk-model figures; they need regenerating.

## 22. Security Considerations

- Secrets (JWT key, database URL, Gemini key) come from environment variables. Without `JWT_SECRET_KEY` the server signs tokens with a random per-process key rather than a constant from the source.
- Demo accounts are created only when missing and are never reset at start-up; `SEED_USER_PASSWORD` sets their initial password. Users change their own password; administrators can reset any. Passwords are hashed with bcrypt and must meet the strength rules.
- RBAC permission checks gate every endpoint; case visibility is applied in the query (`apply_jurisdiction_filter`), and external-agency officers see only cases an administrator has shared with them.
- An administrator cannot change their own role or deactivate themselves; role changes, account creation, deactivation, password resets and password changes are audit-logged.
- Report PDFs require login and access to the case.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`) are applied globally; CORS is scoped by regex to the deployed domains plus localhost.
- The earlier auth bypass (a synthetic admin when no token was sent) was removed; tokens are accepted from the `Authorization` header only.

## 23. Local Development Setup

See [`README.md`](./README.md#getting-started-local-development) for the concise version. Full notes:

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."     # or omit to fall back to local SQLite
export JWT_SECRET_KEY="..."
export LLM_API_KEY="..."                   # Google Gemini API key
uvicorn app.main:app --reload --port 8000
```
Remember: `.env` files are **not** read automatically by this app's settings loading — export real shell variables.

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Set `VITE_API_BASE_URL` in `.env.development` to point at `http://localhost:8000/api/v1` (or the deployed Render URL).

## 24. Appendix: Full Git Commit Log

```
9b1e89e Fix the Predictive AI command assistant - also fully fake, missed earlier
7677934 Fix severe N+1 query bug in CSV export making it take 10+ minutes
06e7aed Fix fake Configure Access save, translation keys, remaining rebrand spots
3ddefd3 Wire up real Gemini LLM and fix the MO similarity search entirely
bd6daee Rebrand from KSP/Karnataka State Police to Forensiq
1e664ac Allow the deployed Vercel frontend through CORS
9053721 Point production frontend at the new Render + Supabase backend
ae5d9fe Fix startup ALTER TABLE running before the tables exist on a fresh DB
2736c87 Fix undefined 'timedelta' crash in forecast fallback, dedupe imports
afef4a8 Fix anomaly detection and hotspot prediction also discarding real ML output
1a06962 Fix the real ML risk-scoring model never actually running
03d0dc9 Fix audit trail never capturing which officer performed an action
9f3e1f6 Remove dead scaffold placeholder files
0565b63 Fix officer appointment failure and inaccurate AI assistant branding
964e1d2 Fix login flow, auth bypass, and SQLite portability
0599fcd Initial commit: KSP Crime Intelligence Platform
```

---

*This document reflects the verified state of the codebase as audited during development. Where a claim could not be independently confirmed (e.g., the exact Vercel deployment URL), it is stated as such rather than assumed.*
