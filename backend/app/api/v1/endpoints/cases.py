from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, get_current_active_user
from app.core.permissions import verify_permission
from app.models.user import User

# CRUD and Services
from app.crud import case_crud
from app.services import case_service, witness_service, annotation_service, assignment_service
from app.utils.pagination import paginate

# Pydantic Schemas
from app.schemas.case_master import CaseMaster, CaseMasterCreate, PaginatedCaseResponse
from app.schemas.witness import Witness, WitnessCreate
from app.schemas.case import CaseAnnotation, AnnotationCreate
from app.schemas.officer import CaseAssignment, AssignmentCreate
from app.schemas.evidence import EvidenceCreate

router = APIRouter()

@router.get("", response_model=PaginatedCaseResponse, summary="List Cases")
def read_cases(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=5000, alias="pageSize", description="Page size"),
    search: Optional[str] = Query(None, description="Fuzzy search by CaseNo or BriefFacts"),
    district_id: Optional[int] = Query(None, alias="districtId", description="Filter by District ID"),
    station_id: Optional[int] = Query(None, alias="stationId", description="Filter by Police Station ID"),
    status_id: Optional[int] = Query(None, alias="statusId", description="Filter by Case Status ID"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="Sorting criterion (date_desc, date_asc, priority_desc, risk_desc)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves a paginated list of crime cases.
    Automatically restricts rows to the active officer's jurisdiction bounds.
    """
    skip = (page - 1) * page_size
    db_cases, total_count = case_crud.get_cases_paginated(
        db=db,
        user=current_user,
        skip=skip,
        limit=page_size,
        search=search,
        district_id=district_id,
        station_id=station_id,
        status_id=status_id,
        sort_by=sort_by
    )
    
    # Extract roles to display dynamic scopes (Statewide vs station-bounded)
    applied_scope = "Statewide"
    if current_user.role and current_user.role.RoleName not in ["Admin", "SCRB_Officer", "SHO", "Constable"]:
        applied_scope = "Jurisdiction Bounded"

    return paginate(db_cases, total_count, page, page_size, applied_scope)


@router.get("/districts-and-stations", summary="Get Districts and Police Stations Hierarchy")
def get_districts_and_stations(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns all 31 Karnataka Districts and their associated Police Stations directly from PostgreSQL.
    """
    from app.models.district import District
    from app.models.police_station import PoliceStation

    districts = db.query(District).all()
    stations = db.query(PoliceStation).all()

    stations_by_district = {}
    for st in stations:
        stations_by_district.setdefault(st.DistrictID, []).append({
            "station_id": st.UnitID,
            "station_name": st.UnitName
        })

    result = []
    for d in districts:
        result.append({
            "district_id": d.DistrictID,
            "district_name": d.DistrictName,
            "stations": stations_by_district.get(d.DistrictID, [])
        })

    return result


@router.get("/station-command-center", summary="Get Station Command Center Analytics")
def get_station_command_center(
    station_id: Optional[int] = Query(None, alias="stationId"),
    district_id: Optional[int] = Query(None, alias="districtId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns real operational Station Command Center KPIs, timeline feeds, officer workloads,
    AI command briefs, and patrol recommendations directly from PostgreSQL.
    """
    from app.services import station_command_service
    s_id = station_id if isinstance(station_id, int) else None
    d_id = district_id if isinstance(district_id, int) else None
    return station_command_service.get_station_command_center(
        db=db,
        current_user=current_user,
        station_id=s_id,
        district_id=d_id,
    )

@router.get("/{case_id}", response_model=CaseMaster, summary="Get Case Details")
def read_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves complete case file metadata, including accused, victims, witnesses,
    evidence items, and assignments. Enforces active jurisdiction scopes.
    """
    db_case = case_crud.get_case_by_id(db, case_id=case_id, user=current_user)
    if db_case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )
    return db_case


def _accessible_case_or_404(db: Session, case_id: int, current_user: User):
    case = case_crud.get_case_by_id(db, case_id=case_id, user=current_user)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found or access denied.")
    return case


@router.get("/{case_id}/accused", response_model=list[dict], summary="List Case Accused")
def list_case_accused(case_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_permission("cases:read"))):
    """Return accused profiles attached to an accessible case file."""
    case = _accessible_case_or_404(db, case_id, current_user)
    return [{"AccusedMasterID": item.AccusedMasterID, "AccusedName": item.AccusedName, "AgeYear": item.AgeYear,
             "GenderID": item.GenderID, "Occupation": item.Occupation, "IsRepeatOffender": item.IsRepeatOffender}
            for item in case.accused_list]


@router.get("/{case_id}/victims", response_model=list[dict], summary="List Case Victims")
def list_case_victims(case_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_permission("cases:read"))):
    """Return victim records attached to an accessible case file."""
    case = _accessible_case_or_404(db, case_id, current_user)
    return [{column.name: getattr(item, column.name) for column in item.__table__.columns} for item in case.victims]


@router.get("/{case_id}/evidence", response_model=list[dict], summary="List Case Evidence")
def list_case_evidence(case_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_permission("cases:read"))):
    """Return evidence inventory attached to an accessible case file."""
    case = _accessible_case_or_404(db, case_id, current_user)
    return [{column.name: getattr(item, column.name) for column in item.__table__.columns} for item in case.evidence_items]


@router.get("/{case_id}/vehicles", response_model=list[dict], summary="List Case Vehicles")
def list_case_vehicles(case_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_permission("cases:read"))):
    """Return vehicle records attached to an accessible case file."""
    case = _accessible_case_or_404(db, case_id, current_user)
    return [{column.name: getattr(item, column.name) for column in item.__table__.columns} for item in case.vehicles]


@router.get("/{case_id}/witnesses", response_model=list[Witness], summary="List Case Witnesses")
def list_case_witnesses(case_id: int, db: Session = Depends(get_db), current_user: User = Depends(verify_permission("cases:read"))):
    """Return witness statements attached to an accessible case file."""
    return _accessible_case_or_404(db, case_id, current_user).witnesses

@router.post("", response_model=CaseMaster, status_code=status.HTTP_201_CREATED, summary="Register Case")
def create_new_case(
    case_in: CaseMasterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:create"))
):
    """
    Registers a new crime case file registry entry.
    Verifies that latitude and longitude coordinates fall within geographical state limits.
    """
    return case_service.register_new_case(db, case_in.model_dump(), current_user)

@router.put("/{case_id}/status", response_model=CaseMaster, summary="Transition Case Status")
def update_case_status(
    case_id: int,
    status_id: int = Query(..., alias="statusId", description="Target case status master ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """
    Transitions the operational workflow lifecycle state of a case.
    """
    return case_service.transition_case_status(db, case_id, status_id, current_user)

@router.put("/{case_id}/priority", response_model=CaseMaster, summary="Update Case Priority")
def update_case_priority(
    case_id: int,
    priority: str = Query(..., description="Target priority (e.g. High, Medium, Low)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """
    Updates the investigation urgency priority classification.
    """
    return case_service.set_case_priority(db, case_id, priority, current_user)

@router.post("/{case_id}/witnesses", response_model=Witness, status_code=status.HTTP_201_CREATED, summary="Record Witness Statement")
def add_witness_statement(
    case_id: int,
    witness_in: WitnessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:annotate"))
):
    """
    Records a witness statement linked to a case.
    """
    stmt_data = witness_in.model_dump()
    stmt_data["CaseMasterID"] = case_id
    return witness_service.record_witness_statement(db, stmt_data, current_user)

@router.post("/{case_id}/annotations", response_model=CaseAnnotation, status_code=status.HTTP_201_CREATED, summary="Add Case Annotation Notes")
def add_annotation(
    case_id: int,
    annotation_in: AnnotationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:annotate"))
):
    """
    Appends investigator annotations and case notes logs.
    """
    return annotation_service.add_case_annotation(
        db=db,
        case_id=case_id,
        notes_text=annotation_in.NotesText,
        category=annotation_in.Category,
        current_user=current_user
    )

@router.delete("/annotations/{annotation_id}", summary="Delete Case Annotation Notes")
def delete_annotation(
    annotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:annotate"))
):
    """
    Soft-deletes a case annotation note entry.
    """
    success = annotation_service.remove_case_annotation(db, annotation_id, current_user)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation not found or deletion failed."
        )
    return {"status": "success", "message": "Annotation successfully soft-deleted."}

@router.post("/{case_id}/assignments", response_model=CaseAssignment, status_code=status.HTTP_201_CREATED, summary="Assign Investigator")
def assign_investigator(
    case_id: int,
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """
    Assigns an officer investigator to a case, incrementing active caseloads.
    """
    return assignment_service.assign_officer_to_case(
        db=db,
        case_id=case_id,
        officer_id=assignment_in.OfficerID,
        role=assignment_in.AssignmentRole,
        current_user=current_user
    )

@router.delete("/assignments/{assignment_id}", summary="Release Investigator")
def release_investigator(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """
    Releases an investigator from a case, decrementing active caseload counts.
    """
    assignment_service.release_officer_from_case(db, assignment_id, current_user)
    return {"status": "success", "message": "Investigator released from case."}

def verify_officer_case_assignment(db: Session, case_id: int, user: User):
    """
    Verifies if the officer/user is assigned to the specified case file.
    Admin users have access across all cases.
    """
    case = case_crud.get_case_by_id(db, case_id=case_id, user=user)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case file not found or access denied.")

    # 1. Admin Override
    if user.role and user.role.RoleName == "Admin":
        return case

    # 2. Check if Primary Investigating Officer
    if case.PolicePersonID and user.OfficerID and case.PolicePersonID == user.OfficerID:
        return case

    # 3. Check if Case Creator
    if case.CreatedBy and case.CreatedBy == user.UserID:
        return case

    # 4. Check active CaseAssignment table
    from app.models.case_assignment import CaseAssignment
    if user.OfficerID:
        assignment = db.query(CaseAssignment).filter(
            CaseAssignment.CaseMasterID == case_id,
            CaseAssignment.OfficerID == user.OfficerID,
            CaseAssignment.IsActive == True
        ).first()
        if assignment:
            return case

    # 5. Check active TaskDelegation table
    from app.models.task_delegation import TaskDelegation
    task_del = db.query(TaskDelegation).filter(
        TaskDelegation.CaseMasterID == case_id,
        TaskDelegation.AssignedToUserID == user.UserID
    ).first()
    if task_del:
        return case

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access Denied: You are not assigned to Case #{case.CaseNo or case_id}. Only assigned officers can upload evidence (CCTV, images, docs)."
    )


@router.post("/{case_id}/evidence", status_code=status.HTTP_201_CREATED, summary="Add Evidence Record to Case")
def add_case_evidence(
    case_id: int,
    evidence_in: EvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Adds an evidence item (CCTV, DNA, Seizure Memo, Weapon) linked to a case.
    Enforces strict assignment check: only assigned officers can upload evidence.
    """
    verify_officer_case_assignment(db, case_id, current_user)

    from app.models.evidence import Evidence
    from datetime import datetime
    
    new_ev = Evidence(
        CaseMasterID=case_id,
        EvidenceType=evidence_in.EvidenceType,
        Description=evidence_in.Description,
        CollectionDate=evidence_in.CollectionDate or datetime.now(),
        FileName=evidence_in.FileName,
        FileUrl=evidence_in.FileUrl,
        FileSize=evidence_in.FileSize,
        UploadedBy=current_user.UserID
    )
    db.add(new_ev)
    db.commit()
    db.refresh(new_ev)
    return {
        "status": "success",
        "EvidenceID": new_ev.EvidenceID,
        "CaseMasterID": new_ev.CaseMasterID,
        "EvidenceType": new_ev.EvidenceType,
        "Description": new_ev.Description,
        "CollectionDate": new_ev.CollectionDate,
        "FileName": new_ev.FileName,
        "FileUrl": new_ev.FileUrl,
        "FileSize": new_ev.FileSize,
        "UploadedBy": new_ev.UploadedBy
    }


@router.post("/{case_id}/upload-evidence", status_code=status.HTTP_201_CREATED, summary="Upload Evidence File to Case")
async def upload_case_evidence_file(
    case_id: int,
    file: UploadFile = File(...),
    evidence_type: str = Form(...),
    description: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Uploads an actual file (CCTV video, image picture, PDF document) as evidence for an assigned case.
    Strictly verifies case assignment before allowing file upload.
    """
    verify_officer_case_assignment(db, case_id, current_user)

    import os
    import uuid
    from datetime import datetime
    from app.models.evidence import Evidence

    from app.core.config import UPLOADS_DIR
    evidence_dir = os.path.join(UPLOADS_DIR, "evidence")
    os.makedirs(evidence_dir, exist_ok=True)

    unique_id = uuid.uuid4().hex[:10]
    safe_filename = f"{unique_id}_{file.filename}"
    file_save_path = os.path.join(evidence_dir, safe_filename)

    file_bytes = await file.read()
    with open(file_save_path, "wb") as f:
        f.write(file_bytes)

    file_url = f"/uploads/evidence/{safe_filename}"

    new_ev = Evidence(
        CaseMasterID=case_id,
        EvidenceType=evidence_type,
        Description=description,
        CollectionDate=datetime.now(),
        FileName=file.filename,
        FilePath=file_save_path,
        FileUrl=file_url,
        FileSize=len(file_bytes),
        UploadedBy=current_user.UserID
    )
    db.add(new_ev)
    db.commit()
    db.refresh(new_ev)

    return {
        "status": "success",
        "EvidenceID": new_ev.EvidenceID,
        "CaseMasterID": new_ev.CaseMasterID,
        "EvidenceType": new_ev.EvidenceType,
        "Description": new_ev.Description,
        "CollectionDate": new_ev.CollectionDate,
        "FileName": new_ev.FileName,
        "FileUrl": new_ev.FileUrl,
        "FileSize": new_ev.FileSize,
        "UploadedBy": new_ev.UploadedBy
    }
