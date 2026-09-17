import numpy as np
from sklearn.ensemble import IsolationForest
from functools import lru_cache

@lru_cache(maxsize=1)
def _get_anomaly_model():
    """Load serialized IsolationForest anomaly detector model. Fail-fast if absent."""
    import joblib
    from pathlib import Path
    model_path = Path(__file__).parents[2] / "saved_models" / "anomaly_detector.joblib"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Required ML artifact 'anomaly_detector.joblib' is missing from {model_path.parent}. "
            f"Run 'python train_and_save_all_models.py' before deploying to Catalyst AppSail."
        )
    return joblib.load(model_path)


def detect_anomalies(cases: list[dict]) -> list[dict]:
    """Flag statistically unusual cases with features scaling and calibrated scores."""
    if len(cases) < 3:
        return []

    raw_matrix = []
    for case in cases:
        delay = float(case.get("reporting_delay_hours", 0.0))
        accused = float(case.get("number_of_accused", 0.0))
        evidence = float(case.get("number_of_evidence_items", 0.0))
        raw_matrix.append([delay, accused, evidence])

    matrix = np.asarray(raw_matrix, dtype=float)

    # 1. Feature Engineering: log transforms to stabilize skewness
    log_delay = np.log1p(matrix[:, 0])
    accused_count = matrix[:, 1]
    evidence_count = matrix[:, 2]

    # Feature interaction ratio
    evidence_accused_ratio = evidence_count / (accused_count + 1.0)

    engineered_features = np.column_stack([
        log_delay,
        accused_count,
        evidence_count,
        evidence_accused_ratio
    ])

    # 2. Fit Isolation Forest model
    model = IsolationForest(contamination="auto", random_state=42).fit(engineered_features)
    scores = -model.score_samples(engineered_features)

    # 3. Dynamic Thresholding (Outliers are values above the 85th percentile)
    threshold = float(np.percentile(scores, 85))
    max_score = float(np.max(scores))

    p85_delay = float(np.percentile(matrix[:, 0], 85))
    p85_accused = float(np.percentile(matrix[:, 1], 85))
    p15_evidence = float(np.percentile(matrix[:, 2], 15))

    findings = []
    for index, (case, score) in enumerate(zip(cases, scores)):
        if score < threshold:
            continue

        # Calibrate score as anomaly confidence scaled to [0.5, 1.0]
        denom = max(0.0001, max_score - threshold)
        confidence = 0.5 + 0.5 * ((score - threshold) / denom)

        # 4. Generate granular explanation factors
        factors = []
        raw_delay = matrix[index, 0]
        raw_accused = matrix[index, 1]
        raw_evidence = matrix[index, 2]

        if raw_delay >= p85_delay and p85_delay > 0:
            factors.append(f"Unusually long reporting delay ({round(raw_delay, 1)} hours)")
        if raw_accused >= p85_accused and p85_accused > 0:
            factors.append(f"Unusually high number of accused ({int(raw_accused)} persons)")
        if raw_evidence <= p15_evidence:
            factors.append(f"Low evidence volume ({int(raw_evidence)} items) relative to complexity")

        if not factors:
            factors.append("Unusual combination of feature ratios (delay-evidence imbalance)")

        findings.append({
            "case_master_id": case["case_master_id"],
            "anomaly_score": round(confidence, 4),
            "factors": factors
        })

    return sorted(findings, key=lambda item: item["anomaly_score"], reverse=True)
