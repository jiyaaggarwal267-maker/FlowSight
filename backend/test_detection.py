"""FLOWSIGHT Step 1c: cross-checks the detection engine against the known
embedded patterns from generate_data.py and prints a human-readable report.
"""

from __future__ import annotations

from detection import (
    run_detection,
    detect_circular_flows,
    detect_fan_out,
    detect_fan_in,
    detect_behavioral_deviation,
    detect_rapid_movement,
    RISK_WEIGHTS,
)

# Ground truth: account IDs where each pattern is embedded by generate_data.py
GROUND_TRUTH = {
    "circular_flow": {"accounts": {"AC-10207"}, "max_risk": RISK_WEIGHTS["circular_flow"]},
    "fan_out": {"accounts": {"AC-10263"}, "max_risk": RISK_WEIGHTS["fan_out"]},
    "fan_in": {"accounts": {"AC-10288"}, "max_risk": RISK_WEIGHTS["fan_in"]},
    "behavioral_deviation": {"accounts": {"AC-10312"}, "max_risk": RISK_WEIGHTS["behavioral_deviation"]},
    "rapid_movement": {"accounts": {"AC-10335"}, "max_risk": RISK_WEIGHTS["rapid_movement"]},
}


def fmt(amount: int) -> str:
    if amount >= 1e7:
        return f"₹{amount/1e7:.1f} Cr"
    if amount >= 1e5:
        return f"₹{amount/1e5:.1f}L"
    return f"₹{amount:,}"


def main() -> None:
    findings, clusters, G = run_detection()

    by_pattern: dict[str, list[dict]] = {}
    for f in findings:
        by_pattern.setdefault(f["pattern"], []).append(f)

    print("=" * 78)
    print("FLOWSIGHT Step 1c — detection cross-check report")
    print("=" * 78)
    print(f"Accounts scored         : {G.number_of_nodes()}")
    print(f"Transactions analyzed   : {G.number_of_edges()}")
    print(f"Total findings produced : {len(findings)}")
    print()

    passed: list[str] = []
    failed: list[str] = []

    for pat, truth in GROUND_TRUTH.items():
        dets = by_pattern.get(pat, [])
        print(f"[{pat}] detections = {len(dets)}")
        if not dets:
            print("  !! NO detection produced for this pattern")
            failed.append(pat)
            continue

        # The embedded pattern must appear among detections, not necessarily
        # as the highest-risk one (risks are equal per-pattern).
        matching = [
            d for d in dets
            if set(d["accounts"]) & truth["accounts"]
        ]
        hit = len(matching) > 0
        rule = all(d["risk"] >= truth["max_risk"] for d in matching)
        status = "PASS" if (hit and rule) else "FAIL"
        (passed if status == "PASS" else failed).append(pat)

        top = max(dets, key=lambda d: d["risk"])
        print(f"  detections: {len(dets)} (match ground truth: {hit})")
        for d in matching:
            print(f"    MATCH risk={d['risk']} evidence={d['evidence']}")
        if not matching:
            print(f"    top      : risk={top['risk']} accounts={top['accounts']}")
            print(f"    evidence : {top['evidence']}")
        print(f"  expected : accounts={sorted(truth['accounts'])} max_risk={truth['max_risk']}")
        print(f"  status   : {status}")

    print()
    print("=" * 78)
    print(f"PATTERN MATCHES: {len(passed)}/{len(GROUND_TRUTH)}")
    if failed:
        print("FAILED patterns:", ", ".join(failed))
    else:
        print("All embedded patterns recovered correctly.")
    print()

    # Cluster risk report
    print("-" * 78)
    print("Detected clusters ranked by risk (top 8)")
    print("-" * 78)
    for c in clusters[:8]:
        contrib = ", ".join(f"{x['pattern']}={x['risk']}" for x in c["contributions"])
        print(f"{c['cluster_id']} risk={c['total_risk']:>3} | "
              f"{len(c['accounts'])} acct | {contrib}")

    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
