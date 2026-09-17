# KSP Crime Intelligence Platform — 10-Day Hackathon Implementation Roadmap
### Derived strictly from the approved Software Architecture Document (v1.0)
**Status:** Official development checklist
**Timeline:** 10 days | ~3–4 hrs on weekdays, extended sessions on 3–4 weekend/long days
**Goal:** A demoable, judge-defensible MVP that proves every architectural pillar of the SAD — RBAC, explainable AI, jurisdiction-awareness, and the standout differentiators — without needing the full production infrastructure stack.

---

## 0. Hackathon Scope Decisions (read this first)

The SAD's own Section 25 roadmap is an 18+ week production plan. To hit 10 days without breaking "single source of truth" fidelity, we **implement the same architecture at hackathon scale** — same module boundaries, same API contracts, same RBAC model, same AI catalogue — but swap heavyweight infra for lightweight equivalents that behave the same way conceptually. Nothing here contradicts the SAD; it's the SAD's own "modular monolith, hackathon-to-pilot" philosophy (Section 2.1) taken literally.

| SAD Component | Full Production Choice | 10-Day Hackathon Substitute | Why this is safe |
|---|---|---|---|
| API Gateway | Kong/NGINX + custom middleware | Auth handled directly in Django middleware | Same enforcement point, fewer moving parts |
| Identity Provider | SAML2/OIDC + state SSO | Local JWT auth (email+password), MFA **mocked** as a static OTP screen | RBAC/jurisdiction logic identical either way |
| Search | OpenSearch + CDC | PostgreSQL full-text (`tsvector`/GIN index) | Same search UX, zero extra infra |
| Vector store | pgvector | pgvector (kept — it's already lightweight) | No substitution needed |
| Graph queries | Recursive CTEs (already the SAD's V1 choice) | Recursive CTEs | No substitution needed |
| Task queue | Celery + Kafka/RabbitMQ | Celery + Redis only | Kafka explicitly deferred even in the SAD |
| Real-time layer | Django Channels (WebSockets) | WebSockets for chat only; dashboards poll every 15–30s | Cut only if Day 8 is tight — see stretch goals |
| Deployment | Kubernetes + Terraform + Vault | Docker Compose, `.env` secrets, single VM/cloud instance | Same containerization strategy, no orchestration overhead |
| DevOps | GitLab CI + Prometheus/Grafana | GitHub Actions (lint+test only) | Enough to prove CI discipline to judges |

**Non-negotiable (these ARE the differentiators judges will score you on):** RBAC + jurisdiction scoping, explainable AI (SHAP-style `top_factors` on every score), hotspot map, similar-case finder (pgvector), network graph, risk scoring, and the AI Assistant as a tool-calling orchestrator over your own APIs. These stay in scope no matter what.

---

## Day-by-Day Milestone Map

| Day | Milestone | Load |
|---|---|---|
| 1 | M0 — Project Setup & Scaffolding | Normal |
| 2 | M1 — Database & Core Read APIs | Normal |
| 3 | M2 — Auth, RBAC & Frontend Shell | Normal |
| 4 | M3 — Hotspot Intelligence | **Weekend/long** |
| 5 | M4 — Investigation Intelligence (Case View, Similar Case Finder, Repeat Offender) | Normal |
| 6 | M5 — Network & Link Analysis | **Weekend/long** |
| 7 | M6 — Predictive Intelligence (Risk Scoring, Anomaly, Forecast) | Normal |
| 8 | M7 — AI Crime Intelligence Assistant | **Weekend/long** |
| 9 | M8 — Collaboration, Reports, Notifications, Audit | Normal |
| 10 | M9 — Security Pass, Testing, Deployment, Demo Polish | **Weekend/long** |

---

## MILESTONE 0 — Project Setup & Scaffolding (Day 1)

**Objective:** Every team member can run the full stack locally in one command; folder structure matches the SAD's approved layout so no rework happens later.

**Features to complete:** Repo scaffolding only — no user-facing feature yet.

**Backend tasks**
- Initialize Django + DRF project as `core/` with the module boundaries from SAD §5.1 (`identity`, `cases`, `officers`, `intelligence`, `network`, `reports`, `collaboration`, `notifications`, `audit`, `admin`) as separate Django apps.
- Initialize FastAPI project as `ai-service/` with the `models/` and `assistant/` sub-packages from SAD §24.
- Set up Docker Compose: `core-backend`, `ai-service`, `postgres` (with PostGIS + pgvector extensions enabled), `redis`.
- Add `.env.example` covering DB creds, JWT secret, AI API key.

**Frontend tasks**
- Initialize React 18 + TypeScript app with the `app/modules/components/hooks/services/state/types` folder structure from SAD §4.2.
- Install and configure Tailwind CSS + shadcn/ui, React Query, Zustand.
- Stub routing shell (empty routes for each sidebar module in SAD §11) so navigation exists even before features do.

**AI tasks**
- Confirm which LLM API (for the Assistant) and embedding model (for MO similarity) the team will use — lock this decision now, it gates Milestone 4 and 7.
- Scaffold `ai-service`'s FastAPI health-check endpoint only.

**Database tasks**
- Load the already-finalized relational schema (District, PoliceStation, CrimeType, CrimeSubType, CaseMaster, Accused, Victim, Officer, Vehicle, Evidence, Witness) unchanged, per SAD §6.1.
- Enable PostGIS and pgvector extensions.
- Create the new platform tables from SAD §6.1: `users`, `roles`, `permissions`, `role_permissions`, `user_jurisdictions`, `collaboration_requests`, `case_annotations`, `ai_model_runs`, `notifications`, `audit_log`, `report_jobs`.

**Expected deliverables**
- `docker-compose up` boots backend, AI service, DB, Redis with zero manual steps.
- Empty-but-navigable frontend shell.
- Full schema (base + platform tables) migrated and seeded with sample rows.

**Dependencies:** None — this is day zero.

**Testing requirements**
- Smoke test: all containers healthy, DB migrations apply cleanly, one dummy API round-trip (frontend → backend → DB → response) works end to end.

---

## MILESTONE 1 — Database & Core Read APIs (Day 2)

**Objective:** Every core entity (cases, accused, victims, officers) is queryable through typed, paginated, jurisdiction-shaped APIs — the foundation every later module builds on.

**Features to complete:** Case/Accused/Victim/Officer/Evidence/Witness read APIs (SAD §16.2 "Cases" group).

**Backend tasks**
- Build DRF serializers/viewsets for `CaseMaster`, `Accused`, `Victim`, `Officer`, `Vehicle`, `Evidence`, `Witness` (read-only at this stage).
- Implement the standard response envelope from SAD §16.3: `{ data, meta: { total, page }, appliedScope }`.
- Implement `GET /cases`, `GET /cases/{id}`, `GET /cases/{id}/accused`, `GET /cases/{id}/victims`, `GET /cases/{id}/evidence`.
- Add pagination (`page`, `pageSize`) and basic structured filters (crime type, date range, station, status).

**Frontend tasks**
- Build the typed API service layer (`services/`) matching each backend module.
- Build a generic data table component (`components/common/`) reusable across all list views.
- Build a Case List view and a bare Case Detail page (no intelligence tabs yet — just facts).

**AI tasks**
- None this milestone — pure data plumbing.

**Database tasks**
- Add indexes for the common filter fields (crime type, station, date, status) to keep list queries fast under demo load.
- Set up a nightly/on-demand sample-data seed script so demo data is reproducible.

**Expected deliverables**
- Working, filterable Case List screen backed by real data.
- Case Detail page showing raw case facts (Overview tab only, per SAD §13.1 item 1).

**Dependencies:** M0 (schema + scaffolding) must be complete.

**Testing requirements**
- Unit tests: serializers return correct shape and pagination envelope.
- Manual test: filtering by crime type/station/date returns correct subsets against seed data.

---

## MILESTONE 2 — Auth, RBAC & Frontend Shell (Day 3)

**Objective:** A logged-in user sees only what their role and jurisdiction allow — the platform's core trust guarantee, built early per the SAD's explicit rationale (§25: "retrofitting access control... is far riskier than building it in from the start").

**Features to complete:** Login, JWT auth, role-rendered sidebar, jurisdiction Context Bar, role-adapted dashboards (SAD §9, §11, §12).

**Backend tasks**
- Implement `POST /auth/login`, `POST /auth/refresh` issuing short-lived JWT + refresh token (SAD §7.2 pattern, MFA mocked/stubbed for hackathon per Section 0 above).
- Implement the three-axis RBAC model from SAD §8.1 (data scope / action scope / module scope) as a Django permission class applied globally.
- Implement the row-level jurisdiction filter at the query layer (SAD §21.2) — every `CaseMaster`-touching query is automatically scoped to `jurisdiction_scope`.
- Seed the role matrix from SAD §8.2 (Constable → SCRB → System Admin) with representative demo accounts for each role.

**Frontend tasks**
- Build login screen + auth state (React Query + token storage).
- Build the persistent app shell: top bar + **role-rendered sidebar** (SAD §11) — modules not permitted are not shown, not just disabled.
- Build the jurisdiction **Context Bar** (SAD §4.1) that persists across modules.
- Build role-adapted dashboard shells for at least 3 personas: field officer, station leadership, SCRB (SAD §9.1–9.6) — KPI row + placeholder panels per SAD §12.1 grid.

**AI tasks:** None this milestone.

**Database tasks**
- Populate `users`, `roles`, `permissions`, `role_permissions`, `user_jurisdictions` with the full role matrix and demo accounts covering every role for the demo.

**Expected deliverables**
- Demo-ready login for each of the 8–9 roles in the matrix.
- Sidebar and dashboard visibly change per role — this alone is a strong judge-visible proof of the architecture.

**Dependencies:** M1 (core read APIs exist to scope).

**Testing requirements**
- RBAC test matrix: for each role, verify at least one "should see" and one "should NOT see" module/data assertion (this is the single most important test suite in the whole project — judges will probe it).
- Test that a station-level user querying statewide data is correctly narrowed unless their role has statewide read.

---

## MILESTONE 3 — Hotspot Intelligence (Day 4, weekend/long session)

**Objective:** Ship the single most visually compelling, judge-facing module first — exactly the sequencing rationale the SAD itself specifies (§25 Phase 2).

**Features to complete:** Live Heatmap, Predicted Hotspot Layer, Hotspot Drilldown (SAD §10.3).

**Backend tasks**
- Implement `GET /hotspots?crimeType=&district=&dateRange=` and `GET /hotspots/predicted`.
- Implement the `intelligence` module's orchestration call into the AI service for hotspot scores, with result caching.
- Wire jurisdiction scoping into hotspot queries (station users see only their station's hotspots by default).

**Frontend tasks**
- Integrate Mapbox GL JS or Leaflet with PostGIS-backed tiles.
- Build the heatmap layer (kernel-density visualization) with filters: crime type, date range, time-of-day.
- Build the Predicted Hotspot overlay with confidence shading.
- Build Hotspot Drilldown: click-through to contributing cases, dominant sub-type, MO cluster summary.

**AI tasks**
- Implement Hotspot Predictor: KDE + time-decay weighting for the live layer; a lightweight XGBoost short-term forecast for the predicted layer (SAD §3.4, §15.2).
- Wrap output in the explainability object pattern (even a simplified `top_factors` — e.g., top contributing crime sub-types/time windows) per SAD §15.3.
- Expose as a scheduled/batch-style endpoint the backend can call and cache (mock the "hourly batch" as an on-demand + cached call for hackathon scale).

**Database tasks**
- Confirm `CaseMaster.latitude/longitude` is exposed as a PostGIS `GEOGRAPHY(Point)` with a GiST index (SAD §6.2) for fast radius queries.
- Create `mv_station_hotspot_scores`-equivalent (a real or simulated materialized view) so the dashboard isn't hitting the AI service on every page load (SAD §6.4).

**Expected deliverables**
- Working heatmap + predicted layer + drilldown, demoable with seed data across at least 2 districts.

**Dependencies:** M1 (case data), M2 (jurisdiction scoping).

**Testing requirements**
- Verify hotspot results respect jurisdiction scope (a station user never sees another station's raw hotspot data unless permitted).
- Sanity-check predicted layer against known dense clusters in seed data (does it point where the data says it should?).

---

## MILESTONE 4 — Investigation Intelligence (Day 5)

**Objective:** Build the single most-used screen for investigating officers — the Case Intelligence View — plus the "wow" AI feature that most differentiates this platform: cross-district Similar Case Finder.

**Features to complete:** Case Intelligence View tabs (Overview, People, Evidence & Vehicle, Intelligence, Timeline), Similar Case Finder, Repeat Offender Panel, Evidence & Witness Tracker (SAD §10.5, §13.1).

**Backend tasks**
- Extend Case Detail API to serve People (Accused/Victim/Witness with repeat-offender flags), Evidence & Vehicle tabs.
- Implement `GET /search/similar-cases/{caseId}`.
- Implement `GET /offenders/{id}/history`, `GET /offenders/{id}/associates`.
- Implement the Smart Investigation Timeline data shape: incident → registration → evidence collection → arrest → chargesheet, with delay flags computed from existing delay-signal fields.

**Frontend tasks**
- Build the full tabbed Case Intelligence View (SAD §13.1).
- Build the Similar Case Finder results list — ranked cards with similarity score and a plain-language "why this matches" explanation.
- Build the Repeat Offender Panel: case history, escalation trend, known associates.
- Build the Smart Investigation Timeline component with visual delay flags — this is a named differentiator (SAD §26), prioritize it.
- Build Evidence & Witness Tracker as a checklist view.

**AI tasks**
- Generate sentence embeddings over `BriefFactsText` (domain-tuned transformer or a strong general embedding model) and store in `pgvector`.
- Implement MO Similarity Engine: structured pre-filter (same crime sub-head/district first) + embedding-distance ranking (SAD §18.1.3) — precompute embeddings in a batch job, serve similarity on-demand.
- Implement the Repeat Offender / entity resolution model: rule-based blocking (name/DOB/gender similarity) as the hackathon-feasible version of SAD's supervised classifier.
- Every AI-backed response includes a `top_factors`-style explanation object (SAD §15.3) — non-negotiable for this milestone.

**Database tasks**
- Populate `pgvector` embedding column on the case table (or an embeddings side-table).
- Log every similarity/repeat-offender inference into `ai_model_runs`.

**Expected deliverables**
- A fully working Case Intelligence View demoable end-to-end: open a case → see risk-relevant people, evidence, similar historical cases (ideally cross-district, to prove the platform's core value prop), and a visual timeline with a delay flag.

**Dependencies:** M1 (case data), M3 patterns reused for AI orchestration wiring.

**Testing requirements**
- Verify Similar Case Finder returns sensible top-N results against seed data with a known planted "duplicate MO" pair.
- Verify statewide similarity is only visible to roles with statewide read (SI and above) per SAD §8.3.

---

## MILESTONE 5 — Network & Link Analysis (Day 6, weekend/long session)

**Objective:** Ship the second flagship differentiator — the interactive Criminal Network Graph — proving cases aren't just records but a connected intelligence layer.

**Features to complete:** Interactive Network Graph, Gang Detection View, Link Explanation Panel (SAD §10.4, §26).

**Backend tasks**
- Implement `GET /network/graph?entityId=&depth=` using recursive CTEs over co-accused/shared-victim/shared-MO edges (SAD §2.3 — CTEs at launch, no graph DB needed).
- Implement `GET /network/gangs` (community-detected clusters).
- Implement `GET /network/link-explanation?a=&b=` returning the specific shared attribute (case/address/MO/associate).

**Frontend tasks**
- Integrate Cytoscape.js or Sigma.js for the zoomable, filterable Network Explorer (SAD §26 — first-class, not a static diagram).
- Build the Gang Detection View with a gang profile card (territory, specialization, member list, lifecycle state).
- Build the Link Explanation Panel — click any edge to see *why* two nodes are connected.
- Wire the mini network graph into the Case Intelligence View's Network tab (SAD §13.1 item 5), expandable to the full explorer.

**AI tasks**
- Build the co-accused/shared-victim/MO-similarity graph construction job.
- Apply Louvain community detection for gang/cluster identification (SAD §3.4, §15.2).
- Log each network computation to `ai_model_runs` with model version.

**Database tasks**
- Ensure edge-generating queries (co-accused joins, shared attribute joins) are indexed for interactive-speed traversal at seed-data scale.

**Expected deliverables**
- A working, clickable network graph that expands outward from any case's accused to its connected component, with a gang cluster view and link explanations — this is a top-tier demo moment.

**Dependencies:** M4 (repeat offender/entity resolution feeds network edges).

**Testing requirements**
- Verify graph expansion from a planted test cluster in seed data returns the expected connected component.
- Verify network module respects "own cases" vs. statewide visibility per role (SI sees own-case network; SCRB sees statewide).

---

## MILESTONE 6 — Predictive Intelligence (Day 7)

**Objective:** Complete the AI catalogue with explainable risk scoring, anomaly detection, and forecasting — rounding out every model named in SAD §3.4/§15.2.

**Features to complete:** Risk Scoring, Crime Forecasting, Resource Deployment Recommender (SAD §10.6).

**Backend tasks**
- Implement `GET /cases/{id}/risk-score`, `GET /anomalies?scope=`, `GET /forecast/crime-trend?district=&horizon=`.
- Wire risk score to auto-attach on case update (new evidence/accused/status change) per SAD §13.2's workflow-state description — for hackathon scale, trigger on-demand + cache rather than a live event bus.

**Frontend tasks**
- Add the Risk Scoring card (with SHAP-style factor breakdown) into the Case Intelligence View's Intelligence tab.
- Build Crime Forecasting charts (7/30/90-day) using Recharts/D3.
- Build the Resource Deployment Recommender panel — combine hotspot forecast + officer workload into a simple suggested-patrol list.
- Add anomaly flags into the Alerts panel used across dashboards.

**AI tasks**
- Implement Risk Scorer: gradient-boosted trees (XGBoost/LightGBM) with SHAP explanations (SAD §3.4) — this is the reference implementation of the explainability object from SAD §15.3, keep the JSON shape identical to the SAD's example.
- Implement Anomaly Detector: Isolation Forest or simple statistical control limits per crime sub-head.
- Implement Forecasting Engine: Prophet/SARIMA per district-crime-type series.
- Register each model version with basic evaluation metrics (even a simple accuracy/precision readout) — SAD §15.5's governance principle, lightweight version.

**Database tasks**
- Persist every risk/anomaly/forecast run to `ai_model_runs`.
- Add/refresh a `mv_district_crime_trend`-equivalent view feeding the forecast dashboard cheaply.

**Expected deliverables**
- Every case shows a risk score with a real, factor-level explanation — no bare numbers anywhere in the UI (SAD §15.3 is a hard requirement, treat it as such for judging too).
- District-level forecast chart and a resource deployment suggestion list.

**Dependencies:** M1–M5 (uses case, network, and hotspot data as model inputs).

**Testing requirements**
- Verify SHAP/explanation output is present on 100% of risk-score responses (automate this check — missing explanations should fail CI).
- Sanity-check forecast trend direction against a seed data pattern with a known planted trend.

---

## MILESTONE 7 — AI Crime Intelligence Assistant (Day 8, weekend/long session)

**Objective:** Ship the orchestrator chatbot that ties every prior module together through tool-calling — this is the single feature most likely to make judges say "this is a real platform, not a dashboard."

**Features to complete:** Conversational Assistant with intent parsing, tool routing into existing APIs, grounded response composition, dashboard-chat synchronization, multi-turn context (SAD §15.4).

**Backend/AI tasks**
- Implement intent & entity parsing: LLM parses officer query into structured intent (e.g., `hotspot_query{crimeType=Burglary, district=Mysuru}`).
- Implement tool routing: map parsed intents to the **existing** backend/AI endpoints built in M1–M6 — the Assistant must have no separate data path (SAD §15.4 step 2), it calls the same RBAC/jurisdiction-scoped APIs everything else uses.
- Implement schema-validated tool calls only — the LLM cannot execute arbitrary queries (SAD §21.1 AI-specific safeguard), pre-defined tool endpoints only.
- Implement grounded response composition: answer text must be generated from actual tool-call results, never from the model's own unverified claims.
- Implement server-side multi-turn session context (current jurisdiction focus, last-referenced case/entity).
- Implement `POST /assistant/chat`, streamed via WebSocket if time allows; polling fallback is acceptable for hackathon.

**Frontend tasks**
- Build the persistent floating Assistant icon/panel (SAD §11) available on all screens.
- Build the chat UI with streaming (or fast-polling) responses.
- Wire dashboard auto-navigation: when the Assistant answers a hotspot/case question, the relevant widget updates in the same view (SAD §15.4's "chat and dashboard are the same session" principle) — even a simplified version (e.g., auto-scroll/highlight the matching panel) sells this well.
- If time allows: voice input as a stretch (SAD §26 differentiator) — text-only is an acceptable fallback.

**Database tasks**
- Log every assistant tool call into `ai_model_runs` (or a dedicated assistant log) for auditability.

**Expected deliverables**
- A working assistant that can answer at least 4–5 realistic officer queries end-to-end (e.g., "show hotspots in this district," "find cases similar to this one," "why is crime rising here," "show repeat offenders linked to this case") with the dashboard reacting live.

**Dependencies:** M3–M6 (the Assistant is only as good as the APIs it orchestrates — build this last for a reason).

**Testing requirements**
- Test that the Assistant respects RBAC/jurisdiction (a station-level officer asking a statewide question gets correctly scoped results, not an unscoped LLM guess).
- Test tool-call schema validation rejects malformed/out-of-scope calls.
- Manual script of 5–8 demo questions rehearsed for Demo Day.

---

## MILESTONE 8 — Collaboration, Reports, Notifications, Audit (Day 9)

**Objective:** Complete the remaining named modules that prove procedural rigor — the things a real police department would actually require before trusting this platform.

**Features to complete:** Cross-District Collaboration workflow, Automated/Report Builder, Notification system, Audit logging (SAD §10.7, §10.9, §14, §17, §19, §20).

**Backend tasks**
- Implement `POST /collaboration/requests`, `PATCH /collaboration/requests/{id}/approve` implementing the time-boxed, request-based access model (SAD §14.2–14.3) — not blanket district access.
- Implement `POST /reports/generate`, `GET /reports/{jobId}/status`, `GET /reports/{jobId}/download` as a Celery job producing a PDF (WeasyPrint/ReportLab) with basic KSP-style letterhead formatting.
- Implement notification event publishing (case assigned, collaboration request, intelligence alert) into a Celery task → `notifications` table, jurisdiction-aware fan-out (SAD §17.2).
- Implement append-only `audit_log` writes for auth events, scope-crossing reads, all writes, and AI invocations (SAD §20.1) — enforce no UPDATE/DELETE at the DB permission level if time allows, otherwise application-level enforcement is an acceptable hackathon substitute.

**Frontend tasks**
- Build the Collaboration Requests screen (submit, view pending, approve/decline) for Inspector/SHO roles.
- Build the Report Builder (parameterized: scope, date range, crime type) and a report status/download list.
- Build the in-app Notifications panel (bell icon, unread state).
- Build a read-only Audit Log viewer for Admin/SCRB roles (SAD §10.9 — admins can view, never alter).

**AI tasks**
- None new — reports may pull already-computed risk/hotspot/forecast data into the PDF narrative summary (a short templated text block referencing the top figures counts as the "narrative summary" differentiator from SAD §26, no new model needed).

**Database tasks**
- Confirm `collaboration_requests`, `report_jobs`, `notifications`, `audit_log` tables are fully wired to their respective flows end to end.

**Expected deliverables**
- A demoable cross-district collaboration request → approval → shared thread flow.
- At least one working generated PDF report.
- Visible notifications on a triggering action.
- A queryable audit log entry for a scope-crossing read.

**Dependencies:** M2 (RBAC), M3–M6 (data being reported on/collaborated over).

**Testing requirements**
- Verify a collaboration request only grants access to the specific linked case, not the whole district (SAD §14.3).
- Verify audit log is append-only (attempt an update/delete and confirm it's rejected).
- Verify report generation completes and the download link is scoped to the requester.

---

## MILESTONE 9 — Security Pass, Testing, Deployment, Demo Polish (Day 10, weekend/long session)

**Objective:** Ship a stable, secure-enough, deployed, judge-ready build with a rehearsed demo — the difference between "impressive prototype" and "qualifies for next round."

**Features to complete:** None new — hardening, integration testing, deployment, and demo packaging only.

**Backend tasks**
- Run the full RBAC test matrix from M2 against every module built since (hotspot, network, investigation, predictive, assistant, reports) — this is the highest-leverage security check given the SAD's jurisdiction-first design principle.
- Confirm every AI-backed endpoint returns the explainability object inline (SAD §16.3) — no exceptions.
- Confirm input validation/parameterized queries on all write endpoints (annotations, collaboration requests).
- Add basic rate limiting if time allows (even simple per-IP throttling counts).

**Frontend tasks**
- Cross-role UI walkthrough: log in as each seeded role and confirm sidebar/dashboard/module visibility matches the matrix exactly.
- Fix responsive/field-mode issues on the primary demo screens (map, network graph, case view, assistant).
- Add loading/error states everywhere a network call can fail during the live demo.

**AI tasks**
- Spot-check every model's explanation output for plausibility (no nonsensical `top_factors`).
- Freeze model versions used for the demo (write them down — judges may ask "how do you know this is right").

**Database tasks**
- Finalize and re-run the seed data script so the demo is reproducible on any machine/deploy target.
- Take a backup snapshot of the demo-ready DB state.

**Expected deliverables**
- Deployed build (Docker Compose on a single cloud VM, or equivalent free-tier hosting) reachable via a public URL.
- A rehearsed demo script covering: role-based login switch, hotspot map, case intelligence view + similar case finder, network graph, risk score with explanation, and the AI Assistant tying it together live.
- A one-page architecture summary slide mapping what was built back to the SAD sections (judges reward traceability).

**Dependencies:** All prior milestones.

**Testing requirements**
- Full end-to-end run-through of the demo script, twice, on the actual deployed environment (not just localhost).
- RBAC regression test matrix passes for every role.
- Confirm no unhandled errors/console exceptions on the core demo path.

---

## If You Run Out of Time: Cut in This Order

Protect the differentiators (hotspot, similar-case finder, network graph, explainable risk score, AI Assistant, RBAC) at all costs — they're what separates this from a generic CRUD dashboard. If time runs short, cut in this order first:

1. Voice input on the Assistant (text-only is fine).
2. Automated/scheduled reports — keep manual Report Builder only.
3. Full notification system — keep in-app only, drop email digest.
4. Forecasting charts — keep risk scoring and hotspot prediction, which carry more demo weight.
5. Anomaly detection — fold its output into the Alerts panel using a simpler rule (e.g., statistical threshold) rather than a trained model.

**Never cut:** RBAC/jurisdiction scoping, explainability objects on AI outputs, and the AI Assistant's tool-calling architecture — these three things are what make this a "platform" and not "a few charts," and they're what SAD-literate judges will specifically look for.
