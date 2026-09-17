from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.schemas.assistant import AssistantQueryRequest, AssistantQueryResponse
from app.services import assistant_service

router = APIRouter()

@router.post("/query", response_model=AssistantQueryResponse, summary="Query AI Assistant")
def query_assistant(
    request: AssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    RAG-driven query assistant interface. Matches keyword tokens against records
    within the officer's jurisdiction scope and returns cited answers.
    """
    result = assistant_service.query_assistant(db, request.query, current_user)
    
    return AssistantQueryResponse(
        answer=result["answer"],
        source_case_ids=result["source_case_ids"],
        model_version=result.get("model_version", "phase4-assistant-v1")
    )
