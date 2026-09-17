# 🛡️ KSP Crime Intelligence & Investigation Platform
### *AI-Powered Predictive Policing & Criminal Network Analytics for Karnataka State Police*

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![AI Engine](https://img.shields.io/badge/AI_Engine-Scikit--Learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![Hackathon](https://img.shields.io/badge/Datathon-2026_Submission-blueviolet?style=for-the-badge)](https://github.com/Madhesh-J007/Datathon-2026)

---

## 🌐 Live Production Deployments

| Component | Host Platform | Production Access URL |
| :--- | :--- | :--- |
| **🎨 Enterprise Frontend Client** | Zoho Catalyst Slate | [https://ksp-frontend-cvrhtldi.onslate.in/](https://ksp-frontend-cvrhtldi.onslate.in/) |
| **⚡ Backend Microservice API** | Zoho Catalyst AppSail (Docker Container) | [https://ksp-docker-backend-50044331349.development.catalystappsail.in/](https://ksp-docker-backend-50044331349.development.catalystappsail.in/) |
| **📖 Interactive API Documentation** | Swagger UI (OAuth2 Authorize Enabled) | [https://ksp-docker-backend-50044331349.development.catalystappsail.in/docs](https://ksp-docker-backend-50044331349.development.catalystappsail.in/docs) |

---

## 🔑 Preset Demo Login Credentials

For testing and hackathon evaluation, use any of the following pre-configured officer accounts:

| Role / Jurisdiction Scope | Username | Password | Rank & Title |
| :--- | :--- | :--- | :--- |
| **👑 System Admin** | `ksp_admin` | `change_me` | System Administrator |
| **⭐ DGP (Statewide Command)** | `Bharathvaj` | `change_me` | DGP — Director General of Police |
| **🎖️ SP (District Officer)** | `ramesh` | `change_me` | SP — Superintendent of Police |
| **🛡️ DySP Officer** | `dysp_officer` | `change_me` | DySP — Deputy Superintendent of Police |
| **👮 Police Inspector (PI)** | `pi_officer` | `change_me` | PI — Police Inspector |
| **🚔 Sub-Inspector (SHO)** | `sho_officer` | `change_me` | PSI — Sub Inspector of Police |
| **📋 Assistant Sub Inspector** | `constable_officer` | `change_me` | ASI — Assistant Sub Inspector |
| **🚓 Police Constable** | `suda` | `change_me` | PC — Police Constable |
| **🔍 External Agency (CBI)** | `cbi_sp_verma` | `cbi@password2026` | SP — Central Bureau of Investigation |
| **🔬 External Agency (FSL)** | `fsl_dna_sunita` | `fsl@password2026` | FSL — Forensic Science Specialist |
| **⚖️ External Agency (ED)** | `ed_jd_hegde` | `ed@password2026` | JD — Enforcement Directorate |

---

## 📋 Executive Overview

The **Karnataka State Police (KSP) Crime Intelligence & Investigation Platform** is an enterprise-grade, end-to-end AI system designed to transform raw historical crime registers and FIR telemetry into actionable, real-time tactical intelligence.

Developed for law enforcement officers, station house officers (SHOs), district superintendents, and senior command staff, the platform unifies:
- **Real-Time Predictive Policing**: Automated risk scoring and statistical anomaly detection on incoming case briefs.
- **Geospatial Hotspot Analytics**: High-density crime corridor detection with KDE heatmaps and tactical patrol routing.
- **Organized Syndicate & Gang Analytics**: Graph-based network analysis for detecting hidden co-offending linkages.
- **Explainable AI (XAI)**: SHAP-driven local feature attribution explaining exact model decision criteria to investigating officers.

---

## 🔥 Key System Features

### 1. 🛡️ AI Risk Assessment & Explainability (XAI)
- **Calibrated Random Forest Risk Engine**: Evaluates crime gravity, time delay, co-accused count, and modus operandi.
- **SHAP Feature Attribution**: Generates human-readable local feature breakdowns detailing positive/negative severity contributions.

### 2. 🗺️ Spatial Hotspot Detection & GIS Patrol Strategy
- **Gaussian Kernel Density Estimation (KDE)**: Clusters latitude/longitude incident telemetry into actionable high-risk zones.
- **Tactical Patrol Routing**: Recommends peak-hour station beat deployments based on temporal crime probability spikes.

### 3. 🕸️ Criminal Network & Syndicate Graph Analytics
- **Graph Centrality & Community Detection**: Analyzes co-offending ties using NetworkX algorithms (Degree Centrality, Betweenness, Louvain Community Detection).
- **Gang Linkage Resolution**: Uncovers hidden cross-precinct syndicate ties across accused individuals.

### 4. 🔎 Modus Operandi Similarity Search
- **Vector Embedding Matching**: Utilizes `pgvector` and sentence embeddings to perform instant similarity searches across thousands of historical FIR briefs.

### 5. 🚨 Mission-Critical Anomaly Detection
- **Isolation Forest Outlier Engine**: Identifies unusual reporting delays, abnormal accused counts, and statistical anomalies requiring senior officer review.

### 6. 📊 Executive Command Dashboard & Automated Dossier Reports
- **Multi-Jurisdictional Scope**: Hierarchical drill-downs for Statewide Executive, District Division, and Police Station Precinct levels.
- **Executive PDF Report Compiler**: Generates downloadable, courtroom-ready intelligence dossier reports.

---

## 🏗️ System Architecture & Data Flow

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  Statewide FIR Logs    │      │  PostgreSQL 15 DB      │      │  FastAPI AI Engine     │
│  & Incident Telemetry  │ ───► │  + PostGIS + pgvector  │ ───► │  scikit-learn / ML     │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
                                                                            │
                                                                            ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  React Enterprise      │ ◄─── │  REST API Endpoints    │ ◄─── │  Inference & Risk      │
│  Command Dashboard     │      │  FastAPI + OAuth2 JWT  │      │  Pipeline Models       │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technologies & Frameworks |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, Leaflet GIS |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy ORM, Uvicorn, OAuth2 + JWT Auth |
| **Database** | PostgreSQL 15, PostGIS (Geospatial Extensions), `pgvector` (Vector Embeddings) |
| **AI / ML Pipeline** | Scikit-Learn (Random Forest, Isolation Forest, Ridge Regressor, KDE), NetworkX, Sentence Transformers, SHAP |
| **Deployment** | Docker Custom Runtime, Zoho Catalyst AppSail (Backend), Zoho Catalyst Slate (Frontend) |

---

## 📂 Repository Structure

```
c:/Project/KSP/Datathon-2026/
├── backend/                       # Core FastAPI Backend & AI Inference Engine
│   ├── app/
│   │   ├── api/v1/                # REST API Endpoints (Auth, Cases, Intelligence, Hotspot, Network, Reports)
│   │   ├── core/                  # Security, Config, JWT Dependencies, Permissions
│   │   ├── crud/                  # SQLAlchemy Database Access Queries
│   │   ├── db/                    # Session Manager & Database Seeder
│   │   ├── middleware/            # Row-Level Jurisdiction & Audit Log Listeners
│   │   ├── ml/                    # Machine Learning Models & Saved Inference Artifacts
│   │   │   ├── models/            # Risk Scoring, Anomaly, Hotspot, Forecasting, Network Models
│   │   │   └── saved_models/      # Production Model Binary Artifacts (.joblib)
│   │   ├── models/                # SQLAlchemy Database Models (CaseMaster, Accused, Witness, Evidence, etc.)
│   │   ├── schemas/               # Pydantic Request/Response Validation Schemas
│   │   └── services/              # Business Logic Services
│   ├── Dockerfile                 # Custom Production Docker Container Spec
│   ├── app-config.json            # Catalyst AppSail Service Config
│   └── requirements.txt           # Python Package Dependencies
├── frontend/                      # Web Client (React + TypeScript + Vite)
│   ├── src/
│   │   ├── app/                   # Providers (Auth, Language Context)
│   │   ├── components/            # Reusable UI Cards, Tables, Navigation Bar, Modals
│   │   ├── modules/               # Enterprise Dashboard, Hotspots, Network Graph, Predictive, Reports
│   │   └── services/              # API Client & Axios Interceptors
│   ├── .env.production            # Production Environment API Binding
│   ├── vite.config.ts             # Vite Bundler Config
│   └── package.json               # NPM Dependencies & Scripts
├── database/                      # DB Seeds and SQL Migrations
├── docs/                          # Architecture Documents and Implementation Roadmaps
├── catalyst.json                  # Zoho Catalyst Project Manifest
└── README.md                      # Project Documentation
```

---

## 💻 Getting Started (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/Madhesh-J007/Datathon-2026.git
cd Datathon-2026
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- Backend API will run at `http://localhost:8000/api/v1`
- Interactive Swagger Docs: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
- Frontend Web App will run at `http://localhost:5173`

---

## 🏆 Hackathon Context

This project was developed for **Datathon 2026** as a submission for the Law Enforcement & AI Intelligence track. 

- **Target Organization**: Karnataka State Police (KSP)
- **Deployment Status**: Production Deployed & Fully Operational
- **License**: Built for Datathon 2026 Public Evaluation
