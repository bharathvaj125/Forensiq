from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.models.officer import Officer

def get_officer_by_id(db: Session, officer_id: int) -> Officer | None:
    """Retrieves a single officer record by OfficerID."""
    return db.query(Officer).filter(Officer.OfficerID == officer_id).first()

def get_officers_paginated(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: str = None
) -> tuple[list[Officer], int]:
    """Retrieves a paginated list of officers along with matching count."""
    query = db.query(Officer)

    if search:
        query = query.filter(
            or_(
                Officer.Name.ilike(f"%{search}%"),
                Officer.BadgeNumber.ilike(f"%{search}%"),
                Officer.Rank.ilike(f"%{search}%")
            )
        )

    total_count = query.count()
    officers = query.order_by(Officer.OfficerID).offset(skip).limit(limit).all()
    return officers, total_count

def create_officer(db: Session, officer_data: dict) -> Officer:
    """Creates a new Officer record."""
    db_officer = Officer(**officer_data)
    db.add(db_officer)
    db.commit()
    db.refresh(db_officer)
    return db_officer

def update_officer(db: Session, officer_db: Officer, officer_data: dict) -> Officer:
    """Updates fields on an existing Officer record."""
    for key, value in officer_data.items():
        setattr(officer_db, key, value)
    db.commit()
    db.refresh(officer_db)
    return officer_db

def delete_officer(db: Session, officer_id: int) -> bool:
    """Deletes an Officer record by OfficerID."""
    db_officer = db.query(Officer).filter(Officer.OfficerID == officer_id).first()
    if not db_officer:
        return False
    db.delete(db_officer)
    db.commit()
    return True
