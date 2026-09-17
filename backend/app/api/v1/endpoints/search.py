from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.models.case_master import CaseMaster
from app.models.accused import Accused
from app.models.evidence import Evidence
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.schemas.search import UnifiedSearchResponse

router = APIRouter()

@router.get("", response_model=UnifiedSearchResponse, summary="Unified Search")
def unified_search(
    q: str = Query(..., min_length=2, description="Search query string"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Executes a unified search across cases, accused persons, and evidence.
    Results are filtered in real-time according to the user's geographical jurisdiction.
    """
    # 1. Search cases
    cases_query = db.query(CaseMaster)
    cases_query = apply_jurisdiction_filter(cases_query, db, current_user)
    cases = cases_query.filter(
        or_(
            CaseMaster.CaseNo.ilike(f"%{q}%"),
            CaseMaster.BriefFacts.ilike(f"%{q}%")
        )
    ).limit(10).all()

    # 2. Search accused
    accused_query = db.query(Accused).join(CaseMaster, Accused.CaseMasterID == CaseMaster.CaseMasterID)
    accused_query = apply_jurisdiction_filter(accused_query, db, current_user, model_class=CaseMaster)
    accused = accused_query.filter(
        Accused.AccusedName.ilike(f"%{q}%")
    ).limit(10).all()

    # 3. Search evidence
    evidence_query = db.query(Evidence).join(CaseMaster, Evidence.CaseMasterID == CaseMaster.CaseMasterID)
    evidence_query = apply_jurisdiction_filter(evidence_query, db, current_user, model_class=CaseMaster)
    evidence = evidence_query.filter(
        Evidence.EvidenceType.ilike(f"%{q}%")
    ).limit(10).all()

    return {
        "cases": cases,
        "accused": accused,
        "evidence": evidence
    }
