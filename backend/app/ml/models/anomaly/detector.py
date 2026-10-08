"""Reporting-delay anomaly detection by robust (modified) z-score.

Chosen by evaluation against the dataset's AnomalyLabel (scripts/evaluate_models.py): the labelled
anomalies are overwhelmingly cases reported unusually late, and a robust z-score on log reporting delay
ranks them far better than a multi-feature Isolation Forest (average precision 0.95 vs 0.14).

Modified z-score = (x - median) / (1.4826 * MAD) on log1p(delay hours); cases at or above the
standard 3.5 cutoff (Iglewicz & Hoaglin, 1993) are flagged.
"""

from __future__ import annotations

import numpy as np

MODEL_VERSION = "anomaly-robust-z-v1"
MODIFIED_Z_CUTOFF = 3.5
MAD_SCALE = 1.4826


def delay_scores(delays_hours: list[float]) -> tuple[np.ndarray, float, float]:
    """Robust z-scores of log reporting delay plus the median delay (hours) and the log-scale MAD."""
    log_delay = np.log1p(np.clip(np.asarray(delays_hours, dtype=float), 0.0, None))
    median = float(np.median(log_delay))
    spread = float(np.median(np.abs(log_delay - median)) * MAD_SCALE)
    if spread == 0.0:
        return np.zeros_like(log_delay), float(np.expm1(median)), 0.0
    return (log_delay - median) / spread, float(np.expm1(median)), spread


def detect_anomalies(cases: list[dict]) -> list[dict]:
    """cases: [{case_master_id, reporting_delay_hours}, ...] -> flagged cases, most anomalous first."""
    if len(cases) < 3:
        return []
    z_scores, median_hours, spread = delay_scores([case["reporting_delay_hours"] for case in cases])
    if spread == 0.0:
        return []

    order = z_scores.argsort()
    percentile = np.empty(len(cases))
    percentile[order] = np.arange(1, len(cases) + 1) / len(cases)

    findings = []
    for index, case in enumerate(cases):
        if z_scores[index] < MODIFIED_Z_CUTOFF:
            continue
        delay = case["reporting_delay_hours"]
        findings.append({
            "case_master_id": case["case_master_id"],
            "anomaly_score": round(float(percentile[index]), 4),
            "z_score": round(float(z_scores[index]), 2),
            "factors": [
                f"Reported {delay:.1f} hours after the incident; the typical case is reported after {median_hours:.1f} hours",
                f"Robust z-score {z_scores[index]:.1f} (flag threshold {MODIFIED_Z_CUTOFF})",
            ],
        })
    return sorted(findings, key=lambda item: item["z_score"], reverse=True)
