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
- **Voice & accessibility (optional, ElevenLabs)** — text-to-speech in up to 11 languages (English, Hindi, Haryanvi, Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi):
  - **Read Aloud** on the investigation dossier — reads the case summary aloud with a language selector.
  - **AI Investigator narration** — a speaker button reads the Finding + Evidence aloud in the selected language; asking a new question stops playback.
  - **Flow Timeline voice narration** — an off-by-default toggle narrates each day's network formation (new accounts joining, transactions, volume moved) in sync with the replay; auto-advance pauses until each narration finishes.
  - Voice needs an **optional `ELEVENLABS_API_KEY`**; without one the buttons show a friendly "speech unavailable" status rather than breaking. Non-English text is translated keylessly on the server (Google Translate with MyMemory fallback, chunked to fit free-tier limits) then spoken with a multilingual ElevenLabs voice.

## Signature screens

- **Landing Page** — a forensic "scanner terminal" hero, live telemetry counters, an animated incident feed, and an interactive network-graph preview. Includes the quick one-click demo sign-in.
- **Network Explorer** (`/analyst/network-explorer`) — interactive entity/transaction graph with risk-coded nodes, click-through to entity profiles, and a suspicious-only filter.
- **Investigation View** (`/analyst/investigations/:id`) — the investigation dossier: summary, accounts in scope, involved transactions, evidence list with transaction IDs, risk breakdown by pattern, findings, AI Investigator / report actions, and a **🔊 Read Aloud** button with a language selector.
- **Flow Timeline** (`/analyst/flow-timeline`) — cumulative volume/txns/active-accounts replay over the network's active window, with daily event transactions and an optional **🔊 Voice Narration** toggle that narrates each day in sync with playback.
- **AI Investigator** (`/analyst/investigator`) — evidence-grounded forensic Q&A; the Forensic Synthesis Report (Finding + Cited Evidence) has a **Read Aloud** speaker button plus language selection.

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
- ElevenLabs `2.68.0` (optional TTS voice) + `deep-translator` `1.11.4` (keyless translation for non-English voice)
- Tested with Python 3.14

**No LLM is used.** The "AI Investigator" is a deterministic, rule-based forensic Q&A layer over the persisted dossier — so every claim cites real records instead of being generated. Voice features are the only opt-in external dependency: they use an optional ElevenLabs API key and free keyless translators; everything else is fully self-contained.

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
   /api/tts (optional ElevenLabs voice)
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

Requirements: **Python 3.10+** and **Node 20.19+** (Vite 7 requires Node ≥20.19).

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional — regenerate the synthetic dataset from scratch (data/ is already committed):
python generate_data.py

# Optional — enable Read Aloud / voice narration (set any ElevenLabs API key):
export ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx

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
| Backend | `ELEVENLABS_API_KEY` | No | unset (voice disabled) | Enables **Read Aloud / AI Investigator narration / Flow Timeline voice narration**. Without it the `/api/tts/speak` endpoint returns `503` and the UI shows a disabled/error status instead of audio. The key is read from the environment only — never committed. |

**No LLM is used and no keys are required** for the core app — the AI Investigator is fully deterministic. Voice features are the one opt-in external dependency: they need an ElevenLabs API key (server env var) and use free keyless translators (Google Translate with MyMemory fallback) for non-English narration.

## Project structure

```
flowsight/
├── backend/
│   ├── app/                     # FastAPI application package
│   │   ├── main.py              # all REST endpoints + static frontend serving
│   │   ├── tts.py               # optional ElevenLabs text-to-speech (/api/tts/speak)
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
| `POST /api/tts/speak` | ElevenLabs text-to-speech — `{text, language}` → `audio/mpeg`; multi-language (English unchanged, others translated chunk-by-chunk via Google/MyMemory) |
| `GET/POST /api/reports*` | Auto-generated SAR/STR-style reports |
| `GET/PATCH /api/admin/rules` | Detection rule management (re-runs detection on change) |
| `GET/POST/PATCH /api/admin/users` | User management |
| `GET /api/admin/audit-logs` | Full audit trail |
| `GET /api/admin/health` | System health dashboard |

## Deployment

The app ships as a **single image that serves both the built React frontend and the FastAPI backend** (SQLite + built-in static serving), so it runs anywhere with Docker — or any host that runs `uvicorn app.main:app --app-dir backend`.

### Free-reliable: Oracle Cloud "Always Free" VM ($0, always-on, never sleeps)

As of 2026, every mainstream free tier that ran Python web servers has been discontinued or paywalled (Render's free web services are gone, Fly/Railway need billing, Hugging Face Spaces now requires PRO for Docker compute). The last genuinely **always-on** free option is Oracle Cloud's Always Free tier — a full VM that never sleeps, free for the life of the account:

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free). A **card is required for identity verification only — it is never charged**. Reject common signup-verification failures by retrying with a different browser/device if the page errors out.
2. Console → **Compute → Instances → Create instance**:
   - Image: **Ubuntu 24.04** (or Oracle Linux), Shape: **VM.Standard.A1.Flex**, **2 OCPU / 12 GB** (current Always Free limit). If "Out of capacity" in your region, resize smaller or try again later.
   - Add your **SSH public key** and create the instance.
3. Open the firewall — **Networking → Virtual cloud networks → your VCN → Security List → Add Ingress Rules**: `TCP 0.0.0.0/0` for ports **80** and **443**.
4. On the VM: pick up `docker` and the image.
   ```bash
   sudo apt update && sudo apt install -y docker.io && sudo systemctl enable --now docker
   git clone https://github.com/<you>/flowsight.git && cd flowsight
   sudo docker build -t flowsight .
   # optional: enable voice
   #sudo docker run -d --name flowsight -p 80:7860 --restart unless-stopped -e ELEVENLABS_API_KEY=sk_xxx flowsight
   sudo docker run -d --name flowsight -p 80:7860 --restart unless-stopped flowsight
   ```
5. Visit `http://<instance-public-ip>` — the whole app (React UI + API + SQLite) serves from that one container. The Ethernet IP is `curl -4 ifconfig.me` from the VM.

Keep-alive (important, free): Oracle may reclaim an Always Free instance it deems **idle** (95th-percentile CPU < 15% for 7 days). Add a free [UptimeRobot](https://uptimerobot.com) HTTPS monitor hitting `http://<ip>/api/health` every 5 minutes, and optionally a lightweight CPU-warm cronjob, to keep utilization above the threshold. Also sign in to the console roughly once a month — accounts idle 30+ days can be suspended.

### No credit card: FastAPI Cloud ($0, free forever) — recommended default

Live at **https://flowsight-app.fastapicloud.dev**. From the FastAPI team, free as long as you want and **no credit card**. The $0 Hobby plan gives 3 apps, automatic HTTPS, and scale-to-zero. It won't build the React app for you, and its runtime mounts only the app directory — so the built UI is copied into `backend/frontend/dist` (un-ignored via `.fastapicloudignore`) and `app/main.py` resolves it there (`_find_frontend_dist()`). Trade-off: the app **sleeps** after inactivity and the first visitor hits a short cold start; SQLite data resets on wake (the app reseeds at boot). In other words it works, but isn't instant-always.

Deploy (run from this repo root):

```bash
# 1. one-time: install the CLI (into the backend venv)
source backend/.venv/bin/activate
pip install "fastapi[standard]"
fastapi login

# 2. every deploy: rebuild the frontend, copy UI into the app dir, deploy
cd frontend && npm run build && cd ..
rm -rf backend/frontend/dist && cp -R frontend/dist backend/frontend/dist
fastapi deploy      # from the repo root; app was created with --directory backend

# optional: set an ELEVENLABS_API_KEY so voice features work
fastapi cloud env set ELEVENLABS_API_KEY sk_xxx --app-id <app-id>
```

> Tips: keep the first `fastapi deploy` from becoming a "reuse image" no-op by **caching the image once with the UI present** (build on a fresh app first, as done here). Delete the leftover `flowsight` app in the [dashboard](https://dashboard.fastapicloud.com) if you don't use it.

The app's **Application Directory is already set to `backend`** (created via `fastapi cloud apps create --directory backend`), which is where `app/main.py` and `backend/requirements.txt` live. Your app is served from a `https://<app>.fastapicloud.dev` URL; set `ELEVENLABS_API_KEY` under the app's env vars (`fastapi cloud env set ELEVENLABS_API_KEY sk_xxx`) if you want voice features.

> Notes: GitHub's push-based integration can't build the frontend yet, so use the local `fastapi deploy` flow above. On the free tier the app runs on ~0.1 vCPU / 512 MB — plenty for the ~15K-transaction demo corpus.

### One-service Render (previously)

`render.yaml` deploys backend + built frontend as **one Render web service**: the build steps `npm install && npm run build` in `frontend/`, then FastAPI serves the built app from `frontend/dist` at a single URL. Render's free tier was discontinued in 2025 (services are suspended until payment is added), so it is kept here only for reference. If paid hosting is ever acceptable, run `docker build` and `docker run` of this same `Dockerfile` on Render/Railway/Fly and set `PORT` to the platform-provided value.

## Known limitations

This is a **prototype/hackathon build** — honesty over polish:

- **Synthetic data only** — all accounts, transactions, and embedded patterns are procedurally generated (an Indian-payments corpus; ~230 accounts, ~15K transactions over 90 days). Not real financial data, and not a production AML engine.
- **Demo authentication** — the login page uses one-click role presets (Analyst / Admin). There is no real auth, SSO, or permission enforcement.
- **SQLite persistence** — used for prototype simplicity (WAL mode, busy timeout). Not horizontally scalable, no encryption at rest, single node.
- **Deterministic AI, not generative** — the AI Investigator answers from rule-based templates over the dossier; it cites real evidence and never hallucinates, but it is not an LLM and does not produce open-ended analysis.
- **Voice relies on external free tiers** — voice narration is optional and depends on an ElevenLabs API key plus free keyless translators. Translation providers rate-limit (Google ≈5 req/s, MyMemory ≈500 chars/request), so long non-English readings are chunked automatically; on rare rate-limit failures the UI shows an error and English narration always works.
- **In-memory detection** — detection loads the full ledger into NetworkX in memory; fine for the sample corpus, but it won't scale to millions of rows without a distributed engine.
- **Illustrative marketing metrics** on the landing page (transaction counts scanned, precision %, latency) are static mockups, not live instrumentation.
- **Desktop-first UI** — mobile-responsive, but the graph-heavy views (Network Explorer, Flow Timeline) are designed for and best experienced on desktop.

## Credits

Built as a prototype to address a challenge: *financial-crime patterns only become visible across many transactions over time.* Concept, data generator, detection engine, API, and the analyst/admin consoles were designed and implemented as part of this project — from synthetic corpus generation through evidence-grounded investigation and SAR-style reporting.

---

**FLOWSIGHT** · Financial Forensic Intelligence · For demo and educational purposes.