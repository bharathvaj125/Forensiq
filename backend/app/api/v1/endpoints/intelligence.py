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
    Computes AI-driven risk scores and identifies contributing feature vectors (SHAP) for a case.
    Enforces row-level geographic scoping boundary constraints.
    """
    case = case_crud.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )
        
    result = intelligence_service.predict_case_risk(db, case, current_user)

    top_factors = []
    for factor in result.get("top_factors", result.get("top_features", [])):
        feat_name = str(factor.get("feature_name") or factor.get("feature") or "Crime Feature")
        score = float(factor.get("impact_score") or factor.get("weight") or factor.get("contribution") or 0.25)
        desc = str(factor.get("description") or f"High impact factor from feature {feat_name}")
        top_factors.append(RiskFactor(FeatureName=feat_name, ImpactScore=score, Description=desc))

    return PredictRiskResponse(
        CaseMasterID=case_id,
        AIRiskScore=float(result.get("score", case.AIRiskScore or 0.75)),
        RiskLevel=str(result.get("risk_level", "High")),
        TopRiskFactors=top_factors,
    )


@router.post("/risk-scores/backfill", summary="Backfill AI Risk Scores Across Database")
def backfill_case_risk_scores(
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """Refreshes and persists model-generated RandomForest risk scores for cases with default seed values."""
    from app.models.case_master import CaseMaster
    cases = db.query(CaseMaster).filter(CaseMaster.AIRiskScore == 0.55).limit(limit).all()
    updated = 0
    for case in cases:
        res = intelligence_service.predict_case_risk(db, case, current_user)
        if res.get("score") is not None:
            case.AIRiskScore = res["score"]
            updated += 1
    db.commit()
    return {"status": "success", "updated_count": updated, "message": f"Successfully backfilled {updated} case risk scores."}
