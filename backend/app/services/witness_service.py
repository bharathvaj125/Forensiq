from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.witness import Witness
from app.models.user import User
from app.crud import witness_crud, case_crud
from app.services import audit_service

def record_witness_statement(db: Session, statement_data: dict, current_user: User) -> Witness:
    """
    Validates that the case is scoped and active, writes the witness statement record, 
    and logs the action to the audit logs.
    """
    case_id = statement_data.get("CaseMasterID")
    if not case_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CaseMasterID is required to record a witness statement."
        )

    # Check case scope
    case = case_crud.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated case not found or access denied."
        )

    db_witness = witness_crud.create_witness(db, statement_data)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="RECORD_WITNESS",
        module="Witness Manager",
        resource_id=str(case_id),
        new_val=f"WitnessID: {db_witness.WitnessMasterID}, Name: {db_witness.WitnessName}"
    )
    
    return db_witness
