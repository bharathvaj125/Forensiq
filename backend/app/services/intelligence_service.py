"""Core Backend orchestration for the intelligence features: risk, anomalies, forecasts,
repeat-offender linkage and semantic case similarity. No fallbacks: when a model or the database
cannot do the job the caller gets an error, never an invented answer."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.ml.features import case_feature_frame, reporting_delay_hours
from app.models.accused import Accused
from app.models.case_embedding import CaseEmbedding
from app.models.case_master import CaseMaster
from app.models.user import User
from app.services import ai_audit_service, cache, reference_data


def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds case narratives via Gemini for real semantic similarity search."""
    from app.services.gemini_client import embed_texts as gemini_embed_texts
    return gemini_embed_texts(texts, dimensions=768)


def _model_unavailable(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Model unavailable: {exc}")


# ----------------------------------------------------------------------------------------- risk

def predict_case_risk(db: Session, case: CaseMaster, current_user: User) -> dict:
    """Score one case with the risk model, explain it, and persist the score."""
    from app.ml.models.risk_scoring import scorer
    try:
        row = case_feature_frame(db, [case]).iloc[0].to_dict()
        result = scorer.predict_risk(row, reference_data.risk_value_labels(db))
    except (FileNotFoundError, RuntimeError) as exc:
        raise _model_unavailable(exc)

    case.AIRiskScore = result["score"]
    case.AIRiskLevel = result["risk_level"]
    case.AIRiskModelVersion = result["model_version"]
    if case.InvestigationPriority is None:
        case.InvestigationPriority = result["priority"]
    db.commit()
    cache.clear()
    ai_audit_service.log_ai_run(db, current_user.UserID, "risk_score", "random_forest", result["model_version"],
                                str(case.CaseMasterID), {"score": result["score"], "level": result["risk_level"]})
    return result


# ------------------------------------------------------------------------------------- forecast

def forecast_crime_trend(db: Session, current_user: User, horizon_days: int) -> dict:
    """Ridge-regression trend over daily registration counts of the cases the caller may see."""
    from app.ml.models.forecasting.forecaster import forecast_crime_trend as predict_trend
    from datetime import date

    query = db.query(CaseMaster.CrimeRegisteredDate).filter(
        CaseMaster.CrimeRegisteredDate.isnot(None), CaseMaster.CrimeRegisteredDate <= date.today()
    )
    query = apply_jurisdiction_filter(query, db, current_user)
    registration_dates = [row[0].isoformat() for row in query.all()]
    result = predict_trend(registration_dates, horizon_days)
    ai_audit_service.log_ai_run(db, current_user.UserID, "crime_forecast", "ridge_regression", result["model_version"],
                                None, {"horizon_days": horizon_days, "trend": result["trend"]})
    return result


# -------------------------------------------------------------------------- repeat offenders

def _accused_record(accused: Accused, case: CaseMaster) -> dict:
    return {
        "id": accused.AccusedMasterID,
        "name": accused.AccusedName,
        "age": accused.AgeYear,
        "gender": accused.GenderID,
        "occupation": accused.Occupation,
        "address": accused.Address,
        "station_id": case.PoliceStationID,
        "registered": case.CrimeRegisteredDate,
        "profile": accused.CriminalProfileID,
        "case_id": case.CaseMasterID,
        "case_no": case.CaseNo,
    }


def resolve_repeat_offenders(db: Session, accused_id: int, current_user: User) -> dict:
    """Records that belong to the same person as this accused.

    Confirmed: same recorded criminal profile. Probable: the trained linkage model scores name,
    age, district, occupation and station similarity over a blocked candidate set."""
    from app.ml.models.repeat_offender import linkage

    scoped = db.query(Accused, CaseMaster).join(CaseMaster, Accused.CaseMasterID == CaseMaster.CaseMasterID)
    scoped = apply_jurisdiction_filter(scoped, db, current_user, model_class=CaseMaster)
    found = scoped.filter(Accused.AccusedMasterID == accused_id).first()
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Accused profile not found or access denied.")
    source, source_case = found
    source_record = _accused_record(source, source_case)

    matches = []
    confirmed_ids = {source.AccusedMasterID}
    if source.CriminalProfileID:
        same_profile = scoped.filter(Accused.CriminalProfileID == source.CriminalProfileID,
                                     Accused.AccusedMasterID != source.AccusedMasterID).all()
        for accused, case in same_profile:
            confirmed_ids.add(accused.AccusedMasterID)
            matches.append({
                "accused_master_id": accused.AccusedMasterID, "confidence": 1.0, "linkage": "Confirmed",
                "factors": [f"Same recorded criminal profile (CP{source.CriminalProfileID:05d})"],
                "accused_name": accused.AccusedName, "case_master_id": case.CaseMasterID, "case_no": case.CaseNo,
            })

    prefix = linkage.normalise_name(source.AccusedName)[:linkage.BLOCK_PREFIX]
    candidate_query = scoped.filter(func.lower(Accused.AccusedName).like(f"{prefix}%"),
                                    Accused.AccusedMasterID.notin_(confirmed_ids))
    if source.GenderID is not None:
        candidate_query = candidate_query.filter(Accused.GenderID == source.GenderID)
    if source.CriminalProfileID:
        candidate_query = candidate_query.filter(
            (Accused.CriminalProfileID.is_(None)) | (Accused.CriminalProfileID != source.CriminalProfileID)
        )
    candidates = [_accused_record(accused, case) for accused, case in candidate_query.all()]
    try:
        probable = linkage.link_candidates(source_record, candidates)
    except FileNotFoundError as exc:
        raise _model_unavailable(exc)
    for item in probable:
        record = item["record"]
        matches.append({
            "accused_master_id": record["id"], "confidence": item["confidence"], "linkage": "Probable",
            "factors": item["factors"], "accused_name": record["name"],
            "case_master_id": record["case_id"], "case_no": record["case_no"],
        })

    matches = sorted(matches, key=lambda item: (item["linkage"] != "Confirmed", -item["confidence"]))[:25]
    version = linkage.load_artifact()["version"]
    ai_audit_service.log_ai_run(db, current_user.UserID, "repeat_offender", "pairwise_linkage", version,
                                str(accused_id), {"match_count": len(matches)})
    return {"ModelVersion": version, "Matches": [
        {"AccusedMasterID": m["accused_master_id"], "Confidence": m["confidence"], "Factors": m["factors"],
         "Linkage": m["linkage"], "AccusedName": m["accused_name"], "CaseMasterID": m["case_master_id"], "CaseNo": m["case_no"]}
        for m in matches
    ]}


# ------------------------------------------------------------------------------------ anomalies

def detect_case_anomalies(db: Session, current_user: User) -> dict:
    """Flag cases reported unusually late relative to every case the caller can see."""
    from app.ml.models.anomaly.detector import MODEL_VERSION, MODIFIED_Z_CUTOFF, detect_anomalies

    cases = apply_jurisdiction_filter(db.query(CaseMaster), db, current_user).all()
    payload = [{
        "case_master_id": case.CaseMasterID,
        "reporting_delay_hours": reporting_delay_hours(case.IncidentFromDate, case.InfoReceivedPSDate, case.CrimeRegisteredDate),
    } for case in cases]
    findings = detect_anomalies(payload)
    case_numbers = {case.CaseMasterID: case.CaseNo for case in cases}

    ai_audit_service.log_ai_run(db, current_user.UserID, "anomaly_detection", "robust_z_score", MODEL_VERSION, None,
                                {"cases_analysed": len(cases), "finding_count": len(findings)})
    return {
        "ModelVersion": MODEL_VERSION,
        "CasesAnalysed": len(cases),
        "Cutoff": MODIFIED_Z_CUTOFF,
        "Findings": [
            {"CaseMasterID": item["case_master_id"], "AnomalyScore": item["anomaly_score"], "ZScore": item["z_score"],
             "Factors": item["factors"], "CaseNo": case_numbers.get(item["case_master_id"])}
            for item in findings
        ],
    }


# ------------------------------------------------------------------------- semantic similarity

def backfill_embeddings(db: Session, current_user: User, limit: int = 250) -> dict:
    """Embed up to `limit` visible cases that have no embedding yet (so repeated calls resume where the last stopped).
    Stops cleanly at the Gemini quota and reports how many cases are still pending."""
    from app.services.gemini_client import GeminiError, GeminiQuotaError

    embedded = select(CaseEmbedding.CaseMasterID).where(
        CaseEmbedding.EmbeddingModel == settings.EMBEDDING_MODEL_NAME, CaseEmbedding.Version == settings.EMBEDDING_MODEL_VERSION)
    query = db.query(CaseMaster).filter(CaseMaster.BriefFacts.isnot(None), CaseMaster.BriefFacts != "", CaseMaster.CaseMasterID.notin_(embedded))
    query = apply_jurisdiction_filter(query, db, current_user)
    pending_total = query.count()
    cases = query.order_by(CaseMaster.CaseMasterID).limit(limit).all()

    created = 0
    note = None
    for start in range(0, len(cases), 100):
        batch = cases[start:start + 100]
        try:
            vectors = _embed_texts([case.BriefFacts for case in batch])
        except GeminiQuotaError as exc:
            note = f"Embedding quota reached; resets in about {exc.retry_after / 3600:.1f} hours."
            break
        except GeminiError as exc:
            note = f"Embedding stopped: {exc}"
            break
        for case, vector in zip(batch, vectors):
            db.add(CaseEmbedding(CaseMasterID=case.CaseMasterID, EmbeddingVector=vector,
                                 EmbeddingModel=settings.EMBEDDING_MODEL_NAME, Version=settings.EMBEDDING_MODEL_VERSION))
            created += 1
        db.commit()
    return {"Processed": created, "Created": created, "Updated": 0, "Pending": max(pending_total - created, 0), "Note": note,
            "ModelName": settings.EMBEDDING_MODEL_NAME, "ModelVersion": settings.EMBEDDING_MODEL_VERSION}


def _factors(source: CaseMaster, candidate: CaseMaster) -> list[dict]:
    factors = [{"FeatureName": "Modus Operandi", "Description": "The case narratives are semantically similar."}]
    if source.CrimeMajorHeadID and source.CrimeMajorHeadID == candidate.CrimeMajorHeadID:
        factors.append({"FeatureName": "Crime Type", "Description": "Both cases share the same major crime classification."})
    if source.CrimeMinorHeadID and source.CrimeMinorHeadID == candidate.CrimeMinorHeadID:
        factors.append({"FeatureName": "Crime Subtype", "Description": "Both cases share the same crime subtype."})
    if source.PoliceStationID and source.PoliceStationID == candidate.PoliceStationID:
        factors.append({"FeatureName": "Location", "Description": "Both cases were registered at the same police station."})
    return factors


def find_similar_cases(db: Session, case_id: int, current_user: User, limit: int = 10) -> dict:
    """Retrieve jurisdiction-scoped nearest neighbours from pgvector using cosine distance."""
    if db.get_bind().dialect.name != "postgresql":
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED,
                            detail="Similar-case search needs PostgreSQL with the pgvector extension.")
    source_query = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id)
    source = apply_jurisdiction_filter(source_query, db, current_user).first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found or access denied.")
    if not source.BriefFacts or not source.BriefFacts.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="This case has no BriefFacts text to embed.")

    source_record = db.query(CaseEmbedding).filter(
        CaseEmbedding.CaseMasterID == source.CaseMasterID,
        CaseEmbedding.EmbeddingModel == settings.EMBEDDING_MODEL_NAME,
        CaseEmbedding.Version == settings.EMBEDDING_MODEL_VERSION,
    ).order_by(CaseEmbedding.CreatedAt.desc()).first()
    if not source_record:
        vector = _embed_texts([source.BriefFacts])[0]
        source_record = CaseEmbedding(
            CaseMasterID=source.CaseMasterID,
            EmbeddingVector=vector,
            EmbeddingModel=settings.EMBEDDING_MODEL_NAME,
            Version=settings.EMBEDDING_MODEL_VERSION,
        )
        db.add(source_record)
        db.commit()
        db.refresh(source_record)

    distance = CaseEmbedding.EmbeddingVector.cosine_distance(source_record.EmbeddingVector).label("distance")
    query = db.query(CaseMaster, distance).join(CaseEmbedding, CaseEmbedding.CaseMasterID == CaseMaster.CaseMasterID).filter(
        CaseMaster.CaseMasterID != source.CaseMasterID,
        CaseEmbedding.EmbeddingModel == settings.EMBEDDING_MODEL_NAME,
        CaseEmbedding.Version == settings.EMBEDDING_MODEL_VERSION,
    )
    query = apply_jurisdiction_filter(query, db, current_user, model_class=CaseMaster)
    rows = query.order_by(distance).limit(limit).all()

    embedded_cases = db.query(func.count(CaseEmbedding.CaseMasterID)).filter(
        CaseEmbedding.EmbeddingModel == settings.EMBEDDING_MODEL_NAME, CaseEmbedding.Version == settings.EMBEDDING_MODEL_VERSION).scalar()
    response_payload = {
        "SourceCaseMasterID": source.CaseMasterID,
        "ModelName": settings.EMBEDDING_MODEL_NAME,
        "ModelVersion": settings.EMBEDDING_MODEL_VERSION,
        "SearchedCases": int(embedded_cases or 0),
        "TotalCases": int(db.query(func.count(CaseMaster.CaseMasterID)).scalar() or 0),
        "Matches": [
            {
                "CaseMasterID": candidate.CaseMasterID,
                "CaseNo": candidate.CaseNo,
                "SimilarityScore": round(max(0.0, min(1.0, 1.0 - float(candidate_distance))), 4),
                "BriefFacts": candidate.BriefFacts,
                "TopFactors": _factors(source, candidate),
            }
            for candidate, candidate_distance in rows
        ],
    }
    ai_audit_service.log_ai_run(db, current_user.UserID, "similar_case", settings.EMBEDDING_MODEL_NAME,
                                settings.EMBEDDING_MODEL_VERSION, str(case_id), {"match_count": len(response_payload["Matches"])})
    return response_payload
