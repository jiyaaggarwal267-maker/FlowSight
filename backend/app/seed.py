"""Seed the SQLite database from Step 1 generated data + detection engine.

On first run (empty DB) it:
  1. loads data/accounts.json + data/transactions.json into accounts/transactions,
  2. seeds detection_rules + users,
  3. runs the detection engine and populates alerts + investigations.

`refresh_detection(rules)` re-runs detection for admin rule changes.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import engine as detect_engine
from .models import (
    Account,
    Alert,
    AuditLog,
    DetectionRule,
    Investigation,
    Transaction,
    User,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(name: str) -> list[dict]:
    return json.loads((DATA_DIR / name).read_text())


def _parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


def _account_type(category: str) -> str:
    if category == "retail":
        return "personal"
    return "current"


def _seed_accounts(db: Session) -> None:
    accounts = _load_json("accounts.json")
    txns = _load_json("transactions.json")

    sent: dict[str, float] = {}
    received: dict[str, float] = {}
    for t in txns:
        sent[t["from"]] = sent.get(t["from"], 0.0) + float(t["amount"])
        received[t["to"]] = received.get(t["to"], 0.0) + float(t["amount"])

    created = datetime(2024, 5, 1)
    for a in accounts:
        db.add(
            Account(
                id=a["acct_id"],
                type=_account_type(a.get("category", "retail")),
                institution=a.get("bank", ""),
                bank=a.get("bank", ""),
                entity=a.get("entity", ""),
                city=a.get("city", ""),
                category=a.get("category", "retail"),
                created_date=created.isoformat(),
                total_sent=round(sent.get(a["acct_id"], 0.0), 2),
                total_received=round(received.get(a["acct_id"], 0.0), 2),
                risk_score=0,
            )
        )


def _seed_transactions(db: Session) -> None:
    txns = _load_json("transactions.json")
    for t in txns:
        db.add(
            Transaction(
                id=t["txn_id"],
                from_account=t["from"],
                to_account=t["to"],
                amount=float(t["amount"]),
                timestamp=_parse_ts(t["timestamp"]),
                channel=t["channel"],
                status="completed",
            )
        )


def _seed_rules(db: Session) -> None:
    for rule in detect_engine.default_rules():
        db.add(
            DetectionRule(
                id=rule["id"],
                name=rule["name"],
                pattern=rule["pattern"],
                status="enabled",
                sensitivity=rule["sensitivity"],
                weight=rule["weight"],
                thresholds=rule["thresholds"],
            )
        )


def _seed_users(db: Session) -> None:
    users = [
        ("a.sharma", "Ananya Sharma", "a.sharma@flowsight.internal",
         "Senior Analyst (L2)", "senior-analyst", "FIU Special Investigations"),
        ("r.mehta", "Rohit Mehta", "r.mehta@flowsight.internal",
         "Compliance Officer", "compliance", "Central Compliance Gate"),
        ("p.roy", "Priya Roy", "p.roy@flowsight.internal",
         "L1 Triage Analyst", "analyst", "Triage & Intake Desk"),
        ("admin", "Platform Admin", "admin@flowsight.internal",
         "Platform Admin", "admin", "Platform Engineering"),
        ("v.kulkarni", "Vikram Kulkarni", "v.kulkarni@flowsight.internal",
         "Senior Analyst (L2)", "senior-analyst", "FIU Special Investigations"),
    ]
    now = datetime.utcnow()
    for i, (uname, name, email, role, role_key, unit) in enumerate(users):
        db.add(
            User(
                username=uname,
                name=name,
                email=email,
                role=role,
                role_key=role_key,
                unit=unit,
                status="active",
                last_active=now - timedelta(minutes=6 * (i + 1)),
            )
        )


def _compute_account_risks(db: Session, findings: list[dict]) -> dict[str, int]:
    risk: dict[str, int] = {}
    for f in findings:
        for a in f["accounts"]:
            risk[a] = risk.get(a, 0) + int(f["risk"])
    return {k: min(v, 100) for k, v in risk.items()}


def _seed_alerts_and_investigations(db: Session, findings: list[dict]) -> None:
    existing = db.execute(select(Alert.id)).scalars().all()
    if existing:
        return

    account_risks = _compute_account_risks(db, findings)
    ordered = sorted(
        findings,
        key=lambda f: -max(account_risks.get(a, 0) for a in f["accounts"]),
    )
    now = datetime.utcnow()
    for n, f in enumerate(ordered, start=1):
        accts = list(f["accounts"])
        alert_risk = max(account_risks.get(a, 0) for a in accts)
        alert = Alert(
            id=f"ALT-{n:04d}",
            pattern_type=f["pattern"],
            risk_score=alert_risk,
            account_ids=accts,
            amount=_alert_amount(f, db),
            detected_at=now,
            status="open",
            evidence=f["evidence"],
            transaction_ids=list(f["transactions"]),
        )
        db.add(alert)
        db.flush()
        # Every alert gets an investigation dossier (top-risk treated most severe).
        inv = Investigation(
            id=f"INV-{n:03d}",
            alert_id=alert.id,
            status="open",
            risk_score=alert_risk,
            summary_json=_build_summary(f, accts),
            assigned_to="A. Sharma" if n <= 3 else "",
        )
        db.add(inv)


def _alert_amount(f: dict, db: Session) -> float:
    """Sum transaction amounts referenced by a finding (fall back to 0)."""
    tids = f.get("transactions", [])
    if not tids:
        return 0.0
    rows = db.execute(
        select(Transaction.amount).where(Transaction.id.in_(tids))
    ).scalars().all()
    return round(sum(rows), 2)


def _build_summary(f: dict, accts: list[str]) -> dict:
    return {
        "pattern": f["pattern"],
        "primary_account": accts[0] if accts else "",
        "accounts": accts,
        "transactions": list(f.get("transactions", [])),
        "evidence": f.get("evidence", ""),
        "description": _pattern_description(f["pattern"]),
    }


def _pattern_description(pattern: str) -> str:
    return {
        "circular_flow": "Money returns to origin through a multi-hop loop "
                         "within a short window, indicating round-tripping.",
        "fan_out": "A single account rapidly disperses funds to many distinct "
                   "counterparties, a common layering technique.",
        "fan_in": "Many distinct accounts funnel funds into one account, "
                  "consistent with smurfing/collection.",
        "behavioral_deviation": "Account activity spikes far above its own "
                                "historical baseline (count + volume).",
        "rapid_movement": "Large inflow is forwarded to new destinations "
                          "almost immediately at a high ratio.",
    }.get(pattern, pattern)


def seed_if_needed(db: Session) -> bool:
    """Populate everything on first run; returns True if freshly seeded."""
    if db.execute(select(Account.id).limit(1)).first():
        # Backfill alerts if a previous run created data but failed detection.
        if not db.execute(select(Alert.id).limit(1)).first():
            rules = _rules_dict(db)
            findings, _clusters = detect_engine.run_with_rules(rules)
            _seed_alerts_and_investigations(db, findings)
            risks = _compute_account_risks(db, findings)
            for acct_id, score in risks.items():
                acct = db.get(Account, acct_id)
                if acct:
                    acct.risk_score = score
            db.commit()
        return False

    _seed_accounts(db)
    _seed_transactions(db)
    _seed_rules(db)
    _seed_users(db)
    db.commit()

    rules = _rules_dict(db)
    findings, _clusters = detect_engine.run_with_rules(rules)
    _seed_alerts_and_investigations(db, findings)

    risks = _compute_account_risks(db, findings)
    for acct_id, score in risks.items():
        acct = db.get(Account, acct_id)
        if acct:
            acct.risk_score = score
            acct.total_sent = acct.total_sent
    db.commit()
    return True


def _rules_dict(db: Session) -> list[dict]:
    rows = db.execute(select(DetectionRule)).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "pattern": r.pattern,
            "status": r.status,
            "sensitivity": r.sensitivity,
            "weight": r.weight,
            "thresholds": r.thresholds,
        }
        for r in rows
    ]


def _finding_key(f: dict) -> tuple:
    return (
        f["pattern"],
        tuple(sorted(f.get("accounts", []))),
        tuple(sorted(f.get("transactions", []))),
    )


def refresh_detection(db: Session) -> tuple[list[dict], list[dict]]:
    """Re-run detection with current rule config and refresh alerts/dossiers.

    Alert IDs are preserved when the finding is unchanged; new findings get new
    alerts and stale ones are removed. Returns (findings, clusters).
    """
    rules = _rules_dict(db)
    findings, clusters = detect_engine.run_with_rules(rules)
    account_risks = _compute_account_risks(db, findings)

    existing_alerts = {
        a.id: a for a in db.execute(select(Alert)).scalars().all()
    }
    by_key: dict[tuple, Alert] = {}
    for a in existing_alerts.values():
        by_key.setdefault(
            (a.pattern_type,
             tuple(sorted(a.account_ids or [])),
             tuple(sorted(a.transaction_ids or []))),
            a,
        )

    active_ids: set[str] = set()
    used_ids: set[str] = set()

    def _next_alert_id() -> str:
        n = 1
        while f"ALT-{n:04d}" in existing_alerts or f"ALT-{n:04d}" in used_ids:
            n += 1
        return f"ALT-{n:04d}"

    def _alert_risk(f: dict) -> int:
        return max(account_risks.get(a, 0) for a in f["accounts"])

    ordered = sorted(
        findings,
        key=lambda f: -max(account_risks.get(a, 0) for a in f["accounts"]),
    )
    for f in ordered:
        matched: Alert | None = by_key.get(_finding_key(f))
        if matched is not None:
            alert = matched
        else:
            alert = Alert(id=_next_alert_id())
            used_ids.add(alert.id)

        risk = _alert_risk(f)
        alert.pattern_type = f["pattern"]
        alert.risk_score = risk
        alert.account_ids = list(f["accounts"])
        alert.amount = _alert_amount(f, db)
        alert.evidence = f["evidence"]
        alert.transaction_ids = list(f["transactions"])
        if not alert.detected_at:
            alert.detected_at = datetime.utcnow()
        if not alert.status:
            alert.status = "open"
        db.add(alert)
        active_ids.add(alert.id)

        inv = db.execute(
            select(Investigation).where(Investigation.alert_id == alert.id)
        ).scalar_one_or_none()
        if inv is None:
            inv = Investigation(id=f"INV-{_inv_number(alert.id)}",
                                alert_id=alert.id, status="open",
                                assigned_to="A. Sharma"
                                if risk >= 60 else "")
            db.add(inv)
        inv.risk_score = risk
        inv.summary_json = _build_summary(f, list(f["accounts"]))

    # Remove stale alerts + their dossiers.
    stale = [a for i, a in existing_alerts.items() if i not in active_ids]
    stale_ids = [a.id for a in stale]
    if stale_ids:
        db.execute(
            Investigation.__table__.delete().where(
                Investigation.alert_id.in_(stale_ids)
            )
        )
        for a in stale:
            db.delete(a)

    risks = _compute_account_risks(db, findings)
    for acct_id, score in risks.items():
        acct = db.get(Account, acct_id)
        if acct:
            acct.risk_score = score

    db.commit()
    return findings, clusters


def _inv_number(alert_id: str) -> int:
    try:
        return int(alert_id.split("-")[1])
    except Exception:
        return 1


def audit(db: Session, user: str, action: str, resource: str = "",
          result: str = "success", detail: dict[str, Any] | None = None) -> None:
    """Append an audit_logs row (required for every state-changing endpoint)."""
    db.add(
        AuditLog(
            user=user,
            action=action,
            resource=resource,
            result=result,
            detail=detail or {},
        )
    )
    db.commit()