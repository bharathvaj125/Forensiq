from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.dependencies import get_db, get_current_active_user
from app.models.court_case import CourtCase
from app.models.user import User

router = APIRouter()

class CourtCaseCreateSchema(BaseModel):
    CaseNo: str
    FIRNo: Optional[str] = None
    DistrictName: Optional[str] = "Bengaluru Urban"
    PoliceStationName: Optional[str] = None
    CourtName: str
    JudgeBench: Optional[str] = None
    PublicProsecutor: Optional[str] = None
    DefenseCounsel: Optional[str] = None
    TrialStage: str
    CaseStatus: Optional[str] = "Under Trial"
    NextHearingDate: Optional[str] = None
    OrderNotes: Optional[str] = None
    OffenceSummary: Optional[str] = None
    BNSSections: Optional[str] = None
    AccusedNames: Optional[str] = None
    ComplainantName: Optional[str] = "State of Karnataka"
    Milestones: Optional[List[dict]] = None

@router.get("/cases", response_model=List[dict])
def get_court_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    case_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    query = db.query(CourtCase)
    if case_status and case_status != "All":
        query = query.filter(CourtCase.CaseStatus == case_status)
    
    if search:
        s = f"%{search}%"
        query = query.filter(
            (CourtCase.CaseNo.ilike(s)) |
            (CourtCase.FIRNo.ilike(s)) |
            (CourtCase.CourtName.ilike(s)) |
            (CourtCase.AccusedNames.ilike(s))
        )
    
    cases = query.all()
    
    res = []
    for c in cases:
        res.append({
            "CourtCaseID": c.CourtCaseID,
            "CaseNo": c.CaseNo,
            "FIRNo": c.FIRNo,
            "DistrictName": c.DistrictName,
            "PoliceStationName": c.PoliceStationName,
            "CourtName": c.CourtName,
            "JudgeBench": c.JudgeBench,
            "PublicProsecutor": c.PublicProsecutor,
            "DefenseCounsel": c.DefenseCounsel,
            "TrialStage": c.TrialStage,
            "CaseStatus": c.CaseStatus,
            "NextHearingDate": c.NextHearingDate,
            "OrderNotes": c.OrderNotes,
            "OffenceSummary": c.OffenceSummary,
            "BNSSections": c.BNSSections,
            "AccusedNames": c.AccusedNames,
            "ComplainantName": c.ComplainantName,
            "Milestones": c.Milestones or []
        })
    return res

@router.post("/cases", status_code=status.HTTP_201_CREATED)
def create_court_case(
    payload: CourtCaseCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    existing = db.query(CourtCase).filter(CourtCase.CaseNo == payload.CaseNo).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Court Case '{payload.CaseNo}' already exists.")
    
    new_case = CourtCase(**payload.dict())
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    return {"message": "Court case registered successfully in database", "CourtCaseID": new_case.CourtCaseID, "CaseNo": new_case.CaseNo}
