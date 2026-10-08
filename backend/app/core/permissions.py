from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.models.role_permission import RolePermission
from app.models.permission import Permission
from app.services import cache

PERMISSION_TTL = 300

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

    return permission_code in _role_codes(db, user.RoleID)


def _role_codes(db: Session, role_id: int) -> frozenset:
    """The permission codes a role grants, cached (roles change rarely and admin changes clear the cache)."""
    def load():
        return frozenset(code for (code,) in db.query(Permission.PermissionCode).join(
            RolePermission, RolePermission.PermissionID == Permission.PermissionID).filter(RolePermission.RoleID == role_id).all())
    return cache.get_or_compute(("role-codes", role_id), PERMISSION_TTL, load)

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


def permissions_for_user(db: Session, user: User) -> list[str]:
    """Every permission code the user's role grants (mirrors has_permission's rules)."""
    if not user.RoleID:
        return []
    every_code = cache.get_or_compute(("all-codes",), PERMISSION_TTL, lambda: frozenset(code for (code,) in db.query(Permission.PermissionCode).all()))
    if user.RoleID == 1 or (user.role and user.role.RoleName == "Admin"):
        return sorted(every_code)
    codes = set(_role_codes(db, user.RoleID))
    if user.role and user.role.RoleName == "ExternalAgencyOfficer":
        codes |= {code for code in every_code if "read" in code}
    return sorted(codes)
