"""Red Team Mode: adversarial evasion simulator.

Generates synthetic fraud networks in a throwaway sandbox and runs the REAL
`detection.py` detectors against them with the thresholds currently configured
on the Admin -> Detection Rules page.

Isolation
---------
Everything lives in this module's in-memory `_SANDBOX` dict plus a temp
directory that is deleted after every run. No sandbox account, transaction,
alert or investigation is ever written to the database, so Overview, Alerts,
Network Explorer, Investigations and Flow Timeline cannot see any of it.
Sandbox account ids are namespaced `RT-####` and can never collide with the
real `AC-#####` range.

Realism contract
----------------
Outcomes are never assumed. `simulate` builds the network, hands it to the
same `detection.py` functions the rest of the app uses, and reports exactly
which detectors fired (if any). When nothing fires, the result panel explains
which live threshold the pattern slipped past, quoting the configured value.
"""

from __future__ import annotations

import random
import shutil
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import networkx as nx

import detection as det
from . import engine as detect_engine

# In-memory sandbox. Never persisted to the database.
_SANDBOX: dict[str, Any] = {"network": None, "log": []}

MAX_LOG = 25

# Baseline amount for generated edges. Deliberately well above the default
# ₹1,00,000 minimum edge amount so that, at low sophistication, amount size is
# not a hidden confound: the only thing catching the pattern is the pattern.
BASE_AMOUNT = 450_000

CHANNELS = ["UPI", "IMPS", "NEFT", "RTGS"]

# Sophistication presets. Each maps the four controls onto concrete values.
PRESETS: dict[str, dict[str, float]] = {
    "low": {"hop_count": 3, "time_spread_hours": 6, "amount_variance": 0.05, "dilution": 0},
    "medium": {"hop_count": 4, "time_spread_hours": 30, "amount_variance": 0.15, "dilution": 2},
    "high": {"hop_count": 5, "time_spread_hours": 60, "amount_variance": 0.30, "dilution": 3},
    "extreme": {"hop_count": 8, "time_spread_hours": 140, "amount_variance": 0.85, "dilution": 5},
}

CONTROL_BOUNDS = {
    "hop_count": (3, 12),
    "time_spread_hours": (1, 240),
    "amount_variance": (0.0, 0.95),
    "dilution": (0, 8),
}


# ── live thresholds ──────────────────────────────────────────────────

def live_thresholds(rules: list[dict]) -> dict[str, dict[str, Any]]:
    """Effective thresholds, i.e. what the engine will actually use right now.

    Mirrors `engine._apply_config`: an enabled rule's stored weight/thresholds
    win, anything unset falls back to the detector signature defaults. Read
    only -- this never mutates the module-level state of `detection.py`.
    """
    enabled = {r["pattern"]: r for r in rules if r.get("status") == "enabled"}
    out: dict[str, dict[str, Any]] = {}
    for pattern, defaults in detect_engine.DETECTOR_DEFAULTS.items():
        rule = enabled.get(pattern)
        merged = dict(defaults)
        weight = det.RISK_WEIGHTS.get(pattern, 0)
        if rule:
            weight = int(rule.get("weight") or weight)
            stored = rule.get("thresholds") or {}
            merged.update({k: v for k, v in stored.items() if k in merged})
        out[pattern] = {
            "enabled": rule is not None,
            "weight": weight,
            "thresholds": merged,
        }
    return out


# ── generation ───────────────────────────────────────────────────────

def _make_accounts(chain: list[str], noise: list[str]) -> list[dict]:
    accounts = []
    for i, acct in enumerate(chain):
        accounts.append({
            "acct_id": acct,
            "name": f"RedTeam Node {i}",
            "type": "current",
            "institution": "SANDBOX",
            "bank": "SANDBOX",
            "entity": f"RT Node {i}",
            "city": "Sandbox",
            "category": "business",
        })
    for i, acct in enumerate(noise):
        accounts.append({
            "acct_id": acct,
            "name": f"RedTeam Noise {i}",
            "type": "current",
            "institution": "SANDBOX",
            "bank": "SANDBOX",
            "entity": f"RT Noise {i}",
            "city": "Sandbox",
            "category": "retail",
        })
    return accounts


def _generate(
    hop_count: int,
    time_spread_hours: float,
    amount_variance: float,
    dilution: int,
    rng: random.Random,
) -> dict[str, Any]:
    """Build one circular-flow network with optional noise-account dilution."""
    # origin -> ... -> origin, `hop_count` edges in total.
    chain = [f"RT-{i:04d}" for i in range(1, hop_count + 1)]
    noise = [f"RT-9{i:03d}" for i in range(1, dilution + 1)]

    start = datetime(2024, 10, 1, 9, 0, 0)
    # Spread the hops so the *closing* edge lands exactly `time_spread_hours`
    # after the first one. The detector measures span as (last edge ts - first
    # edge ts), so this makes the control equal the span the detector sees.
    # hop_count >= 3 (see CONTROL_BOUNDS) so the divisor is never zero.
    step_h = time_spread_hours / (hop_count - 1)

    txns: list[dict] = []
    counter = 0

    def add_edge(src: str, dst: str, ts: datetime, amount: float) -> None:
        nonlocal counter
        counter += 1
        txns.append({
            "txn_id": f"RTX-{counter:05d}",
            "from": src,
            "to": dst,
            "amount": amount,
            # Whole seconds, matching the real corpus format. detect_behavioral_
            # deviation feeds this straight to pd.to_datetime, which infers a
            # single format and rejects fractional seconds.
            "timestamp": ts.replace(microsecond=0).isoformat(),
            "channel": rng.choice(CHANNELS),
        })

    for i in range(hop_count):
        src = chain[i]
        dst = chain[(i + 1) % hop_count]
        offset = int(round(step_h * 3600 * i))
        ts = start + timedelta(seconds=offset)
        jitter = 1.0 + rng.uniform(-amount_variance, amount_variance)
        add_edge(src, dst, ts, max(1, int(round(BASE_AMOUNT * jitter))))

    # Dilution: noise accounts that move small, obviously-benign amounts. They
    # add corpus noise so the sandbox is not a suspiciously clean ring, and they
    # count toward the population the other detectors (fan-out/fan-in) inspect.
    if dilution:
        for i, n in enumerate(noise):
            ts = start + timedelta(hours=rng.uniform(0, max(time_spread_hours, 1)))
            amt = rng.randint(4_000, 22_000)
            peer = chain[rng.randrange(hop_count)]
            add_edge(n, peer, ts, amt)
            add_edge(peer, n, ts + timedelta(minutes=7), amt)

    amounts = [t["amount"] for t in txns]
    span_h = (datetime.fromisoformat(txns[hop_count - 1]["timestamp"]) - start).total_seconds() / 3600

    return {
        "accounts": _make_accounts(chain, noise),
        "transactions": txns,
        "chain": chain,
        "noise": noise,
        "cycle_txns": txns[:hop_count],
        "hop_count": hop_count,
        "span_hours": round(span_h, 1),
        "amount_variance": amount_variance,
        "min_cycle_amount": min(amounts[:hop_count]),
        "max_cycle_amount": max(amounts[:hop_count]),
        "total_amount": sum(amounts),
        "edges": [
            {"txn_id": t["txn_id"], "from": t["from"], "to": t["to"],
             "amount": t["amount"], "channel": t["channel"],
             "timestamp": t["timestamp"]}
            for t in txns
        ],
    }


# ── detection against the sandbox ────────────────────────────────────

def _run_real_detection(
    net: dict[str, Any],
    th: dict[str, dict[str, Any]],
) -> dict[str, list[dict]]:
    """Run the genuine `detection.py` detectors over the sandbox network.

    The network is written to a temp directory and loaded back through
    `detection.load_data`, so the graph the detectors see is built by the real
    loader from the real on-disk format. Thresholds are passed as explicit
    keyword arguments rather than by monkeypatching module globals, so this
    cannot leak configuration into the live engine.
    """
    tmp = Path(tempfile.mkdtemp(prefix="flowsight_redteam_"))
    try:
        import json

        a_path = tmp / "accounts.json"
        t_path = tmp / "transactions.json"
        a_path.write_text(json.dumps(net["accounts"]))
        t_path.write_text(json.dumps(net["transactions"]))

        G, _accounts_map, txns = det.load_data(a_path, t_path)

        def params(pattern: str) -> dict[str, Any]:
            return dict(th.get(pattern, {}).get("thresholds", {}))

        return {
            "circular_flow": det.detect_circular_flows(G, **params("circular_flow")),
            "fan_out": det.detect_fan_out(G, **params("fan_out")),
            "fan_in": det.detect_fan_in(G, **params("fan_in")),
            "behavioral_deviation": det.detect_behavioral_deviation(
                txns, **params("behavioral_deviation")),
            "rapid_movement": det.detect_rapid_movement(G, **params("rapid_movement")),
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _evaluate(net: dict[str, Any], results: dict[str, list[dict]], th: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Decide caught/evaded from real detector output, and explain why.

    `caught` is True only when a detector produced a finding that actually
    touches the generated network. The evasion reasons are computed by
    comparing the generated network's real properties against the live
    thresholds, so the explanation is derived, never scripted.
    """
    sandbox_ids = {a["acct_id"] for a in net["accounts"]}
    triggered: list[dict[str, Any]] = []
    for pattern, findings in results.items():
        for f in findings:
            if not set(f["accounts"]) & sandbox_ids:
                continue
            cfg = th.get(pattern, {})
            triggered.append({
                "pattern": pattern,
                "risk": f["risk"],
                "weight": cfg.get("weight"),
                "evidence": f["evidence"],
                "accounts": f["accounts"],
                "transactions": f["transactions"],
            })
    triggered.sort(key=lambda t: -t["risk"])

    cf = th.get("circular_flow", {}).get("thresholds", {})
    window = float(cf.get("window_hours", 72.0))
    min_edge = float(cf.get("min_edge_amount", 100_000))
    max_len = int(cf.get("max_cycle_len", 6))

    reasons: list[dict[str, Any]] = []
    if net["span_hours"] > window:
        reasons.append({
            "control": "Time spread",
            "detail": (
                f"Cycle closed in {net['span_hours']:.1f}h. The circular-flow "
                f"detector's time window is {window:g}h, so the path's own "
                f"deadline expires before the money returns to the origin."
            ),
        })
    if net["hop_count"] > max_len:
        reasons.append({
            "control": "Hop count",
            "detail": (
                f"Chain is {net['hop_count']} hops. The detector abandons any path "
                f"once it reaches depth {max_len}, so a cycle this long is "
                f"pruned mid-search and never closes."
            ),
        })
    if net["min_cycle_amount"] < min_edge:
        reasons.append({
            "control": "Amount variance",
            "detail": (
                f"Smallest cycle edge is ₹{net['min_cycle_amount']:,.0f}, below the "
                f"₹{min_edge:,.0f} minimum edge amount, so those edges are discarded "
                f"before the cycle can be traced."
            ),
        })

    # How much jitter is actually needed before the band dips under the floor.
    variance_needed = max(0.0, 1.0 - (min_edge / BASE_AMOUNT))
    # Levers that add realism but do not, on their own, defeat any detector.
    # Reported explicitly so the page never overstates what a control does.
    non_evasive = [
        {
            "control": "Account dilution",
            "detail": (
                f"{len(net['noise'])} noise accounts add corpus realism but do not "
                f"themselves defeat a detector — they neither lengthen the cycle nor "
                f"move it outside the time window."
            ),
        },
        {
            "control": "Amount variance",
            "detail": (
                f"Only above ≈{variance_needed:.0%} does the amount band dip under the "
                f"₹{min_edge:,.0f} edge floor. At the current "
                f"{net['amount_variance']:.0%} the smallest edge is "
                f"₹{net['min_cycle_amount']:,.0f}, still above it, so variance is "
                f"cosmetically realistic here but not the reason for the outcome. "
                f"Note the circular-flow detector has no variance or roundness test "
                f"of its own — it only checks a floor."
            ),
        },
    ] if net["noise"] else [{
        "control": "Amount variance",
        "detail": (
            f"Only above ≈{variance_needed:.0%} does the amount band dip under the "
            f"₹{min_edge:,.0f} edge floor. At the current "
            f"{net['amount_variance']:.0%} the smallest edge is "
            f"₹{net['min_cycle_amount']:,.0f}, still above it. The circular-flow "
            f"detector has no variance or roundness test of its own — only a floor."
        ),
    }]

    # Per-detector honesty. Only circular_flow is meaningfully testable against a
    # ring this small; the rest either need a population or a history the sandbox
    # deliberately does not have. Saying so is more useful than a green "clear".
    n_accounts = len(net["accounts"])
    fan_out_t = th.get("fan_out", {}).get("thresholds", {})
    fan_in_t = th.get("fan_in", {}).get("thresholds", {})
    behav_t = th.get("behavioral_deviation", {}).get("thresholds", {})
    rapid_t = th.get("rapid_movement", {}).get("thresholds", {})

    applicability = {
        "circular_flow": {
            "testable": True,
            "note": (
                f"Primary target. A {net['hop_count']}-hop ring is exactly what this "
                f"detector searches for."
            ),
        },
        "fan_out": {
            "testable": n_accounts >= int(fan_out_t.get("min_targets", 10)),
            "note": (
                f"Needs {fan_out_t.get('min_targets', 10)} distinct targets within "
                f"{fan_out_t.get('window_hours', 6):g}h; the sandbox has "
                f"{n_accounts} accounts total."
            ),
        },
        "fan_in": {
            "testable": n_accounts >= int(fan_in_t.get("min_sources", 10)),
            "note": (
                f"Needs {fan_in_t.get('min_sources', 10)} distinct sources within "
                f"{fan_in_t.get('window_hours', 6):g}h; the sandbox has "
                f"{n_accounts} accounts total."
            ),
        },
        "behavioral_deviation": {
            "testable": False,
            "note": (
                f"Needs {behav_t.get('baseline_days', 60)} days of history to build a "
                f"baseline; the sandbox covers a single day by design, so there is "
                f"nothing to deviate from."
            ),
        },
        "rapid_movement": {
            "testable": net["span_hours"] <= 2 * float(rapid_t.get("window_hours", 2)),
            "note": (
                f"Needs inflow ≥ ₹{rapid_t.get('min_inflow', 500_000):,.0f} re-forwarded "
                f"within {rapid_t.get('window_hours', 2):g}h. The sandbox hops are "
                f"{(net['span_hours'] / max(net['hop_count'] - 1, 1)):.1f}h apart."
            ),
        },
    }

    detector_report = []
    for pattern, meta in applicability.items():
        hits = [t for t in triggered if t["pattern"] == pattern]
        detector_report.append({
            "pattern": pattern,
            "weight": th.get(pattern, {}).get("weight"),
            "enabled": th.get(pattern, {}).get("enabled", False),
            "status": "fired" if hits else ("clear" if meta["testable"] else "not_applicable"),
            "hits": len(hits),
            "note": meta["note"],
        })

    total_risk = min(sum(t["risk"] for t in triggered), 100)
    return {
        "caught": bool(triggered),
        "detectors": triggered,
        "detector_report": detector_report,
        "risk_score": total_risk,
        "evasion_reasons": reasons,
        "non_evasive_controls": non_evasive,
        "thresholds_used": {
            "circular_flow": {
                "window_hours": window,
                "min_edge_amount": min_edge,
                "max_cycle_len": max_len,
            }
        },
    }


# ── public API ───────────────────────────────────────────────────────

def simulate(params: dict[str, Any], rules: list[dict], seed: int | None = None) -> dict[str, Any]:
    """Generate one evasion attempt and test it with the real engine."""
    preset = params.get("preset") or "custom"
    # A bare {"preset": "extreme"} must produce the preset's own values, so the
    # preset is the base layer and explicit keys override it. The frontend sends
    # all four controls (and reads them back from /config), which keeps the two
    # sides from drifting.
    base = dict(PRESETS.get(preset, {})) if preset in PRESETS else {}
    for k in ("hop_count", "time_spread_hours", "amount_variance", "dilution"):
        if k in params and params[k] is not None:
            base[k] = params[k]

    hop_count = int(base.get("hop_count", 3))
    spread = float(base.get("time_spread_hours", 24))
    variance = float(base.get("amount_variance", 0.1))
    dilution = int(base.get("dilution", 0))

    lo, hi = CONTROL_BOUNDS["hop_count"]
    hop_count = max(lo, min(hop_count, hi))
    lo, hi = CONTROL_BOUNDS["dilution"]
    dilution = max(lo, min(dilution, hi))
    lo, hi = CONTROL_BOUNDS["amount_variance"]
    variance = max(lo, min(variance, hi))

    rng = random.Random(seed)
    th = live_thresholds(rules)

    net = _generate(hop_count, spread, variance, dilution, rng)
    results = _run_real_detection(net, th)
    verdict = _evaluate(net, results, th)

    record = {
        "id": f"RTS-{len(_SANDBOX['log']) + 1:03d}",
        "level": preset,
        "params": {
            "hop_count": hop_count,
            "time_spread_hours": spread,
            "amount_variance": variance,
            "dilution": dilution,
        },
        "caught": verdict["caught"],
        "risk_score": verdict["risk_score"],
        "detector_patterns": [d["pattern"] for d in verdict["detectors"]],
        "span_hours": net["span_hours"],
        "min_cycle_amount": net["min_cycle_amount"],
        "verdict": verdict,
        "network": net,
    }
    _SANDBOX["network"] = record
    _SANDBOX["log"].insert(0, record)
    del _SANDBOX["log"][MAX_LOG:]
    return record


def state() -> dict[str, Any]:
    return {"current": _SANDBOX["network"], "log": _SANDBOX["log"]}


def clear() -> dict[str, Any]:
    _SANDBOX["network"] = None
    _SANDBOX["log"] = []
    return {"cleared": True}
