# KSP Crime Intelligence Platform — Project Structure Reference

This document explains **every folder and file** in the scaffold: its
purpose, its responsibility, and which module/team consumes it. It is
generated directly from the approved Software Architecture Document (SAD)
and the 10-Day Implementation Roadmap — no structure here deviates from
those two documents.

Legend: **Purpose** = what it exists to do · **Responsibility** = what it
owns / must never do · **Used by** = who calls or depends on it.

---

## 1. Root level

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `README.md` | Project overview, quickstart, tech stack summary | First document any engineer reads | Whole team |
| `PROJECT_STRUCTURE.md` | This file — full folder/file reference | Keeps the scaffold self-documenting | Whole team |
| `docker-compose.yml` | Orchestrates postgres, redis, backend, ai-engine, frontend for local/dev | Single-command environment bring-up (Roadmap M0) | All developers, CI |
| `.env.example` | Template of every environment variable the stack needs | Prevents secrets from being hardcoded anywhere in source | All three services, docker-compose |
| `.gitignore` | Excludes secrets, build artifacts, model binaries from version control | Repo hygiene | Git |
| `.github/workflows/ci.yml` | Lint + test automation on push/PR | Hackathon-scope substitute for the SAD's full CI/monitoring stack (Roadmap Section 0) | GitHub Actions |

---

## 2. `backend/` — Core Backend (FastAPI + SQLAlchemy + PostgreSQL + JWT + Alembic)

Implements SAD Section 5 (Backend Architecture). This is the **only**
service permitted to write to the system-of-record database (SAD §15.1).

### 2.1 Top level

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `backend/requirements.txt` | Pinned Python dependencies | Reproducible backend environment | `pip install`, Docker build, CI |
| `backend/Dockerfile` | Container image definition for the backend service | Production packaging | `docker-compose.yml`, deployment |
| `backend/alembic.ini` | Alembic configuration (script location, logging) | Migration tooling config; DB URL injected from settings, never hardcoded | `alembic` CLI |
| `backend/alembic/env.py` | Wires Alembic autogenerate to `app.db.base.Base.metadata` | Resolves the real DB connection at migration time | `alembic upgrade/revision` |
| `backend/alembic/script.py.mako` | Template used to generate new migration files | Consistent migration file structure | `alembic revision` |
| `backend/alembic/versions/` | Generated migration files (chronological schema history) | The **live** source of truth for DB schema (not `database/schema/`, which is reference-only) | Deployment, every developer's local DB |
| `backend/app/main.py` | FastAPI app entrypoint | Creates the app, registers middleware + the v1 router | `uvicorn`, Docker CMD |

### 2.2 `backend/app/core/` — cross-cutting configuration

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `config.py` | Centralized env-driven settings (DB URL, JWT secret, Redis URL, AI-service URL, CORS) | Single place secrets/config are read from | Every module needing configuration |
| `security.py` | JWT creation/validation, password hashing, refresh logic | Implements SAD §7.2 auth flow | `auth` endpoint, auth middleware |
| `dependencies.py` | FastAPI DI functions: `get_db`, `get_current_user`, `require_role`, `require_jurisdiction` | The enforcement point every protected route calls | Nearly all endpoint files |
| `permissions.py` | RBAC rule definitions: data scope / action scope / module scope (SAD §8.1) + the full role matrix (§8.2) | Source of truth for "can this role do this" | `dependencies.py`, middleware |

### 2.3 `backend/app/db/`

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `base.py` | SQLAlchemy declarative `Base` + model import hub | Lets Alembic discover every model for autogenerate | `alembic/env.py`, `session.py` |
| `session.py` | Engine + `SessionLocal` factory + `get_db` dependency | DB connection lifecycle | `core/dependencies.py`, every `crud/` file |
| `init_db.py` | One-time bootstrap: default roles/permissions + admin user | Local dev / demo environment setup | `docs/setup/`, seed scripts |

### 2.4 `backend/app/middleware/`

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `auth_middleware.py` | Request-level JWT validation | Mirrors the SAD's API Gateway auth enforcement (§2.2/§16) at the app layer | `main.py` middleware stack |
| `jurisdiction_scope.py` | Injects the user's `jurisdiction_scope` into every `CaseMaster`-touching query | Implements SAD §21.2 row-level enforcement — structurally impossible to bypass | `crud/` layer (cases, accused, victims, evidence, network, hotspot) |
| `audit_hook.py` | Captures writes + scope-crossing reads into `audit_log` | Implements SAD §20 audit requirements | `main.py`, collaboration/report endpoints |

### 2.5 `backend/app/tasks/` — Celery background jobs

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `celery_app.py` | Celery app instance + Redis broker config | Async job infrastructure | `report_tasks.py`, `notification_tasks.py` |
| `report_tasks.py` | Async report generation (PDF render, upload, status update) | Implements SAD §19.2 pipeline | `reports.py` endpoint |
| `notification_tasks.py` | Async, jurisdiction-aware notification fan-out | Implements SAD §17.2 | Case/collaboration/network alert triggers |

### 2.6 `backend/app/utils/`

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `pagination.py` | Shared pagination + the standard `{data, meta, appliedScope}` envelope | Implements SAD §16.3 API convention | Every list endpoint |
| `exceptions.py` | Custom exception classes + handlers | Consistent error responses across the API | All endpoint modules |

### 2.7 `backend/app/api/v1/`

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `router.py` | Aggregates every endpoint module under `/api/v1` | Single mounting point | `main.py` |
| `endpoints/auth.py` | Login/refresh/MFA-stub | SAD §7 | Frontend `auth` module |
| `endpoints/cases.py` | Case/Accused/Victim/Vehicle/Evidence/Witness read + annotation | SAD §16.2 "Cases" group | Frontend `investigation` module |
| `endpoints/officers.py` | Officer roster/assignment/workload | — | Frontend `dashboard`/`admin` |
| `endpoints/hotspot.py` | Live + predicted hotspot data | SAD §10.3 | Frontend `hotspot` module |
| `endpoints/network.py` | Network graph, gang detection, link explanation | SAD §10.4 | Frontend `network` module |
| `endpoints/intelligence.py` | Risk score, similar-case, repeat-offender orchestration | SAD §15 | Frontend `investigation`/`predictive` |
| `endpoints/search.py` | Structured/free-text/semantic/entity search | SAD §18 | Global search bar, Similar Case Finder |
| `endpoints/reports.py` | Report generate/status/download | SAD §19 | Frontend `reports` module |
| `endpoints/collaboration.py` | Cross-district request/approval | SAD §14 | Frontend `collaboration` module |
| `endpoints/notifications.py` | Notification list/read-state | SAD §17 | Frontend notification panel |
| `endpoints/audit.py` | Read-only audit log queries | SAD §20 | Frontend admin/SCRB audit viewer |
| `endpoints/admin.py` | User/role/jurisdiction management | SAD §10.9 | Frontend `admin` module |
| `endpoints/assistant.py` | AI Assistant chat endpoint | SAD §15.4 | Frontend `assistant` module |

### 2.8 `backend/app/models/` — SQLAlchemy ORM (mirrors finalized schema + new platform tables, SAD §6.1)

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `district.py`, `police_station.py`, `crime_type.py`, `crime_sub_type.py`, `case_master.py`, `accused.py`, `victim.py`, `officer.py`, `vehicle.py`, `evidence.py`, `witness.py` | ORM mapping for the **already-finalized** relational schema — unchanged per SAD §6.1 | `case_master.py` additionally maps the PostGIS `GEOGRAPHY(Point)` column (§6.2) | `crud/` layer, Alembic |
| `user.py`, `role.py`, `user_jurisdiction.py` | ORM mapping for identity/RBAC platform tables | Backs the auth + permission system | `identity`/auth flows |
| `collaboration_request.py` | ORM mapping for cross-district requests | SAD §14 | `collaboration` module |
| `case_annotation.py` | ORM mapping for the only investigative write surface besides the source system | SAD §6.1 | `cases` endpoints |
| `ai_model_run.py` | ORM mapping for the AI inference audit trail | SAD §15.1 audit boundary | `services/intelligence_service.py` and siblings |
| `notification.py` | ORM mapping for notifications | SAD §17 | `notifications` endpoint |
| `audit_log.py` | ORM mapping for the append-only audit log | SAD §20 — no UPDATE/DELETE grants | `audit` endpoint |
| `report_job.py` | ORM mapping for async report job state | SAD §19 | `reports` endpoint, Celery tasks |

### 2.9 `backend/app/schemas/`

One Pydantic file per model above (same filenames) — **Purpose:** request/response validation & serialization contracts. **Responsibility:** never leak ORM internals directly to the API; this is the typed boundary. **Used by:** the matching endpoint file, and mirrored by `frontend/src/types/`.

### 2.10 `backend/app/crud/`

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `case_crud.py` | Jurisdiction-scoped queries for CaseMaster + children | Enforces §21.2 at the query layer | `cases.py`, `intelligence.py` |
| `accused_crud.py` | Accused queries incl. repeat-offender flag joins | — | `cases.py` |
| `officer_crud.py` | Officer roster/workload queries | — | `officers.py` |
| `user_crud.py` | Users/roles/permissions/jurisdictions queries | — | `auth.py`, `admin.py` |
| `hotspot_crud.py` | PostGIS geospatial queries | — | `hotspot.py` |
| `network_crud.py` | Recursive-CTE graph traversal (SAD §2.3 — no graph DB at V1) | — | `network.py` |
| `collaboration_crud.py` | Collaboration request lifecycle queries | — | `collaboration.py` |
| `audit_crud.py` | Append-only audit log writes/reads | — | `audit_hook.py`, `audit.py` |
| `report_crud.py` | Report job lifecycle queries | — | `reports.py`, `report_tasks.py` |

### 2.11 `backend/app/services/` — orchestration layer

| File | Purpose | Responsibility | Used by |
|---|---|---|---|
| `auth_service.py` | Login/token-issuance orchestration | — | `auth.py` |
| `case_service.py` | Case read/annotation orchestration | — | `cases.py` |
| `intelligence_service.py` | Calls the AI Engine for risk/similarity/repeat-offender scores, caches + persists to `ai_model_runs` | **Only** layer allowed to call the AI Engine for these capabilities | `intelligence.py` |
| `hotspot_service.py` | Calls the AI Engine hotspot model, caches results | Feeds the materialized-view-equivalent cache | `hotspot.py` |
| `network_service.py` | Calls the AI Engine network/gang model, persists graph results | — | `network.py` |
| `report_service.py` | Builds `report_jobs`, triggers Celery task | — | `reports.py` |
| `collaboration_service.py` | Implements time-boxed, request-based cross-district access (SAD §14.2) | — | `collaboration.py` |
| `notification_service.py` | Jurisdiction-aware dispatch logic | — | `notification_tasks.py` |
| `assistant_service.py` | Assistant orchestration: intent parsing call → tool routing → grounded response | Implements SAD §15.4 at the backend boundary | `assistant.py` |

### 2.12 `backend/tests/`

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `unit/` | Unit tests per module (crud, services, permissions) | Fast, no external dependencies | CI |
| `integration/` | Full request/response tests incl. the RBAC test matrix (Roadmap M2/M9's most important suite) | Verifies jurisdiction scoping end-to-end | CI, pre-demo regression pass |

---

## 3. `frontend/` — Web Client (React + Vite + TypeScript + Tailwind + React Router + Axios)

Implements SAD Section 4 (Frontend Architecture).

### 3.1 Top level

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `package.json` | Dependency manifest + npm scripts | Reproducible frontend environment | `npm install`, CI, Docker build |
| `tsconfig.json` | TypeScript compiler config + `@/` path alias | Type safety, import ergonomics | `vite`, editors |
| `vite.config.ts` | Dev server + build config, path alias, backend proxy | Build tooling | `npm run dev`/`build` |
| `tailwind.config.js` | Design tokens, content paths, field-mode theme extension (SAD §4.4) | Styling system | PostCSS build |
| `postcss.config.js` | Tailwind + autoprefixer pipeline | CSS processing | Vite build |
| `.eslintrc.cjs` | Lint rules | Code quality gate | CI, editors |
| `index.html` | HTML shell, mounts the React root | App bootstrap | Vite |
| `Dockerfile` | Multi-stage build → nginx static serve | Production packaging | `docker-compose.yml` |
| `public/` | Static assets served as-is | — | — |

### 3.2 `frontend/src/app/`

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `main.tsx` | Vite/React entrypoint | Mounts `<App />` | `index.html` |
| `App.tsx` | Root component: providers + router outlet | App composition root | `main.tsx` |
| `routes/AppRoutes.tsx` | Route table mapping paths → module pages | Mirrors SAD §11 sidebar structure | `App.tsx` |
| `routes/ProtectedRoute.tsx` | Auth + role/module access guard | Frontend mirror of backend RBAC (SAD §8) — defense in depth, never the only check | `AppRoutes.tsx` |
| `providers/QueryProvider.tsx` | React Query client provider | Server-state cache (SAD §4.3) | `App.tsx` |
| `providers/AuthProvider.tsx` | JWT/session context provider | Token lifecycle | `App.tsx`, `ProtectedRoute.tsx` |

### 3.3 `frontend/src/modules/` — one per SAD sidebar module (§11)

| Folder | Purpose | Responsibility |
|---|---|---|
| `dashboard/` | Role-adapted home dashboards (Station/District/Circle/Statewide/field) | SAD §9, §12 |
| `hotspot/` | Live Heatmap, Predicted Hotspot Layer, Drilldown | SAD §10.3 |
| `network/` | Network Explorer, Gang Detection, Link Explanation | SAD §10.4 |
| `investigation/` | Case Intelligence View, Similar Case Finder, Repeat Offender Panel, Evidence/Witness Tracker | SAD §10.5, §13.1 |
| `predictive/` | Risk Scoring, Crime Forecasting, Resource Deployment Recommender | SAD §10.6 |
| `reports/` | Report Builder, Automated Reports | SAD §10.7 |
| `assistant/` | AI Assistant floating chat panel + dashboard sync | SAD §15.4 |
| `admin/` | User management, role config, jurisdiction mapping, audit viewer | SAD §10.9 |
| `collaboration/` | Cross-District Collaboration Requests | SAD §14 |
| `auth/` | Login + first-login onboarding wizard | SAD §10.1 |

*Used by:* `AppRoutes.tsx` mounts each module's `index.tsx` at its route.

### 3.4 `frontend/src/components/`

| File | Purpose | Used by |
|---|---|---|
| `common/DataTable.tsx` | Generic sortable/paginated table | cases, officers, network, admin |
| `common/KpiCard.tsx` | Dashboard KPI card (12-col grid, SAD §12.1) | all dashboards |
| `common/ContextBar.tsx` | Persistent jurisdiction scope selector (SAD §4.1) | app shell, every module |
| `common/Sidebar.tsx` | Role-rendered navigation | app shell |
| `common/TopBar.tsx` | Search entry, notifications, user menu | app shell |
| `map/HeatmapLayer.tsx` | Kernel-density heatmap primitive | hotspot module |
| `map/PredictedHotspotOverlay.tsx` | Confidence-shaded overlay primitive | hotspot module |
| `graph/NetworkGraphCanvas.tsx` | Zoomable network graph primitive (SAD §26) | network module, Case Intelligence View |
| `charts/TrendChart.tsx` | Trend/forecast chart primitive | predictive, reports, dashboard |
| `charts/ExplanationCard.tsx` | Renders the AI `top_factors` explanation object — mandatory next to every AI score (SAD §15.3) | investigation, predictive |
| `layout/AppShell.tsx` | Combines TopBar + Sidebar + ContextBar + content area | `App.tsx` |

### 3.5 `frontend/src/hooks/`, `src/services/`, `src/state/`, `src/types/`

| Category | Purpose | Responsibility | Used by |
|---|---|---|---|
| `hooks/*.ts` | React Query wrappers per data domain (case search, hotspot, risk score, network, auth, assistant chat) | Server-state fetching/caching (SAD §4.3) | Module components |
| `services/apiClient.ts` | Configured Axios instance: base URL, JWT attach + refresh-retry interceptors | Single HTTP boundary | Every other `services/*.ts` file |
| `services/*Service.ts` | One typed client per backend module (auth, case, hotspot, network, intelligence, search, report, collaboration, notification, audit, admin, assistant) | Typed API boundary (SAD §4.2) | `hooks/`, module components |
| `state/*.ts` | Zustand stores: UI state only (sidebar, jurisdiction selection, map layers, graph selection) | Never duplicates server-state data (SAD §4.3) | Layout + module components |
| `types/*.ts` | Shared TS types incl. the AI explainability object shape and the API envelope shape | Mirrors backend Pydantic schemas | `services/`, components |
| `styles/index.css` | Tailwind entrypoint + field-mode theme tokens | Global styling | `main.tsx` |

---

## 4. `ai-engine/` — AI/ML Inference Microservice (Python + scikit-learn + NetworkX + pandas)

Implements SAD Section 15 (AI Architecture) as a **stateless, separately
deployable service** (SAD §2.1) — it never writes to the system of record.

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `requirements.txt` | Pinned AI Engine dependencies | Reproducible ML environment | `pip install`, Docker build |
| `Dockerfile` | Container image, deployed independently from backend | Reflects SAD §2.1's separable-service principle | `docker-compose.yml` |
| `config.py` | Model artifact paths, read-only training DB connection, embedding model name | Isolated config from the backend | Every file in `ai-engine/` |
| `serving/main.py` | FastAPI entrypoint for the microservice | Exposes all model capabilities over HTTP | Backend `services/*.py` (internal RPC) |
| `serving/schemas.py` | Request/response contracts incl. the shared explainability object shape | The AI ↔ Backend API contract | All serving endpoints |
| `serving/router.py` | Aggregates one router per model capability under `/ai/v1` | Mounting point | `serving/main.py` |
| `models/hotspot/predictor.py` | KDE + time-decay density estimation, XGBoost/short-term forecast (SAD §3.4) | — | `hotspot_service.py` (backend) |
| `models/hotspot/train.py` | Training/retraining script, run as scheduled batch | — | `pipelines/batch_scoring.py` |
| `models/risk_scoring/scorer.py` | Gradient-boosted risk classifier (scikit-learn) | Matches `RiskLabel` ground truth | `intelligence_service.py` |
| `models/risk_scoring/train.py` | Training script | — | `pipelines/training_pipeline.py` |
| `models/risk_scoring/explain.py` | Builds the structured `top_factors` explanation object (SAD §15.3) | Non-negotiable on every score | `scorer.py` |
| `models/repeat_offender/resolver.py` | Rule-based blocking + classifier for entity resolution | Evaluated against `HiddenCriminalProfileID` | `intelligence_service.py` |
| `models/repeat_offender/train.py` | Training/eval script | — | `pipelines/training_pipeline.py` |
| `models/network_gang/graph_builder.py` | NetworkX graph construction (co-accused/shared-victim/MO edges) | — | `community_detection.py`, `network_service.py` |
| `models/network_gang/community_detection.py` | Louvain community detection | Evaluated against `HiddenGangID`/`HiddenClusterID` | `network_service.py` |
| `models/mo_similarity/embeddings.py` | Sentence embeddings over `BriefFactsText` | Persisted to pgvector via the backend | `similarity_search.py` |
| `models/mo_similarity/similarity_search.py` | Structured pre-filter + embedding-distance ranking (SAD §18.1.3) | — | `intelligence_service.py`, search endpoints |
| `models/anomaly/detector.py` | Isolation Forest / statistical control limits | Evaluated against `AnomalyLabel` | Alerts panel data source |
| `models/forecasting/forecaster.py` | Time-series forecasting via pandas/statsmodels | — | Predictive Intelligence dashboard |
| `assistant/intent_parser/parser.py` | LLM-based query → structured intent parsing (SAD §15.4 step 1) | — | `tool_router/router.py` |
| `assistant/tool_router/router.py` | Maps intents to schema-validated calls against existing backend APIs — no separate data path (SAD §15.4 step 2, §21.1 safeguard) | — | `response_composer/composer.py` |
| `assistant/tool_router/tool_schemas.py` | Schema definitions validating every LLM tool-call before execution | Prevents prompt-injection-driven arbitrary queries | `tool_router/router.py` |
| `assistant/response_composer/composer.py` | Composes the grounded natural-language response + dashboard-sync directive (SAD §15.4 steps 4–5) | — | `serving` assistant endpoint |
| `assistant/response_composer/session_context.py` | Server-side multi-turn session/context store | — | `intent_parser/`, `tool_router/` |
| `pipelines/feature_engineering.py` | Shared pandas feature transforms | Reused across risk/anomaly/forecast training | `models/*/train.py` |
| `pipelines/training_pipeline.py` | End-to-end training orchestration + evaluation metric logging (SAD §15.5) | — | CI/scheduled retraining |
| `pipelines/batch_scoring.py` | Scheduled batch inference entrypoint (hourly hotspot, daily others per SAD §15.2) | — | Cron/Celery-beat equivalent |
| `artifacts/` | Trained model binaries (gitignored) | Never committed to source control | `serving/`, `models/*/train.py` output |
| `notebooks/` | Exploratory analysis, not production code | Kept out of `serving/`/`models/` production paths | Data science exploration only |

---

## 5. `database/`

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `schema/finalized_schema.sql` | Read-only reference export of the already-finalized relational schema | Documentation only — the **live** schema source is `backend/alembic/versions/` | Backend model authors, AI Engine developers |
| `seeds/seed_data.py` | Reproducible demo data: one user per role (SAD §8.2) + cross-district case data | Makes the demo reproducible on any machine (Roadmap M9) | Local dev, CI fixtures, Demo Day |
| `scripts/backup.sh`, `restore.sh` | Demo-state DB snapshot/restore | Roadmap M9 deliverable | Ops/deployment step |
| `scripts/refresh_materialized_views.sh` | Refreshes `mv_station_hotspot_scores`, `mv_officer_workload`, `mv_district_crime_trend`, `mv_repeat_offender_index` (SAD §6.4) | Keeps dashboards fast without hitting the AI service on every load | Scheduled job |

---

## 6. `docs/`

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `architecture/` | Home for the approved SAD + Roadmap | Source of truth for all design decisions; deviations proposed here first | Whole team |
| `api/API_CONTRACTS.md`, `openapi.json` | Endpoint contracts + exported OpenAPI spec | Frontend/backend contract agreement point | Frontend service-layer devs, AI Engine integration |
| `setup/LOCAL_DEV_SETUP.md` | Environment setup instructions | Gets every team member running on Day 1 | Whole team, Roadmap M0 |
| `demo/DEMO_SCRIPT.md` | Rehearsed Demo Day script + architecture-to-SAD traceability slide | Reproducible, judge-ready demo | Presenter, Roadmap M9 |

---

## 7. `infra/` and `.github/`

| Path | Purpose | Responsibility | Used by |
|---|---|---|---|
| `infra/docker/nginx.conf` | Optional shared reverse-proxy config | Cross-service infra kept out of app folders | Deployment (Roadmap M9) |
| `infra/ci/` | Supporting CI scripts/reference | — | GitHub Actions |
| `.github/workflows/ci.yml` | Lint + test pipeline | Hackathon-scope substitute for the SAD's full CI/monitoring stack | Every push/PR |

---

## 8. Traceability note

Every folder above maps to a named section of the SAD and a named
milestone of the Roadmap. If you ever need to add a file that doesn't
map cleanly to something in `docs/architecture/`, that's a signal to
update the SAD first — not to freelance the structure.
