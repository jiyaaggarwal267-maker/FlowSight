# FLOWSIGHT — Financial Forensic Intelligence & Graph Analytics

> **See the flow. Detect the pattern. Stop the crime.**

FLOWSIGHT is a financial crime intelligence platform that surfaces fraud patterns hiding across many transactions, accounts, and time. It turns raw payment graphs — UPI/IMPS/NEFT/RTGS traffic between 230 accounts over 90 days — into explainable alerts, network investigations, flow timelines, and SAR-style reports that an analyst can trace back to individual transactions. Detection is five explainable graph rules plus a capped, unsupervised ML anomaly signal, and the thresholds are adversarially testable from inside the product.

Live demo: **[https://flowsight-vl0m.onrender.com](https://flowsight-vl0m.onrender.com)** (no sign-up — one-click Analyst and Admin demo access).

---

## Table of Contents

- [Why it exists](#why-it-exists)
- [Key features](#key-features)
- [Signature screens](#signature-screens)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [How detection works](#how-detection-works)
- [Red Team: adversarial evasion testing](#red-team-adversarial-evasion-testing)
- [Onboarding: who it's for](#onboarding-who-its-for)
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

FLOWSIGHT detects those patterns directly on the transaction graph: synthetic data → graph-based detection engine (+ unsupervised anomaly scoring) → FastAPI → React investigator console → evidence-grounded AI investigation and auto-generated SAR/STR-style reports. A built-in **red-team sandbox** closes the loop by attacking those same thresholds and reporting which ones a determined launderer would slip past.

## Key features

- **Graph-based pattern detection** — five detectors that flag:
  - **Circular flow** — money returns to its origin through a multi-hop loop within a short window (round-tripping).
  - **Fan-out** — one account rapidly disperses funds to many distinct counterparties (layering).
  - **Fan-in** — many accounts funnel funds into a single account (smurfing / collection).
  - **Behavioral deviation** — account activity spikes far above its own 60-day baseline in count and volume.
  - **Rapid movement / pass-through** — a mule forwards ≥85% of a large inflow within hours of receiving it.
- **Unsupervised ML anomaly signal (Isolation Forest)** — a sixth, strictly additive signal (`app/ml_detection.py`) that learns each account's own behavioural fingerprint (txn count, avg/std amount, unique counterparties, avg hours between txns, out/in ratio) and scores how unlike the rest of the population it looks. It uses **no labels and no hand-written thresholds**, is retrained from live rows on every detection refresh, and can add at most **+15** of a 100-point score — it never replaces, reweights or disables the rules. Surfaced in the dossier as its own `UNSUPERVISED` row in the risk breakdown, with the contributing feature values shown.
- **Risk scoring & clustering** — findings are combined into risk-scored clusters (0–100) and fed into alerts and investigation dossiers with cited transaction IDs.
- **Configurable detection rules** — admins enable/disable pattern rules, tune sensitivity and thresholds; changing a rule re-runs detection and refreshes alerts/investigations.
- **Red Team: adversarial evasion testing** (`/admin/red-team`) — an in-memory sandbox that generates a synthetic money-laundering ring, runs it against the **real** detection engine at the **currently configured** thresholds, and reports exactly which detectors fired. If nothing fires, it derives and quotes the specific live threshold the pattern slipped past. Nothing is ever written to the database.
- **Network Explorer** — a visual transaction graph of entities and money flows, with a suspicious-only mode.
- **Flow Timeline** — case-scoped day-by-day replay of a network's formation (volume, transaction count, active accounts, and the individual events per day), reachable at `/analyst/flow-timeline/:id` and kept in sync with the sidebar's active case.
- **AI Investigator (evidence-grounded, not a chatbot)** — answers investigative questions deterministically, citing actual transactions from the dossier. No black-box generation.
- **Auto-generated SAR-style reports** — executive summary, network overview, key evidence, transaction paths, risk assessment, and recommended action, ready for statutory filing workflows.
- **Admin Console** — Detection Rules, Red Team sandbox, Users & Roles, Audit Logs (every state change is audited), and System Health.
- **Investigation workflow** — dossier-driven triage with status, assignment, appended findings, and a per-factor risk breakdown.
- **Onboarding that explains itself** — a first-entry "Who FLOWSIGHT is for" modal plus a 6-step **Guided Tour** (header button on both consoles) that spotlights the real UI in sequence: Overview KPIs → Network Explorer → Dossier → Flow Timeline → AI Investigator → Detection Rules. Anchored with `data-tour` selectors, session-scoped so it never nags.
- **Honest UI** — no fake "Investigation INV-xxx" badges on corpus-wide views, no dead "Save View" buttons, no empty graph standing in for a failed load (a missing case renders an explicit error with a route back to Alerts), and every account/case ID shown in the UI comes from the actual seeded dataset.
- **Voice & accessibility (optional, ElevenLabs)** — text-to-speech in up to 11 languages (English, Hindi, Haryanvi, Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Punjabi):
  - **Read Aloud** on the investigation dossier — reads the case summary aloud with a language selector.
  - **AI Investigator narration** — a speaker button reads the Finding + Evidence aloud in the selected language; asking a new question stops playback.
  - **Flow Timeline voice narration** — an off-by-default toggle narrates each day's network formation (new accounts joining, transactions, volume moved) in sync with the replay; auto-advance pauses until each narration finishes.
  - Voice needs an **optional `ELEVENLABS_API_KEY`**; without one the buttons show a friendly "speech unavailable" status rather than breaking. Non-English text is translated keylessly on the server (Google Translate with MyMemory fallback, chunked to fit free-tier limits) then spoken with a multilingual ElevenLabs voice.

## Signature screens

- **Landing Page** (`/`) — a forensic "scanner terminal" hero, live telemetry counters, an animated incident feed, and an interactive network-graph preview (the standalone public graph page was folded into this hero). Includes the quick one-click demo sign-in.
- **Network Explorer** (`/analyst/network-explorer`) — interactive entity/transaction graph with risk-coded nodes, real node/edge counts, a high-risk-only filter, a minimum-flow filter, zoom/pan with **Fit to Screen**, and click-through to entity profiles.
- **Investigation View** (`/analyst/investigations/:id`) — the investigation dossier: summary, accounts in scope, involved transactions, evidence list with transaction IDs, a **per-factor risk breakdown** (each rule's real contribution, plus the `UNSUPERVISED` ML Anomaly Signal row with its feature values), appended findings, AI Investigator / report actions, and a **🔊 Read Aloud** button with a language selector.
- **Flow Timeline** (`/analyst/flow-timeline/:id?`) — case-scoped cumulative volume/txns/active-accounts replay over the network's active window, with daily event transactions, a day scrubber, and an optional **🔊 Voice Narration** toggle that narrates each day in sync with playback. A case that fails to load shows an explicit error rather than an empty graph.
- **AI Investigator** (`/analyst/ai-investigator`) — evidence-grounded forensic Q&A; the Forensic Synthesis Report (Finding + Cited Evidence) has a **Read Aloud** speaker button plus language selection.
- **Red Team** (`/admin/red-team`) — the evasion lab: preset or custom evasion controls, the generated ring rendered as a live graph, a caught/evaded verdict, a per-detector report, and derived explanations of which configured threshold was missed.

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
- scikit-learn 1.9.1 (`IsolationForest` — unsupervised anomaly scoring, trained at runtime)
- ElevenLabs `2.68.0` (optional TTS voice) + `deep-translator` `1.11.4` (keyless translation for non-English voice)
- Tested with Python 3.14

**No LLM is used.** The "AI Investigator" is a deterministic, rule-based forensic Q&A layer over the persisted dossier — so every claim cites real records instead of being generated. The ML layer is an *unsupervised* scikit-learn model trained on the app's own transaction data at boot, not a language model and not a third-party service. Voice features are the only opt-in external dependency: they use an optional ElevenLabs API key and free keyless translators; everything else is fully self-contained.

## Architecture

```
synthetic data generator (generate_data.py)
        │  data/accounts.json + data/transactions.json (committed)
        ▼
detection engine (detection.py + app/engine.py)
    NetworkX MultiDiGraph → 5 rule detectors → findings → risk-weighted clusters
        │
        ├──► ML layer (app/ml_detection.py)
        │      per-account feature vectors → IsolationForest → 0-100 anomaly score
        │      additive only (≤ +15), retrained from live rows on every refresh
        │
        ├──► risk-scored alerts + investigation dossiers
        │
        └──► red team sandbox (app/red_team.py)
               synthetic evasion ring in a temp dir → real detectors, live thresholds
               never touches the database
        │
        ▼
FastAPI (app/main.py) ── SQLite via SQLAlchemy (flowsight.db)
   /api/overview · /api/network · /api/alerts · /api/accounts
   /api/investigations · /api/reports · /api/admin/* · /api/ai-investigator
   /api/admin/red-team/* (config · simulate · state · clear)
   /api/tts (optional ElevenLabs voice)
        │
        ▼
React frontend (Vite)
   Public landing → Analyst console → Admin console (incl. Red Team)
   AI Investigator → SAR reports · onboarding modal + guided tour
```

The backend seeds itself on first boot: it reads `backend/data/*.json`, creates the SQLite schema, seeds rules + demo users, trains the Isolation Forest on the seeded transactions, and runs the detection engine to populate alerts and investigation dossiers. The frontend talks to FastAPI over `/api/*`.

## How detection works

The engine loads the full ledger into a `NetworkX.MultiDiGraph` and runs five independent detectors:

1. **Circular flow** — a time-bounded, timestamp-ordered path search finds money-returning cycles (≥ ₹1L per edge, closes within 72h).
2. **Fan-out / Fan-in** — sliding-window batch detection for one account dispersing to / receiving from ≥10 distinct accounts within hours.
3. **Behavioral deviation** — pandas-based daily aggregation builds a 60-day baseline per account and flags z-score spikes over absolute floors (count and volume).
4. **Rapid movement** — for each account, checks whether a large inflow (≥ ₹5L) is forwarded at ≥85% within ~2 hours, without exceeding the actual inflow.

Findings are combined into clusters with risk-weighted scores, ranked, and stored as alerts + investigations. Admin rule edits are applied by monkeypatching detector parameters and re-running the engine (`app/engine.py`), then refreshing alerts and dossiers.

### The ML layer is additive, not authoritative

`app/ml_detection.py` runs alongside the rules and is deliberately subordinate to them:

- **Features per account** — transaction count, mean amount, amount standard deviation, unique counterparties, average hours between transactions, and out/in amount ratio. All computed from the `transactions` table; a zero-activity account is encoded explicitly rather than dropped.
- **Model** — scikit-learn `IsolationForest` (`n_estimators=300`, `contamination=0.1`, `random_state=42`). `score_samples` output is inverted and min-max scaled against the observed population spread into a **0–100 scale where higher means more anomalous**. Fewer than 10 accounts is too small a population, and the model is simply skipped.
- **Weighting** — the anomaly score is converted into risk points capped at `ML_RISK_WEIGHT = 15`. The five rule weights already total 106, so a maximally anomalous account is a supporting indicator and can never become a critical alert on its own. `risk_breakdown` lists the ML contribution as its own `ml_anomaly` row, so an analyst can always separate rules from the model.
- **No labels, no leakage** — the forest is retrained from the rows currently in the database every time detection refreshes (boot, seed, or rule edit), so the signal always reflects the data actually present. Nothing is hand-tagged as fraud.
- **Persisted** — the fitted model is written to `backend/data/isolation_forest.joblib` (git-ignored, rebuilt on demand).

## Red Team: adversarial evasion testing

`/admin/red-team` answers the question a compliance team actually cares about: *if a launderer knew our thresholds, would they get through?*

**How it works**

1. The admin picks a sophistication preset (`low` / `medium` / `high` / `extreme`) or tunes the four controls directly — **hop count** (3–12), **time spread** (1–240h), **amount variance** (0–95% jitter), **account dilution** (0–8 noise accounts).
2. The backend generates a synthetic circular-flow network in a **temp directory** and loads it back through `detection.load_data`, so the graph the detectors see is built by the real loader from the real on-disk format.
3. The **genuine** `detection.py` functions run against it, with thresholds read live from the Detection Rules page (`live_thresholds()` mirrors `engine._apply_config`: an enabled rule's stored weight/thresholds win, anything unset falls back to detector defaults). Thresholds are passed as explicit keyword arguments, so the sandbox cannot leak configuration into the live engine.
4. `_evaluate` decides caught/evaded from real detector output and **derives** the explanation by comparing the generated network's actual properties against those live thresholds — e.g. *"Cycle closed in 84.0h. The circular-flow detector's time window is 72h, so the path's own deadline expires before the money returns."* Outcomes are never assumed.

**Honesty properties**

- **Isolation** — everything lives in an in-memory `_SANDBOX` dict plus a temp dir deleted after each run. No sandbox account, transaction, alert or investigation is ever written to SQLite, and sandbox ids are namespaced `RT-####` so they can never collide with the real `AC-#####` range. Overview, Alerts, Network Explorer, Investigations and Flow Timeline cannot see any of it.
- **Per-detector applicability** — a ring that small cannot meaningfully exercise every detector, and the page says so rather than showing a green "clear". Each detector reports `fired` / `clear` / `not_applicable` with the concrete reason: fan-out and fan-in need ≥10 distinct targets/sources (the sandbox has fewer), behavioral deviation needs 60 days of history (the sandbox covers one day by design), and rapid movement needs the hops close together.
- **Non-evasive levers are labelled as such** — account dilution and low amount variance add realism but don't themselves defeat a detector, and are reported separately from the real evasion reasons so the page never overstates what a control achieved.

**Endpoints** — `GET /api/admin/red-team/config`, `POST /api/admin/red-team/simulate`, `GET /api/admin/red-team/state`, `POST /api/admin/red-team/clear`. The last 25 runs are kept in memory for the session log.

## Onboarding: who it's for

Detection tooling is easy to build and easy to misjudge: a screen full of red graphs is worthless if the viewer doesn't know whether it is a compliance analyst, an auditor, or a regulator. So the first entry into either console explains the tool before it hands it over.

- **Context modal** — on first entry to `/analyst/*` or `/admin/*` in a session, a "Who FLOWSIGHT is for" modal states that this is an internal financial-crime intelligence tool for bank compliance teams and FIUs, lists the audience (Compliance Analysts, Financial Intelligence Units, Internal Audit & Regulators), and is clear that the data is synthetic. Marked seen in `sessionStorage`, so it returns in a new tab but never nags. Re-openable any time via the **ⓘ** button in either header.
- **Guided Tour** — a **Guided Tour** button in both headers starts a 6-step spotlight walkthrough that navigates the real app in sequence: Analyst Overview KPIs → Network Explorer → Investigation Dossier → Flow Timeline → AI Investigator → Admin Detection Rules. Each step anchors to a `data-tour` selector, draws an SVG spotlight with callout placement that flips above/below the target, and re-queries on resize and after lazy route chunks mount.
- `OnboardingLayer` is mounted **outside** the route `Suspense` boundary (`App.jsx`) so tour state survives lazy page chunks swapping between steps.

## Local setup

Requirements: **Python 3.11+** (pinned pandas 3.0 and scikit-learn 1.9 both require ≥3.11) and **Node 20.19+** (Vite 7 requires Node ≥20.19).

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

npm run dev
```

The dev server runs at **http://localhost:5173**. Vite proxies `/api` → `127.0.0.1:8000`, so **no `.env` file is needed** for local development.

> **Do not create `frontend/.env` with `VITE_API_URL=http://localhost:8000`.** Vite inlines `VITE_*` variables into the bundle at *build* time, so that file makes the production bundle call `localhost:8000` in every visitor's browser — the deployed site then fails with `ERR_CONNECTION_REFUSED` and no data loads. `src/lib/api.js` now ignores `VITE_API_URL` in production builds and uses same-origin relative paths, and `npm run build` fails if a `localhost:<port>` address reaches the built assets. For a dev server that must target a different host, put the variable in `frontend/.env.development` (loaded by `vite dev`, never by `vite build`).

> **Run both servers at the same time** — the frontend has no data without the backend.

### Seeding notes

- The SQLite DB (`backend/flowsight.db`) is created and seeded automatically on first boot from `backend/data/*.json` — no manual migration step.
- Seeding also trains the Isolation Forest, so the first boot writes `backend/data/isolation_forest.joblib`. It is git-ignored and retrained automatically on every detection refresh; delete it any time without consequence.
- Re-running `python generate_data.py` regenerates only the JSON corpus; delete `backend/flowsight.db` afterwards so the API reseeds from the new files.

## Demo access

There is **no real authentication system**. The login screen offers two one-click entries:

- **Analyst Demo** → `/analyst/overview` — A. Sharma (L2 FIU Officer) forensic console.
- **Admin Demo** → `/admin/overview` — Risk Director sandbox.

The first entry into either console shows a short "Who FLOWSIGHT is for" modal, and the **Guided Tour** button in the header walks through the workflow at any time.

## Environment variables

| Where | Variable | Required | Default | Purpose |
| --- | --- | --- | --- | --- |
| Frontend | `VITE_API_URL` | No | `""` (same-origin) | Only honoured by `vite dev` (via `frontend/.env.development`) to point a dev server at a different host. It is **ignored in production builds** on purpose — deployed builds always call their own origin. See the warning above. |
| Backend | `ELEVENLABS_API_KEY` | No | unset (voice disabled) | Enables **Read Aloud / AI Investigator narration / Flow Timeline voice narration**. Without it the `/api/tts/speak` endpoint returns `503` and the UI shows a disabled/error status instead of audio. The key is read from the environment only — never committed. |

**No LLM is used and no keys are required** for the core app — the AI Investigator is fully deterministic, and the ML layer is an unsupervised scikit-learn model trained locally on the app's own data. Voice features are the one opt-in external dependency: they need an ElevenLabs API key (server env var) and use free keyless translators (Google Translate with MyMemory fallback) for non-English narration.

## Project structure

```
flowsight/
├── backend/
│   ├── app/                     # FastAPI application package
│   │   ├── main.py              # all REST endpoints + static frontend serving
│   │   ├── tts.py               # optional ElevenLabs text-to-speech (/api/tts/speak)
│   │   ├── seed.py              # DB seeding + detection refresh on rule edits
│   │   ├── engine.py            # rule-configurable detection engine wrapper
│   │   ├── ml_detection.py      # IsolationForest feature build / train / score
│   │   ├── red_team.py          # in-memory adversarial evasion sandbox
│   │   ├── database.py          # SQLAlchemy engine + SQLite (WAL)
│   │   └── models.py            # accounts, transactions, alerts, investigations,
│   │                            # detection_rules, audit_logs, users
│   ├── detection.py             # Step-1 detection engine (NetworkX + pandas)
│   ├── generate_data.py         # synthetic Indian payments corpus generator
│   ├── test_detection.py        # detection engine tests
│   └── data/                    # committed generated corpus (accounts.json,
│                                # transactions.json, embedded_patterns.json);
│                                # isolation_forest.joblib is git-ignored + rebuilt
├── frontend/
│   ├── src/
│   │   ├── pages/public/        # Landing (incl. graph preview), Login
│   │   ├── pages/analyst/       # Overview, NetworkExplorer, AlertsTriage,
│   │   │                        # InvestigationView, FlowTimeline, EntityProfile,
│   │   │                        # AiInvestigator, InvestigationReports
│   │   ├── pages/admin/         # Overview, Users, Rules, RedTeam, AuditLogs, Health
│   │   ├── components/          # shared UI (layout, badges, palette, graph,
│   │   │                        # ContextModal, Walkthrough, OnboardingLayer)
│   │   ├── layouts/             # Public / Analyst / Admin shells
│   │   └── lib/                 # api client + runtime helpers + tour definitions
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
| `GET /api/investigations/:id` | Investigation dossier (accounts, transactions, evidence, per-factor risk breakdown incl. `ml_signal`) |
| `GET /api/investigations/:id/timeline` | Per-day flow-timeline data |
| `POST /api/ai-investigator/query` | Evidence-grounded forensic Q&A |
| `POST /api/tts/speak` | ElevenLabs text-to-speech — `{text, language}` → `audio/mpeg`; multi-language (English unchanged, others translated chunk-by-chunk via Google/MyMemory) |
| `GET/POST /api/reports*` | Auto-generated SAR/STR-style reports |
| `GET/PATCH /api/admin/rules` | Detection rule management (re-runs detection on change) |
| `GET /api/admin/red-team/config` | Live detector thresholds + control bounds + presets |
| `POST /api/admin/red-team/simulate` | Generate one synthetic evasion network and test it with the real engine (no DB writes) |
| `GET /api/admin/red-team/state` | Current sandbox network + last 25 runs |
| `POST /api/admin/red-team/clear` | Clear the sandbox |
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

# 2. every deploy: `npm run build` also syncs the UI into the app dir
#    (the postbuild step copies frontend/dist -> backend/frontend/dist)
cd frontend && npm run build && cd ..
fastapi deploy      # from the repo root; app was created with --directory backend

# optional: set an ELEVENLABS_API_KEY so voice features work
fastapi cloud env set ELEVENLABS_API_KEY sk_xxx --app-id <app-id>
```

> **The build step is not optional.** FastAPI Cloud mounts only `backend/`, so a
> build left in `frontend/dist` is never deployed — that silently ships the
> previous UI. `npm run build` now mirrors the output into
> `backend/frontend/dist` automatically, so you cannot forget. If you ever run
> `vite build` directly, mirror it yourself:
> `rm -rf backend/frontend/dist && cp -R frontend/dist backend/frontend/dist`.

> Tips: keep the first `fastapi deploy` from becoming a "reuse image" no-op by **caching the image once with the UI present** (build on a fresh app first, as done here). Delete the leftover `flowsight` app in the [dashboard](https://dashboard.fastapicloud.com) if you don't use it.

The app's **Application Directory is already set to `backend`** (created via `fastapi cloud apps create --directory backend`), which is where `app/main.py` and `backend/requirements.txt` live. Your app is served from a `https://<app>.fastapicloud.dev` URL; set `ELEVENLABS_API_KEY` under the app's env vars (`fastapi cloud env set ELEVENLABS_API_KEY sk_xxx`) if you want voice features.

> **Cold starts and scale-to-zero.** The platform sleeps the app after
> inactivity and the disk is ephemeral, so every wake re-seeds SQLite and re-runs
> detection. The app therefore binds and serves the UI immediately and finishes
> booting in a background thread, so HTML/CSS/JS paint right away; only `/api/*`
> waits for the seed (and `/api/health` answers instantly, reporting
> `status: starting` while it finishes). A cold boot from an empty database
> takes about a second. To keep the instance warm, the `keepalive` GitHub
> workflow pings `/api/health` every 10 minutes — set the repository variable
> `APP_URL` to your deployed URL to enable it.

> Notes: GitHub's push-based integration can't build the frontend yet, so use the local `fastapi deploy` flow above. On the free tier the app runs on ~0.1 vCPU / 512 MB — plenty for the ~15K-transaction demo corpus.

### One-service Render (previously)

`render.yaml` deploys backend + built frontend as **one Render web service**: the build steps `npm install && npm run build` in `frontend/`, then FastAPI serves the built app from `frontend/dist` at a single URL. Render's free tier was discontinued in 2025 (services are suspended until payment is added), so it is kept here only for reference. If paid hosting is ever acceptable, run `docker build` and `docker run` of this same `Dockerfile` on Render/Railway/Fly and set `PORT` to the platform-provided value.

## Known limitations

This is a **prototype/hackathon build** — honesty over polish:

- **Synthetic data only** — all accounts, transactions, and embedded patterns are procedurally generated (an Indian-payments corpus; ~230 accounts, ~15K transactions over 90 days). Not real financial data, and not a production AML engine.
- **Demo authentication** — the login page uses one-click role presets (Analyst / Admin). There is no real auth, SSO, or permission enforcement. The Red Team sandbox is likewise not permission-gated beyond reaching `/admin/*`.
- **SQLite persistence** — used for prototype simplicity (WAL mode, busy timeout). Not horizontally scalable, no encryption at rest, single node.
- **Deterministic AI, not generative** — the AI Investigator answers from rule-based templates over the dossier; it cites real evidence and never hallucinates, but it is not an LLM and does not produce open-ended analysis.
- **The ML layer is a demo, and a weak one** — an Isolation Forest on 6 aggregate features over ~230 accounts is a demonstration that unsupervised scoring can be *added* to rules safely, not a validated fraud model. There is no labelled data, so there is no way to report precision/recall, no concept-drift handling, and no feature-importance validation. Scores are relative to whatever population is currently in the DB, and because the forest is retrained on every refresh, a score is not comparable across refreshes. It is capped at +15 precisely so a bad model can only ever nudge a rule-based verdict, never drive one.
- **The Red Team sandbox tests a narrow shape** — it only generates circular-flow rings, so circular flow is the primary target; fan-out/fan-in need more accounts than a ring has, behavioral deviation needs 60 days of history the sandbox deliberately doesn't produce, and rapid movement only applies when the hops are close together. The UI reports each of these as `not_applicable` rather than pretending a clear result. It also tests the *current* thresholds, so it validates one moment in time, not the detector's robustness in general.
- **Voice relies on external free tiers** — voice narration is optional and depends on an ElevenLabs API key plus free keyless translators. Translation providers rate-limit (Google ≈5 req/s, MyMemory ≈500 chars/request), so long non-English readings are chunked automatically; on rare rate-limit failures the UI shows an error and English narration always works.
- **In-memory detection** — detection loads the full ledger into NetworkX in memory; fine for the sample corpus, but it won't scale to millions of rows without a distributed engine. The Red Team sandbox is likewise in-process and single-instance: with multiple workers each gets its own `_SANDBOX`, so the run history is per-process and lost on restart.
- **Illustrative marketing metrics** on the landing page (transaction counts scanned, precision %, latency) are static mockups, not live instrumentation.
- **Desktop-first UI** — mobile-responsive, but the graph-heavy views (Network Explorer, Flow Timeline) are designed for and best experienced on desktop.
- **Flow Timeline and investigations are seeded-case oriented** — `/analyst/flow-timeline/:id` expects a real investigation id, and the sidebar's active case only follows pages that actually emit one (Network Explorer is corpus-wide and deliberately doesn't claim a case).

## Credits

Built as a prototype to address a challenge: *financial-crime patterns only become visible across many transactions over time.* Concept, data generator, rule detection engine, unsupervised ML layer, red-team evasion sandbox, API, and the analyst/admin consoles were designed and implemented as part of this project — from synthetic corpus generation through evidence-grounded investigation and SAR-style reporting.

---

**FLOWSIGHT** · Financial Forensic Intelligence · For demo and educational purposes.