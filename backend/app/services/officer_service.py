from sqlalchemy.orm import Session
from app.crud import officer_crud

def increment_caseload(db: Session, officer_id: int) -> int:
    """
    Increments the active assigned case counter for an officer.
    """
    officer = officer_crud.get_officer_by_id(db, officer_id)
    if officer:
        current_count = officer.AssignedCaseCount or 0
        officer.AssignedCaseCount = current_count + 1
        db.commit()
        return officer.AssignedCaseCount
    return 0

def decrement_caseload(db: Session, officer_id: int) -> int:
    """
    Decrements the active assigned case counter for an officer (minimizes at 0).
    """
    officer = officer_crud.get_officer_by_id(db, officer_id)
    if officer:
        current_count = officer.AssignedCaseCount or 0
        if current_count > 0:
            officer.AssignedCaseCount = current_count - 1
        else:
            officer.AssignedCaseCount = 0
        db.commit()
        return officer.AssignedCaseCount
    return 0
