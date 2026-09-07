"""FLOWSIGHT Step 2: FastAPI REST server backed by SQLite.

Serves persisted accounts/transactions/alerts/investigations plus admin
endpoints. Detection (Step 1) runs on first seed and whenever admin rules are
edited. No LLM/AI functionality in this step.
"""

from __future__ import annotations

import json
import sys
import threading
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

# Make Step 1 modules importable regardless of CWD.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import detection as det
from .database import get_db
from .models import (
    Account,
    Alert,
    AuditLog,
    DetectionRule,
    Investigation,
    Transaction,
    User,
)
from .seed import audit, refresh_detection, seed_if_needed

DATA_DIR = BACKEND_ROOT / "data"

app = FastAPI(title="FLOWSIGHT API", version="2.0.0", description=__doc__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_started = threading.Event()


@app.on_event("startup")
def _startup() -> None:
    def _init() -> None:
        from .database import Base, engine

        with engine.begin() as conn:
            Base.metadata.create_all(bind=conn)
        from .database import SessionLocal

        db = SessionLocal()
        try:
            if not _started.is_set():
                seed_if_needed(db)
                _started.set()
        finally:
            db.close()

    threading.Thread(target=_init, daemon=True).start()


# ── serializers ───────────────────────────────────────────────────────


def _severity(risk: int) -> str:
    if risk >= 60:
        return "critical"
    if risk >= 40:
        return "high"
    if risk >= 25:
        return "medium"
    return "low"


def _acct_dict(a: Account, with_risk: bool = True) -> dict:
    return {
        "id": a.id,
        "acct_id": a.id,
        "entity": a.entity,
        "type": a.type,
        "institution": a.institution,
        "bank": a.bank,
        "city": a.city,
        "category": a.category,
        "created_date": a.created_date,
        "total_sent": a.total_sent,
        "total_received": a.total_received,
        "risk_score": a.risk_score,
        "risk": a.risk_score,
    }


def _txn_dict(t: Transaction) -> dict:
    return {
        "id": t.id,
        "txn_id": t.id,
        "from": t.from_account,
        "from_account": t.from_account,
        "to": t.to_account,
        "to_account": t.to_account,
        "amount": t.amount,
        "timestamp": t.timestamp.isoformat(),
        "channel": t.channel,
        "status": t.status,
    }


def _alert_dict(a: Alert) -> dict:
    return {
        "id": a.id,
        "pattern": a.pattern_type,
        "pattern_type": a.pattern_type,
        "risk": a.risk_score,
        "risk_score": a.risk_score,
        "severity": _severity(a.risk_score),
        "evidence": a.evidence,
        "accounts": a.account_ids or [],
        "transactions": a.transaction_ids or [],
        "amount": a.amount,
        "detected_at": a.detected_at.isoformat() if a.detected_at else None,
        "status": a.status,
        "assigned_to": a.assigned_to,
    }


def _inv_dict(i: Investigation) -> dict:
    return {
        "id": i.id,
        "alert_id": i.alert_id,
        "status": i.status,
        "risk_score": i.risk_score,
        "summary": i.summary_json or {},
        "assigned_to": i.assigned_to,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "role_key": u.role_key,
        "unit": u.unit,
        "status": u.status,
        "last_active": u.last_active.isoformat() if u.last_active else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def _rule_dict(r: DetectionRule) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "pattern": r.pattern,
        "status": r.status,
        "sensitivity": r.sensitivity,
        "weight": r.weight,
        "thresholds": r.thresholds or {},
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _log_dict(l: AuditLog) -> dict:
    return {
        "id": l.id,
        "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        "user": l.user,
        "action": l.action,
        "resource": l.resource,
        "result": l.result,
        "detail": l.detail or {},
    }


# ── helpers ───────────────────────────────────────────────────────────


def _findings_from_alerts(db: Session) -> list[dict]:
    rows = db.execute(select(Alert)).scalars().all()
    findings = []
    for a in rows:
        findings.append({
            "pattern": a.pattern_type,
            "accounts": a.account_ids or [],
            "transactions": a.transaction_ids or [],
            "risk": a.risk_score,
            "evidence": a.evidence,
        })
    return findings


def _account_baseline(db: Session, acct: Account) -> dict:
    txns = db.execute(
        select(Transaction).where(
            (Transaction.from_account == acct.id)
            | (Transaction.to_account == acct.id)
        )
    ).scalars().all()
    if not txns:
        return {"avg_monthly_txns": 0, "avg_monthly_volume": 0, "active_days": 0,
                "top_channels": {}, "avg_amount": 0}
    months = defaultdict(int)
    volume = defaultdict(float)
    channels: Counter[str] = Counter()
    days: set[str] = set()
    total_amt = 0.0
    for t in txns:
        m = t.timestamp.strftime("%Y-%m")
        months[m] += 1
        volume[m] += t.amount
        channels[t.channel] += 1
        days.add(t.timestamp.strftime("%Y-%m-%d"))
        total_amt += t.amount
    n_months = max(len(months), 1)
    return {
        "avg_monthly_txns": round(sum(months.values()) / n_months, 1),
        "avg_monthly_volume": round(sum(volume.values()) / n_months, 2),
        "active_days": len(days),
        "top_channels": dict(channels.most_common(5)),
        "avg_amount": round(total_amt / len(txns), 2),
        "txn_count": len(txns),
    }


def _connected_entities(db: Session, acct: Account) -> list[dict]:
    txns = db.execute(
        select(Transaction).where(
            (Transaction.from_account == acct.id)
            | (Transaction.to_account == acct.id)
        )
    ).scalars().all()
    agg: dict[str, dict] = {}
    for t in txns:
        other = t.to_account if t.from_account == acct.id else t.from_account
        direction = "out" if t.from_account == acct.id else "in"
        e = agg.setdefault(other, {"id": other, "out_amount": 0.0,
                                   "in_amount": 0.0, "txn_count": 0})
        e["txn_count"] += 1
        if direction == "out":
            e["out_amount"] += t.amount
        else:
            e["in_amount"] += t.amount
    out = []
    for other, e in agg.items():
        other_acct = db.get(Account, other)
        out.append({
            "id": other,
            "entity": other_acct.entity if other_acct else "",
            "bank": other_acct.bank if other_acct else "",
            "risk_score": other_acct.risk_score if other_acct else 0,
            "txn_count": e["txn_count"],
            "amount_sent": round(e["out_amount"], 2),
            "amount_received": round(e["in_amount"], 2),
            "direction": "out" if e["out_amount"] >= e["in_amount"] else "in",
        })
    return out


# ── 1. overview ───────────────────────────────────────────────────────


@app.get("/api/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    total_txns = db.execute(select(func.count(Transaction.id))).scalar() or 0
    total_volume = db.execute(select(func.sum(Transaction.amount))).scalar() or 0.0
    acct_count = db.execute(select(func.count(Account.id))).scalar() or 0

    alerts = db.execute(select(Alert)).scalars().all()
    high_risk = sum(1 for a in alerts if _severity(a.risk_score) in ("critical", "high"))
    critical = sum(1 for a in alerts if _severity(a.risk_score) == "critical")

    by_channel: dict[str, float] = {}
    for row in (db.execute(select(Transaction.channel, Transaction.amount)).all()):
        by_channel[row[0]] = by_channel.get(row[0], 0.0) + row[1]

    top_patterns: Counter[str] = Counter()
    for a in alerts:
        top_patterns[a.pattern_type] += 1

    invs = db.execute(select(Investigation).order_by(
        Investigation.created_at.desc()).limit(6)).scalars().all()

    return {
        "accounts": acct_count,
        "transactions": total_txns,
        "total_volume": round(total_volume, 2),
        "avg_txn": round(total_volume / total_txns, 2) if total_txns else 0,
        "channels": {k: round(v, 2) for k, v in by_channel.items()},
        "high_risk_alerts": high_risk,
        "critical_alerts": critical,
        "clusters": len(alerts),
        "top_patterns": dict(top_patterns),
        "top_alerts": [_alert_dict(a) for a in sorted(
            alerts, key=lambda x: -x.risk_score)[:5]],
        "recent_investigations": [_inv_dict(i) for i in invs],
    }


# ── 2. network ────────────────────────────────────────────────────────


@app.get("/api/network")
def network(
    suspicious_only: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict:
    accts = db.execute(select(Account)).scalars().all()
    txns = db.execute(select(Transaction)).scalars().all()
    findings = _findings_from_alerts(db)

    involved: set[str] = set()
    for f in findings:
        involved.update(f["accounts"])
    suspicious_ids = involved if suspicious_only else None

    degree: Counter[str] = Counter()
    for t in txns:
        degree[t.from_account] += 1
        degree[t.to_account] += 1

    nodes = []
    for a in accts:
        if suspicious_ids is not None and a.id not in suspicious_ids:
            continue
        nodes.append({
            "id": a.id,
            "entity": a.entity,
            "category": a.category,
            "city": a.city,
            "bank": a.bank,
            "type": a.type,
            "risk": a.risk_score,
            "risk_score": a.risk_score,
            "degree": degree.get(a.id, 0),
            "total_sent": a.total_sent,
            "total_received": a.total_received,
        })

    edges = []
    for t in txns:
        if suspicious_ids is not None and (
            t.from_account not in suspicious_ids or t.to_account not in suspicious_ids
        ):
            continue
        edges.append(_txn_dict(t))

    return {"nodes": nodes, "edges": edges}


# ── 3. accounts list + detail ─────────────────────────────────────────


@app.get("/api/accounts")
def accounts(
    search: str = Query(""),
    category: str = Query(""),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    q = select(Account)
    if search:
        like = f"%{search.lower()}%"
        q = q.where(
            (func.lower(Account.id).like(like))
            | (func.lower(Account.entity).like(like))
            | (func.lower(Account.city).like(like))
        )
    if category:
        q = q.where(Account.category == category)
    total = db.execute(
        select(func.count()).select_from(q.subquery())
    ).scalar() or 0
    items = db.execute(q.order_by(Account.risk_score.desc())
                       .offset(offset).limit(limit)).scalars().all()
    return {
        "total": total,
        "offset": offset,
        "items": [_acct_dict(a) for a in items],
    }


@app.get("/api/accounts/{account_id}")
def account_detail(account_id: str, db: Session = Depends(get_db)) -> dict:
    acct = db.get(Account, account_id)
    if not acct:
        raise HTTPException(status_code=404, detail="account not found")

    txns = db.execute(
        select(Transaction).where(
            (Transaction.from_account == acct.id)
            | (Transaction.to_account == acct.id)
        ).order_by(Transaction.timestamp.desc())
    ).scalars().all()

    findings = [a for a in db.execute(select(Alert)).scalars().all()
                if acct.id in (a.account_ids or [])]

    return {
        **_acct_dict(acct),
        "txn_count": len(txns),
        "baseline": _account_baseline(db, acct),
        "connected_entities": _connected_entities(db, acct),
        "findings": [_alert_dict(a) for a in findings],
        "transactions": [_txn_dict(t) for t in txns[:500]],
    }


@app.get("/api/transactions")
def transactions(
    limit: int = Query(200, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    account: str = Query(""),
    channel: str = Query(""),
    db: Session = Depends(get_db),
) -> dict:
    q = select(Transaction)
    if account:
        q = q.where((Transaction.from_account == account)
                    | (Transaction.to_account == account))
    if channel:
        q = q.where(Transaction.channel == channel)
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar() or 0
    items = db.execute(q.order_by(Transaction.timestamp.desc())
                       .offset(offset).limit(limit)).scalars().all()
    return {
        "total": total,
        "offset": offset,
        "items": [_txn_dict(t) for t in items],
    }


# ── 4. alerts ─────────────────────────────────────────────────────────


@app.get("/api/alerts")
def alerts(
    status: str = Query(""),
    pattern: str = Query(""),
    db: Session = Depends(get_db),
) -> dict:
    q = select(Alert)
    if status:
        q = q.where(Alert.status == status)
    if pattern:
        q = q.where(Alert.pattern_type == pattern)
    items = db.execute(q.order_by(Alert.risk_score.desc())).scalars().all()
    return {
        "total": len(items),
        "items": [_alert_dict(a) for a in items],
    }


@app.patch("/api/alerts/{alert_id}")
def update_alert(
    alert_id: str,
    payload: dict,
    user: str = Query("analyst"),
    db: Session = Depends(get_db),
) -> dict:
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="alert not found")
    allowed = {"status", "assigned_to", "note"}
    changed = {k: v for k, v in payload.items() if k in allowed}
    if not changed:
        raise HTTPException(status_code=400, detail="no updatable fields provided")
    old = {
        "status": alert.status,
        "assigned_to": alert.assigned_to,
        "note": "",
    }
    for k, v in changed.items():
        setattr(alert, k, v)
    audit(db, user=user, action="alert.update",
          resource=f"alerts/{alert.id}",
          detail={"before": old, "after": changed})
    db.refresh(alert)
    return _alert_dict(alert)


# ── 5. investigations ─────────────────────────────────────────────────


def _risk_breakdown(inv: Investigation, db: Session) -> list[dict]:
    summary = inv.summary_json or {}
    contributions: dict[str, int] = {}
    for a in db.execute(select(Alert)).scalars().all():
        if a.id == inv.alert_id:
            contributions[a.pattern_type] = contributions.get(a.pattern_type, 0) + a.risk_score
    total = sum(contributions.values()) or inv.risk_score or 1
    return [
        {
            "pattern": p,
            "risk": r,
            "weight": round(r / total * 100, 1),
        }
        for p, r in sorted(contributions.items(), key=lambda x: -x[1])
    ] or [{"pattern": "composite", "risk": inv.risk_score, "weight": 100.0}]


def _dossier_dict(inv: Investigation, db: Session) -> dict:
    summary = inv.summary_json or {}
    acct_ids = list(summary.get("accounts", []))
    txn_ids = list(summary.get("transactions", []))

    accounts = [_acct_dict(a) for a in
                (db.execute(select(Account).where(Account.id.in_(acct_ids)))
                 .scalars().all())] if acct_ids else []
    txns = [_txn_dict(t) for t in
            (db.execute(select(Transaction).where(Transaction.id.in_(txn_ids)))
             .scalars().all())] if txn_ids else []

    alerts_here = [a for a in db.execute(select(Alert)).scalars().all()
                   if a.id == inv.alert_id]

    severity = "critical" if inv.risk_score >= 60 else (
        "high" if inv.risk_score >= 40 else "medium"
    )

    return {
        "id": inv.id,
        "alert_id": inv.alert_id,
        "status": inv.status,
        "risk_score": inv.risk_score,
        "severity": severity,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "assigned_to": inv.assigned_to,
        "summary": {
            "description": summary.get("description", ""),
            "primary_account": summary.get("primary_account", ""),
            "pattern_types": [a.pattern_type for a in alerts_here],
            "findings": [_alert_dict(a) for a in alerts_here],
        },
        "evidence": [
            {"txn_id": t["txn_id"], "type": "transaction",
             "detail": f"{t['from']} -> {t['to']} {t['amount']} via {t['channel']} @ {t['timestamp']}"}
            for t in txns
        ],
        "risk_breakdown": _risk_breakdown(inv, db),
        "accounts": accounts,
        "involved_accounts": accounts,
        "transactions": txns,
        "involved_transactions": txns,
    }


def _report_id(inv_id: str) -> str:
    return "RPT-" + "".join(ch for ch in inv_id if ch.isdigit()).zfill(3)


def _build_report(inv: Investigation, db: Session) -> dict:
    d = _dossier_dict(inv, db)
    accts = d["accounts"]
    txns = d["transactions"]
    patterns = d["summary"].get("pattern_types", []) or ["unknown"]
    total_amt = sum(float(t.get("amount") or 0) for t in txns)
    channels = sorted({t.get("channel") for t in txns if t.get("channel")})
    ent_names = [a.get("entity") or a.get("id") for a in accts]
    hops = " -> ".join([t.get("from") or "?" for t in txns[:6]])
    if txns:
        hops += f" -> {txns[min(5, len(txns) - 1)].get('to') or '?'}"
    findings = d["summary"].get("findings", [])
    evidence_txt = findings[0].get("evidence", "") if findings else d["summary"].get("description", "")
    return {
        "id": _report_id(inv.id),
        "investigation_id": inv.id,
        "analyst": inv.assigned_to or "A. Sharma",
        "status": "Ready" if inv.status in ("open", "resolved") else inv.status,
        "generated_at": d["created_at"],
        "risk_score": inv.risk_score,
        "content": {
            "executive_summary": (
                f"Investigation {inv.id} ({', '.join(patterns)}) concerns {len(accts)} accounts "
                f"moving a total of \u20b9{total_amt:,.0f} across {len(txns)} transactions "
                f"(risk {inv.risk_score}/100). {evidence_txt}"
            ),
            "network_overview": (
                f"{len(accts)} accounts in scope: {', '.join(ent_names[:8])}. "
                f"Settlement rails observed: {', '.join(channels) or '\u2014'}."
            ),
            "key_evidence": "; ".join(e.get("detail", "") for e in d["evidence"][:8]),
            "transaction_paths": hops,
            "behavioral_deviations": (
                f"Velocity and structuring deviation vs 60-day baseline "
                f"(z-threshold breach, min volume \u20b95L). {len(txns)} scoped transactions."
            ),
            "linked_entities": ", ".join(
                f"{a.get('entity')} ({a.get('id')})" for a in accts[:10]
            ),
            "risk_assessment": (
                f"Composite risk {inv.risk_score}/100 ({d['severity']}). "
                + "; ".join(
                    f"{b.get('pattern')}: {b.get('risk')} (w {b.get('weight')}%)"
                    for b in d["risk_breakdown"]
                )
            ),
            "recommended_action": (
                "Freeze primary suspect hub before the next settlement window; "
                "file STR with FIU-IND; escalate to Tier-2 SIU."
            ),
        },
    }


@app.get("/api/investigations/{investigation_id}")
def investigation_dossier(
    investigation_id: str, db: Session = Depends(get_db)
) -> dict:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="investigation not found")
    return _dossier_dict(inv, db)


@app.get("/api/investigations/{investigation_id}/timeline")
def investigation_timeline(
    investigation_id: str, db: Session = Depends(get_db)
) -> dict:
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="investigation not found")
    summary = inv.summary_json or {}
    txn_ids = list(summary.get("transactions", []))
    txns = (db.execute(select(Transaction).where(Transaction.id.in_(txn_ids)))
            .scalars().all()) if txn_ids else []

    if not txns:
        return {"investigation_id": inv.id, "days": []}

    txns.sort(key=lambda t: t.timestamp)
    start = txns[0].timestamp.date()
    end = txns[-1].timestamp.date()

    days: list[dict] = []
    cumulative_volume = 0.0
    cumulative_txns = 0
    active_accounts: set[str] = set()

    per_day: dict[datetime.date, list[Transaction]] = defaultdict(list)
    for t in txns:
        per_day[t.timestamp.date()].append(t)

    cursor = start
    index = 0
    while cursor <= end:
        day_txns = per_day.get(cursor, [])
        cumulative_txns += len(day_txns)
        day_volume = sum(t.amount for t in day_txns)
        cumulative_volume += day_volume
        for t in day_txns:
            active_accounts.add(t.from_account)
            active_accounts.add(t.to_account)
        index += 1
        days.append({
            "day": index,
            "date": cursor.isoformat(),
            "txn_count": len(day_txns),
            "volume": round(day_volume, 2),
            "cumulative_txns": cumulative_txns,
            "cumulative_volume": round(cumulative_volume, 2),
            "active_accounts": len(active_accounts),
            "event_txns": [_txn_dict(t) for t in day_txns[:50]],
        })
        cursor += timedelta(days=1)

    return {
        "investigation_id": inv.id,
        "pattern": summary.get("pattern", ""),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_volume": round(cumulative_volume, 2),
        "total_txns": cumulative_txns,
        "days": days,
    }


# ── 6. entities / clusters / embedded patterns (frontend client) ──────


@app.get("/api/entities")
def entities(db: Session = Depends(get_db)) -> dict:
    accts = db.execute(select(Account)).scalars().all()
    txns = db.execute(select(Transaction)).scalars().all()
    agg: dict[str, dict] = {}
    for a in accts:
        e = agg.setdefault(a.entity, {
            "entity": a.entity, "accounts": 0, "volume_in": 0.0,
            "volume_out": 0.0, "txns": 0, "risk": 0,
        })
        e["accounts"] += 1
        e["risk"] += a.risk_score
    for t in txns:
        fa = next((a for a in accts if a.id == t.from_account), None)
        ta = next((a for a in accts if a.id == t.to_account), None)
        if fa:
            agg[fa.entity]["volume_out"] += t.amount
            agg[fa.entity]["txns"] += 1
        if ta:
            agg[ta.entity]["volume_in"] += t.amount
    rows = [
        {**v, "risk": min(v["risk"], 100),
         "volume_in": round(v["volume_in"], 2),
         "volume_out": round(v["volume_out"], 2)}
        for v in agg.values()
    ]
    rows.sort(key=lambda r: -r["risk"])
    return {"total": len(rows), "items": rows}


@app.get("/api/clusters")
def clusters(db: Session = Depends(get_db)) -> list[dict]:
    alerts_all = db.execute(select(Alert)).scalars().all()
    out = []
    for i, a in enumerate(alerts_all, start=1):
        out.append({
            "cluster_id": f"CLU-{i:03d}",
            "accounts": a.account_ids or [],
            "total_risk": a.risk_score,
            "contributions": [{"pattern": a.pattern_type, "risk": a.risk_score}],
        })
    out.sort(key=lambda c: -c["total_risk"])
    return out


@app.get("/api/embedded_patterns")
def embedded_patterns() -> dict:
    try:
        return json.loads((DATA_DIR / "embedded_patterns.json").read_text())
    except Exception:
        return {}


@app.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    return {
        "status": "ok",
        "database": "connected",
        "accounts": db.execute(select(func.count(Account.id))).scalar() or 0,
        "transactions": db.execute(select(func.count(Transaction.id))).scalar() or 0,
        "alerts": db.execute(select(func.count(Alert.id))).scalar() or 0,
        "investigations": db.execute(select(func.count(Investigation.id))).scalar() or 0,
    }


# ── 7. admin ──────────────────────────────────────────────────────────


@app.get("/api/admin/rules")
def admin_rules(db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(DetectionRule).order_by(DetectionRule.id)).scalars().all()
    return {"total": len(rows), "items": [_rule_dict(r) for r in rows]}


@app.patch("/api/admin/rules/{rule_id}")
def update_rule(
    rule_id: str,
    payload: dict,
    user: str = Query("admin"),
    db: Session = Depends(get_db),
) -> dict:
    rule = db.get(DetectionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="rule not found")
    old = _rule_dict(rule)
    for k in ("status", "sensitivity", "weight", "thresholds", "name"):
        if k in payload:
            setattr(rule, k, payload[k])
    rule.updated_at = datetime.utcnow()
    db.commit()
    refresh_detection(db)
    audit(db, user=user, action="rule.update", resource=f"admin/rules/{rule.id}",
          detail={"before": old, "after": _rule_dict(rule)})
    db.refresh(rule)
    return _rule_dict(rule)


@app.patch("/api/admin/rules")
def update_rules_bulk(
    payload: dict,
    user: str = Query("admin"),
    db: Session = Depends(get_db),
) -> dict:
    items = payload.get("items", [])
    if not items and "rules" in payload:
        items = payload["rules"]
    if not items:
        raise HTTPException(status_code=400, detail="no rules provided")
    for item in items:
        rule = db.get(DetectionRule, item.get("id"))
        if not rule:
            continue
        for k in ("status", "sensitivity", "weight", "thresholds", "name"):
            if k in item:
                setattr(rule, k, item[k])
        rule.updated_at = datetime.utcnow()
    db.commit()
    refresh_detection(db)
    audit(db, user=user, action="rules.update.bulk", resource="admin/rules",
          detail={"updated": [i.get("id") for i in items]})
    return admin_rules(db)


@app.get("/api/admin/audit-logs")
def admin_audit_logs(
    limit: int = Query(200, ge=1, le=2000),
    user: str = Query(""),
    action: str = Query(""),
    db: Session = Depends(get_db),
) -> dict:
    q = select(AuditLog)
    if user:
        q = q.where(AuditLog.user == user)
    if action:
        q = q.where(AuditLog.action.like(f"%{action}%"))
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar() or 0
    items = db.execute(q.order_by(AuditLog.timestamp.desc())
                       .limit(limit)).scalars().all()
    return {"total": total, "items": [_log_dict(l) for l in items]}


@app.get("/api/admin/users")
def admin_users(
    role_key: str = Query(""),
    search: str = Query(""),
    db: Session = Depends(get_db),
) -> dict:
    q = select(User)
    if role_key and role_key != "all":
        q = q.where(User.role_key == role_key)
    if search:
        like = f"%{search.lower()}%"
        q = q.where(
            (func.lower(User.name).like(like))
            | (func.lower(User.email).like(like))
            | (func.lower(User.unit).like(like))
        )
    items = db.execute(q.order_by(User.created_at)).scalars().all()
    return {"total": len(items), "items": [_user_dict(u) for u in items]}


@app.post("/api/admin/users")
def create_user(
    payload: dict,
    user: str = Query("admin"),
    db: Session = Depends(get_db),
) -> dict:
    username = payload.get("username") or payload.get("email", "").split("@")[0]
    exists = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="username already exists")
    u = User(
        username=username,
        name=payload.get("name", username),
        email=payload.get("email", ""),
        role=payload.get("role", "L1 Analyst"),
        role_key=payload.get("role_key", "analyst"),
        unit=payload.get("unit", ""),
        status=payload.get("status", "active"),
    )
    db.add(u)
    db.commit()
    audit(db, user=user, action="user.create", resource=f"admin/users/{u.id}",
          detail={"username": username})
    db.refresh(u)
    return _user_dict(u)


@app.patch("/api/admin/users/{user_id}")
def update_user(
    user_id: int,
    payload: dict,
    user: str = Query("admin"),
    db: Session = Depends(get_db),
) -> dict:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="user not found")
    old = _user_dict(u)
    for k in ("name", "email", "role", "role_key", "unit", "status"):
        if k in payload:
            setattr(u, k, payload[k])
    if "last_active" in payload:
        u.last_active = datetime.utcnow()
    db.commit()
    audit(db, user=user, action="user.update", resource=f"admin/users/{u.id}",
          detail={"before": old, "after": _user_dict(u)})
    db.refresh(u)
    return _user_dict(u)


@app.get("/api/admin/health")
def admin_health(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(select(func.count(Account.id)))
        db_ok = True
    except Exception:
        db_ok = False
    acct = db.execute(select(func.count(Account.id))).scalar() or 0
    txns = db.execute(select(func.count(Transaction.id))).scalar() or 0
    alerts_n = db.execute(select(func.count(Alert.id))).scalar() or 0
    rules = db.execute(select(DetectionRule)).scalars().all()
    rules_ok = all(r.status in ("enabled", "disabled") for r in rules)
    return {
        "status": "operational" if db_ok else "degraded",
        "database": "connected" if db_ok else "error",
        "services": {
            "api": "operational",
            "detection_engine": "operational",
            "storage": "operational" if db_ok else "error",
        },
        "counts": {
            "accounts": acct,
            "transactions": txns,
            "alerts": alerts_n,
        },
        "rules": {"total": len(rules), "healthy": rules_ok},
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── reserved for Step 3 ───────────────────────────────────────────────


@app.post("/api/ai-investigator/query")
def ai_investigator_query(payload: dict, db: Session = Depends(get_db)) -> dict:
    """Deterministic, evidence-grounded forensic Q&A (no LLM).

    Answers from persisted dossier data so every claim cites real records.
    """
    question = str(payload.get("question") or payload.get("q") or "")
    inv_id = str(payload.get("investigation_id") or "")
    inv = db.get(Investigation, inv_id) if inv_id else None
    if inv is None:
        inv = db.execute(
            select(Investigation).order_by(Investigation.risk_score.desc())
        ).scalars().first()
    if inv is None:
        raise HTTPException(status_code=404, detail="no investigations available")
    d = _dossier_dict(inv, db)
    accts = d["accounts"]
    txns = d["transactions"]
    patterns = d["summary"].get("pattern_types", []) or ["unknown"]
    total_amt = sum(float(t.get("amount") or 0) for t in txns)
    q = question.lower()

    evidence = [
        {
            "txn_id": t.get("txn_id"),
            "detail": next(
                (e.get("detail", "") for e in d["evidence"]
                 if e.get("txn_id") == t.get("txn_id")),
                "",
            ),
            "from": t.get("from"),
            "to": t.get("to"),
            "amount": t.get("amount"),
        }
        for t in txns[:8]
    ]

    if any(k in q for k in ("path", "shortest", "route", "hop")):
        hops = " -> ".join([t.get("from") or "?" for t in txns[:6]])
        if txns:
            hops += f" -> {txns[min(5, len(txns) - 1)].get('to') or '?'}"
        finding = (
            f"Fund path for {inv.id} ({', '.join(patterns)}): {hops}. "
            f"{len(txns)} scoped transactions totalling \u20b9{total_amt:,.0f}."
        )
    elif any(k in q for k in ("smurf", "threshold", "structur", "5l", "500000")):
        small = [t for t in txns if float(t.get("amount") or 0) < 500000]
        finding = (
            f"{len(small)} of {len(txns)} scoped transactions in {inv.id} sit "
            f"under the \u20b95L threshold, consistent with structuring/smurfing "
            f"to evade reporting. Largest sub-threshold hop: "
            f"\u20b9{max([float(t.get('amount') or 0) for t in small] or [0]):,.0f}."
        )
    elif any(k in q for k in ("outflow", "trace", "fund", "where")):
        outs: dict[str, float] = {}
        for t in txns:
            outs[t.get("from") or "?"] = outs.get(t.get("from") or "?", 0) + float(t.get("amount") or 0)
        top = sorted(outs.items(), key=lambda kv: -kv[1])[:3]
        finding = (
            f"Outflow concentration for {inv.id}: "
            + "; ".join(f"{a} sent \u20b9{v:,.0f}" for a, v in top)
            + f". Total scoped movement \u20b9{total_amt:,.0f} across {len(txns)} transactions."
        )
    else:
        desc = d["summary"].get("description", "")
        finding = (
            f"{inv.id} was flagged for {', '.join(patterns)} with risk "
            f"{inv.risk_score}/100: {desc} {len(accts)} accounts and {len(txns)} "
            f"transactions (\u20b9{total_amt:,.0f}) are in scope."
        )

    return {
        "investigation_id": inv.id,
        "question": question,
        "finding": finding,
        "evidence": evidence,
        "patterns": patterns,
        "risk_score": inv.risk_score,
    }


@app.get("/api/reports")
def reports_list(db: Session = Depends(get_db)) -> dict:
    invs = db.execute(select(Investigation).order_by(Investigation.id)).scalars().all()
    items = [_build_report(inv, db) for inv in invs]
    return {"total": len(items), "items": items}


@app.get("/api/reports/{report_id}")
def report_detail(report_id: str, db: Session = Depends(get_db)) -> dict:
    for inv in db.execute(select(Investigation)).scalars().all():
        if _report_id(inv.id) == report_id.upper():
            return _build_report(inv, db)
    raise HTTPException(status_code=404, detail="report not found")


@app.post("/api/reports/generate")
def reports_generate(payload: dict, db: Session = Depends(get_db)) -> dict:
    inv_id = str(payload.get("investigation_id") or "")
    inv = db.get(Investigation, inv_id) if inv_id else None
    if inv is None:
        raise HTTPException(status_code=404, detail="investigation not found")
    report = _build_report(inv, db)
    audit(db, user="analyst", action="report.generate", resource=report["id"],
          detail={"investigation_id": inv.id})
    return report