# Karnataka State Police — Crime Intelligence & Investigation Platform
## Software Architecture Document (v1.0)

**Status:** Foundation document — single source of truth for all development
**Scope:** This document defines architecture only. No source code, no dataset redesign. It builds strictly on top of the already-finalized synthetic relational dataset (District, PoliceStation, CrimeType, CrimeSubType, CaseMaster, Accused, Victim, Officer, Vehicle, Evidence, Witness, and the combined AI dataset).

---

## Table of Contents

1. Overall System Vision
2. Software Architecture
3. Technology Stack
4. Frontend Architecture
5. Backend Architecture
6. Database Architecture
7. Authentication Architecture
8. Role-Based Access Control
9. Complete User Workflow
10. Complete Module Breakdown
11. Sidebar Navigation
12. Dashboard Layouts
13. Investigation Workflow
14. Cross-District Collaboration Workflow
15. AI Architecture
16. API Architecture
17. Notification System
18. Search Architecture
19. Report Generation
20. Audit Logging
21. Security Architecture
22. Deployment Architecture
23. Scalability Considerations
24. Folder Structure
25. Development Roadmap
26. Standout Features (Differentiators)

---

## 1. Overall System Vision

### 1.1 What this platform is

This is **not** an FIR management system. FIR registration already exists in KSP's operational systems (CCTNS and state-level extensions). This platform sits **on top of** that layer of record and turns historical + live case data into **actionable intelligence**: where crime will happen next, who is likely responsible, which cases are connected, and what an investigating officer should do next.

The platform's job is to answer three questions faster than a human analyst can, at state scale:

1. **Where** is crime concentrated, and where will it move next?
2. **Who** is behind it — individually and as networks/gangs?
3. **What** should an officer, station, or district do about it right now?

### 1.2 Design principles

- **Intelligence-first, not records-first.** Every screen should answer "so what should I do" — not just display data.
- **Explainable AI, not black-box AI.** Every prediction shows the evidence and reasoning behind it, because outputs may support investigation and, ultimately, judicial process.
- **Read-heavy, write-light.** The platform is primarily an analytical layer. Very few write paths exist outside case annotation, collaboration requests, and administrative configuration — this keeps the system safe and simple to secure.
- **Role-appropriate breadth, not artificial restriction.** Investigative visibility (e.g., searching similar cases statewide) is a *read* capability that should be broadly available; only *write* and *administrative* actions are tightly scoped.
- **Jurisdiction-aware by default, jurisdiction-crossing by design.** Every query defaults to the user's jurisdiction but supports explicit statewide search, because criminals do not respect station boundaries.
- **Human-in-the-loop.** AI ranks, scores, and surfaces — humans decide. No module auto-closes, auto-charges, or auto-escalates a case.

### 1.3 Primary personas

- **Field-level officer (Constable → SI):** needs fast, mobile-friendly answers during patrol and investigation.
- **Station leadership (Inspector/SHO):** needs case oversight, workload visibility, and investigation tooling.
- **Supervisory/district leadership (CI/ACP, SP/Commissioner):** needs district-level intelligence, resource allocation, and cross-station patterns.
- **SCRB (State Crime Records Bureau):** needs statewide intelligence, trend reporting, and cross-district network analysis.
- **System Administrator:** needs to manage accounts, roles, and system configuration — but must never see or alter investigative content.

---

## 2. Software Architecture

### 2.1 Architectural style

**Layered, modular monolith at launch, service-decomposable at scale** — the right choice for a hackathon-to-production trajectory:

- A modular monolith avoids the operational overhead of microservices during early deployment (fewer moving parts to secure, deploy, and get statewide sign-off for), while internal module boundaries are drawn so that any module (e.g., the AI/ML services) can be extracted into an independent service later without a rewrite.
- The **AI/ML layer is architected as a separable service from day one** (own process, own API contract) since it has different scaling, GPU/compute, and deployment characteristics than the transactional backend.

### 2.2 High-level architecture diagram (textual)

```
                         ┌────────────────────────────┐
                         │        Client Layer         │
                         │  Web App (React) · Mobile   │
                         │  (officer field app, PWA)   │
                         └──────────────┬───────────────┘
                                        │ HTTPS / WSS
                         ┌──────────────▼───────────────┐
                         │        API Gateway            │
                         │  AuthN/AuthZ · Rate Limiting  │
                         │  Request Routing · Audit Hook │
                         └───────┬───────────────┬───────┘
                 ┌───────────────┘               └───────────────┐
     ┌───────────▼───────────┐                       ┌───────────▼────────────┐
     │   Core Backend API      │                       │   AI/ML Service Layer   │
     │  (Django REST / FastAPI)│  ── internal RPC ──▶  │  (FastAPI + ML runtime) │
     │  Cases, Accused, Victim,│ ◀── internal RPC ──   │  Hotspot, Network, Risk,│
     │  Officers, Reports, RBAC│                       │  MO, Anomaly, Chatbot   │
     └───────────┬────────────┘                       └───────────┬────────────┘
                 │                                                 │
     ┌───────────▼────────────┐                       ┌───────────▼────────────┐
     │   Relational Database    │                       │   Feature / Vector Store │
     │  PostgreSQL + PostGIS    │                       │  (Embeddings, precomputed │
     │  (system of record)      │                       │   graph & risk features)  │
     └───────────┬────────────┘                       └───────────┬────────────┘
                 │                                                 │
     ┌───────────▼────────────────────────────────────────────────▼────────────┐
     │                     Supporting Infrastructure                             │
     │  Object Storage (evidence files) · Cache (Redis) · Message Queue (Celery/ │
     │  Kafka) · Search Index (OpenSearch) · Notification Service · Audit Store  │
     └──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Key architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monolith vs. microservices | Modular monolith + separated AI service | Fast to build/secure for a hackathon-to-pilot path; AI workloads have different scaling needs so are split out immediately |
| Sync vs. async processing | Sync for reads, async for heavy analytics | Dashboards must feel instant; network-graph builds, forecasts, and report generation run as background jobs |
| Database | PostgreSQL + PostGIS | Relational integrity for the case schema, native geospatial indexing for hotspot queries |
| Search | OpenSearch (Elasticsearch-compatible) | Free-text case/BriefFacts search, MO similarity pre-filtering, fast faceted search |
| Caching | Redis | Session store, dashboard query caching, rate limiting |
| Async jobs | Celery (Python) with Redis/RabbitMQ broker | Report generation, model batch scoring, notification fan-out |
| Graph queries | PostgreSQL recursive CTEs at launch; Neo4j evaluated at scale | Avoids introducing a graph DB before proving the need; the Criminal Network module is designed so it can swap its data-access layer to a graph DB later without changing the API contract |

---

## 3. Technology Stack

### 3.1 Frontend

| Layer | Technology | Notes |
|---|---|---|
| Web application | React 18 + TypeScript | Component reuse across dashboards |
| State management | React Query (server state) + Zustand (UI state) | Clear separation of server-cache vs. local UI state |
| Mapping | Mapbox GL JS / Leaflet + PostGIS tiles | Hotspot heatmaps, patrol route overlays |
| Graph visualization | Cytoscape.js or Sigma.js | Criminal Network Explorer |
| Charting | Recharts / D3.js | Trend, forecast, and analytics charts |
| UI framework | Tailwind CSS + shadcn/ui | Consistent design system, accessible components |
| Mobile/field access | Progressive Web App (PWA) first; React Native evaluated for v2 | Officers need offline-tolerant, low-bandwidth access in the field |

### 3.2 Backend

| Layer | Technology | Notes |
|---|---|---|
| Core API | Django + Django REST Framework | Mature RBAC, admin tooling, ORM integrity for a schema this relational |
| AI/ML service | FastAPI (Python) | Lightweight, async-friendly, ideal for model-serving endpoints |
| Task queue | Celery + Redis/RabbitMQ | Background jobs: report generation, batch scoring, notifications |
| Real-time layer | Django Channels (WebSockets) | Live dashboard updates, chatbot streaming responses |
| API Gateway | Kong / NGINX + custom auth middleware | Central authN/authZ enforcement, rate limiting, request logging |

### 3.3 Database & storage

| Component | Technology | Notes |
|---|---|---|
| Primary datastore | PostgreSQL 15+ with PostGIS | System of record for all relational tables |
| Search index | OpenSearch | BriefFacts full-text search, faceted case search |
| Cache | Redis | Sessions, hot dashboard queries, rate limiting |
| Object storage | S3-compatible (MinIO on-prem or cloud S3) | Evidence files, generated PDF reports |
| Feature store | PostgreSQL materialized views + Redis for hot features | Precomputed risk scores, hotspot grids, officer workload |
| Vector store | pgvector (PostgreSQL extension) | BriefFacts embeddings for MO/similar-case search — avoids a separate vector DB at V1 scale |

### 3.4 AI/ML stack

| Capability | Approach | Notes |
|---|---|---|
| Hotspot prediction | Spatial density estimation (KDE) + time-decay weighting; XGBoost for short-term forecast | Interpretable, fast to retrain |
| Risk scoring | Gradient-boosted trees (XGBoost/LightGBM) with SHAP explanations | Matches the `RiskLabel` ground truth in the AI dataset; SHAP gives the "why" |
| Repeat offender / entity resolution | Rule-based blocking (name/DOB/gender similarity) + supervised classifier trained against `HiddenCriminalProfileID` | Directly evaluable against the dataset's known ground truth |
| Network/gang detection | Graph construction (co-accused, shared victim, shared MO edges) + community detection (Louvain) | Evaluated against `HiddenGangID`/`HiddenClusterID` |
| MO similarity | Sentence embeddings (e.g., a domain-tuned transformer) over `BriefFactsText` + structured feature blending | Powers "find similar cases" |
| Anomaly detection | Isolation Forest / statistical control limits per crime sub-head | Evaluated against `AnomalyLabel` |
| Forecasting | Prophet / SARIMA per district-crime-type series | Simple, explainable, good for district-level trend reporting |
| AI Assistant / NLU | LLM-based intent parsing + tool-calling into the above models and the search/API layer | The chatbot is an orchestrator, not a separate brain — see Section 15 |

### 3.5 DevOps & infrastructure

| Layer | Technology |
|---|---|
| Containerization | Docker + Docker Compose (dev), Kubernetes (staging/prod) |
| CI/CD | GitLab CI / GitHub Actions |
| Infra as code | Terraform |
| Monitoring | Prometheus + Grafana |
| Logging | ELK/OpenSearch stack, centralized structured logging |
| Secrets management | HashiCorp Vault or cloud KMS |
| Hosting | State data center / empaneled government cloud (data residency requirement — see Section 21) |

---

## 4. Frontend Architecture

### 4.1 Application shell

- Single-page application with a **persistent shell** (top bar + role-based sidebar) and a **routed content area**.
- Route-level code splitting so heavy modules (Network Graph, Map, Report Builder) load on demand.
- A global **Context Bar** beneath the top bar reflects the user's current jurisdiction scope (e.g., "Mysuru District ▾ / All Stations ▾") and persists across modules — every dashboard, search, and report respects it unless explicitly widened.

### 4.2 Component architecture

```
src/
  app/                 # routing, shell, providers
  modules/
    dashboard/
    hotspot/
    network/
    investigation/
    predictive/
    reports/
    assistant/
    admin/
  components/
    common/            # buttons, tables, cards, modals (design system)
    map/                # map primitives (heatmap layer, marker cluster, draw tools)
    graph/               # network graph primitives
    charts/
  hooks/                # useCaseSearch, useHotspotData, useRiskScore, etc.
  services/              # typed API clients (one per backend module)
  state/                  # Zustand stores (UI state only)
  types/                  # shared TypeScript types generated from the API schema
```

### 4.3 State management strategy

- **Server state** (cases, officers, scores) → React Query: automatic caching, background refetch, optimistic UI for the few write paths that exist (annotations, collaboration requests).
- **UI state** (sidebar collapsed, active map layer, selected node in a graph) → Zustand, kept local to each module.
- **No client-side duplication of source-of-truth data** — every screen fetches through the typed service layer, never holds a second copy of case data long-term.

### 4.4 Accessibility & field usability

- WCAG 2.1 AA target for all core workflows.
- High-contrast "field mode" theme for outdoor/mobile visibility.
- Every map/graph visualization has a tabular fallback view for low-bandwidth or screen-reader use.

---

## 5. Backend Architecture

### 5.1 Module boundaries (within the modular monolith)

| Module | Responsibility |
|---|---|
| `identity` | Users, roles, jurisdictions, permissions, sessions |
| `cases` | CaseMaster, Accused, Victim, Vehicle, Evidence, Witness CRUD/read APIs |
| `officers` | Officer roster, assignment, workload |
| `intelligence` | Orchestrates calls into the AI/ML service, caches results |
| `network` | Graph construction/query endpoints (co-accused, gang, cluster) |
| `reports` | Report templates, generation jobs, export |
| `collaboration` | Cross-district requests, shared case access grants |
| `notifications` | Alert rules, delivery, read/unread state |
| `audit` | Immutable action log, queryable by admins/SCRB |
| `admin` | User/role management, system configuration |

### 5.2 Request lifecycle

1. Client request hits the **API Gateway** — TLS termination, rate limiting, JWT validation.
2. Gateway forwards to **Core Backend**, attaching the authenticated identity + jurisdiction claims.
3. Backend's **permission middleware** evaluates the request against RBAC rules (Section 8) before any handler runs.
4. For analytical endpoints, the backend either serves from a **precomputed cache** (Redis/materialized view) or issues an **internal RPC call** to the AI/ML service.
5. Every state-changing request and every access to sensitive investigative data is emitted to the **audit module** asynchronously (non-blocking).

### 5.3 Internal service communication

- Core Backend ↔ AI/ML Service: internal REST over the private network, authenticated with a service-to-service token (not exposed to the gateway).
- All AI/ML responses include a `model_version`, `confidence`, and `explanation` payload — the backend never re-derives these, only passes them through, keeping the contract auditable end to end.

---

## 6. Database Architecture

### 6.1 System of record

PostgreSQL hosts the already-finalized relational schema unchanged: `District`, `PoliceStation`, `CrimeType`, `CrimeSubType`, `CaseMaster`, `Accused`, `Victim`, `Officer`, `Vehicle`, `Evidence`, `Witness`. No redesign — this document only adds **platform tables** around that schema:

| New platform table | Purpose |
|---|---|
| `users` | Login identity, linked to an `Officer` record where applicable |
| `roles` / `permissions` / `role_permissions` | RBAC definitions (Section 8) |
| `user_jurisdictions` | Which District(s)/Station(s) a user is scoped to |
| `collaboration_requests` | Cross-district data-sharing requests and approvals |
| `case_annotations` | Officer notes/tags on a case (the only write surface into investigative narrative besides the source CCTNS-equivalent system) |
| `ai_model_runs` | Every AI inference logged: inputs, outputs, model version, timestamp |
| `notifications` | Alert delivery and read-state |
| `audit_log` | Immutable, append-only action log |
| `report_jobs` | Async report generation job state |

### 6.2 Geospatial indexing

- `CaseMaster.latitude/longitude` indexed via PostGIS `GEOGRAPHY(Point)` column (generated/synced from the existing lat/long fields) with a GiST index — enables sub-second radius and polygon (station jurisdiction boundary) queries for hotspot detection.

### 6.3 Read/write separation

- A **read replica** serves all dashboard, search, and reporting queries.
- The **primary** handles writes only (case annotations, collaboration requests, admin actions) — since the platform is read-heavy, this significantly reduces load on the primary and isolates analytical query load from transactional integrity.

### 6.4 Materialized views (precomputed intelligence)

To keep dashboards fast without hitting the AI service on every page load:

- `mv_station_hotspot_scores` — refreshed hourly
- `mv_officer_workload` — refreshed every 15 minutes
- `mv_district_crime_trend` — refreshed daily
- `mv_repeat_offender_index` — refreshed daily (feeds Repeat Offender module)

---

## 7. Authentication Architecture

### 7.1 Identity provider

- **Primary:** State SSO / KSP internal directory (if available) via SAML2 or OIDC federation.
- **Fallback (hackathon/pilot):** Self-hosted OAuth2/OIDC provider (e.g., Keycloak), backed by the `users` table, with government-grade password policy enforcement.

### 7.2 Authentication flow

1. User authenticates via SSO or local credentials + **mandatory MFA** (OTP via registered mobile, per government security norms) for any role above Constable/Head Constable.
2. On success, the backend issues a **short-lived JWT access token** (15 min) + **refresh token** (8 hr, tied to device fingerprint).
3. JWT claims include: `user_id`, `role`, `jurisdiction_scope` (district/station IDs), `permissions_version`.
4. Every API request is validated at the gateway; jurisdiction scope is enforced again at the query layer (defense in depth — see Section 21).

### 7.3 Session management

- Redis-backed session store for revocation (e.g., immediate logout on role change or account compromise).
- Device-bound sessions: field officers on shared station devices get shorter idle timeouts than desk-based supervisory roles.

---

## 8. Role-Based Access Control

### 8.1 Design philosophy

Permissions are split into three independent axes so roles don't need one-off special cases:

1. **Data scope** — which jurisdiction(s) a role can *see* (own station / district / statewide).
2. **Action scope** — what a role can *do* (read / annotate / manage officers / manage system).
3. **Module scope** — which modules are visible at all (e.g., Admin Panel is invisible to investigative roles, investigative data is invisible to System Admin).

### 8.2 Role matrix

| Role | Data Scope (read) | Write Actions | Module Access |
|---|---|---|---|
| Constable | Own station | Case annotation (limited) | Dashboard, Investigation (assigned cases), Search (own station) |
| Head Constable | Own station | Case annotation | Same as Constable + basic reports |
| Police Writer | Own station | Record data-entry support (non-investigative fields only) | Case data support views, no AI/predictive modules |
| ASI | Own station | Case annotation, evidence linkage | Investigation, Hotspot (station-level), Search (station) |
| SI (Investigating Officer role) | Own station, **read-only statewide search** | Full case investigation actions, annotations, collaboration requests | Investigation, Network (own cases), Predictive (own cases), Search (statewide, read-only) |
| Inspector / SHO | Own station (manage), district (read) | Case assignment, officer workload management, approve collaboration requests | All station-level modules + Reports + station Admin (officers only) |
| Circle Inspector / ACP | Circle/sub-division (manage), district (read) | Cross-station case coordination within circle | Hotspot, Network, Predictive, Reports at circle level |
| District SP / Commissioner | District (manage), statewide (read) | Resource allocation decisions, district-level report publishing | Full Crime Intelligence Dashboard, all modules at district scope + statewide read |
| SCRB Officer | Statewide (read + intelligence publishing) | Publish statewide advisories, manage cross-district pattern flags | Full statewide access to all intelligence modules; no case-record editing |
| System Administrator | **No investigative data access** | User/role management, system configuration, integration management | Admin Panel only — explicitly walled off from Cases, Accused, Victim, Network modules |

### 8.3 Key RBAC principles applied

- **Read-only statewide search is granted broadly** (from SI upward) because finding a similar case in another district is exactly the kind of workflow this platform exists to enable — restricting it would defeat the platform's purpose.
- **System Administrator is the most locked-down role in terms of data**, not the least — full system control, zero investigative visibility. This mirrors real government IT separation-of-duties requirements and prevents a single compromised admin account from exposing case data.
- **Write actions are always narrower than read actions** — nobody's account, at any level, can silently alter historical case facts; only add annotations, requests, and administrative configuration.

---

## 9. Complete User Workflow

### 9.1 Constable / Head Constable — after login

Lands on a **simplified field dashboard**: today's assigned tasks, station-level hotspot map (view-only), and a search bar scoped to their station. No predictive scores, no network graphs — these roles consume intelligence, they don't drive it.

### 9.2 ASI / SI — after login

Lands on the **Investigation Dashboard**: their assigned case list, sorted by risk score, with a "Cases needing attention" panel (stale investigation, upcoming court dates, anomaly flags). One click into any case opens the **Case Intelligence View** (Section 13). SI additionally sees a "Search statewide" toggle on the search bar.

### 9.3 Inspector / SHO — after login

Lands on the **Station Command Dashboard**: station-wide case load by officer, station hotspot map, pending collaboration requests to approve, and a station performance summary (charge-sheet rate, average investigation duration, backlog).

### 9.4 Circle Inspector / ACP — after login

Lands on the **Circle Overview Dashboard**: comparative view across stations in the circle, cross-station pattern alerts (e.g., same MO appearing in two neighboring stations), and resource-reallocation suggestions.

### 9.5 District SP / Commissioner — after login

Lands on the **District Command Dashboard**: district crime trend, hotspot heatmap across the whole district, top network/gang alerts active in the district, and resource deployment recommendations feeding into patrol planning.

### 9.6 SCRB Officer — after login

Lands on the **Statewide Intelligence Dashboard**: cross-district trend comparison, statewide network clusters that span district boundaries, and the Automated Intelligence Report feed (Section 26).

### 9.7 System Administrator — after login

Lands on the **Admin Console** only: user accounts, role assignments, jurisdiction mapping, system health, integration status. No case data is queryable from this account, enforced at the API layer, not just hidden in the UI.

---

## 10. Complete Module Breakdown

### 10.1 Authentication & Role Management
Login, MFA, password/SSO management, session control, first-login onboarding wizard that sets a user's jurisdiction and role (approved by a supervisor).

### 10.2 Crime Intelligence Dashboard
The home screen, role-adapted (Section 9). Shows: live case volume, hotspot summary, top alerts (network, anomaly, risk), and quick-search.

### 10.3 Crime Hotspot Intelligence
- **Live Heatmap** — kernel-density crime map, filterable by crime type, date range, time-of-day.
- **Predicted Hotspot Layer** — near-term forecast overlay with confidence shading.
- **Hotspot Drilldown** — click a hotspot to see contributing cases, dominant crime sub-type, and MO cluster.

### 10.4 Criminal Network & Link Analysis
- **Interactive Network Graph** (Section 26) — co-accused, shared-victim, and MO-similarity edges.
- **Gang Detection View** — community-detected clusters with a gang profile card (territory, specialization, member list, lifecycle state).
- **Link Explanation Panel** — for any two nodes, shows *why* they're linked (shared case, shared address, shared MO, shared associate).

### 10.5 Investigation Intelligence
- **Case Intelligence View** (Section 13) — the single most-used screen for SI/Inspector roles.
- **Similar Case Finder** — MO-embedding-based ranked list of similar historical cases, statewide.
- **Repeat Offender Panel** — for any accused, shows their full case history, escalation trend, and known associates.
- **Evidence & Witness Tracker** — checklist view against the case's Evidence/Witness records.

### 10.6 Predictive Intelligence
- **Risk Scoring** — per-case risk label with SHAP-based explanation.
- **Crime Forecasting** — district/station-level forecast charts (next 7/30/90 days) by crime sub-type.
- **Resource Deployment Recommender** — suggested patrol allocation based on hotspot + officer workload data.

### 10.7 Reports & Analytics
- **Report Builder** — parameterized report templates (station/district/state, date range, crime type).
- **Automated Intelligence Reports** — scheduled, auto-generated weekly/monthly district summaries (Section 26).
- **Export** — PDF/Excel export with KSP letterhead formatting.

### 10.8 AI Assistant / Crime Intelligence Chatbot
Conversational interface described fully in Section 15 — orchestrates the modules above rather than being a standalone Q&A bot.

### 10.9 Administration Panel
User management, role/permission configuration, jurisdiction mapping, audit log viewer (read-only even for admins — they can view but the log itself is immutable), system health, integration configuration (CCTNS sync, SSO config).

---

## 11. Sidebar Navigation

Sidebar is **role-rendered** — modules a role cannot access are not shown (not just disabled), keeping the UI uncluttered per role.

```
🏠 Dashboard
🗺️ Hotspot Intelligence
   ├─ Live Map
   ├─ Predicted Hotspots
   └─ Hotspot Drilldown
🕸️ Network & Link Analysis
   ├─ Network Explorer
   ├─ Gang Detection
   └─ Link Explanation
🔍 Investigation
   ├─ My Cases
   ├─ Similar Case Finder
   ├─ Repeat Offender Lookup
   └─ Evidence & Witness Tracker
📈 Predictive Intelligence
   ├─ Risk Scoring
   ├─ Crime Forecasting
   └─ Resource Deployment
📊 Reports & Analytics
   ├─ Report Builder
   └─ Automated Reports
🤝 Collaboration
   └─ Cross-District Requests
💬 AI Assistant           (persistent floating icon on all screens)
⚙️ Administration          (System Admin only)
```

---

## 12. Dashboard Layouts

### 12.1 Layout system

All dashboards share a **12-column responsive grid**: a summary KPI row (4 cards), a primary visualization (map/graph/chart, 8 columns), a secondary panel (alerts/list, 4 columns), and a detail drawer that slides in without full navigation (keeps context — critical for an analytical tool).

### 12.2 Station Command Dashboard (example)

```
┌─────────┬─────────┬─────────┬─────────┐
│ Open    │ Charge- │ Avg Inv.│ Officers │
│ Cases   │ Sheet % │ Duration│ Active   │
└─────────┴─────────┴─────────┴─────────┘
┌───────────────────────────┬─────────────┐
│                             │ Alerts       │
│   Station Hotspot Map       │ • Anomaly    │
│   (heatmap + case pins)     │ • Repeat off.│
│                             │ • Collab req.│
└───────────────────────────┴─────────────┘
┌───────────────────────────────────────────┐
│  Officer Workload Table (sortable)          │
└───────────────────────────────────────────┘
```

### 12.3 District Command Dashboard (example)

Same grid, primary panel becomes a **district choropleth + station-level heat layer**, secondary panel becomes **cross-station pattern alerts**, bottom panel becomes **resource deployment recommendations**.

---

## 13. Investigation Workflow

### 13.1 Case Intelligence View — the core investigation screen

When an officer opens a case, the view is organized into tabs, all fed by the joined case data and AI layer:

1. **Overview** — CaseMaster facts, BriefFacts, status, gravity, category.
2. **People** — Accused (with repeat-offender flag + prior case links), Victim, Witness.
3. **Evidence & Vehicle** — Evidence list, linked Vehicle records.
4. **Intelligence** — Risk score + explanation, MO cluster membership, similar cases ranked by similarity score.
5. **Network** — mini network graph centered on this case's accused (expandable to the full Network Explorer).
6. **Timeline** — Smart Investigation Timeline (Section 26): incident → registration → evidence collection → arrest → chargesheet, with delay flags.
7. **Collaboration** — request access/input from another district if a linked entity falls outside jurisdiction.

### 13.2 Workflow states

```
Case Registered → Under Investigation → [Evidence/Accused/Victim linked]
   → AI Intelligence auto-attached (risk score, similar cases, network position)
   → Officer reviews & annotates → Chargesheet filed / Closed (Undetected/False Case)
   → Case remains searchable indefinitely for future similar-case matching
```

AI intelligence is **attached automatically** as soon as a case has enough linked data (accused/victim/evidence) — the officer is never required to manually trigger a model run for standard intelligence; they can additionally request an on-demand re-score after new evidence is added.

---

## 14. Cross-District Collaboration Workflow

### 14.1 Problem this solves

An accused in a Mysuru case shares an identity signal (name+DOB match, or a network-graph link) with an accused in a Bengaluru case. Investigating officers in each district may never otherwise discover this.

### 14.2 Workflow

1. **System-detected suggestion:** the Network module flags a possible cross-district link (e.g., shared `HiddenClusterID` risk, or a strong MO-similarity + partial identity match) and notifies both stations' Inspectors.
2. **Officer-initiated request:** an SI can also manually submit a **Collaboration Request** — "I believe this case is linked to Case #X in District Y" — attaching their reasoning.
3. **Approval:** the receiving station's Inspector/SHO approves or declines; approval grants **time-boxed read access** to the specific linked case(s), not blanket district access.
4. **Joint case thread:** once approved, both stations see a shared **Collaboration Thread** — notes, shared network graph view, shared evidence references (read-only cross-district; each station retains write ownership of its own case).
5. **Escalation:** if the link spans more than two districts or indicates an organized network, SCRB is auto-notified and can convert it into a **statewide intelligence flag**.

### 14.3 Why time-boxed, request-based access

This avoids the two failure modes of cross-jurisdiction systems: (a) officers never discovering relevant connections because access is too siloed, and (b) uncontrolled statewide visibility into every district's active investigations, which raises both security and procedural (chain-of-custody) concerns.

---

## 15. AI Architecture

### 15.1 Principle: models serve the backend, they don't replace it

The AI/ML service is a **stateless inference layer**. It never writes directly to the system-of-record database — it returns scores/labels/explanations to the Core Backend, which persists them (in `ai_model_runs` and the materialized views) and is the only writer of record. This keeps a clean audit boundary between "what the AI said" and "what the system stored."

### 15.2 Model catalogue and how each attaches to the platform

| Model | Trigger | Consumed by |
|---|---|---|
| Hotspot Predictor | Scheduled (hourly) batch job | Hotspot Intelligence module, Resource Deployment |
| Risk Scorer | On case update (new evidence/accused/status change) | Case Intelligence View, Predictive Intelligence |
| Repeat Offender / Entity Resolver | Scheduled (daily) batch job over Accused | Repeat Offender Panel, Network module |
| Network/Gang Detector | Scheduled (daily) batch job, on-demand recompute for a sub-graph | Network Explorer, Gang Detection View |
| MO Similarity Engine | On-demand (Similar Case Finder), precomputed embeddings | Investigation Intelligence, AI Assistant |
| Anomaly Detector | Scheduled (daily) batch + real-time check on case registration | Alerts panel, SCRB dashboard |
| Forecasting Engine | Scheduled (daily) | Predictive Intelligence, District Dashboard |
| AI Assistant orchestrator | Real-time, per chat turn | Chatbot (Section 15.4) |

### 15.3 Explainability layer

Every scoring model returns a structured explanation object, not just a number:

```json
{
  "risk_label": "High",
  "confidence": 0.81,
  "top_factors": [
    {"factor": "GravityOffenceName = Heinous", "weight": 0.34},
    {"factor": "IsRepeatOffenderGroundTruth = true", "weight": 0.29},
    {"factor": "3 prior cases in 18 months", "weight": 0.18}
  ],
  "model_version": "risk-xgb-v2.3",
  "generated_at": "2026-07-15T09:02:11Z"
}
```
The frontend renders `top_factors` as a plain-language explanation card next to every score — this is a hard requirement, not an enhancement, given the investigative/judicial context.

### 15.4 AI Crime Intelligence Assistant architecture

The chatbot is an **orchestrator with tool access**, not a document-QA bot:

1. **Intent & entity parsing:** an LLM parses the officer's natural-language query into a structured intent (e.g., `hotspot_query{crime_type=Burglary, district=Mysuru}`).
2. **Tool routing:** the parsed intent maps to one or more existing backend/AI endpoints — the same APIs the dashboards use (Section 16). The assistant has **no separate data path**; it calls the platform's own APIs, which enforces the same RBAC and jurisdiction scoping as everything else.
3. **Action execution:** the tool call executes (e.g., `GET /hotspots?crimeType=Burglary&district=Mysuru`).
4. **Grounded response composition:** the LLM composes a natural-language answer **grounded in the actual returned data**, and the frontend simultaneously updates the relevant widget (map pans to Mysuru and shows the burglary heatmap layer) — the chat and the dashboard are the same session, not two separate experiences.
5. **Multi-turn context:** conversation state (current jurisdiction focus, last-referenced case/entity) is held server-side per session, so "show repeat offenders linked to **this** case" resolves correctly after a prior "open case #1234" turn.

```
Officer: "Why is crime increasing in this district?"
   → Intent: trend_explanation{district=<current context>}
   → Tool calls: forecasting.trend(district), anomaly.recent(district),
                  hotspot.delta(district, period=90d)
   → Response: grounded summary + dashboard auto-navigates to
     District Trend view with the specific contributing sub-types highlighted
```

### 15.5 Model governance

- Every model version is registered with training data snapshot, evaluation metrics against the dataset's own ground-truth labels (`HiddenCriminalProfileID`, `HiddenGangID`, `RiskLabel`, `AnomalyLabel`), and a sign-off record before promotion to production — this is what makes the system's outputs defensible in an investigative context.

---

## 16. API Architecture

*(Design only — no code.)*

### 16.1 API style

- **REST** for all CRUD/query endpoints (broad tooling support, easy to secure with standard gateway policies).
- **WebSocket channel** for live dashboard updates and chatbot streaming.
- **Versioned** (`/api/v1/...`) from day one.

### 16.2 Core endpoint groups

| Group | Example endpoints (illustrative) |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/mfa/verify` |
| Cases | `GET /cases`, `GET /cases/{id}`, `GET /cases/{id}/accused`, `GET /cases/{id}/victims`, `GET /cases/{id}/evidence`, `POST /cases/{id}/annotations` |
| Search | `GET /search/cases?query=&scope=`, `GET /search/similar-cases/{caseId}` |
| Hotspot | `GET /hotspots?crimeType=&district=&dateRange=`, `GET /hotspots/predicted` |
| Network | `GET /network/graph?entityId=&depth=`, `GET /network/gangs`, `GET /network/link-explanation?a=&b=` |
| Repeat Offender | `GET /offenders/{id}/history`, `GET /offenders/{id}/associates` |
| Risk & Anomaly | `GET /cases/{id}/risk-score`, `GET /anomalies?scope=` |
| Forecasting | `GET /forecast/crime-trend?district=&horizon=` |
| Reports | `POST /reports/generate`, `GET /reports/{jobId}/status`, `GET /reports/{jobId}/download` |
| Collaboration | `POST /collaboration/requests`, `PATCH /collaboration/requests/{id}/approve` |
| Assistant | `POST /assistant/chat` (streams via WebSocket) |
| Admin | `GET /admin/users`, `POST /admin/users/{id}/role`, `GET /admin/audit-log` |

### 16.3 API design conventions

- Every list endpoint supports `page`, `pageSize`, jurisdiction filters, and returns a consistent envelope: `{ data, meta: { total, page }, appliedScope }` — `appliedScope` always echoes back the jurisdiction the query was actually run against, so the frontend (and the officer) can never be misled about what they're looking at.
- Every write endpoint requires an `X-Reason` header for investigative writes (annotations, collaboration requests) that gets persisted alongside the audit entry — supports procedural accountability.
- All AI-backed read endpoints return the explainability object (Section 15.3) inline, never as a separate call the frontend might skip.

---

## 17. Notification System

### 17.1 Notification types

| Type | Example | Delivery |
|---|---|---|
| Operational | New case assigned, collaboration request received | In-app + push (PWA) |
| Intelligence alert | Anomaly detected, new hotspot forming in your jurisdiction | In-app + email digest option |
| Network alert | New link discovered involving a case you're investigating | In-app, high priority |
| Administrative | Role changed, account action required | In-app + email |
| Scheduled | Weekly automated intelligence report ready | Email + in-app |

### 17.2 Architecture

- Backend events publish to a **notification queue** (Celery task) → **Notification Service** resolves delivery channel per user preference → writes to `notifications` table → pushes via WebSocket if the user is online, else queues for next login/email digest.
- Notification rules are **jurisdiction-aware** — a district alert only notifies users whose `user_jurisdictions` intersect that district.

---

## 18. Search Architecture

### 18.1 Search types

1. **Structured search** — filters over CaseMaster/Accused/Victim fields (crime type, date range, station, status) — served directly from PostgreSQL with proper indexing.
2. **Free-text search** — over `BriefFactsText` and case metadata — served from **OpenSearch**, kept in sync via change-data-capture (CDC) from PostgreSQL (Debezium or a simpler polling sync job at V1 scale).
3. **Semantic similarity search** ("find similar cases") — over BriefFacts embeddings stored in **pgvector**, combined with structured pre-filtering (same crime sub-head, same district first) before ranking by embedding distance — keeps queries fast and results relevant rather than a pure global vector search.
4. **Entity search** — accused/victim/officer lookup with fuzzy name matching (trigram similarity in PostgreSQL) to handle the same name-variant noise the dataset intentionally contains.

### 18.2 Search scoping

Every search request is automatically scoped to the caller's jurisdiction **unless** the role has "statewide read" (Section 8) and the user explicitly widens scope in the UI — defaults are always narrow, widening is always an explicit action, never silent.

---

## 19. Report Generation

### 19.1 Report types

- **Station/District/State periodic summary** (crime counts, trend, top hotspots, top risk cases).
- **Case dossier export** (single case, full intelligence view, for court/administrative use).
- **Network/gang intelligence brief** (cluster summary, member list, territory map).
- **Custom report** via the Report Builder (parameterized).

### 19.2 Generation pipeline

1. Report request → `report_jobs` row created (status: `queued`) → Celery worker picks it up.
2. Worker queries the read replica + AI service for any needed scores, renders a templated PDF (WeasyPrint/ReportLab) with KSP letterhead, uploads to object storage.
3. `report_jobs` updated to `completed` with a signed, time-limited download URL; requester notified.
4. All generated reports are logged in the audit trail (who generated what, over what scope, when).

---

## 20. Audit Logging

### 20.1 What is logged

- Every authentication event (success/failure/MFA).
- Every read of investigative data **above a configurable sensitivity threshold** (e.g., viewing a case outside one's home jurisdiction via statewide search) — not every single page view, to avoid unusable log volume, but every *scope-crossing* access.
- Every write (annotation, collaboration request/approval, report generation, admin action).
- Every AI model invocation tied to a specific case (for judicial defensibility of AI-assisted findings).

### 20.2 Architecture

- **Append-only** `audit_log` table, additionally mirrored to a **write-once object storage bucket** (nightly export) so the log survives even a full database compromise scenario.
- No UPDATE or DELETE grants exist on `audit_log` for any application role, including System Administrator — enforced at the database permission level, not just the application layer.
- SCRB and System Administrator can both *view* audit logs (for oversight and system health respectively) but neither can alter them.

---

## 21. Security Architecture

### 21.1 Defense in depth

| Layer | Control |
|---|---|
| Network | Private subnet for DB/AI services, WAF in front of the API gateway, VPN-only access to admin endpoints |
| Transport | TLS 1.2+ everywhere, mTLS between Core Backend and AI/ML service |
| AuthN | MFA mandatory above field-officer level, SSO federation where available |
| AuthZ | RBAC enforced at gateway (coarse) and again at query layer (fine-grained, jurisdiction row-level filtering) — defense in depth against a bug in either layer |
| Data at rest | Full-disk/database-level encryption; evidence files encrypted in object storage with per-file keys |
| Data in transit | TLS everywhere, no plaintext internal traffic |
| Application | Input validation, parameterized queries only (ORM-enforced), CSRF protection, strict CSP headers |
| AI-specific | Prompt-injection safeguards on the Assistant (tool calls are schema-validated, the LLM cannot execute arbitrary queries — only the pre-defined, permission-checked tool endpoints) |
| Data residency | Hosted within state-approved government data center / empaneled cloud region only |

### 21.2 Row-level jurisdiction enforcement

Every query touching CaseMaster (and its children) passes through a **jurisdiction filter injected at the ORM/query-builder layer** based on the authenticated user's `jurisdiction_scope` claim — this is not something each API handler has to remember to add; it's structurally impossible to bypass from a normal endpoint.

### 21.3 Sensitive-attribute handling

Per the dataset design, fields with elevated sensitivity (any demographic attributes beyond what's operationally required) are treated with the same care as the dataset generation phase: not surfaced in general dashboards, accessible only within a case's detail view to roles with legitimate investigative need, and never used as a standalone filter/facet in search or analytics.

---

## 22. Deployment Architecture

### 22.1 Environments

`dev` → `staging` (mirrors prod, used for UAT with real KSP stakeholders) → `production` (state data center / empaneled government cloud).

### 22.2 Deployment topology

```
                    ┌───────────────┐
                    │  Load Balancer │
                    └───────┬───────┘
              ┌─────────────┼─────────────┐
      ┌───────▼──────┐              ┌──────▼───────┐
      │  Web/App Pods  │              │  API Pods     │
      │  (Kubernetes)  │              │  (Kubernetes) │
      └────────────────┘              └───────┬──────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │   AI/ML Service Pods  │
                                    │   (separate node pool,│
                                    │   GPU-enabled if used)│
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
             ┌──────▼──────┐          ┌────────▼────────┐        ┌───────▼───────┐
             │  PostgreSQL   │          │      Redis        │        │  OpenSearch    │
             │ (primary+replica)│       │  (cache/queue)    │        │  (search index)│
             └──────────────┘          └───────────────────┘        └───────────────┘
```

### 22.3 Release process

Blue-green deployment for the Core Backend (zero-downtime given this is used during active investigations); AI models deployed independently via a model registry with canary rollout (new model version serves a small percentage of traffic before full promotion).

---

## 23. Scalability Considerations

- **Read replicas** scale horizontally as dashboard/search load grows — the platform's read-heavy nature makes this the primary scaling lever.
- **Materialized views** absorb the majority of dashboard load without touching live tables or the AI service on every page view.
- **AI/ML service** scales independently (its own pod pool) since inference load (especially embedding generation and graph computation) has a very different profile than transactional API load.
- **Partitioning strategy:** `CaseMaster` and its children partitioned by year (or district+year at very large scale) once case volume grows beyond a few million rows, keeping indexes fast without a schema redesign.
- **Statewide rollout path:** architecture supports incremental rollout district-by-district (a `user_jurisdictions`-scoped pilot) before a full statewide cutover, de-risking adoption.

---

## 24. Folder Structure

```
ksp-crime-intelligence/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── modules/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── state/
│   │   └── types/
│   └── public/
├── backend/
│   ├── core/
│   │   ├── identity/
│   │   ├── cases/
│   │   ├── officers/
│   │   ├── intelligence/
│   │   ├── network/
│   │   ├── reports/
│   │   ├── collaboration/
│   │   ├── notifications/
│   │   ├── audit/
│   │   └── admin/
│   ├── api_gateway/
│   └── config/
├── ai-service/
│   ├── models/
│   │   ├── hotspot/
│   │   ├── risk_scoring/
│   │   ├── repeat_offender/
│   │   ├── network_gang/
│   │   ├── mo_similarity/
│   │   ├── anomaly/
│   │   └── forecasting/
│   ├── assistant/
│   │   ├── intent_parser/
│   │   ├── tool_router/
│   │   └── response_composer/
│   └── serving/
├── data/
│   ├── schema/               # the already-finalized relational schema (read-only reference)
│   └── pipelines/            # sync/ETL jobs, materialized view refresh jobs
├── infra/
│   ├── terraform/
│   ├── k8s/
│   └── docker/
├── docs/
│   └── architecture/         # this document and its future revisions
└── tests/
    ├── backend/
    ├── ai-service/
    └── frontend/
```

---

## 25. Development Roadmap

### Phase 0 — Foundation (Weeks 1–2)
Identity/RBAC skeleton, database provisioning against the finalized schema, API gateway, CI/CD pipeline, folder scaffolding.

### Phase 1 — Core Records & Search (Weeks 3–4)
Case/Accused/Victim/Officer read APIs, structured + free-text search, base dashboard shell, role-rendered navigation.

### Phase 2 — Hotspot Intelligence (Weeks 5–6)
Geospatial indexing, live heatmap, hotspot drilldown — the most visually demonstrable module, prioritized early for stakeholder buy-in.

### Phase 3 — Investigation Intelligence (Weeks 7–8)
Case Intelligence View, Similar Case Finder (embeddings + pgvector), Repeat Offender Panel, Smart Investigation Timeline.

### Phase 4 — Network & Predictive Intelligence (Weeks 9–11)
Network graph construction, gang detection, risk scoring with explainability, anomaly detection, forecasting.

### Phase 5 — AI Assistant (Weeks 12–13)
Intent parsing, tool routing into all prior modules, streaming chat UI, dashboard-assistant synchronization.

### Phase 6 — Collaboration, Reports, Notifications (Weeks 14–15)
Cross-district workflow, automated intelligence reports, notification system end-to-end.

### Phase 7 — Security Hardening & Audit (Weeks 16–17)
Full RBAC/jurisdiction enforcement testing, audit log completeness review, penetration testing, data residency verification.

### Phase 8 — Pilot & Iterate (Weeks 18+)
District-scoped pilot deployment, stakeholder feedback loop, model evaluation against ground truth, staged statewide rollout.

**Sequencing rationale:** hotspot intelligence is built early because it's the fastest path to a compelling, demonstrable capability; security/audit hardening is deliberately a dedicated late phase rather than "bolted on," but jurisdiction-scoping and RBAC are foundational (Phase 0) precisely because retrofitting access control onto an investigative system is far riskier than building it in from the start.

---

## 26. Standout Features (Differentiators)

Every feature below is scoped to a real, named policing problem it solves — no gimmicks.

| Feature | Problem it solves |
|---|---|
| **Smart Investigation Timeline** | Officers and supervisors currently have no single view of where time is being lost in a case (slow evidence collection? delayed arrest? backlog at chargesheet?). A visual timeline with delay flags (fed by `ReportingDelayHours`, `ArrestDelayDays`, `ChargesheetFilingDelayDays`-equivalent signals) makes bottlenecks visible at a glance. |
| **AI Similar Case Assistant** | Officers investigating a case often don't know a near-identical MO occurred in another district months earlier. Embedding-based similarity search surfaces it automatically, with a plain-language explanation of *why* two cases match. |
| **Criminal Relationship Explorer** | Co-offending and gang structures are invisible in a flat case list. An interactive graph makes "who is connected to whom, and how" explorable in seconds instead of requiring manual cross-referencing across dozens of FIRs. |
| **Patrol Recommendation Engine** | Resource deployment is often based on static beat plans rather than current risk. Combining hotspot forecasts with officer availability produces concrete, explainable patrol suggestions for the coming shift/week. |
| **Crime Evolution Timeline** | For a repeat offender or gang, seeing the progression of offence severity over time (escalating vs. stable vs. de-escalating) helps prioritize intervention — directly visualizes the escalation-curve concept already in the dataset's ground truth. |
| **Interactive Criminal Network Graph** | As above (Criminal Relationship Explorer) — implemented as a first-class, zoomable, filterable graph view rather than a static diagram, so an analyst can expand outward from any single case to its full connected component. |
| **Explainable AI Predictions** | Any AI output used in an investigative or resource-allocation context must be defensible. Every score ships with its top contributing factors, never a bare number. |
| **Collaboration Requests Between Districts** | Solves the real, common failure mode where connected cases in different districts never get cross-referenced because there's no workflow for an officer to flag and request access to a linked case elsewhere. |
| **Automated Intelligence Reports** | District/circle leadership currently assembles trend reports manually. Scheduled, auto-generated reports (with narrative summaries, not just charts) save significant analyst time and standardize reporting quality across districts. |
| **Voice-Based AI Assistant** | For officers in the field or in situations where typing is impractical, voice input into the same Assistant (Section 15.4) lowers the barrier to using the intelligence layer during active work, not just at a desk. |
| **Case Knowledge Graph** | Extends the Network Explorer beyond people to *all* entities — cases, accused, victims, vehicles, evidence, officers, courts — as one queryable graph, enabling questions like "what other cases involve this vehicle registration" that a purely relational view struggles to answer quickly. |
| **Investigation Recommendation Engine** | Beyond showing data, proactively suggests next steps on a case (e.g., "3 similar cases in this cluster were solved after cross-referencing CCTV evidence — consider requesting footage from nearby cases' stations") — turns the platform from a passive dashboard into an active investigative aid. |

---

*This document is the foundation architecture for the KSP Crime Intelligence & Investigation Platform. It defines structure, not code. All future implementation work should trace back to a section in this document; any deviation should be proposed as a revision to this document first, keeping it the single source of truth throughout development.*
