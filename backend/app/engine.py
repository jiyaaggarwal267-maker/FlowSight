"""Detection engine wrapper.

Imports and runs the Step 1 detectors (detection.py) WITHOUT modifying their
logic. Configuration from the `detection_rules` table is applied at runtime by
monkeypatching module-level defaults (risk weights + detector parameters) and
by filtering enabled patterns, so admin rule edits genuinely change detection
output before alerts/investigations are refreshed.
"""

from __future__ import annotations

import inspect
import json
from pathlib import Path
from typing import Any

import detection as det

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Detector kwargs per pattern (subset of the function signature we expose to
# rules as thresholds). Values mirror detection.py defaults.
DETECTOR_DEFAULTS: dict[str, dict[str, Any]] = {
    "circular_flow": {
        "window_hours": 72.0,
        "min_edge_amount": 100_000,
        "max_cycle_len": 6,
    },
    "fan_out": {"window_hours": 6.0, "min_targets": 10},
    "fan_in": {"window_hours": 6.0, "min_sources": 10},
    "behavioral_deviation": {
        "baseline_days": 60,
        "z_threshold": 3.0,
        "min_abs_count": 5,
        "min_abs_vol": 300_000,
    },
    "rapid_movement": {
        "window_hours": 2.0,
        "forward_ratio": 0.85,
        "min_inflow": 500_000,
    },
}

PATTERNS = list(DETECTOR_DEFAULTS.keys())


def default_rules() -> list[dict]:
    """Seed configuration when the detection_rules table is empty."""
    return [
        {
            "id": "RULE-CIRC-001",
            "name": "Circular Flow Detection",
            "pattern": "circular_flow",
            "sensitivity": "medium",
            "weight": det.RISK_WEIGHTS.get("circular_flow", 28),
            "thresholds": DETECTOR_DEFAULTS["circular_flow"],
        },
        {
            "id": "RULE-FANOUT-001",
            "name": "Fan-Out (Structuring) Detection",
            "pattern": "fan_out",
            "sensitivity": "medium",
            "weight": det.RISK_WEIGHTS.get("fan_out", 22),
            "thresholds": DETECTOR_DEFAULTS["fan_out"],
        },
        {
            "id": "RULE-FANIN-001",
            "name": "Fan-In (Smurfing Funnel) Detection",
            "pattern": "fan_in",
            "sensitivity": "medium",
            "weight": det.RISK_WEIGHTS.get("fan_in", 22),
            "thresholds": DETECTOR_DEFAULTS["fan_in"],
        },
        {
            "id": "RULE-BEHAV-001",
            "name": "Behavioral Deviation Detection",
            "pattern": "behavioral_deviation",
            "sensitivity": "medium",
            "weight": det.RISK_WEIGHTS.get("behavioral_deviation", 19),
            "thresholds": DETECTOR_DEFAULTS["behavioral_deviation"],
        },
        {
            "id": "RULE-RAPID-001",
            "name": "Rapid Movement Detection",
            "pattern": "rapid_movement",
            "sensitivity": "medium",
            "weight": det.RISK_WEIGHTS.get("rapid_movement", 15),
            "thresholds": DETECTOR_DEFAULTS["rapid_movement"],
        },
    ]


def _apply_config(rules: list[dict]) -> None:
    """Push rule configuration into the Step 1 engine at module level."""
    weights: dict[str, int] = {}
    enabled_patterns: list[str] = []
    for rule in rules:
        pattern = rule.get("pattern", "")
        if pattern not in DETECTOR_DEFAULTS:
            continue
        if rule.get("status") == "enabled":
            weights[pattern] = int(rule.get("weight") or 0)
            enabled_patterns.append(pattern)
        # Also override the detector's keyword defaults (thresholds) so the
        # engine consumes them directly.
        defaults = rule.get("thresholds") or {}
        merged = dict(DETECTOR_DEFAULTS[pattern])
        merged.update({k: v for k, v in defaults.items() if k in merged})
        _apply_detector_defaults(pattern, merged)
    weights.update(
        {p: det.RISK_WEIGHTS[p] for p in det.RISK_WEIGHTS if p not in weights}
    )
    det.RISK_WEIGHTS.clear()
    det.RISK_WEIGHTS.update(weights)


def _apply_detector_defaults(pattern: str, params: dict[str, Any]) -> None:
    """Set detector function keyword defaults in the order of their signature."""
    funcs = {
        "circular_flow": det.detect_circular_flows,
        "fan_out": det.detect_fan_out,
        "fan_in": det.detect_fan_in,
        "behavioral_deviation": det.detect_behavioral_deviation,
        "rapid_movement": det.detect_rapid_movement,
    }
    func = funcs[pattern]
    names = [
        p
        for p in inspect.signature(func).parameters.values()
        if p.default is not inspect.Parameter.empty
    ]
    values = tuple(
        params.get(n.name, DETECTOR_DEFAULTS[pattern][n.name]) for n in names
    )
    func.__defaults__ = values


def run_with_rules(
    rules: list[dict],
    accounts_path: str | Path = DATA_DIR / "accounts.json",
    transactions_path: str | Path = DATA_DIR / "transactions.json",
) -> tuple[list[dict], list[dict]]:
    """Run the Step 1 engine with configuration applied.

    Returns (findings, clusters). Only enabled patterns are retained.
    """
    _apply_config(rules)
    findings, clusters, _g = det.run_detection(accounts_path, transactions_path)
    enabled = {r["pattern"] for r in rules if r.get("status") == "enabled"}
    findings = [f for f in findings if f["pattern"] in enabled]
    clusters = [
        c for c in clusters
        if any(cp["pattern"] in enabled for cp in c.get("contributions", []))
    ]
    return findings, clusters


def run_default() -> tuple[list[dict], list[dict]]:
    default = default_rules()
    for rule in default:
        rule["status"] = "enabled"
    return run_with_rules(default)