from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.crud import case_crud
from app.schemas.intelligence import (
    EmbeddingBackfillResponse,
    CrimeTrendForecastResponse,
    RepeatOffenderResponse,
    AnomalyResponse,
    PredictRiskResponse,
    RiskFactor,
    SimilarCasesResponse,
)
from app.services import intelligence_service

router = APIRouter()


@router.get("/anomalies", response_model=AnomalyResponse, summary="Detect Case Anomalies")
def get_case_anomalies(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Return explainable anomaly flags within the active jurisdiction scope."""
    return intelligence_service.detect_case_anomalies(db, current_user)


@router.get("/offenders/{accused_id}/repeat-offender-matches", response_model=RepeatOffenderResponse, summary="Find Repeat-Offender Matches")
def get_repeat_offender_matches(
    accused_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Return explainable likely repeat-offender matches within permitted case scope."""
    return intelligence_service.resolve_repeat_offenders(db, accused_id, current_user)


@router.get("/forecast/crime-trend", response_model=CrimeTrendForecastResponse, summary="Forecast Crime Trend")
def get_crime_trend_forecast(
    horizon_days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Return a 1-90 day crime-registration forecast for the caller's jurisdiction."""
    if not 1 <= horizon_days <= 90:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="horizon_days must be between 1 and 90.")
    return intelligence_service.forecast_crime_trend(db, current_user, horizon_days)


@router.post("/embeddings/backfill", response_model=EmbeddingBackfillResponse, summary="Build Case Embeddings")
def build_case_embeddings(
    limit: int = 250,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update")),
):
    """Generate versioned pgvector embeddings only for cases visible to the caller."""
    if not 1 <= limit <= 1000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="limit must be between 1 and 1000.")
    return intelligence_service.backfill_embeddings(db, current_user, limit=limit)


@router.get("/cases/{case_id}/similar", response_model=SimilarCasesResponse, summary="Find Similar Cases")
def get_similar_cases(
    case_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Return explainable, jurisdiction-scoped nearest case matches from pgvector."""
    if not 1 <= limit <= 25:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="limit must be between 1 and 25.")
    return intelligence_service.find_similar_cases(db, case_id, current_user, limit=limit)

@router.get("/cases/{case_id}/predict", response_model=PredictRiskResponse, summary="Predict Case Risk Score")
def predict_case_risk(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Scores a case with the risk model and explains it by decision-path attribution (per-feature
    contribution to the estimated chance of a High/Severe rating). Enforces jurisdiction scoping.
    """
    case = case_crud.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    result = intelligence_service.predict_case_risk(db, case, current_user)

    return PredictRiskResponse(
        CaseMasterID=case_id,
        AIRiskScore=result["score"],
        RiskLevel=result["risk_level"],
        TopRiskFactors=[
            RiskFactor(FeatureName=f["feature_name"], ImpactScore=f["impact_score"], Description=f["description"])
            for f in result["top_factors"]
        ],
        ModelVersion=result["model_version"],
        Summary=result["summary"],
        Confidence=result["confidence"],
        ConfidenceMeaning=result["confidence_meaning"],
        ClassProbabilities=result["class_probabilities"],
    )


@router.post("/risk-scores/backfill", summary="Re-score every case with the current risk model")
def backfill_case_risk_scores(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """Re-scores all cases with the current model version and persists score and level."""
    from app.ml.models.risk_scoring import scorer
    from app.services import risk_service
    try:
        updated = risk_service.score_cases(db)
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Model unavailable: {exc}")
    return {"status": "success", "updated_count": updated, "model_version": scorer.model_version()}


@router.get("/risk-model", summary="Risk model card: training data, cross-validated metrics, feature importance")
def get_risk_model_card(current_user: User = Depends(verify_permission("cases:read"))):
    from app.ml.models.risk_scoring import scorer
    try:
        return scorer.model_card()
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Model unavailable: {exc}")
