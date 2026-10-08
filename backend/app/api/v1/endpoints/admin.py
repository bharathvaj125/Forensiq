from datetime import datetime, timedelta, timezone
from typing import List
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.core.security import hash_password, validate_password_strength
from app.db import session as db_session
from app.middleware.jurisdiction_scope import STATEWIDE_ROLES
from app.models.user import User
from app.models.user_jurisdiction import UserJurisdiction
from app.models.officer import Officer
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.permission import Permission
from app.schemas.admin import (
    AdminUserOut, PasswordReset, RoleDetail, UserActiveUpdate, UserCreate, UserJurisdictionCreate, UserJurisdictionOut, UserRoleUpdate,
)
from app.services import audit_service, cache, reference_data
from app.services.scope_service import describe_scope

router = APIRouter()


def _admin_user(db: Session, user: User, officers: dict, jurisdictions: dict) -> dict:
    officer = officers.get(user.OfficerID)
    level, description = describe_scope(db, user, jurisdictions.get(user.UserID, []), officer)
    return {
        "UserID": user.UserID, "Username": user.Username, "Email": user.Email, "IsActive": user.IsActive, "CreatedAt": user.CreatedAt,
        "role": user.role, "OfficerID": user.OfficerID, "OfficerName": officer.Name if officer else None,
        "Rank": officer.Rank if officer else None, "BadgeNumber": officer.BadgeNumber if officer else None,
        "ScopeLevel": level, "ScopeDescription": description,
    }


def _directory(db: Session, users: list[User]) -> list[dict]:
    officers = {o.OfficerID: o for o in db.query(Officer).filter(Officer.OfficerID.in_([u.OfficerID for u in users if u.OfficerID])).all()}
    jurisdictions: dict[int, list[UserJurisdiction]] = {}
    for row in db.query(UserJurisdiction).all():
        jurisdictions.setdefault(row.UserID, []).append(row)
    return [_admin_user(db, u, officers, jurisdictions) for u in users]


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED, summary="Create Platform User")
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("users:manage"))
):
    """Creates the account and, unless an existing officer is linked, the officer record behind it (name, badge, rank,
    posting). A user who is not on a statewide role also gets a jurisdiction row for the chosen station or district."""
    pw_error = validate_password_strength(user_in.Password)
    if pw_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_error)
    if db.query(User).filter(User.Username == user_in.Username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already registered.")
    role = db.query(Role).filter(Role.RoleID == user_in.RoleID).first() if user_in.RoleID else None
    if not role:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a valid role.")

    station_id, district_id = user_in.PoliceStationID, user_in.DistrictID
    if station_id:
        station_district = reference_data.station_districts(db).get(station_id)
        if station_district is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown police station.")
        if district_id and district_id != station_district:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="That station is not in the chosen district.")
        district_id = station_district
    elif district_id and district_id not in reference_data.district_names(db):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown district.")
    if role.RoleName not in STATEWIDE_ROLES and role.RoleName != "ExternalAgencyOfficer" and not (station_id or district_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"The {role.RoleName} role needs a district or station, otherwise the account would see no cases.")

    officer_id = user_in.OfficerID
    if officer_id:
        if not db.query(Officer.OfficerID).filter(Officer.OfficerID == officer_id).first():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown officer.")
    else:
        if not user_in.OfficerName or not user_in.BadgeNumber or not user_in.Rank:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The officer's name, badge number and rank are required.")
        if db.query(Officer.OfficerID).filter(Officer.BadgeNumber == user_in.BadgeNumber).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That badge number belongs to another officer.")
        officer = Officer(Name=user_in.OfficerName, Rank=user_in.Rank, BadgeNumber=user_in.BadgeNumber,
                          PoliceStationID=station_id, DistrictID=district_id)
        db.add(officer)
        db.flush()
        officer_id = officer.OfficerID

    db_user = User(Username=user_in.Username, PasswordHash=hash_password(user_in.Password), Email=user_in.Email,
                   OfficerID=officer_id, RoleID=role.RoleID, IsActive=True)
    db.add(db_user)
    db.flush()
    if station_id or district_id:
        db.add(UserJurisdiction(UserID=db_user.UserID, UnitID=station_id or None, DistrictID=None if station_id else district_id, Active=True))
    db.commit()
    cache.clear()
    audit_service.log_action(db=db, user_id=current_user.UserID, action="CREATE_USER", module="Admin",
                             resource_id=str(db_user.UserID), new_val=f"{db_user.Username} ({role.RoleName})")
    return _directory(db, [db_user])[0]


@router.get("/users", response_model=List[AdminUserOut], summary="List Platform Users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(verify_permission("users:manage"))):
    """Every account with its officer record, role and the scope the server will actually apply."""
    return _directory(db, db.query(User).order_by(User.Username).all())


@router.get("/roles", response_model=List[RoleDetail], summary="Roles, their permissions and how many accounts hold them")
def list_roles(db: Session = Depends(get_db), current_user: User = Depends(verify_permission("users:manage"))):
    codes: dict[int, list[str]] = {}
    for role_id, code in db.query(RolePermission.RoleID, Permission.PermissionCode).join(
            Permission, Permission.PermissionID == RolePermission.PermissionID).all():
        codes.setdefault(role_id, []).append(code)
    holders = dict(db.query(User.RoleID, func.count(User.UserID)).group_by(User.RoleID).all())
    return [{
        "RoleID": r.RoleID, "RoleName": r.RoleName, "Description": r.Description, "Permissions": sorted(codes.get(r.RoleID, [])),
        "ScopeLevel": "Statewide" if r.RoleName in STATEWIDE_ROLES else "Granted access only" if r.RoleName == "ExternalAgencyOfficer" else "Station / district",
        "Users": holders.get(r.RoleID, 0),
    } for r in db.query(Role).order_by(Role.RoleID).all()]


@router.patch("/users/{user_id}/role", response_model=AdminUserOut, summary="Update User Security Role")
def update_user_role(
    user_id: int,
    role_in: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("users:manage"))
):
    target = db.query(User).filter(User.UserID == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.UserID == current_user.UserID:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role.")
    role = db.query(Role).filter(Role.RoleID == role_in.RoleID).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown role.")
    previous = target.role.RoleName if target.role else None
    target.RoleID = role.RoleID
    db.commit()
    cache.clear()
    audit_service.log_action(db=db, user_id=current_user.UserID, action="UPDATE_USER_ROLE", module="Admin",
                             resource_id=str(user_id), old_val=previous, new_val=role.RoleName)
    db.refresh(target)
    return _directory(db, [target])[0]


@router.patch("/users/{user_id}/active", response_model=AdminUserOut, summary="Deactivate or reactivate an account")
def set_user_active(
    user_id: int,
    body: UserActiveUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("users:manage"))
):
    target = db.query(User).filter(User.UserID == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.UserID == current_user.UserID and not body.IsActive:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account.")
    target.IsActive = body.IsActive
    db.commit()
    audit_service.log_action(db=db, user_id=current_user.UserID, action="ACTIVATE_USER" if body.IsActive else "DEACTIVATE_USER",
                             module="Admin", resource_id=str(user_id))
    return _directory(db, [target])[0]


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT, summary="Set a new password for an account")
def reset_password(
    user_id: int,
    body: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("users:manage"))
):
    target = db.query(User).filter(User.UserID == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    problem = validate_password_strength(body.NewPassword)
    if problem:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=problem)
    target.PasswordHash = hash_password(body.NewPassword)
    db.commit()
    audit_service.log_action(db=db, user_id=current_user.UserID, action="RESET_PASSWORD", module="Admin", resource_id=str(user_id))


@router.post("/jurisdictions", response_model=UserJurisdictionOut, status_code=status.HTTP_201_CREATED, summary="Assign User Jurisdiction Override")
def assign_jurisdiction(
    jurisdict_in: UserJurisdictionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("users:manage"))
):
    """Adds a district or station the user may work in, on top of any they already have."""
    if not jurisdict_in.DistrictID and not jurisdict_in.UnitID:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Give a district or a police station.")
    if not db.query(User.UserID).filter(User.UserID == jurisdict_in.UserID).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    db_jurisdict = UserJurisdiction(UserID=jurisdict_in.UserID, DistrictID=jurisdict_in.DistrictID, UnitID=jurisdict_in.UnitID, Active=jurisdict_in.Active)
    db.add(db_jurisdict)
    db.commit()
    db.refresh(db_jurisdict)
    cache.clear()
    return db_jurisdict


# ------------------------------------------------------------------------------------ system health

def _count(db: Session, model) -> int:
    return int(db.query(func.count()).select_from(model).scalar() or 0)


@router.get("/system-health", summary="Database, model, assistant and activity figures read live from the platform")
def system_health(db: Session = Depends(get_db), current_user: User = Depends(verify_permission("users:manage"))):
    from app.core.config import settings
    from app.ml.models.anomaly.detector import MODEL_VERSION as ANOMALY_VERSION
    from app.ml.models.forecasting.forecaster import MODEL_VERSION as FORECAST_VERSION
    from app.ml.models.hotspot.predictor import MODEL_VERSION as HOTSPOT_VERSION
    from app.ml.models.repeat_offender.train import MODEL_VERSION as LINKAGE_VERSION
    from app.ml.models.risk_scoring import scorer
    from app.models.accused import Accused
    from app.models.ai_model_run import AIModelRun
    from app.models.audit_log import AuditLog
    from app.models.case_embedding import CaseEmbedding
    from app.models.case_master import CaseMaster
    from app.models.criminal_relationship import CriminalRelationship
    from app.models.evidence import Evidence
    from app.models.notification import Notification
    from app.models.vehicle import Vehicle
    from app.models.victim import Victim
    from app.models.court_case import CourtCase
    from app.services import analytics, gemini_client
    from app.services.network_service import COMMUNITY_MODEL_VERSION

    started = time.perf_counter()
    db.execute(text("select 1"))
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    dialect = db.get_bind().dialect.name

    tables = []
    for model in (CaseMaster, Accused, Victim, Evidence, Vehicle, Officer, User, AuditLog, AIModelRun, CaseEmbedding, CriminalRelationship, Notification, CourtCase):
        name = model.__tablename__
        size = None
        if dialect == "postgresql":
            size = db.execute(text("select pg_total_relation_size(to_regclass(:name))"), {"name": name}).scalar()
        tables.append({"table_name": name, "row_count": _count(db, model), "size_bytes": int(size) if size is not None else None})
    database_size = db.execute(text("select pg_database_size(current_database())")).scalar() if dialect == "postgresql" else None

    try:
        risk = scorer.model_card()
        risk_info = {"version": risk["version"], "trained_at": risk["trained_at"], "trained_on": risk["trained_on"],
                     "cross_validated_accuracy": risk["cross_validation"].get("accuracy"), "majority_class_accuracy": risk["majority_class_accuracy"]}
        current_version = risk["version"]
    except Exception as exc:  # noqa: BLE001 - reported to the administrator rather than hidden
        risk_info, current_version = {"error": str(exc)}, None

    total_cases = _count(db, CaseMaster)
    scored_current = db.query(func.count(CaseMaster.CaseMasterID)).filter(CaseMaster.AIRiskModelVersion == current_version).scalar() if current_version else 0
    embedded = db.query(func.count(func.distinct(CaseEmbedding.CaseMasterID))).scalar()
    configured = bool(settings.LLM_API_KEY) and settings.LLM_API_KEY != "change_me"
    models = gemini_client.available_models() if configured else []
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    return {
        "database": {"dialect": dialect, "healthy": True, "latency_ms": latency_ms, "size_bytes": int(database_size) if database_size is not None else None,
                     "fallback_active": bool(db_session.DB_FALLBACK_ACTIVE)},
        "tables": tables,
        "models": [
            {"name": "Case risk scoring", "version": risk_info.get("version"), "detail": risk_info},
            {"name": "Late-reporting anomaly detection", "version": ANOMALY_VERSION},
            {"name": "Crime forecast", "version": FORECAST_VERSION},
            {"name": "Hotspot detection", "version": HOTSPOT_VERSION},
            {"name": "Repeat-offender linkage", "version": LINKAGE_VERSION},
            {"name": "Network communities", "version": COMMUNITY_MODEL_VERSION},
        ],
        "scoring": {"cases": total_cases, "scored_with_current_model": int(scored_current or 0)},
        "embeddings": {"embedded_cases": int(embedded or 0), "cases": total_cases},
        "assistant": {"configured": configured, "available": bool(models), "models": models,
                      "retry_in_seconds": None if models or not configured else round(gemini_client.soonest_available_in())},
        "activity_24h": {
            "ai_runs": db.query(func.count(AIModelRun.AIModelRunID)).filter(AIModelRun.CreatedAt >= since).scalar(),
            "audit_events": db.query(func.count(AuditLog.AuditLogID)).filter(AuditLog.Timestamp >= since).scalar(),
            "active_users": db.query(func.count(func.distinct(AuditLog.UserID))).filter(AuditLog.Timestamp >= since, AuditLog.UserID.isnot(None)).scalar(),
        },
        "as_of_date": analytics.as_of_date(db).isoformat(),
    }
