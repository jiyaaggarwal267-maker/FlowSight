"""FLOWSIGHT Step 1b: pattern detection engine.

Loads the generated JSON corpus into a NetworkX MultiDiGraph, runs four
independent detectors (circular flow, fan-out/fan-in, behavioural deviation,
rapid movement), and returns structured findings with cluster-level risk scores.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import networkx as nx
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent / "data"

RISK_WEIGHTS: dict[str, int] = {
    "circular_flow": 28,
    "fan_out": 22,
    "fan_in": 22,
    "behavioral_deviation": 19,
    "rapid_movement": 15,
}


def fmt(amount: int) -> str:
    if amount >= 1e7:
        return f"₹{amount/1e7:.1f} Cr"
    if amount >= 1e5:
        return f"₹{amount/1e5:.1f}L"
    return f"₹{amount:,}"


# ── load ──────────────────────────────────────────────────────────────

def load_data(
    accounts_path: str | Path = DATA_DIR / "accounts.json",
    transactions_path: str | Path = DATA_DIR / "transactions.json",
) -> tuple[nx.MultiDiGraph, dict[str, dict], list[dict]]:
    accounts = json.loads(Path(accounts_path).read_text())
    transactions = json.loads(Path(transactions_path).read_text())
    accounts_map = {a["acct_id"]: a for a in accounts}

    G = nx.MultiDiGraph()
    for a in accounts:
        G.add_node(a["acct_id"], **a)
    for t in transactions:
        G.add_edge(
            t["from"], t["to"],
            txn_id=t["txn_id"], amount=t["amount"],
            timestamp=datetime.fromisoformat(t["timestamp"]),
            channel=t["channel"],
        )
    return G, accounts_map, transactions


# ── detector 1: circular flows ────────────────────────────────────────

def detect_circular_flows(
    G: nx.MultiDiGraph,
    window_hours: float = 72.0,
    min_edge_amount: int = 100_000,
    max_cycle_len: int = 6,
) -> list[dict]:
    """Find money-return cycles using a time-bounded path search.

    Instead of a blind DFS (which explodes combinatorially on a dense graph),
    we grow paths forward sorted by timestamp, only extending along edges that
    are >= min_edge_amount and appear after the previous edge. When the walk
    returns to its own start within `window_hours`, a cycle is recorded.
    """
    findings: list[dict] = []
    seen: set[frozenset[str]] = set()

    # Pre-sort outgoing edges per node by timestamp, keeping only big edges.
    out_map: dict[str, list[tuple[datetime, str, int, str]]] = {}
    for node in G.nodes():
        edges = [
            (d["timestamp"], nxt, d["amount"], d["txn_id"])
            for _, nxt, d in G.out_edges(node, data=True)
            if d["amount"] >= min_edge_amount
        ]
        edges.sort(key=lambda e: e[0])
        out_map[node] = edges

    for start in out_map:
        if not out_map[start]:
            continue
        # Stack items: (current node, path tuple of (acct, txn_id, amount, ts),
        #              count). Path is rooted at start.
        stack: list[tuple[str, tuple, int]] = [(start, (), 0)]
        while stack:
            cur, path, depth = stack.pop()
            if depth >= max_cycle_len:
                continue
            last_ts = path[-1][3] if path else datetime.min
            for ts, nxt, amt, tid in out_map[cur]:
                if ts < last_ts:
                    continue
                new_path = path + ((cur, tid, amt, ts),)
                if nxt == start and len(new_path) >= 3:
                    key = frozenset(p[0] for p in new_path)
                    if key in seen:
                        continue
                    span_h = (new_path[-1][3] - new_path[0][3]).total_seconds() / 3600
                    if span_h > window_hours:
                        continue
                    seen.add(key)
                    accts = [p[0] for p in new_path]
                    txn_ids = [p[1] for p in new_path]
                    total = sum(p[2] for p in new_path)
                    chain = " -> ".join(accts) + " -> " + start
                    findings.append({
                        "pattern": "circular_flow",
                        "accounts": accts,
                        "transactions": txn_ids,
                        "risk": RISK_WEIGHTS["circular_flow"],
                        "evidence": (
                            f"Circular flow {chain}, {fmt(total)} across "
                            f"{len(txn_ids)} hops, closes in {span_h:.1f}h"
                        ),
                    })
                elif nxt != start:
                    stack.append((nxt, new_path, depth + 1))
    return findings


# ── detector 2: fan-out ───────────────────────────────────────────────

def detect_fan_out(
    G: nx.MultiDiGraph,
    window_hours: float = 6.0,
    min_targets: int = 10,
) -> list[dict]:
    findings: list[dict] = []
    for node in G.nodes():
        edges = sorted(
            [(d["timestamp"], tgt, d["amount"], d["txn_id"])
             for _, tgt, d in G.out_edges(node, data=True)],
            key=lambda x: x[0],
        )
        if len(edges) < min_targets:
            continue
        lo = 0
        best: list | None = None
        for hi in range(len(edges)):
            while (edges[hi][0] - edges[lo][0]).total_seconds() > window_hours * 3600:
                lo += 1
            batch = edges[lo:hi + 1]
            distinct = {b[1] for b in batch}
            if len(distinct) >= min_targets and (best is None or len(batch) > len(best)):
                best = batch
        if not best:
            continue
        tgts = sorted({b[1] for b in best})
        txn_ids = [b[3] for b in best]
        total = sum(b[2] for b in best)
        span = (best[-1][0] - best[0][0]).total_seconds() / 3600
        short = ", ".join(tgts[:3]) + ("…" if len(tgts) > 3 else "")
        findings.append({
            "pattern": "fan_out",
            "accounts": [node] + tgts,
            "transactions": txn_ids,
            "risk": RISK_WEIGHTS["fan_out"],
            "evidence": (
                f"{node} fanned out to {len(tgts)} accounts ({short}) "
                f"in {span:.1f}h, {len(txn_ids)} txns, {fmt(total)} total"
            ),
        })
    return findings


# ── detector 3: fan-in ────────────────────────────────────────────────

def detect_fan_in(
    G: nx.MultiDiGraph,
    window_hours: float = 6.0,
    min_sources: int = 10,
) -> list[dict]:
    findings: list[dict] = []
    for node in G.nodes():
        edges = sorted(
            [(d["timestamp"], src, d["amount"], d["txn_id"])
             for src, _, d in G.in_edges(node, data=True)],
            key=lambda x: x[0],
        )
        if len(edges) < min_sources:
            continue
        lo = 0
        best: list | None = None
        for hi in range(len(edges)):
            while (edges[hi][0] - edges[lo][0]).total_seconds() > window_hours * 3600:
                lo += 1
            batch = edges[lo:hi + 1]
            distinct = {b[1] for b in batch}
            if len(distinct) >= min_sources and (best is None or len(batch) > len(best)):
                best = batch
        if not best:
            continue
        srcs = sorted({b[1] for b in best})
        txn_ids = [b[3] for b in best]
        total = sum(b[2] for b in best)
        span = (best[-1][0] - best[0][0]).total_seconds() / 3600
        findings.append({
            "pattern": "fan_in",
            "accounts": srcs + [node],
            "transactions": txn_ids,
            "risk": RISK_WEIGHTS["fan_in"],
            "evidence": (
                f"{len(srcs)} accounts fanned into {node} in {span:.1f}h, "
                f"{len(txn_ids)} txns, {fmt(total)} total"
            ),
        })
    return findings


# ── detector 4: behavioural deviation ─────────────────────────────────

def detect_behavioral_deviation(
    transactions: list[dict],
    baseline_days: int = 60,
    z_threshold: float = 3.0,
    min_abs_count: int = 5,
    min_abs_vol: int = 300_000,
) -> list[dict]:
    df = pd.DataFrame(transactions)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    min_ts = df["timestamp"].min()
    df["day"] = (df["timestamp"] - min_ts).dt.days

    # An account is "active on a day" if it sends OR receives that day. The
    # deviation may appear on the inflow (credits) or outflow (debits) side.
    def agg(c):
        d = df.rename(columns={c: "_acct"})
        return (
            d.groupby(["_acct", "day"])
            .agg(count=("txn_id", "count"), volume=("amount", "sum"))
            .reset_index()
        )

    daily = pd.concat(
        [agg("from"), agg("to")], ignore_index=True
    )
    daily = (
        daily.groupby(["_acct", "day"])
        .agg(count=("count", "sum"), volume=("volume", "sum"))
        .reset_index()
    )

    cutoff = baseline_days
    findings: list[dict] = []

    for acct, grp in daily.groupby("_acct"):
        grp = grp.set_index("day").sort_index()
        base = grp[grp.index < cutoff]
        if len(base) > 0:
            mc = float(base["count"].mean())
            sc = float(base["count"].std(ddof=0) or 0)
            mv = float(base["volume"].mean())
            sv = float(base["volume"].std(ddof=0) or 0)
        else:
            mc, sc, mv, sv = 0.0, 0.0, 0.0, 0.0
        # Spike must be a meaningful jump over baseline (z-score) AND clear an
        # absolute floor, guarding against pure noise / first-activation.
        tc = max(min_abs_count, mc + z_threshold * sc)
        tv = max(min_abs_vol, mv + z_threshold * sv)
        det = grp[grp.index >= cutoff]
        spikes = det[(det["count"] >= tc) & (det["volume"] >= tv)]
        if spikes.empty:
            continue
        spike_set = set(spikes.index.tolist())
        spike_txns = [
            t["txn_id"] for t in transactions
            if t["from"] == acct or t["to"] == acct
            if int((datetime.fromisoformat(t["timestamp"]) - min_ts).days) in spike_set
        ]
        mc_s = int(spikes["count"].max())
        vol_s = int(spikes["volume"].sum())
        findings.append({
            "pattern": "behavioral_deviation",
            "accounts": [acct],
            "transactions": spike_txns,
            "risk": RISK_WEIGHTS["behavioral_deviation"],
            "evidence": (
                f"{acct} baseline: {mc:.1f}/day {fmt(int(mv))} | "
                f"spike: {mc_s} txns/day on {len(spikes)} days, "
                f"{fmt(vol_s)} total"
            ),
        })
    return findings


# ── detector 5: rapid movement ────────────────────────────────────────

def detect_rapid_movement(
    G: nx.MultiDiGraph,
    window_hours: float = 2.0,
    forward_ratio: float = 0.85,
    min_inflow: int = 500_000,
) -> list[dict]:
    findings: list[dict] = []
    for node in G.nodes():
        in_e = sorted(
            [(d["timestamp"], d["amount"], d["txn_id"])
             for _, _, d in G.in_edges(node, data=True)],
            key=lambda x: x[0],
        )
        out_e = sorted(
            [(d["timestamp"], d["amount"], d["txn_id"])
             for _, _, d in G.out_edges(node, data=True)],
            key=lambda x: x[0],
        )
        if not in_e or not out_e:
            continue
        worst: dict | None = None
        for in_ts, in_amt, in_tid in in_e:
            if in_amt < min_inflow:
                continue
            end = in_ts + timedelta(hours=window_hours)
            fwd = sum(a for t, a, _ in out_e if in_ts < t <= end)
            # Forwarded must not exceed the actual inflow (ignore pre-existing
            # balance "forwarding" that would inflate the ratio).
            if fwd > in_amt:
                continue
            fwd_tids = [tid for t, _, tid in out_e if in_ts < t <= end]
            r = fwd / in_amt
            if r >= forward_ratio:
                if worst is None or r > worst["ratio"]:
                    worst = dict(in_amt=in_amt, fwd=fwd, ratio=r,
                                 in_tid=in_tid, out_tids=fwd_tids,
                                 hours=(end - in_ts).total_seconds() / 3600)
        if worst is None:
            continue
        findings.append({
            "pattern": "rapid_movement",
            "accounts": [node],
            "transactions": [worst["in_tid"]] + worst["out_tids"],
            "risk": RISK_WEIGHTS["rapid_movement"],
            "evidence": (
                f"{node} received {fmt(worst['in_amt'])}, forwarded "
                f"{worst['ratio']*100:.0f}% ({fmt(worst['fwd'])}) in "
                f"{worst['hours']:.1f}h via {len(worst['out_tids'])} txns"
            ),
        })
    return findings


# ── risk combining ────────────────────────────────────────────────────

def _cluster_key(f: dict) -> str:
    p, a = f["pattern"], f["accounts"]
    if p == "fan_out":
        return a[0]
    if p == "fan_in":
        return a[-1]
    return tuple(sorted(a))


def combine_risk(findings: list[dict]) -> list[dict]:
    clusters: dict[str, dict] = {}
    for f in findings:
        k = _cluster_key(f)
        if k not in clusters:
            clusters[k] = {"cluster_id": f"CLU-{len(clusters)+1:03d}",
                           "accounts": [], "total_risk": 0, "findings": []}
        c = clusters[k]
        c["findings"].append(f)
        c["accounts"] = sorted(set(c["accounts"]) | set(f["accounts"]))
        c["total_risk"] = min(c["total_risk"] + f["risk"], 100)
    for c in clusters.values():
        c["contributions"] = [{"pattern": f["pattern"], "risk": f["risk"]}
                              for f in c["findings"]]
        del c["findings"]
    return sorted(clusters.values(), key=lambda c: -c["total_risk"])


# ── runner ────────────────────────────────────────────────────────────

def run_detection(
    accounts_path: str | Path = DATA_DIR / "accounts.json",
    transactions_path: str | Path = DATA_DIR / "transactions.json",
) -> tuple[list[dict], list[dict], nx.MultiDiGraph]:
    G, accts, txns = load_data(accounts_path, transactions_path)
    findings: list[dict] = []
    findings += detect_circular_flows(G)
    findings += detect_fan_out(G)
    findings += detect_fan_in(G)
    findings += detect_behavioral_deviation(txns)
    findings += detect_rapid_movement(G)
    return findings, combine_risk(findings), G