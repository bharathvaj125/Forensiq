from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

def create_audit_entry(db: Session, audit_data: dict) -> AuditLog:
    """Creates and commits a new AuditLog entry in the database."""
    db_entry = AuditLog(**audit_data)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def get_audit_entries(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    user_id: int = None
) -> list[AuditLog]:
    """Retrieves paginated audit logs, optionally filtered by UserID."""
    query = db.query(AuditLog)
    if user_id is not None:
        query = query.filter(AuditLog.UserID == user_id)
    return query.order_by(AuditLog.Timestamp.desc()).offset(skip).limit(limit).all()
