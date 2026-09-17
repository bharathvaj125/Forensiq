from sqlalchemy.orm import Session, joinedload
from app.models.case_assignment import CaseAssignment

def get_assignment_by_id(db: Session, assignment_id: int) -> CaseAssignment | None:
    """Retrieves a single assignment by CaseAssignmentID."""
    return db.query(CaseAssignment).filter(CaseAssignment.CaseAssignmentID == assignment_id).first()

def get_assignments_by_case(db: Session, case_id: int) -> list[CaseAssignment]:
    """Retrieves all assignments (active and inactive) associated with a CaseMasterID."""
    return db.query(CaseAssignment).options(
        joinedload(CaseAssignment.officer)
    ).filter(CaseAssignment.CaseMasterID == case_id).all()

def get_assignments_by_officer(db: Session, officer_id: int) -> list[CaseAssignment]:
    """Retrieves all case assignments (active and inactive) associated with an OfficerID."""
    return db.query(CaseAssignment).options(
        joinedload(CaseAssignment.case)
    ).filter(
        CaseAssignment.OfficerID == officer_id
    ).all()

def create_assignment(db: Session, assignment_data: dict) -> CaseAssignment:
    """Creates and commits a new CaseAssignment record."""
    db_assignment = CaseAssignment(**assignment_data)
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    return db_assignment

def update_assignment(db: Session, assignment_db: CaseAssignment, assignment_data: dict) -> CaseAssignment:
    """Updates fields on an existing CaseAssignment record."""
    for key, value in assignment_data.items():
        setattr(assignment_db, key, value)
    db.commit()
    db.refresh(assignment_db)
    return assignment_db

def delete_assignment(db: Session, assignment_id: int) -> bool:
    """Deletes an assignment record by CaseAssignmentID."""
    db_assignment = db.query(CaseAssignment).filter(CaseAssignment.CaseAssignmentID == assignment_id).first()
    if not db_assignment:
        return False
    db.delete(db_assignment)
    db.commit()
    return True
