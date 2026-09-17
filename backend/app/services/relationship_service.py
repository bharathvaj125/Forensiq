from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.criminal_relationship import CriminalRelationship
from app.models.user import User
from app.crud import criminal_relationship_crud
from app.services import audit_service

def establish_suspect_link(
    db: Session,
    source_person_id: int,
    target_person_id: int,
    rel_type: str,
    current_user: User
) -> CriminalRelationship:
    """
    Creates a new suspect network connection (edge) in the database.
    """
    if source_person_id == target_person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source suspect and Target suspect cannot be the same person."
        )

    relationship_data = {
        "SourcePersonID": source_person_id,
        "TargetPersonID": target_person_id,
        "RelationshipType": rel_type,
        "ConfidenceScore": 1.0,
        "CreatedBy": current_user.UserID,
        "CreatedAt": datetime.now(timezone.utc),
        "Status": "Pending",
        "Active": True
    }

    db_relationship = criminal_relationship_crud.create_relationship(db, relationship_data)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="CREATE_RELATIONSHIP",
        module="Network Manager",
        resource_id=str(db_relationship.RelationshipID),
        new_val=f"Source: {source_person_id}, Target: {target_person_id}, Type: {rel_type}"
    )
    
    return db_relationship

def verify_suspect_link(
    db: Session,
    relationship_id: int,
    verify_status: str,
    current_user: User
) -> CriminalRelationship:
    """
    Applies investigator verification to a suspect network connection, updating status,
    verified author, and timestamp.
    """
    relationship = criminal_relationship_crud.get_relationship_by_id(db, relationship_id)
    if not relationship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relationship record not found."
        )

    if verify_status not in ["Confirmed", "Disputed", "Pending"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid verification status. Must be Confirmed, Disputed, or Pending."
        )

    old_status = relationship.Status
    
    update_data = {
        "Status": verify_status,
        "VerifiedBy": current_user.UserID,
        "VerifiedDate": datetime.now(timezone.utc)
    }

    updated = criminal_relationship_crud.update_relationship(db, relationship, update_data)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="VERIFY_RELATIONSHIP",
        module="Network Manager",
        resource_id=str(relationship_id),
        old_val=old_status,
        new_val=verify_status
    )
    
    return updated
