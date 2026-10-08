# Forensiq — Feature Checklist & Audit Log

This is the working checklist used to audit every AI-labelled feature in the platform, fix what was broken, and record how each fix was verified. "Verified" means confirmed with a direct reproduction (a script, a curl call, or a UI test against real data) — not just read from the source and assumed correct.

Legend: ✅ Verified working · ⚠️ Working but with a caveat (see notes) · ⬜ Not yet done

---

## 0. MASTER FIX PLAN — "nothing hardcoded, everything computed from data" (started 2026-10-07)

Rule for this plan: no fabricated numbers, names, alerts, confidences or canned chat answers anywhere. Every figure shown to a user is computed from the database; if data is missing the UI says so.

**WP1 — Data foundation (root causes in the seed loader)**
- [x] Seeder dropped `CriminalProfileID` / `GangID` / `IsRepeatOffender` from `Accused.csv` (string IDs like `CP00038`, `GNG0001`, `True` vs integer columns) → fix loader + backfill live DB (772 records / 138 profiles / 9 gangs)
- [x] `case_status_master` is empty → seed from the CSVs (1 Under Investigation, 2 Charge Sheeted, 3 Closed-Undetected, 4 Closed-False Case, 5 Pending Trial, 6 Disposed-Convicted) and stop hardcoding "status 1/2 = pending, 3 = closed"
- [x] Remove the `criminal_relationships` fabricated seeder (`fix_dataset_and_gangs.py` invents "Gang Syndicate Leader" edges between the first 40 accused)

**WP2 — Models evaluated and trained against the dataset's REAL labels (`CrimeCases_AI.csv`)**
- [x] Risk model: previously trained on 1,000 random rule-labelled rows (97% = recovering my own formula; only ~50% vs real `RiskLabel`) → retrain on real `RiskLabel` with richer DB-available features, cross-validated, honest metrics
- [x] Anomaly detector: 11.7% precision / AUC 0.87 vs real `AnomalyLabel` → improve and report real precision/recall
- [x] Repeat-offender resolution + gang detection evaluated against `CriminalProfileID` / `GangID`
- [x] Reproducible `backend/scripts/evaluate_models.py` (reads the CSV ground truth, prints metrics)
- [x] Remove silent heuristic fallbacks in `intelligence_service` (risk, anomaly, forecast, repeat-offender) and dead "AI Engine" HTTP calls

**WP3 — Predictive module + station command center computed from data**
- [x] `get_predictive_dashboard`: real growth rate, hotspot/warning/squad/backlog numbers, real forecast label, real XAI text (no `or 210`, no `0.048`)
- [x] `get_hotspot_rankings`: real KDE clusters from case coordinates, named from real police stations / crime-type table
- [x] `get_patrol_strategy`: derived from real peak hours, hotspot load, open-case backlog
- [x] `get_early_warnings`: statistical spike detection (recent vs baseline) per crime type / district
- [x] `station_command_service`: remove fake patrol units, fake "Ryan Yadav" alert, `active_warrants = 12`, invented officers-on-duty and workload formulas
- [x] Replace hardcoded `CRIME_HEAD_LABELS` and keyword→category guesses with the real `crime_type` table

**WP4 — Chatbot that answers any question from the database**
- [x] Gemini function-calling agent with read-only, jurisdiction-scoped DB tools (counts/group-bys, case lookup, accused search, repeat offenders, hotspots, anomalies, forecast, gangs, similar cases)
- [x] Both `/assistant/query` and `/predictive/assistant-query` use it; delete canned keyword answers; `recommended_actions` and `supporting_data` come from the run, not constants
- [x] Latency tuned; honest error message on model failure

**WP5 — Remaining backend hardcodes**
- [x] `case_crud` fake risk score `(CaseMasterID*37)%75` → real model
- [x] Collaboration agency recommendation: keyword rules + invented confidences → data/LLM-grounded
- [x] Notifications: event-driven, no invented dates/branding
- [x] Network graph: person identity from `CriminalProfileID`; remove "Karnataka Police State Registry"/"KSP" strings
- [x] Gang endpoint: real communities from co-accused + shared-vehicle + stored links; evaluated vs `GangID`
- [x] Rebrand sweep (KSP/Karnataka strings, `ksp-*` model versions), rename "SHAP" → decision-path attribution, delete dead `mo_similarity/embeddings.py`

**WP6 — Frontend hardcodes**
- [x] Court module: remove `hardcodedCourtCases`
- [x] Hotspot module: remove `mockStations`, `sectorNames`, dummy patrol polyline
- [x] Dashboard/Predictive: remove `|| 12`, `|| 5000`, `|| 86`, `|| 14`, `|| 68.4` fallbacks; show "no data" instead
- [x] Investigation: server-assigned FIR numbers (no `Math.random`), remove `caseId || 101`, `AgeYear || 32`
- [x] District lists from API instead of hardcoded arrays; status labels from API
- [x] Loader text "KSP COMMAND CENTER…"
- [x] `npm run build` clean; pages verified in browser against local backend

**WP7 — Semantic search coverage**
- [ ] Batch embedding (`batchEmbedContents`) + resumable backfill is done, but only 931 of 5,000 cases are embedded (the Gemini free tier allows ~1,000 embeddings a day: run `python scripts/backfill_embeddings.py` daily); new cases are not embedded on creation yet

**WP8 — Verification & delivery**
- [x] Smoke-test suite in repo (`backend/tests/smoke_test.py`), all endpoints + ground-truth checks
- [x] Docs updated (README, this file)
- [x] Committed (no co-author trailer), pushed, Render redeploy reports `dialect: postgresql`, smoke test 51/51 against the live API, Vercel serves the new build (2026-10-08)

---

**Found and fixed while verifying (2026-10-08)**
- [x] FIR registration was fake: the form posted malformed data (hardcoded station id 101, a crime-head *name* in an id field, random FIR number), the API rejected it, and the page then showed a success toast anyway. Rebuilt: stations / crime types / categories from the database, server-assigned numbers, complainant / accused / witnesses / vehicles / property / evidence saved in one transaction, real errors shown, Karnataka coordinate bounds corrected (Bidar and Kalaburagi were being rejected).
- [x] Start-up re-seeded the demo accounts and reset their passwords, roles and active flag on every boot, so administrator changes were undone and the known demo passwords always worked. Now accounts are created only if missing; `SEED_USER_PASSWORD` sets their password; users can change their own password and administrators can reset any.
- [x] The default JWT signing key was a public constant in the source; without `JWT_SECRET_KEY` the server now uses a random per-process key.
- [x] `GET /reports/jobs/{id}/download` required no login (anyone could fetch any dossier by job id); it now needs login and access to the case.
- [x] An external-agency officer with no granted access could read every case ("demo fallback"); now sees nothing until access is granted. Court page, ContextBar and Admin now show the scope the server really applies.
- [x] Hotspot model: bandwidth was clamped to ~11 km and centres were 2 km apart, so the top 25 "hotspots" lay in two districts and counted the same FIRs about four times. Now a cross-validated bandwidth and disjoint hotspots (20+ districts, each FIR in at most one).
- [x] Task delegation rank logic matched usernames and substrings (`"si" in "assistant"`); replaced by a whole-word rank ladder; task status can only be changed by the assignee, the appointer or an administrator.
- [x] Admin: the "appoint officer" form discarded the officer's name and badge, created a random badge number per process (`hash()` is salted), and never applied the chosen station; fake database-size figures replaced by `/admin/system-health`.
- [x] Stored text was HTML-entity-escaped (`Ram&#x27;s`); now stored as typed and escaped on output.
- [x] Performance: shared case-frame and hotspot caching (cleared on any case change), faster KDE evaluation; dashboard summary 6.9 s -> ~1.1 s, predictive dashboard 4.7 s -> ~0.9 s on warm calls.
- [x] Risk score was confusing (label "Medium" next to a number near 0.00, because the number was the chance of High/Severe). The stored score is now a 0-100 risk index that agrees with the level (Low ~12, Medium ~32, High ~54, Severe ~87 on average); the chance of High or Severe is shown separately. Model v5-index (same forest). Tested whether more registration-time features or other algorithms improve accuracy: they do not (51-53%).
- [x] Speed: the login check ran database queries on the server's event loop (freezing other requests) and re-read user, role and permissions on every request; now one query in a worker thread, with cached permissions, scope, `/auth/me` and the heavy read endpoints (dashboard, predictive, hotspots, network, court, reference), idle-only connection pings, gzip, smaller map payload, and task polling every 30 s instead of 5 s.
- [x] Collaboration: requests and grants silently fell back to case 1, agency 1 and officer 1; they now require a real case, external officer and requesting officer. Report PDFs no longer print a made-up 55% risk, "Medium" priority or a canned patrol directive.
- [x] Pinned `scikit-learn` to the version the saved models were trained with.
- [x] Dead-host fallback `catalystappsail.in` in the frontend API client replaced with a same-origin default.

---

## 1. Core Platform

- [x] ✅ JWT authentication (login, refresh, logout)
- [x] ✅ Role-based access control (RBAC) enforced per-endpoint via `verify_permission`
- [x] ✅ Auth bypass removed — a code path that fabricated a synthetic admin user when no valid token was supplied now correctly raises HTTP 401
- [x] ✅ Officer / role management (Admin panel) — `PATCH /admin/users/{id}/role` wired end-to-end, frontend form now actually calls it instead of a no-op
- [x] ✅ Audit trail — fixed a bug where `get_current_user` was a sync function inside an async request path, breaking Python contextvar propagation so the acting user wasn't attached to audit log entries; changed to `async def`
- [x] ✅ Case CRUD (create, view, update, list) with jurisdiction scoping
- [x] ✅ CSV/report export — fixed an N+1 query bug (`selectinload` added for `accused_list` and `evidence_items`)
- [x] ✅ CORS — `allow_origin_regex` extended to include the deployed Vercel domain (was blocking the live frontend)
- [x] ✅ i18n — English + Kannada; filled missing translation keys (`tab_audit`, `btn_request`)

## 2. Risk Scoring

- [x] ✅ RandomForestClassifier trains and saves correctly (`app/ml/models/risk_scoring/train.py`)
- [x] ✅ **Fixed:** inference path had a missing assignment — the model's predicted probabilities were computed but never converted into the `score` variable returned to the API, so every request silently fell back to a rigid two-feature heuristic formula despite the "AI risk scoring" label in the UI
- [x] ✅ **Fixed:** `numpy.float64` return type broke on production Postgres via psycopg2 (`InvalidSchemaName` error) — SQLite tolerated it, Postgres didn't; added explicit `float()` cast
- [x] ✅ Verified via a standalone train/test evaluation script (`eval_risk_model.py`) — 80/20 stratified split, same synthetic data-generation and training procedure as production. Results:

  | | Accuracy | Precision (macro) | Recall (macro) | F1 (macro) |
  |---|---|---|---|---|
  | Fallback heuristic (previously live in prod) | 48.00% | 28.57% | 43.32% | 34.43% |
  | RandomForest (fixed) | 97.00% | 96.93% | 95.17% | 96.00% |

- [x] ⚠️ Local explainability (`explain.py`) works and returns per-feature contribution percentages, but it's a custom hand-written `TreeExplainer` using decision-path analysis, **not** the real `shap` library. Code comments/docstrings and the old README called it "SHAP" — that label is inaccurate and should not be repeated in academic writeups without this caveat.
- [ ] ⬜ Not done: k-fold cross-validation / hyperparameter tuning (currently a single fixed train/test split)
- [ ] ⬜ Not done: validation against real (non-synthetic) case outcomes

## 3. Anomaly Detection

- [x] ✅ IsolationForest model trains and runs
- [x] ✅ **Fixed:** result dictionary was computed but never assigned to the variable returned by the endpoint (`result = {"model_version": ..., "findings": findings}` was missing), so the endpoint returned incomplete/empty output despite the model executing without error
- [x] ✅ **Fixed:** missing `timedelta` import that would have raised a `NameError` on certain code paths
- [x] ⚠️ Confirmed to execute correctly end-to-end; no ground-truth "is this actually anomalous" labels exist in the dataset, so accuracy/precision cannot be scored — only correct execution is verified

## 4. Hotspot Mapping

- [x] ✅ KDE-based hotspot computation over case coordinates (PostGIS)
- [x] ✅ **Fixed:** same result-dictionary assignment bug as anomaly detection (`result = {"model_version": "phase4-kde-hotspot-v1", "hotspots": hotspots}` was missing)
- [x] ✅ Verified hotspot endpoint returns non-empty, plausible clusters against seeded case data

## 5. Co-offending Network Analysis

- [x] ✅ NetworkX graph built from accused co-occurrence across cases
- [x] ✅ **Fixed (found 2026-10-07):** the live `get_gang_communities` never called the greedy-modularity code — it POSTed to a non-existent "AI Engine" service, swallowed the failure, and fell back to plain connected-components with a hardcoded 0.88 confidence. `networkx` was also missing from `requirements.txt`, so `community_detection.py` could not even import. Now calls `detect_communities` (greedy modularity + PageRank) directly and `networkx` is a declared dependency; verified on synthetic edges (two planted clusters recovered).
- [ ] ⚠️ `/network/gangs` returns 0 communities on the live data because the `criminal_relationships` table is empty and no accused has a `PersonID`. The code works; the seed data has no inputs for it. (The `/network/graph` view builds from a different, name-based path and does show 1,660 nodes / 2,194 edges.)
- [x] ✅ Deduplicated redundant imports in `network_service.py` / `network.py`; removed a dead `witnesses` query and unused `Witness` import
- [ ] Note: the original README claimed "Louvain Community Detection" — this was never true; the code has always used NetworkX's built-in greedy-modularity algorithm. Corrected in the new README.

## 6. Semantic Case Search

- [x] ✅ **Fixed (major):** the embedding function did not call any real embedding model — it hashed case text with SHA-256 and reshaped the hash bytes into a vector, so "similar case" results were essentially random with respect to actual meaning
- [x] ✅ Replaced with real Google Gemini embeddings (`gemini-embedding-001`, truncated to 768 dims to match the existing `pgvector` column)
- [x] ✅ **Fixed:** `pgvector` Python package was never in `requirements.txt`; a silent `try/except ImportError` fallback quietly redefined the vector column type as plain `JSON`, which passed `operator does not exist: json <=> unknown` errors under real cosine-similarity queries. Added the dependency and migrated the live column from `JSON` to `vector(768)` via `ALTER COLUMN ... TYPE ... USING`
- [x] ⚠️ A second, unused embedding path exists at `app/ml/models/mo_similarity/embeddings.py` (sentence-transformers, loads a local model directory if present). It is **dead code** — nothing imports or calls it. Left in place, documented, not wired to any route. Candidate for deletion in a future cleanup.

## 7. Conversational Assistant (Predictive Intelligence Chat)

- [x] ✅ **Fixed (2026-10-07):** `/assistant/query` was silently serving a canned "Karnataka Police Crime Records Database analysis" template on every call, because Gemini's 20s timeout was too short for its larger prompt and `except Exception: result = None` hid the failure. Timeout raised to 90s, transient 429/5xx now retried with backoff, failures are logged, and the fallback is now an honest "AI model unavailable — plain record lookup" message instead of a fake analysis. Verified: returns a real Gemini answer matching the database (Belagavi 296 FIRs, 1,412 high-risk). Latency is 20–30s because `gemini-3.6-flash` is slow on large prompts.
- [x] ✅ Gemini API key moved from the URL query string to the `x-goog-api-key` header — it was being written in plaintext to the HTTP request logs (local and Render).
- [x] ✅ `/health` now reports the real database dialect and returns `"status": "degraded"` when the SQLite fallback is active (previously it reported "healthy" while silently running on a throwaway SQLite file).

- [x] ✅ **Fixed (major):** previously keyword-matched against a fixed set of hardcoded strings containing fabricated statistics (e.g., a hardcoded "210 repeat offenders" figure not derived from any real query)
- [x] ✅ **Fixed:** a separate dead `httpx` call to a non-existent external "AI Engine" service was removed
- [x] ✅ Replaced with real Gemini (`gemini-3.6-flash`) calls, grounded in genuine aggregate SQL queries (real district counts, real high-risk counts, real repeat-offender counts) built before the LLM call
- [x] ✅ Manually verified that numeric claims in assistant responses trace back to a real query, not a hardcoded string

## 8. Data Layer

- [x] ✅ All primary keys migrated to `BigInteger` (with SQLite variant fallback) across 11 models
- [x] ✅ Missing `Active` column added to `user_jurisdiction`
- [x] ✅ Removed hardcoded/leaked database credentials from `config.py` and deleted `test_conn.py` / `test_ip.py`, which contained a plaintext DB password
- [x] ✅ `ALTER TABLE` migration block moved to run after `Base.metadata.create_all()` instead of before (was silently no-op-ing on fresh databases)

## 9. Deployment

- [x] ✅ Frontend deployed to Vercel
- [x] ✅ Backend deployed to Render (Docker, Oregon region)
- [x] ✅ Database on Supabase (Postgres 17 + pgvector + PostGIS, Mumbai / ap-south-1)
- [x] ✅ Vercel environment variable (`VITE_API_BASE_URL`) fixed — was silently not being picked up from the committed `.env.production` file because Vercel's build didn't substitute it; resolved by setting it directly as a Vercel dashboard Config variable
- [ ] ⬜ **Not done (deferred):** migrate the Render backend from Oregon to a Singapore region to reduce cross-region latency to the Mumbai Supabase database (~3s/request currently due to Oregon↔Mumbai round trip). Plan is ready: new Render service in Singapore with the same 4 env vars (`DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `LLM_API_KEY`), then repoint `VITE_API_BASE_URL` and retire the Oregon service.

## 10. Known Remaining Issues (not yet fixed)

- [ ] ⬜ **Predictive Intelligence module is largely hardcoded, not computed** (found 2026-10-07, `app/services/predictive_service.py`): `get_hotspot_rankings` returns 8 fixed place names whose counts come from index arithmetic (`14 + (idx*3) % 11`) and never reads the case data; `get_patrol_strategy` returns fixed unit counts and fixed "350 Cyber FIRs / 1,480 night-shift FIRs" claims; `get_early_warnings` returns 4 canned alerts including invented suspect names and percentages ("+18%", "+24%"); the dashboard hardcodes `growth_rate = 0.048` (commented "Calculated"), `high_risk_hotspot_count: 8`, `patrol_squads_recommended: 14`, `early_warnings_active: 5`, `backlog_workload_index: 68.4`, and falls back to a fake "210 repeat offenders" when the real count is 0. Only the dashboard's per-hour/day/month counts and the `/hotspot` KDE endpoint are genuinely data-derived. Needs a rewrite to compute these from the database.
- [ ] ⬜ **Seed data has no repeat-offender signal:** `accused.IsRepeatOffender` is 0 for all 6,483 rows, `accused.PersonID` is NULL for all rows, and `criminal_relationships` is empty. Anything depending on those (repeat-offender counts, gang detection) shows zero.
- [ ] ⬜ **Semantic search covers 31 of 5,000 cases:** only 31 rows exist in `case_embedding`. Running the full backfill means ~5,000 Gemini embedding calls, which exceeds typical free-tier daily quotas.
- [ ] ⬜ Duplicate `CaseNo` values across different cases in seed data (e.g. "202600001" on cases 23 and 24).

- [ ] ⬜ Loading spinner on the frontend still displays leftover branding text: "KSP COMMAND CENTER SECURITY TELEMETRY..." — cosmetic, low priority
- [ ] ⬜ `app/ml/models/mo_similarity/embeddings.py` (dead sentence-transformers code path) not yet removed
- [ ] ⬜ "SHAP" naming in `explain.py` / `intelligence.py` docstrings is inaccurate (it's a custom explainer, not the `shap` library) — not yet renamed
- [ ] ⬜ Render Oregon→Singapore migration (see §9)

---

*Last updated as part of the pre-PBL-submission audit. Every "Fixed" item above was confirmed with a direct reproduction against the running application or a standalone script — not assumed from reading the code.*
