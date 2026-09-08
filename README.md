# FLOWSIGHT — Financial Forensic Intelligence & Graph Analytics

> **See the flow. Detect the pattern. Stop the crime.**

FLOWSIGHT is a financial crime intelligence platform that surfaces fraud patterns hiding across many transactions, accounts, and time. It turns raw payment graphs — UPI/IMPS/NEFT/RTGS traffic between 230 accounts over 90 days — into explainable alerts, network investigations, flow timelines, and SAR-style reports that an analyst can trace back to individual transactions.

Live demo: **[https://flowsight-vl0m.onrender.com](https://flowsight-vl0m.onrender.com)** (no sign-up — one-click Analyst and Admin demo access).

---

## Table of Contents

- [Why it exists](#why-it-exists)
- [Key features](#key-features)
- [Signature screens](#signature-screens)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [How detection works](#how-detection-works)
- [Local setup](#local-setup)
- [Demo access](#demo-access)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [API overview](#api-overview)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Credits](#credits)

---

## Why it exists

A single suspicious transfer, looked at in isolation, rarely looks suspicious. Money laundering, layering, and structuring only become obvious once you can see the **pattern across time and accounts** — money that loops back to its origin, one account fanning out to dozens of smurfs, signals hidden in long call chains.

FLOWSIGHT detects those patterns directly on the transaction graph: synthetic data → graph-based detection engine → FastAPI → React investigator console → evidence-grounded AI investigation and auto-generated SAR/STR-style reports.

## Key features

- **Graph-based pattern detection** — five detectors that flag:
  - **Circular flow** — money returns to its origin through a multi-hop loop within a short window (round-tripping).
  - **Fan-out** — one account rapidly disperses funds to many distinct counterparties (layering).
  - **Fan-in** — many accounts funnel funds into a single account (smurfing / collection).
  - **Behavioral deviation** — account activity spikes far above its own 60-day baseline in count and volume.
  - **Rapid movement / pass-through** — a mule forwards ≥85% of a large inflow within hours of receiving it.
- **Risk scoring & clustering** — findings are combined into risk-scored clusters (0–100) and fed into alerts and investigation dossiers with cited transaction IDs.
- **Configurable detection rules** — admins enable/disable pattern rules, tune sensitivity and thresholds; changing a rule re-runs detection and refreshes alerts/investigations.
- **Network Explorer** — a visual transaction graph of entities and money flows, with a suspicious-only mode.
- **Flow Timeline** — day-by-day replay of a network's formation (volume, transaction count, active accounts, and the individual events per day).
- **AI Investigator (evidence-grounded, not a chatbot)** — answers investigative questions deterministically, citing actual transactions from the dossier. No black-box generation.
- **Auto-generated SAR-style reports** — executive summary, network overview, key evidence, transaction paths, risk assessment, and recommended action, ready for statutory filing workflows.
- **Admin Console** — Detection Rules, Users & Roles, Audit Logs (every state change is audited), and System Health.
- **Investigation workflow** — dossier-driven triage with status, assignment, appended findings, and risk breakdown per pattern.

## Signature screens

- **Landing Page** — a forensic "scanner terminal" hero, live telemetry counters, an animated incident feed, and an interactive network-graph preview. Includes the quick one-click demo sign-in.
- **Network Explorer** (`/analyst/network-explorer`) — interactive entity/transaction graph with risk-coded nodes, click-through to entity profiles, and a suspicious-only filter.
- **Investigation View** (`/analyst/investigations/:id`) — the investigation dossier: summary, accounts in scope, involved transactions, evidence list with transaction IDs, risk breakdown by pattern, findings, and AI Investigator / report actions.
- **Flow Timeline** (`/analyst/flow-timeline`) — cumulative volume/txns/active-accounts replay over the network's active window, with daily event transactions.

## Tech stack

**Frontend** (`frontend/`)

- React 19
- Vite 7
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- React Router 7
- Oxlint (linting)
- Custom SVG graph rendering (no external graph library)

**Backend** (`backend/`)

- FastAPI 0.115
- Uvicorn 0.35
- SQLAlchemy 2.0 + SQLite (WAL mode)
- NetworkX 3.6 (graph + detection)
- Pandas 3.0 (behavioral deviation / baseline stats)
- Tested with Python 3.14

**No LLM/API keys are used.** The "AI Investigator" is a deterministic, rule-based forensic Q&A layer over the persisted dossier — so every claim cites real records instead of being generated.

## Architecture

```
synthetic data generator (generate_data.py)
        │  data/accounts.json + data/transactions.json (committed)
        ▼
detection engine (detection.py + app/engine.py)
   NetworkX MultiDiGraph → 5 detectors → findings → risk-weighted clusters
        │
        ▼
FastAPI (app/main.py) ── SQLite via SQLAlchemy (flowsight.db)
   /api/overview · /api/network · /api/alerts · /api/accounts
   /api/investigations · /api/reports · /api/admin/* · /api/ai-investigator
        │
        ▼
React frontend (Vite)
   Public → Analyst console → Admin console → AI Investigator → SAR reports
```

The backend seeds itself on first boot: it reads `backend/data/*.json`, creates the SQLite schema, seeds rules + demo users, and runs the detection engine to populate alerts and investigation dossiers. The frontend talks to FastAPI over `/api/*`.

## How detection works

The engine loads the full ledger into a `NetworkX.MultiDiGraph` and runs five independent detectors:

1. **Circular flow** — a time-bounded, timestamp-ordered path search finds money-returning cycles (≥ ₹1L per edge, closes within 72h).
2. **Fan-out / Fan-in** — sliding-window batch detection for one account dispersing to / receiving from ≥10 distinct accounts within hours.
3. **Behavioral deviation** — pandas-based daily aggregation builds a 60-day baseline per account and flags z-score spikes over absolute floors (count and volume).
4. **Rapid movement** — for each account, checks whether a large inflow (≥ ₹5L) is forwarded at ≥85% within ~2 hours, without exceeding the actual inflow.

Findings are combined into clusters with risk-weighted scores, ranked, and stored as alerts + investigations. Admin rule edits are applied by monkeypatching detector parameters and re-running the engine (`app/engine.py`), then refreshing alerts and dossiers.

## Local setup

Requirements: **Python 3.10+** and **Node 18+**.

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional — regenerate the synthetic dataset from scratch (data/ is already committed):
python generate_data.py

# Start the API (auto-creates and seeds backend/flowsight.db on first boot):
uvicorn app.main:app --reload
```

The API runs at **http://localhost:8000**. Interactive docs: http://localhost:8000/docs.

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install

# Point the frontend at the backend (see Environment variables below):
echo "VITE_API_URL=http://localhost:8000" > .env

npm run dev
```

The dev server runs at **http://localhost:5173**. Vite also proxies `/api` → `127.0.0.1:8000`, so the app works even without `.env`.

> **Run both servers at the same time** — the frontend has no data without the backend.

### Seeding notes

- The SQLite DB (`backend/flowsight.db`) is created and seeded automatically on first boot from `backend/data/*.json` — no manual migration step.
- Re-running `python generate_data.py` regenerates only the JSON corpus; delete `backend/flowsight.db` afterwards so the API reseeds from the new files.

## Demo access

There is **no real authentication system**. The login screen offers two one-click entries:

- **Analyst Demo** → `/analyst/overview` — A. Sharma (L2 FIU Officer) forensic console.
- **Admin Demo** → `/admin/overview` — Risk Director sandbox.

## Environment variables

| Where | Variable | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| Frontend (`frontend/.env`) | `VITE_API_URL` | No | `""` (same-origin) | Base URL of the FastAPI backend. Set to `http://localhost:8000` for local dev. In the single-URL Render deploy the frontend is served by FastAPI, so it's not needed. |
| Backend | — | None | — | No environment variables are required. The DB path and data directory are fixed to `backend/` subfolders. |

There are **no API keys anywhere** — the AI Investigator is fully deterministic.

## Project structure

```
flowsight/
├── backend/
│   ├── app/                     # FastAPI application package
│   │   ├── main.py              # all REST endpoints + static frontend serving
│   │   ├── seed.py              # DB seeding + detection refresh on rule edits
│   │   ├── engine.py            # rule-configurable detection engine wrapper
│   │   ├── database.py          # SQLAlchemy engine + SQLite (WAL)
│   │   └── models.py            # accounts, transactions, alerts, investigations,
│   │                            # detection_rules, audit_logs, users
│   ├── detection.py             # Step-1 detection engine (NetworkX + pandas)
│   ├── generate_data.py         # synthetic Indian payments corpus generator
│   ├── test_detection.py        # detection engine tests
│   └── data/                    # committed generated corpus (accounts.json,
│                                # transactions.json, embedded_patterns.json)
├── frontend/
│   ├── src/
│   │   ├── pages/public/        # Landing, NetworkGraphPublic, Login
│   │   ├── pages/analyst/       # Overview, NetworkExplorer, AlertsTriage,
│   │   │                        # InvestigationView, FlowTimeline, EntityProfile,
│   │   │                        # AiInvestigator, InvestigationReports
│   │   ├── pages/admin/         # Overview, Users, Rules, AuditLogs, Health
│   │   ├── components/          # shared UI (layout, badges, palette, graph)
│   │   ├── layouts/             # Public / Analyst / Admin shells
│   │   └── lib/                 # api client + runtime helpers
│   └── index.html
├── .github/workflows/keepalive.yml   # optional Render free-tier keep-alive pings
├── render.yaml                       # single-URL Render deploy config
└── requirements.txt                  # backend dependencies (mirrors backend/)
```

## API overview

Selected endpoints (full list: `http://localhost:8000/docs`):

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness + DB record counts |
| `GET /api/overview` | Dashboard aggregates, top alerts, recent investigations |
| `GET /api/network` | Graph nodes/edges for the Network Explorer (`?suspicious_only=true`) |
| `GET /api/accounts`, `GET /api/accounts/:id` | Account list and detail dossier (baseline, connected entities, findings) |
| `GET /api/alerts` | Detected alerts with severity, evidence, risk |
| `GET /api/investigations/:id` | Investigation dossier (accounts, transactions, evidence, risk breakdown) |
| `GET /api/investigations/:id/timeline` | Per-day flow-timeline data |
| `POST /api/ai-investigator/query` | Evidence-grounded forensic Q&A |
| `GET/POST /api/reports*` | Auto-generated SAR/STR-style reports |
| `GET/PATCH /api/admin/rules` | Detection rule management (re-runs detection on change) |
| `GET/POST/PATCH /api/admin/users` | User management |
| `GET /api/admin/audit-logs` | Full audit trail |
| `GET /api/admin/health` | System health dashboard |

## Deployment

`render.yaml` deploys backend + built frontend as **one free Render web service**: the build steps `npm install && npm run build` in `frontend/`, then FastAPI serves the built app from `frontend/dist` at a single URL. Render's free tier spins down after ~15 min of idle; the optional GitHub Action (`.github/workflows/keepalive.yml`) pings `/api/health` every 10 minutes to keep it awake — set the repository variable `APP_URL` (e.g. `https://flowsight-vl0m.onrender.com`) to enable it. Since the free tier has an ephemeral disk, the app reseeds its SQLite DB at boot (a fresh DB may look slightly different from a local one).

## Known limitations

This is a **prototype/hackathon build** — honesty over polish:

- **Synthetic data only** — all accounts, transactions, and embedded patterns are procedurally generated (an Indian-payments corpus; ~230 accounts, ~15K transactions over 90 days). Not real financial data, and not a production AML engine.
- **Demo authentication** — the login page uses one-click role presets (Analyst / Admin). There is no real auth, SSO, or permission enforcement.
- **SQLite persistence** — used for prototype simplicity (WAL mode, busy timeout). Not horizontally scalable, no encryption at rest, single node.
- **Deterministic AI, not generative** — the AI Investigator answers from rule-based templates over the dossier; it cites real evidence and never hallucinates, but it is not an LLM and does not produce open-ended analysis.
- **In-memory detection** — detection loads the full ledger into NetworkX in memory; fine for the sample corpus, but it won't scale to millions of rows without a distributed engine.
- **Illustrative marketing metrics** on the landing page (transaction counts scanned, precision %, latency) are static mockups, not live instrumentation.

## Credits

Built as a prototype to address a challenge: *financial-crime patterns only become visible across many transactions over time.* Concept, data generator, detection engine, API, and the analyst/admin consoles were designed and implemented as part of this project — from synthetic corpus generation through evidence-grounded investigation and SAR-style reporting.

---

**FLOWSIGHT** · Financial Forensic Intelligence · For demo and educational purposes.