"""Unsupervised behavioral anomaly scoring (Isolation Forest).

This is an ADDITIVE fifth signal layered on top of the four rule-based
detectors in `detection.py`. It never replaces, disables, or reweights those
detectors -- it only contributes additional risk points on top of whatever
they already found.

How it works
------------
1. `build_features` turns every account into a small numeric vector describing
   its real transaction behaviour, computed from the `transactions` table.
2. `train` fits a scikit-learn `IsolationForest` on those vectors. There are no
   labels involved: it learns what "normal" looks like from the population
   itself, so no manual tagging of fraud is required.
3. `score_accounts` converts Isolation Forest's raw `score_samples` output
   (lower/more negative = more anomalous) into a 0-100 scale where HIGHER means
   MORE anomalous, by min-max scaling against the observed population spread.
4. The model is persisted with joblib so a warm boot can score without retraining.

`ML_RISK_WEIGHT` is the maximum number of points this signal may add to an
account's risk score. The five rule weights in `detection.py` sum to 106, so a
capped +15 keeps the ML layer influential but strictly secondary -- a maximally
anomalous account is a supporting indicator, never on its own a critical alert.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest

# Maximum risk points the ML signal may contribute to an account's score.
# The rule detectors already total 106 points, so this stays a clear
# supporting signal rather than a dominant one.
ML_RISK_WEIGHT = 15

MODEL_PATH = Path(__file__).resolve().parent.parent / "data" / "isolation_forest.joblib"

# Isolation Forest is distance/outlier oriented, so a modest contamination guess
# keeps the ranking sensible even though we never use the predicted labels.
_ISOLATION_FOREST_PARAMS: dict[str, Any] = {
    "n_estimators": 300,
    "contamination": 0.1,
    "random_state": 42,
}

FEATURE_NAMES = [
    "txn_count",
    "avg_amount",
    "amount_std",
    "unique_counterparties",
    "avg_hours_between_txns",
    "out_in_ratio",
]


@dataclass(frozen=True)
class MLModel:
    """A trained Isolation Forest plus the population bounds used to scale it."""

    model: IsolationForest
    raw_min: float
    raw_max: float
    n_accounts: int
    feature_names: tuple[str, ...] = tuple(FEATURE_NAMES)

    def raw_score(self, vector: np.ndarray) -> float:
        """Raw Isolation Forest score (lower/more negative = more anomalous)."""
        return float(self.model.score_samples(vector.reshape(1, -1))[0])

    def anomaly_score(self, vector: np.ndarray) -> float:
        """Map a raw score onto 0-100 where higher is MORE anomalous.

        Isolation Forest returns negative scores where more negative means more
        anomalous, so the range is inverted before scaling.
        """
        raw = self.raw_score(vector)
        span = self.raw_max - self.raw_min
        if span <= 0:
            return 0.0
        inverted = self.raw_max - raw
        return float(min(100.0, max(0.0, inverted / span * 100.0)))

    def risk_points(self, anomaly_score: float) -> int:
        """Risk points contributed by an anomaly score, capped at ML_RISK_WEIGHT."""
        return int(round(min(100.0, max(0.0, anomaly_score)) / 100.0 * ML_RISK_WEIGHT))


def build_features(txn_rows: list[dict], account_ids: list[str]) -> dict[str, np.ndarray]:
    """Build one feature vector per account from raw transaction rows.

    Each row is a dict with `from_account`, `to_account`, `amount`, `timestamp`
    (datetime) and `status` -- exactly the columns the `transactions` table has.
    """
    grouped: dict[str, list[dict]] = {a: [] for a in account_ids}
    for t in txn_rows:
        src = t.get("from_account")
        dst = t.get("to_account")
        if src in grouped:
            grouped[src].append(t)
        if dst in grouped and dst != src:
            grouped[dst].append(t)

    vectors: dict[str, np.ndarray] = {}
    for acct, txns in grouped.items():
        if not txns:
            # A brand-new account is itself unusual; zero-activity is encoded
            # explicitly rather than dropped so it still receives a score.
            vectors[acct] = np.zeros(len(FEATURE_NAMES), dtype=float)
            continue

        sent = [t for t in txns if t.get("from_account") == acct]
        received = [t for t in txns if t.get("to_account") == acct and t.get("from_account") != acct]

        amounts = np.array([float(t.get("amount") or 0.0) for t in txns], dtype=float)
        counterparties = {
            t.get("to_account") if t.get("from_account") == acct else t.get("from_account")
            for t in txns
            if t.get("to_account") is not None and t.get("from_account") is not None
        }
        counterparties.discard(acct)

        times = sorted(t["timestamp"] for t in txns if t.get("timestamp") is not None)
        if len(times) > 1:
            gaps = [
                (times[i + 1] - times[i]).total_seconds() / 3600.0
                for i in range(len(times) - 1)
            ]
            avg_gap = float(np.mean(gaps)) if gaps else 0.0
        else:
            avg_gap = 0.0

        sent_total = float(sum(float(t.get("amount") or 0.0) for t in sent))
        recv_total = float(sum(float(t.get("amount") or 0.0) for t in received))
        if recv_total > 0:
            out_in_ratio = sent_total / recv_total
        elif sent_total > 0:
            # Outbound-only with no inbound at all is an extreme ratio.
            out_in_ratio = float(len(sent) * 1000)
        else:
            out_in_ratio = 0.0

        vectors[acct] = np.array(
            [
                float(len(txns)),
                float(np.mean(amounts)) if amounts.size else 0.0,
                float(np.std(amounts)) if amounts.size else 0.0,
                float(len(counterparties)),
                avg_gap,
                out_in_ratio,
            ],
            dtype=float,
        )
    return vectors


def train(vectors: dict[str, np.ndarray]) -> MLModel | None:
    """Fit the Isolation Forest on all account feature vectors."""
    if len(vectors) < 10:
        # Too small a population for a meaningful density estimate.
        return None

    matrix = np.vstack(list(vectors.values()))
    model = IsolationForest(**_ISOLATION_FOREST_PARAMS)
    model.fit(matrix)
    raw = model.score_samples(matrix)
    return MLModel(
        model=model,
        raw_min=float(np.min(raw)),
        raw_max=float(np.max(raw)),
        n_accounts=len(vectors),
    )


def score_accounts(ml_model: MLModel, vectors: dict[str, np.ndarray]) -> dict[str, dict]:
    """Return per-account anomaly scores, risk points and dominant features."""
    results: dict[str, dict] = {}
    for acct, vector in vectors.items():
        anomaly = ml_model.anomaly_score(vector)
        results[acct] = {
            "anomaly_score": round(anomaly, 1),
            "risk_points": ml_model.risk_points(anomaly),
            "features": {
                name: round(float(value), 2)
                for name, value in zip(ml_model.feature_names, vector)
            },
        }
    return results


def save_model(ml_model: MLModel) -> None:
    """Persist the trained model so a warm boot can score without retraining."""
    import joblib

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(ml_model, MODEL_PATH)


def load_model() -> MLModel | None:
    """Load a previously trained model, or None if none was persisted."""
    if not MODEL_PATH.exists():
        return None
    try:
        import joblib

        return joblib.load(MODEL_PATH)
    except Exception:
        return None
