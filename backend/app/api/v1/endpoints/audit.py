from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.crud import audit_crud
from app.schemas.audit import AuditLogOut

router = APIRouter()

@router.get("", response_model=List[AuditLogOut], summary="List Audit Logs")
def read_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, alias="pageSize", description="Page size"),
    user_id: Optional[int] = Query(None, alias="userId", description="Filter by User ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("users:manage"))
):
    """
    Retrieves a paginated list of system compliance audit logs, optionally filtered by UserID.
    """
    skip = (page - 1) * page_size
    return audit_crud.get_audit_entries(
        db=db,
        skip=skip,
        limit=page_size,
        user_id=user_id
    )
