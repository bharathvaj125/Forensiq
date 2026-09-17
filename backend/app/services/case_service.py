from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.case_master import CaseMaster
from app.models.user import User
from app.crud import case_crud
from app.services import audit_service

def register_new_case(db: Session, case_data: dict, current_user: User) -> CaseMaster:
    """
    Registers a new case file record, validates fields, and records the audit log.
    """
    # Simple business validations
    if not case_data.get("CrimeNo") or not case_data.get("CaseNo"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Crime number and Case number are required."
        )

    # Coordinate check
    lat = case_data.get("latitude", 0.0)
    lon = case_data.get("longitude", 0.0)
    if not (8.0 <= lat <= 16.0) or not (74.0 <= lon <= 79.0):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Coordinates must fall within the boundaries of Karnataka (lat: 8-16, lon: 74-79)."
        )

    # Date order verification
    from_dt = case_data.get("IncidentFromDate")
    to_dt = case_data.get("IncidentToDate")
    if from_dt and to_dt and from_dt > to_dt:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Incident From Date cannot be after Incident To Date."
        )

    db_case = case_crud.create_case(db, case_data)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="CREATE_CASE",
        module="Case Manager",
        resource_id=str(db_case.CaseMasterID),
        new_val=f"CrimeNo: {db_case.CrimeNo}, CaseNo: {db_case.CaseNo}"
    )
    
    return db_case

def transition_case_status(db: Session, case_id: int, new_status_id: int, current_user: User) -> CaseMaster:
    """
    Updates the operational lifecycle status of a case.
    """
    case_db = case_crud.get_case_by_id(db, case_id, current_user)
    if not case_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    old_status = str(case_db.CaseStatusID)
    updated_case = case_crud.update_case(db, case_db, {"CaseStatusID": new_status_id})
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="UPDATE_CASE_STATUS",
        module="Case Manager",
        resource_id=str(case_id),
        old_val=old_status,
        new_val=str(new_status_id)
    )
    
    return updated_case

def set_case_priority(db: Session, case_id: int, priority: str, current_user: User) -> CaseMaster:
    """
    Updates the investigation priority of a case.
    """
    case_db = case_crud.get_case_by_id(db, case_id, current_user)
    if not case_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    old_priority = case_db.InvestigationPriority
    updated_case = case_crud.update_case(db, case_db, {"InvestigationPriority": priority})
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="UPDATE_CASE_PRIORITY",
        module="Case Manager",
        resource_id=str(case_id),
        old_val=old_priority,
        new_val=priority
    )
    
    return updated_case
