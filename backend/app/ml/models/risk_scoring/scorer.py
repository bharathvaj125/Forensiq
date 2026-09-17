"""Dataset-trained, explainable risk scoring for the Phase 4 API."""

from functools import lru_cache
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from app.core.config import settings
from app.ml.models.risk_scoring.train import train_risk_model
from app.ml.models.risk_scoring.explain import (
    explain_prediction_local,
    get_confidence_meaning,
    get_investigator_insights
)

FEATURES = [
    "GravityOffenceID", "ReportingDelayHours", "CaseAgeDays",
    "NumberOfAccused", "NumberOfEvidenceItems",
]


@lru_cache(maxsize=1)
def _model() -> RandomForestClassifier:
    """Load serialized risk scoring model. Fail-fast if absent."""
    import joblib
    from pathlib import Path
    model_path = Path(__file__).parents[2] / "saved_models" / "risk_scoring_rf.joblib"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Required ML artifact 'risk_scoring_rf.joblib' is missing from {model_path.parent}. "
            f"Run 'python train_and_save_all_models.py' before deploying to Catalyst AppSail."
        )
    return joblib.load(model_path)


def predict_risk(payload: dict) -> dict:
    """Predict calibrated risk, confidence level, and local explainability values."""
    model = _model()

    feat_dict = {
        "GravityOffenceID": int(int(payload.get("gravity_offence_id", 0)) == 1),
        "ReportingDelayHours": max(0.0, float(payload.get("reporting_delay_hours", 0))),
        "CaseAgeDays": max(0.0, float(payload.get("case_age_days", 0))),
        "NumberOfAccused": max(0, int(payload.get("number_of_accused", 0))),
        "NumberOfEvidenceItems": max(0, int(payload.get("number_of_evidence_items", 0))),
    }

    features_df = pd.DataFrame([feat_dict])
    probabilities = model.predict_proba(features_df[FEATURES])[0]

    # Percentile-calibrated risk score levels based on dataset distribution
    # (Distribution: Mean ~0.15, 75th percentile ~0.34, Max ~0.52)
    if score >= 0.45:
        level = "Critical"
    elif score >= 0.25:
        level = "High"
    elif score >= 0.10:
        level = "Medium"
    else:
        level = "Low"

    # Prediction Confidence (probability of the predicted class)
    pred_class = int(model.predict(features_df[FEATURES])[0])
    confidence = float(probabilities[pred_class])

    confidence_meaning = get_confidence_meaning(confidence)

    # Compute Tree-based SHAP contributions and local summary
    explanation = explain_prediction_local(model, feat_dict)
    
    # Dual-mapped factor schema: supports both old backend keys & new XAI keys
    top_factors = []
    for f in explanation["factors"]:
        top_factors.append({
            "feature_name": f["feature"],
            "impact_score": f["contribution"],
            "feature": f["feature"],
            "contribution": f["contribution"],
            "percentage": f["percentage"],
            "direction": f["direction"],
            "description": f"[{f['direction'].upper()}: {f['percentage']}%] {f['description']}"
        })

    # Include additional dynamic helper insights
    insights = get_investigator_insights(feat_dict)
    summary_text = explanation["summary"]
    if insights:
        summary_text += " Insights: " + " ".join(insights)

    return {
        "score": round(score, 4),
        "risk_level": level,
        "model_version": "phase4-risk-rf-v3",
        "confidence": round(confidence, 4),
        "confidence_meaning": confidence_meaning,
        "summary": summary_text,
        "top_factors": top_factors,
    }
