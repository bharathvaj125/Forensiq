from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.schemas.assistant import AssistantQueryRequest, AssistantQueryResponse
from app.services import assistant_service

router = APIRouter()


@router.get("/status", summary="What the assistant can currently answer from")
def assistant_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Real figures for the chat greeting: how many FIRs the caller can query and whether a language model is reachable."""
    from sqlalchemy import func
    from app.core.config import settings
    from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
    from app.models.case_embedding import CaseEmbedding
    from app.models.case_master import CaseMaster
    from app.services import analytics, gemini_client

    configured = bool(settings.LLM_API_KEY) and settings.LLM_API_KEY != "change_me"
    models = gemini_client.available_models() if configured else []
    as_of = analytics.as_of_date(db)
    return {
        "configured": configured,
        "available": bool(models),
        "models": models,
        "retry_in_seconds": None if models or not configured else round(gemini_client.soonest_available_in()),
        "cases_in_scope": apply_jurisdiction_filter(
            db.query(CaseMaster.CaseMasterID).filter(CaseMaster.CrimeRegisteredDate <= as_of), db, current_user).count(),
        "embedded_cases": db.query(func.count(func.distinct(CaseEmbedding.CaseMasterID))).scalar(),
        "as_of_date": as_of.isoformat(),
    }


@router.post("/query", response_model=AssistantQueryResponse, summary="Query AI Assistant")
def query_assistant(
    request: AssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Data-grounded assistant: the model queries the database through jurisdiction-scoped tools
    (counts, case lookup, hotspots, anomalies, forecasts, networks...) and answers from the results.
    """
    result = assistant_service.query_assistant(db, request.query, current_user)

    return AssistantQueryResponse(
        answer=result["answer"],
        source_case_ids=result["source_case_ids"],
        model_version=result["model_version"],
        download_url=result["download_url"],
        tools_used=result["tools_used"],
    )
