from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.case_annotation import CaseAnnotation
from app.models.user import User
from app.crud import case_annotation_crud, case_crud
from app.services import audit_service

def add_case_annotation(
    db: Session,
    case_id: int,
    notes_text: str,
    category: str,
    current_user: User
) -> CaseAnnotation:
    """
    Appends an investigator annotation journal entry to a case, verifying jurisdiction.
    """
    case = case_crud.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    annotation_data = {
        "CaseMasterID": case_id,
        "UserID": current_user.UserID,
        "NotesText": notes_text,
        "Category": category,
        "IsDeleted": False
    }

    db_annotation = case_annotation_crud.create_annotation(db, annotation_data)
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="ADD_ANNOTATION",
        module="Annotation Manager",
        resource_id=str(case_id),
        new_val=f"AnnotationID: {db_annotation.AnnotationID}, Category: {category}"
    )
    
    return db_annotation

def remove_case_annotation(db: Session, annotation_id: int, current_user: User) -> bool:
    """
    Soft-deletes a case annotation entry to ensure chronological audit history compliance.
    """
    annotation = case_annotation_crud.get_annotation_by_id(db, annotation_id)
    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotation record not found."
        )

    # Scoping check
    case = case_crud.get_case_by_id(db, annotation.CaseMasterID, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated case not found or access denied."
        )

    success = case_annotation_crud.delete_annotation(db, annotation_id)
    if success:
        # Audit log
        audit_service.log_action(
            db=db,
            user_id=current_user.UserID,
            action="DELETE_ANNOTATION",
            module="Annotation Manager",
            resource_id=str(annotation.CaseMasterID),
            old_val=f"AnnotationID: {annotation_id}"
        )
    return success
