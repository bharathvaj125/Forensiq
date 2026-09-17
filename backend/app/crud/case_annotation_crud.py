from sqlalchemy.orm import Session, joinedload
from app.models.case_annotation import CaseAnnotation

def get_annotation_by_id(db: Session, annotation_id: int) -> CaseAnnotation | None:
    """Retrieves a single annotation record by AnnotationID."""
    return db.query(CaseAnnotation).filter(CaseAnnotation.AnnotationID == annotation_id).first()

def get_annotations_by_case(db: Session, case_id: int) -> list[CaseAnnotation]:
    """Retrieves all non-deleted annotations for a specific CaseMasterID."""
    return db.query(CaseAnnotation).options(
        joinedload(CaseAnnotation.user)
    ).filter(
        CaseAnnotation.CaseMasterID == case_id,
        CaseAnnotation.IsDeleted == False
    ).order_by(CaseAnnotation.CreatedAt).all()

def create_annotation(db: Session, annotation_data: dict) -> CaseAnnotation:
    """Creates and commits a new CaseAnnotation record."""
    db_annotation = CaseAnnotation(**annotation_data)
    db.add(db_annotation)
    db.commit()
    db.refresh(db_annotation)
    return db_annotation

def update_annotation(db: Session, annotation_db: CaseAnnotation, annotation_data: dict) -> CaseAnnotation:
    """Updates fields on an existing CaseAnnotation record."""
    for key, value in annotation_data.items():
        setattr(annotation_db, key, value)
    db.commit()
    db.refresh(annotation_db)
    return annotation_db

def delete_annotation(db: Session, annotation_id: int) -> bool:
    """Enforces soft deletion of CaseAnnotation records to preserve audit compliance history."""
    db_annotation = db.query(CaseAnnotation).filter(CaseAnnotation.AnnotationID == annotation_id).first()
    if not db_annotation:
        return False
    db_annotation.IsDeleted = True
    db.commit()
    return True
