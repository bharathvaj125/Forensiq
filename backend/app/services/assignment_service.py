from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.case_assignment import CaseAssignment
from app.models.user import User
from app.crud import case_assignment_crud, case_crud, officer_crud
from app.services import officer_service, audit_service

def assign_officer_to_case(
    db: Session,
    case_id: int,
    officer_id: int,
    role: str,
    current_user: User
) -> CaseAssignment:
    """
    Binds an investigator to a case file under a specific role, updates the officer's active caseload count,
    and logs the audit trail inside a single safe transaction.
    """
    # 1. Enforce row-level jurisdiction scope on the case lookup
    case = case_crud.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    # 2. Check if the officer exists
    officer = officer_crud.get_officer_by_id(db, officer_id)
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer profile not found."
        )

    # 3. Ensure the officer is not already actively bound to this case in this specific role
    existing = db.query(CaseAssignment).filter(
        CaseAssignment.CaseMasterID == case_id,
        CaseAssignment.OfficerID == officer_id,
        CaseAssignment.AssignmentRole == role,
        CaseAssignment.IsActive == True
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Officer is already actively assigned to this case in this role."
        )

    assignment_data = {
        "CaseMasterID": case_id,
        "OfficerID": officer_id,
        "AssignmentRole": role,
        "AssignedDate": datetime.now(timezone.utc),
        "IsActive": True
    }

    try:
        db_assignment = case_assignment_crud.create_assignment(db, assignment_data)
        officer_service.increment_caseload(db, officer_id)
        
        # Trigger dynamic in-app notification for the assigned officer
        assigned_user = db.query(User).filter(User.OfficerID == officer_id).first()
        if assigned_user:
            from app.services import notification_service
            notification_service.create_notification(
                db,
                user_id=assigned_user.UserID,
                title="New Investigator Assignment",
                message=f"You have been assigned as {role} on Case #{case.CaseNo}."
            )
        
        # Log the audit action
        audit_service.log_action(
            db=db,
            user_id=current_user.UserID,
            action="ASSIGN_OFFICER",
            module="Assignment Manager",
            resource_id=str(case_id),
            new_val=f"OfficerID: {officer_id}, Role: {role}"
        )
        return db_assignment
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign investigator: {e}"
        )

def release_officer_from_case(
    db: Session,
    assignment_id: int,
    current_user: User
) -> CaseAssignment:
    """
    Deactivates an active investigator assignment, decrements the officer's active caseload count,
    and logs the audit trail inside a single safe transaction.
    """
    assignment_db = case_assignment_crud.get_assignment_by_id(db, assignment_id)
    if not assignment_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment record not found."
        )

    if not assignment_db.IsActive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment is already inactive."
        )

    # Validate that the active user has scope access to the case
    case = case_crud.get_case_by_id(db, assignment_db.CaseMasterID, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated case not found or access denied."
        )

    try:
        updated = case_assignment_crud.update_assignment(
            db,
            assignment_db,
            {
                "IsActive": False,
                "UnassignedDate": datetime.now(timezone.utc)
            }
        )
        officer_service.decrement_caseload(db, assignment_db.OfficerID)
        
        # Log the audit action
        audit_service.log_action(
            db=db,
            user_id=current_user.UserID,
            action="RELEASE_OFFICER",
            module="Assignment Manager",
            resource_id=str(assignment_db.CaseMasterID),
            old_val=f"OfficerID: {assignment_db.OfficerID}, Role: {assignment_db.AssignmentRole}"
        )
        return updated
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to release investigator: {e}"
        )
