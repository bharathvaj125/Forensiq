import json
import logging
from datetime import datetime, date, timezone
from sqlalchemy.event import listen
from sqlalchemy.orm import Mapper
from app.models.audit_log import AuditLog
from app.core.context import current_user_id

logger = logging.getLogger("ksp_backend")

def after_insert_listener(mapper, connection, target):
    """Event listener triggered after a record is inserted."""
    if isinstance(target, AuditLog):
        return

    user_id = current_user_id.get()
    table_name = target.__tablename__
    
    # Resolve the primary key value
    pk_name = target.__mapper__.primary_key[0].name
    resource_id = getattr(target, pk_name, None)
    
    # Serialize the inserted attributes
    new_vals = {}
    for col in target.__table__.columns:
        val = getattr(target, col.name, None)
        if val is not None:
            if isinstance(val, (datetime, date)):
                new_vals[col.name] = val.isoformat()
            else:
                new_vals[col.name] = str(val)

    # Insert log directly via the active transaction connection
    connection.execute(
        AuditLog.__table__.insert().values(
            Timestamp=datetime.now(timezone.utc),
            UserID=user_id,
            Action="CREATE",
            ModuleName=table_name.upper(),
            ResourceID=str(resource_id) if resource_id is not None else None,
            OldValue=None,
            NewValue=json.dumps(new_vals)
        )
    )

def after_update_listener(mapper, connection, target):
    """Event listener triggered after a record is updated."""
    if isinstance(target, AuditLog):
        return

    user_id = current_user_id.get()
    table_name = target.__tablename__
    
    pk_name = target.__mapper__.primary_key[0].name
    resource_id = getattr(target, pk_name, None)
    
    # Capture changes on column attributes using get_history
    from sqlalchemy.orm.attributes import get_history
    old_vals = {}
    new_vals = {}
    
    for col in target.__table__.columns:
        history = get_history(target, col.name)
        if history.has_changes():
            old_val = history.deleted[0] if history.deleted else None
            new_val = history.added[0] if history.added else None
            
            # Skip if no actual modification happened
            if old_val == new_val:
                continue
                
            old_vals[col.name] = str(old_val) if old_val is not None else ""
            new_vals[col.name] = str(new_val) if new_val is not None else ""
            
    if not old_vals and not new_vals:
        return

    connection.execute(
        AuditLog.__table__.insert().values(
            Timestamp=datetime.now(timezone.utc),
            UserID=user_id,
            Action="UPDATE",
            ModuleName=table_name.upper(),
            ResourceID=str(resource_id) if resource_id is not None else None,
            OldValue=json.dumps(old_vals),
            NewValue=json.dumps(new_vals)
        )
    )

def after_delete_listener(mapper, connection, target):
    """Event listener triggered after a record is deleted."""
    if isinstance(target, AuditLog):
        return

    user_id = current_user_id.get()
    table_name = target.__tablename__
    
    pk_name = target.__mapper__.primary_key[0].name
    resource_id = getattr(target, pk_name, None)
    
    connection.execute(
        AuditLog.__table__.insert().values(
            Timestamp=datetime.now(timezone.utc),
            UserID=user_id,
            Action="DELETE",
            ModuleName=table_name.upper(),
            ResourceID=str(resource_id) if resource_id is not None else None,
            OldValue=f"Deleted record ID: {resource_id}",
            NewValue=None
        )
    )

def register_audit_listeners():
    """Loops through all database model mappers and registers the event hooks."""
    from app.db.base import Base
    logger.info("Registering database-wide SQLAlchemy audit listeners...")
    for mapper in Base.registry.mappers:
        # Listen to active mapper classes with associated database tables
        if hasattr(mapper.class_, "__tablename__"):
            listen(mapper.class_, "after_insert", after_insert_listener)
            listen(mapper.class_, "after_update", after_update_listener)
            listen(mapper.class_, "after_delete", after_delete_listener)
