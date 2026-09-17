from sqlalchemy.orm import Session
from app.crud import audit_crud

def log_action(
    db: Session,
    user_id: int | None,
    action: str,
    module: str,
    resource_id: str = None,
    client_ip: str = None,
    user_agent: str = None,
    old_val: str = None,
    new_val: str = None
):
    """
    Standard service helper to write compliance audit logs.
    Catches and handles internal db exceptions to prevent audit log failures
    from rolling back primary business operations.
    """
    audit_data = {
        "UserID": user_id,
        "Action": action,
        "ModuleName": module,
        "ResourceID": resource_id,
        "ClientIP": client_ip,
        "UserAgent": user_agent,
        "OldValue": old_val,
        "NewValue": new_val
    }
    try:
        audit_crud.create_audit_entry(db, audit_data)
    except Exception:
        # Fail-silent for audit writes so core operations are not blocked
        pass
