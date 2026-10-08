# Forensiq — AI Crime Intelligence Platform

*A full-stack crime intelligence platform for case triage, risk scoring, anomaly detection, hotspot mapping, co-offending network analysis and a data-grounded investigator assistant.*

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Gemini](https://img.shields.io/badge/LLM-Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![scikit-learn](https://img.shields.io/badge/ML-Scikit--Learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)

---

## Live Deployment

| Component | Host | URL |
| :--- | :--- | :--- |
| Frontend | Vercel | https://forensiq-black.vercel.app |
| Backend API | Render (Oregon) | https://forensiq-g12e.onrender.com/api/v1 |
| API Docs (Swagger) | Render | https://forensiq-g12e.onrender.com/docs |
| Database | Supabase (PostgreSQL 17 + pgvector + PostGIS, Mumbai) | private |

> Render's free tier puts the API to sleep when idle, so the first request after a quiet spell can take up to a minute (the login page says so). Supabase's free tier pauses a project after about a week without traffic; `GET /health` reports `"status": "degraded"` and the database dialect if the API has fallen back to SQLite, so check it before trusting the live site.

---

## What it does

Forensiq works on First Information Report (FIR) records. Everything on every screen is computed from the database at request time; where the data cannot support a figure, the screen says so instead of showing a placeholder.

| Area | What you get |
| :--- | :--- |
| **Command Center** | Situation briefing, KPIs, alerts, recommended actions and charts for the state, a district or a station, computed over every case in scope (not a sample). |
| **Case registry & FIR registration** | Server-side filtered case list; a registration form that stores the FIR together with its complainant (victim), accused, witnesses, vehicles, stolen property and an evidence file in one transaction; the server assigns the case number, registration date, status, registering officer and risk score. Case detail has risk explanation, people, evidence, network graph, chronology (built from dates, audit trail, assignments and notes), similar cases, and status / priority / journal actions. |
| **Risk scoring** | RandomForest trained on the dataset's own `RiskLabel` (Low / Medium / High / Severe). Score = estimated probability of High or Severe; every score has a per-feature explanation (decision-path attribution, not SHAP). |
| **Anomaly detection** | Robust modified z-score (median / MAD, cutoff 3.5) over reporting delay; each flag carries its z-score. |
| **Repeat offenders & networks** | Recorded criminal profiles, a gradient-boosting record-linkage model for probable matches, and gang networks found by greedy-modularity community detection over co-accused, shared-vehicle, home-district and stored links. |
| **Hotspots** | Kernel density estimation with a cross-validated bandwidth; hotspots are disjoint (no FIR counted twice) and each carries its counts, High/Severe lift over the state average, peak hours and top crimes. Map filters (districts, stations, crime types) are read from the database. |
| **Predictive intelligence** | Ridge-regression 30-day forecast with a backtest, Poisson spike tests (Bonferroni-corrected) for early warnings, BNSS 187 statutory-window overdue tracking, and a rule-based patrol plan whose rule is printed with the result. |
| **Court monitoring** | Every charge-sheeted / pending-trial / convicted FIR, with hearing details (bench, prosecutor, next date, orders) that authorised officers record. |
| **Semantic search** | Gemini `gemini-embedding-001` (768-d) narratives in pgvector, cosine search. Coverage is shown on screen. |
| **Assistant** | A tool-calling agent: the model queries jurisdiction-scoped database tools (counts, case lookup, hotspots, anomalies, forecasts, networks, patrol plans, similar cases, PDF dossiers) and answers from the results. It falls back through a chain of models when one is out of quota, and says so honestly when none is available. |
| **Administration** | Appoint officers (officer record + account + posting), change roles, deactivate accounts, reset passwords, view the permissions each role grants and the case visibility each account really has, and a live system-health view (tables, model versions, scoring coverage, activity). |
| **Inter-agency vault, task delegation, reports** | Access requests and grants for external agencies; rank-aware task appointment with a timeline; PDF / CSV / XLS / DOCX exports. |

---

## Honest model results

Full numbers are in [`docs/MODEL_EVALUATION.md`](./docs/MODEL_EVALUATION.md) (regenerate with `python scripts/evaluate_models.py`).

- **Risk model:** 5-fold cross-validated accuracy **53.6%** on four classes, against **48.1%** for always guessing the most common class; ROC-AUC for "High or Severe" **0.895**. It is useful for ranking cases, weak as a four-way classifier. Scores stored for the seeded cases come from a model trained on those same cases, so they are in-sample; scores for newly registered FIRs are genuinely out-of-sample.
- **Earlier claims retracted:** an older version reported ~97% accuracy; that model was recovering the formula the original fork used to generate its risk column, not predicting the dataset's labels.
- **Hotspots:** the dataset's coordinates cluster within about 3 km of each town, so hotspots resolve at town level, not street level.
- **Gang detection:** the district-link weight was tuned against the dataset's hidden gang labels, so its reported agreement with them is optimistic.

---

## Data notes

- The seeded data is synthetic. 228 FIRs carry registration dates after today; they are excluded from analytics ("registered up to" dates are shown on screen).
- Court names, patrol rosters, officer duty status and warrant records do not exist in the data, so those features were removed rather than invented. Courts appear by id.
- `GravityOffenceID` 1 is treated as the heinous class (90-day investigation window under BNSS 187) and 2 as the rest; case-category names are absent, so ids are shown.
- Semantic search covers only the FIRs embedded so far (the Gemini free tier allows about 1,000 embeddings a day); `python scripts/backfill_embeddings.py` continues where it stopped.

---

## Security notes

- Access is enforced on the server from the role's permissions; the UI only mirrors it. External-agency officers see only cases an administrator has shared with them (none by default).
- Demo accounts are created **only if missing** and are never reset on restart. Set `SEED_USER_PASSWORD` before the first start to choose their password, change yours from the avatar menu, and rotate any account whose password is known. An administrator can reset any password from **Admin → Accounts**.
- Set `JWT_SECRET_KEY`. Without it the server signs tokens with a random per-process key (safe, but everyone is logged out on each restart).
- PDF dossiers require login and access to the case; text stored from forms is sanitised for markup characters but otherwise kept as typed.

---

## Architecture

```
React 18 + TypeScript (Vercel)
        │  HTTPS / REST
        ▼
FastAPI backend (Render, Docker)
        │
        ├──► PostgreSQL 17 + pgvector + PostGIS (Supabase)
        └──► Google Gemini API (assistant + embeddings)
```

## Repository structure

```
Forensiq/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST endpoints
│   │   ├── services/           # analytics, assistant (+tools), predictive, hotspot, network, scope, rank, cache ...
│   │   ├── ml/                 # features, risk scoring, anomaly, hotspot, repeat-offender, network, forecasting
│   │   ├── db/                 # seeding, data repair, migrations, bulk updates
│   │   └── models/ schemas/ core/ middleware/
│   ├── scripts/                # train_models, evaluate_models, evaluate_assistant, sync_reference_data, backfill_embeddings
│   ├── tests/smoke_test.py     # 53 end-to-end checks against a running server
│   └── requirements.txt, Dockerfile
├── frontend/src/               # modules (dashboard, investigation, hotspot, predictive, court, admin ...), services, components
├── docs/MODEL_EVALUATION.md    # generated model report
├── FEATURE_CHECKLIST.md        # audit log and verified status
└── PROJECT_DOCUMENTATION.md
```

## Getting started (local)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
set -a && source .env && set +a                       # config is read from real environment variables
uvicorn app.main:app --port 8000
```

Environment: `DATABASE_URL`, `JWT_SECRET_KEY`, `LLM_API_KEY` (Gemini), optional `LLM_MODELS` (comma-separated fallback chain), optional `SEED_USER_PASSWORD`.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 ; set VITE_API_BASE_URL in .env.development
```

Useful scripts (run from `backend/`):

```bash
python scripts/train_models.py        # retrain risk + linkage models from the seed CSVs
python scripts/evaluate_models.py     # regenerate docs/MODEL_EVALUATION.md
python tests/smoke_test.py            # add a base URL to test a deployment; --llm also exercises the chatbot
```

---

## Status

Developed as a Project-Based Learning (PBL) project for the Machine Learning course (CS3505) by Bharathvaj S and Adhithyan R. [`FEATURE_CHECKLIST.md`](./FEATURE_CHECKLIST.md) records what was audited, fixed and verified.
