from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.accused import Accused

def get_accused_by_id(db: Session, accused_id: int) -> Accused | None:
    """Retrieves a single accused record by AccusedMasterID."""
    return db.query(Accused).filter(Accused.AccusedMasterID == accused_id).first()

def get_accused_paginated(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: str = None
) -> tuple[list[Accused], int]:
    """Retrieves a paginated list of accused records along with matching count."""
    query = db.query(Accused)

    if search:
        query = query.filter(
            or_(
                Accused.AccusedName.ilike(f"%{search}%"),
                Accused.Occupation.ilike(f"%{search}%")
            )
        )

    total_count = query.count()
    accused_list = query.order_by(Accused.AccusedMasterID).offset(skip).limit(limit).all()
    return accused_list, total_count

def create_accused(db: Session, accused_data: dict) -> Accused:
    """Creates a new Accused record."""
    db_accused = Accused(**accused_data)
    db.add(db_accused)
    db.commit()
    db.refresh(db_accused)
    return db_accused

def update_accused(db: Session, accused_db: Accused, accused_data: dict) -> Accused:
    """Updates fields on an existing Accused record."""
    for key, value in accused_data.items():
        setattr(accused_db, key, value)
    db.commit()
    db.refresh(accused_db)
    return accused_db

def delete_accused(db: Session, accused_id: int) -> bool:
    """Deletes an Accused record by AccusedMasterID."""
    db_accused = db.query(Accused).filter(Accused.AccusedMasterID == accused_id).first()
    if not db_accused:
        return False
    db.delete(db_accused)
    db.commit()
    return True
