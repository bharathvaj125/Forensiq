"""Case risk scoring with the dataset-trained RandomForest (see train.py).

index  = the stored risk score, 0-1: the expected severity, sum(class number x probability) / 3 with
         Low=0, Medium=1, High=2, Severe=3 (so Low is near 0, Medium near 0.33, High near 0.67, Severe near 1)
high_probability = estimated probability that the case is rated High or Severe in the dataset's labelling
level  = most probable class: Low / Medium / High / Severe
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.ml.models.risk_scoring.explain import explain_case, global_importance
from app.ml.models.risk_scoring.train import HIGH_CLASS_INDEXES

ARTIFACT_PATH = Path(__file__).parents[2] / "saved_models" / "risk_scoring_rf.joblib"

PRIORITY_BY_LEVEL = {"Low": "Low", "Medium": "Medium", "High": "High", "Severe": "High"}


@lru_cache(maxsize=1)
def load_artifact() -> dict:
    if not ARTIFACT_PATH.exists():
        raise FileNotFoundError(
            f"Risk model artifact missing at {ARTIFACT_PATH}. Train it with: python scripts/train_models.py"
        )
    artifact = joblib.load(ARTIFACT_PATH)
    if not isinstance(artifact, dict) or "model" not in artifact:
        raise RuntimeError("Risk model artifact is in an outdated format. Retrain with: python scripts/train_models.py")
    return artifact


def model_version() -> str:
    return load_artifact()["version"]


def model_card() -> dict:
    artifact = load_artifact()
    return {
        "version": artifact["version"],
        "trained_at": artifact["trained_at"],
        "trained_on": artifact["trained_on"],
        "cross_validation": artifact["cross_validation"]["chosen"],
        "majority_class_accuracy": artifact["cross_validation"]["majority_class_accuracy"],
        "feature_importance": global_importance(artifact),
    }


def score_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Vectorised scoring. Returns score, level, confidence and the four class probabilities per row."""
    artifact = load_artifact()
    model = artifact["model"]
    raw = model.predict_proba(frame[artifact["features"]].astype(float))
    proba = np.zeros((len(frame), len(artifact["classes"])))
    for column, label in enumerate(model.classes_):
        proba[:, int(label)] = raw[:, column]

    result = pd.DataFrame(proba, index=frame.index, columns=[f"p_{name}" for name in artifact["classes"]])
    result["high_probability"] = proba[:, list(HIGH_CLASS_INDEXES)].sum(axis=1)
    result["score"] = (proba * np.arange(len(artifact["classes"]))).sum(axis=1) / (len(artifact["classes"]) - 1)
    result["level"] = [artifact["classes"][i] for i in proba.argmax(axis=1)]
    result["confidence"] = proba.max(axis=1)
    return result


def predict_risk(row: dict, value_labels: dict | None = None) -> dict:
    """Score one case from its feature row and explain the score."""
    artifact = load_artifact()
    scored = score_frame(pd.DataFrame([row]))
    entry = scored.iloc[0]
    explanation = explain_case(artifact, row, value_labels)

    level = entry["level"]
    cv = artifact["cross_validation"]["chosen"]
    top = explanation["factors"][:3]
    drivers = "; ".join(f"{f['feature']} ({f['contribution'] * 100:+.1f} pts)" for f in top)
    top_factors = [
        {
            "feature_name": f["feature"],
            "impact_score": f["contribution"],
            "feature": f["feature"],
            "contribution": f["contribution"],
            "percentage": f["percentage"],
            "direction": f["direction"],
            "description": f["description"],
        }
        for f in explanation["factors"]
    ]
    return {
        "score": round(float(entry["score"]), 4),
        "high_probability": round(float(entry["high_probability"]), 4),
        "risk_level": level,
        "priority": PRIORITY_BY_LEVEL[level],
        "model_version": artifact["version"],
        "confidence": round(float(entry["confidence"]), 4),
        "confidence_meaning": (
            f"The model gives '{level}' a {entry['confidence']:.0%} probability. Across 5-fold cross-validation on "
            f"{artifact['trained_on']['rows']} labelled cases it was right {cv['accuracy']:.0%} of the time "
            f"(always guessing the most common class would be right {artifact['cross_validation']['majority_class_accuracy']:.0%})."
        ),
        "summary": (f"Risk index {entry['score'] * 100:.0f}/100: most likely class {level}, with an estimated "
                    f"{entry['high_probability']:.0%} chance of a High or Severe rating. Main drivers: {drivers}."),
        "class_probabilities": {name: round(float(entry[f"p_{name}"]), 4) for name in artifact["classes"]},
        "baseline_probability": explanation["baseline_probability"],
        "top_factors": top_factors,
    }
