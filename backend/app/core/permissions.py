from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.models.role_permission import RolePermission
from app.models.permission import Permission

def has_permission(db: Session, user: User, permission_code: str) -> bool:
    """
    Checks if a user's role has the specified permission.
    Admins automatically bypass all permission checks.
    """
    if not user.RoleID:
        return False
    
    # Bypass all permission checks for Admin role (by ID or name)
    if user.RoleID == 1 or (user.role and user.role.RoleName == "Admin"):
        return True

    # Allow read-only permissions for ExternalAgencyOfficer role
    if user.role and user.role.RoleName == "ExternalAgencyOfficer" and (permission_code.endswith(":read") or "read" in permission_code):
        return True

    # Query if the user's role is granted the requested permission
    exists = db.query(RolePermission).join(
        Permission, RolePermission.PermissionID == Permission.PermissionID
    ).filter(
        RolePermission.RoleID == user.RoleID,
        Permission.PermissionCode == permission_code
    ).first()
    
    return exists is not None

def verify_permission(permission_code: str):
    """
    FastAPI dependency factory that returns a dependency function to enforce
    permission requirements on routes.
    """
    def dependency(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if not has_permission(db, current_user, permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: required '{permission_code}'"
            )
        return current_user
    return dependency
