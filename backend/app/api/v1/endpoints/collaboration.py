from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.services import collaboration_service

router = APIRouter()

# 1. External Officer Authentication & Credentials Verification
@router.post("/officer-login", summary="Authenticate External Agency Officer (CBI, NIA, ED, FSL)")
def officer_login(
    login_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    return collaboration_service.authenticate_external_officer(db, login_data)


# 2. External Agencies Management
@router.get("/agencies", summary="List External Agencies (CBI, NIA, ED, FSL, NCRB)")
def list_external_agencies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.get_external_agencies(db)

@router.post("/agencies", summary="Register New External Agency (Admin Only)")
def create_external_agency(
    agency_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not (current_user.role and current_user.role.RoleName == "Admin"):
        raise HTTPException(status_code=403, detail="Only System Administrators can register external agencies.")
    return collaboration_service.create_external_agency(db, agency_data, current_user)


# 3. External Agency Officers Management
@router.get("/agency-officers", summary="List External Agency Officers & Credentials")
def list_external_agency_officers(
    agency_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.get_external_agency_officers(db, agency_id)

@router.post("/agency-officers", summary="Register External Agency Officer (Admin Only)")
def create_external_agency_officer(
    officer_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not (current_user.role and current_user.role.RoleName == "Admin"):
        raise HTTPException(status_code=403, detail="Only System Administrators can register external agency officers.")
    return collaboration_service.create_external_agency_officer(db, officer_data, current_user)


# 4. External Officer-Initiated Request Submission
@router.post("/officer-request", summary="External Officer Submit Access Request")
def submit_officer_request(
    req_data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.create_external_officer_request(db, req_data, current_user)


# 5. AI-Assisted Agency Recommendation
@router.get("/ai-recommendation/{case_id}", summary="AI-Assisted External Agency Recommendation")
def get_ai_agency_recommendation(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.recommend_agency_for_case(db, case_id)


# 6. Collaboration Requests Workflow & Approval Configurator
@router.get("/requests", summary="List Inter-Agency Collaboration Requests")
def list_collaboration_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.get_collaboration_requests(db, current_user)

@router.post("/requests/{request_id}/approve", summary="Admin Approve Request & Configure Granular Scope & Feature Access")
def approve_collaboration_request(
    request_id: int,
    approval_config: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.approve_collaboration_request(db, request_id, approval_config, current_user)

@router.post("/requests/{request_id}/reject", summary="Reject Collaboration Request")
def reject_collaboration_request(
    request_id: int,
    remarks: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.reject_collaboration_request(db, request_id, remarks, current_user)


# 7. External Officer Dashboard Workspace (Restricted Scope)
@router.get("/external-workspace", summary="External Agency Officer Restricted Workspace")
def get_external_officer_workspace(
    officer_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.get_external_officer_workspace(db, current_user, officer_id)


# 8. Audit History
@router.get("/audit-logs", summary="Inter-Agency Collaboration Audit Logs")
def get_collaboration_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return collaboration_service.get_collaboration_audit_logs(db)
