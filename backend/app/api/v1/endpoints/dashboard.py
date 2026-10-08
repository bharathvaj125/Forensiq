"""Dashboard data: one server-side summary so no screen has to extrapolate from a sample of cases."""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.core.permissions import verify_permission
from app.ml.models.anomaly.detector import MODIFIED_Z_CUTOFF, delay_scores
from app.models.accused import Accused
from app.models.ai_model_run import AIModelRun
from app.models.audit_log import AuditLog
from app.models.case_assignment import CaseAssignment
from app.models.case_master import CaseMaster
from app.models.district import District
from app.models.officer import Officer
from app.models.police_station import PoliceStation
from app.models.task_delegation import TaskDelegation
from app.models.user import User
from app.services import analytics, predictive_service, reference_data

router = APIRouter()


def _counts(frame: pd.DataFrame, key: str, names: dict, groups: dict, limit: int | None = None) -> list[dict]:
    rows = []
    for value, group in frame.groupby(key):
        rows.append({"id": int(value), "name": names.get(int(value), f"#{int(value)}"), "cases": int(len(group)),
                     "open": int(analytics.is_open(group, groups).sum()), "high_risk": int(analytics.high_risk(group).sum())})
    rows.sort(key=lambda row: -row["cases"])
    return rows[:limit] if limit else rows


@router.get("/summary", summary="Aggregated figures for the dashboard, computed from every case in scope")
def get_summary(
    district_id: Optional[int] = Query(None, alias="districtId"),
    station_id: Optional[int] = Query(None, alias="stationId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    as_of = analytics.as_of_date(db)
    everything = analytics.load_cases(db, current_user)
    future = int((everything["registered"] > pd.Timestamp(as_of)).sum())
    everything = everything[everything["registered"] <= pd.Timestamp(as_of)]

    frame = everything
    if station_id:
        frame = frame[frame["station_id"] == station_id]
    elif district_id:
        frame = frame[frame["district_id"] == district_id]

    groups = reference_data.status_groups(db)
    status_names = reference_data.status_names(db)
    district_names = reference_data.district_names(db)
    station_names = reference_data.station_names(db)
    station_district = reference_data.station_districts(db)
    crime_names = reference_data.crime_head_names(db)

    delays = ((frame["received"] - frame["incident"]).dt.total_seconds() / 3600).fillna(0.0).tolist()
    z_scores, _, spread = delay_scores(delays) if len(delays) >= 3 else ([], 0, 0)
    anomalies = int((pd.Series(z_scores) >= MODIFIED_Z_CUTOFF).sum()) if spread else 0

    case_ids = set(int(i) for i in frame["CaseMasterID"])
    profiles = {p for ps in analytics.repeat_profiles_by_case(db, case_ids).values() for p in ps}

    hotspots = analytics.compute_hotspots(db, frame, limit=10)
    alerts = predictive_service._collect_alerts(db, frame, as_of)
    window = analytics.best_window(analytics.hourly_counts(frame))
    plan = predictive_service.get_patrol_strategy(db, current_user, district_id=district_id, station_id=station_id) if hotspots else None

    monthly = frame.groupby(frame["registered"].dt.strftime("%Y-%m")).size().sort_index().tail(24)
    top_crimes = analytics.top_counts(frame["head_id"], crime_names, 3)
    open_cases = int(analytics.is_open(frame, groups).sum()) if len(frame) else 0
    overdue = analytics.overdue_investigations(db, frame, as_of) if len(frame) else {"count": 0, "under_investigation": 0}
    briefing = (
        f"{len(frame)} FIRs in scope (registered up to {as_of.isoformat()}); {open_cases} are open and {int(analytics.high_risk(frame).sum())} are rated "
        f"High or Severe by the risk model."
        + (f" Most frequent crime: {top_crimes[0][0]} ({top_crimes[0][1]})." if top_crimes else "")
        + (f" Incidents peak between {analytics.window_label(window)} ({window['share']:.0%} of all)." if window else "")
        + f" {overdue['count']} of {overdue['under_investigation']} investigations are past the statutory window."
    ) if len(frame) else "No cases in this scope."

    recommendations = []
    if plan and plan["patrol_route"]:
        recommendations.append({"title": "Patrol deployment", "priority": plan["priority_level"],
                                "detail": f"{plan['recommended_cars']} car(s) and {plan['recommended_bikes']} bike unit(s) for {plan['suggested_timing']} ({plan['suggested_shift']}); first stop {plan['patrol_route'][0]}."})
    for alert in alerts[:2]:
        recommendations.append({"title": alert["alert_type"], "priority": alert["risk_level"].upper(), "detail": alert["suggested_action"]})

    latest = frame.sort_values("registered", ascending=False).head(6)
    facts = dict(db.query(CaseMaster.CaseMasterID, CaseMaster.BriefFacts).filter(CaseMaster.CaseMasterID.in_([int(i) for i in latest["CaseMasterID"]])).all()) if len(latest) else {}
    recent_cases = [{"case_id": int(r.CaseMasterID), "case_no": r.CaseNo, "registered": r.registered.date().isoformat(),
                     "station": station_names.get(int(r.station_id)), "risk_level": r.level,
                     "crime_type": crime_names.get(int(r.head_id)) if pd.notna(r.head_id) else None,
                     "facts": (facts.get(int(r.CaseMasterID)) or "")[:140]} for r in latest.itertuples()]

    activity_query = db.query(AIModelRun, User.Username).join(User, User.UserID == AIModelRun.UserID).order_by(AIModelRun.CreatedAt.desc())
    if current_user.role is None or current_user.role.RoleName != "Admin":
        activity_query = activity_query.filter(AIModelRun.UserID == current_user.UserID)
    activity = [{"time": run.CreatedAt.isoformat() if run.CreatedAt else None, "label": run.Capability.replace("_", " "),
                 "detail": f"{run.ModelName} {run.ModelVersion} (by {username})"} for run, username in activity_query.limit(8).all()]

    scope_level = "station" if station_id else "district" if district_id else "statewide"
    return {
        "as_of_date": as_of.isoformat(), "future_dated_excluded": future,
        "scope": {"level": scope_level, "district_id": district_id, "station_id": station_id,
                  "name": station_names.get(station_id) if station_id else district_names.get(district_id) if district_id else "All districts"},
        "totals": {
            "cases": int(len(frame)), "open": open_cases, "closed": int(frame["status_id"].isin(groups["closed"]).sum()),
            "high_risk": int(analytics.high_risk(frame).sum()), "severe": int((frame["level"] == "Severe").sum()),
            "unscored": int(frame["level"].isna().sum()), "repeat_offender_profiles": len(profiles),
            "anomalies_flagged": anomalies, "hotspots": len(hotspots),
            "critical_or_high_hotspots": sum(1 for h in hotspots if h["risk_level"] in ("Critical", "High")),
            "active_alerts": len(alerts),
        },
        "by_status": [{"id": int(k), "name": status_names.get(int(k), f"#{int(k)}"), "cases": int(v)} for k, v in frame["status_id"].value_counts().items()],
        "by_risk_level": {str(k): int(v) for k, v in frame["level"].value_counts().items()},
        "by_district": _counts(everything, "district_id", district_names, groups),
        "by_station": _counts(frame, "station_id", station_names, groups, limit=12),
        "by_crime_type": [{"id": int(k), "name": crime_names.get(int(k), f"#{int(k)}"), "cases": int(v)} for k, v in frame["head_id"].value_counts().items()],
        "monthly": [{"month": f"{m} (to {as_of.day})" if m == as_of.strftime("%Y-%m") and as_of != (pd.Timestamp(as_of) + pd.offsets.MonthEnd(0)).date() else m,
                     "cases": int(c)} for m, c in monthly.items()],
        "districts": sorted(({"id": i, "name": n} for i, n in district_names.items()), key=lambda d: d["name"]),
        "stations": sorted(({"id": i, "name": n, "district_id": station_district.get(i)} for i, n in station_names.items()
                            if district_id and station_district.get(i) == district_id), key=lambda s: s["name"]),
        "briefing": briefing, "alerts": alerts[:5], "recommendations": recommendations,
        "recent_cases": recent_cases, "activity": activity,
    }


@router.get("/workspace", summary="Figures about the signed-in user's own work, and platform totals for administrators")
def get_workspace(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    is_admin = bool(current_user.role and current_user.role.RoleName == "Admin")
    result: dict = {"is_admin": is_admin}

    if is_admin:
        result["platform"] = {
            "users": db.query(func.count(User.UserID)).filter(User.IsActive.is_(True)).scalar(),
            "officers": db.query(func.count(Officer.OfficerID)).filter(~Officer.BadgeNumber.like("UNLISTED-%")).scalar(),
            "districts": db.query(func.count(District.DistrictID)).scalar(),
            "police_stations": db.query(func.count(PoliceStation.UnitID)).scalar(),
            "cases": db.query(func.count(CaseMaster.CaseMasterID)).scalar(),
            "accused_records": db.query(func.count(Accused.AccusedMasterID)).scalar(),
            "ai_runs_last_7_days": db.query(func.count(AIModelRun.AIModelRunID)).filter(
                AIModelRun.CreatedAt >= datetime.now(timezone.utc) - timedelta(days=7)).scalar(),
            "audit_events_last_7_days": db.query(func.count(AuditLog.AuditLogID)).filter(
                AuditLog.Timestamp >= datetime.now(timezone.utc) - timedelta(days=7)).scalar(),
        }

    assigned_ids = [row[0] for row in db.query(CaseAssignment.CaseMasterID).filter(
        CaseAssignment.OfficerID == current_user.OfficerID, CaseAssignment.IsActive.is_(True)).all()] if current_user.OfficerID else []
    tasks = db.query(TaskDelegation).filter(TaskDelegation.AssignedToUserID == current_user.UserID).all()
    done_statuses = ("Completed", "Closed")
    result["mine"] = {
        "assigned_cases": len(assigned_ids),
        "assigned_case_list": [{"case_id": c.CaseMasterID, "case_no": c.CaseNo, "registered": c.CrimeRegisteredDate.isoformat() if c.CrimeRegisteredDate else None,
                                "risk_level": c.AIRiskLevel, "risk_score": c.AIRiskScore, "facts": (c.BriefFacts or "")[:140]}
                               for c in db.query(CaseMaster).filter(CaseMaster.CaseMasterID.in_(assigned_ids)).limit(15).all()] if assigned_ids else [],
        "tasks_open": sum(1 for t in tasks if t.Status not in done_statuses),
        "tasks_completed_last_7_days": sum(1 for t in tasks if t.Status in done_statuses and t.UpdatedAt
                                           and t.UpdatedAt >= datetime.now(timezone.utc) - timedelta(days=7)),
        "tasks_total": len(tasks),
        "tasks_overdue": sum(1 for t in tasks if t.Status not in done_statuses and t.DueDate and t.DueDate < date.today().isoformat()),
    }
    return result
