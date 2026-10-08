from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Body, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.auth import LoginRequest, TokenResponse, TokenRefreshRequest, UserOut
from app.services import auth_service
from app.models.user import User
from app.core.security import hash_password, validate_password_strength, verify_password
from app.schemas.auth import PasswordChange
from app.services import audit_service

router = APIRouter()

@router.post("/login", response_model=TokenResponse, summary="User Login")
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticates a user/officer supporting Swagger OAuth2 Authorize form (application/x-www-form-urlencoded), application/json, or query params.
    """
    username = ""
    password = ""
    content_type = request.headers.get("content-type", "")

    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        try:
            raw_form = await request.form()
            username = str(raw_form.get("username") or raw_form.get("Username") or "")
            password = str(raw_form.get("password") or raw_form.get("Password") or "")
        except Exception:
            pass

    if not username and not password:
        try:
            body = await request.json()
            username = str(body.get("Username") or body.get("username") or "")
            password = str(body.get("Password") or body.get("password") or "")
        except Exception:
            pass

    if not username and not password:
        username = request.query_params.get("username") or request.query_params.get("Username") or ""
        password = request.query_params.get("password") or request.query_params.get("Password") or ""

    login_req = LoginRequest(
        Username=username,
        Password=password
    )
    return auth_service.authenticate_user(db, login_req)

@router.post("/refresh", response_model=TokenResponse, summary="Refresh Access Token")
def refresh(request: TokenRefreshRequest, db: Session = Depends(get_db)):
    """
    Validates a refresh token and returns a new access and refresh token pair.
    """
    return auth_service.refresh_access_token(db, request)

@router.post("/logout", status_code=204, summary="User Logout")
async def logout(request: Request):
    """
    Revokes the provided refresh token via application/x-www-form-urlencoded or application/json.
    """
    content_type = request.headers.get("content-type", "")
    if "application/x-www-form-urlencoded" in content_type:
        form_data = await request.form()
        refresh_token = str(form_data.get("refresh_token") or "")
    else:
        try:
            body = await request.json()
            refresh_token = body.get("refresh_token", "")
        except Exception:
            refresh_token = ""
    auth_service.logout_user(refresh_token)

@router.get("/me", response_model=UserOut, summary="Get Current User Profile")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieves the profile details of the currently logged-in active user.
    """
    if getattr(current_user, "OfficerID", None):
        try:
            from app.models.officer import Officer
            officer = db.query(Officer).filter(Officer.OfficerID == current_user.OfficerID).first()
            if officer:
                setattr(current_user, "Rank", officer.Rank)
        except Exception:
            pass
    from app.core.permissions import permissions_for_user
    setattr(current_user, "Permissions", permissions_for_user(db, current_user))
    from app.services.scope_service import describe_scope
    level, description = describe_scope(db, current_user)
    setattr(current_user, "ScopeLevel", level)
    setattr(current_user, "ScopeDescription", description)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT, summary="Change your own password")
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Requires the current password; the new one must meet the platform's strength rules."""
    if not verify_password(body.CurrentPassword, current_user.PasswordHash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The current password is incorrect.")
    if body.NewPassword == body.CurrentPassword:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a password different from the current one.")
    problem = validate_password_strength(body.NewPassword)
    if problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)
    current_user.PasswordHash = hash_password(body.NewPassword)
    db.commit()
    audit_service.log_action(db=db, user_id=current_user.UserID, action="CHANGE_PASSWORD", module="Auth", resource_id=str(current_user.UserID))
