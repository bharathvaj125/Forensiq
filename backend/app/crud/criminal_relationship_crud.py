from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.criminal_relationship import CriminalRelationship

def get_relationship_by_id(db: Session, relationship_id: int) -> CriminalRelationship | None:
    """Retrieves a single relationship record by RelationshipID."""
    return db.query(CriminalRelationship).filter(CriminalRelationship.RelationshipID == relationship_id).first()

def get_relationships_by_person(db: Session, person_id: int) -> list[CriminalRelationship]:
    """Retrieves all active relationships where the person is either the source or target."""
    return db.query(CriminalRelationship).filter(
        or_(
            CriminalRelationship.SourcePersonID == person_id,
            CriminalRelationship.TargetPersonID == person_id
        ),
        CriminalRelationship.Active == True
    ).order_by(CriminalRelationship.RelationshipID).all()

def create_relationship(db: Session, relationship_data: dict) -> CriminalRelationship:
    """Creates a new CriminalRelationship record."""
    db_relationship = CriminalRelationship(**relationship_data)
    db.add(db_relationship)
    db.commit()
    db.refresh(db_relationship)
    return db_relationship

def update_relationship(db: Session, relationship_db: CriminalRelationship, relationship_data: dict) -> CriminalRelationship:
    """Updates fields on an existing CriminalRelationship record."""
    for key, value in relationship_data.items():
        setattr(relationship_db, key, value)
    db.commit()
    db.refresh(relationship_db)
    return relationship_db

def delete_relationship(db: Session, relationship_id: int) -> bool:
    """Deletes a relationship record by setting its Active status to False."""
    db_relationship = db.query(CriminalRelationship).filter(CriminalRelationship.RelationshipID == relationship_id).first()
    if not db_relationship:
        return False
    db_relationship.Active = False
    db.commit()
    return True
