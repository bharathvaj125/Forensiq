"""Station command-centre analytics, computed from the caller's case records.

Only what the data supports is reported: there is no duty roster, patrol-unit register or warrant register
in the database, so those are not shown."""

from __future__ import annotations

from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.accused import Accused
from app.models.evidence import Evidence
from app.models.officer import Officer
from app.models.user import User
from app.models.witness import Witness
from app.services import analytics, predictive_service, reference_data


def get_station_command_center(db: Session, current_user: User, station_id: Optional[int] = None,
                               district_id: Optional[int] = None) -> dict:
    as_of = analytics.as_of_date(db)
    frame = analytics.load_cases(db, current_user, station_id=station_id, district_id=district_id)
    frame = frame[frame["registered"] <= pd.Timestamp(as_of)]
    groups = reference_data.status_groups(db)
    status_names = reference_data.status_names(db)
    station_names = reference_data.station_names(db)
    case_ids = [int(c) for c in frame["CaseMasterID"]]
    total = len(frame)

    open_mask = analytics.is_open(frame, groups)
    kpis = {
        "total_firs": total,
        "active_firs": int(open_mask.sum()),
        "todays_firs": int((frame["registered"].dt.date == date.today()).sum()),
        "latest_registration_date": as_of.isoformat(),
        "pending_investigations": int(frame["status_id"].isin(groups["investigation"]).sum()),
        "charge_sheeted": int(frame["status_id"].isin(groups["chargesheet"]).sum()),
        "pending_trial": int(frame["status_id"].isin(groups["trial"]).sum()),
        "closed_cases": int(frame["status_id"].isin(groups["closed"]).sum()),
        "critical_cases": int(analytics.high_risk(frame).sum()),
        "repeat_offender_profiles": 0,
        "evidence_items": 0,
        "witness_statements": 0,
        "investigating_officers": int(frame.loc[open_mask, "officer_id"].nunique()),
    }
    if case_ids:
        scoped = set(case_ids)
        profile_rows = db.query(Accused.CriminalProfileID, Accused.CaseMasterID).filter(Accused.CriminalProfileID.isnot(None)).all()
        kpis["repeat_offender_profiles"] = len({profile for profile, case_id in profile_rows if case_id in scoped})
        evidence_rows = db.query(Evidence.CaseMasterID, func.count(Evidence.EvidenceID)).group_by(Evidence.CaseMasterID).all()
        kpis["evidence_items"] = sum(count for case_id, count in evidence_rows if case_id in scoped)
        witness_rows = db.query(Witness.CaseMasterID, func.count(Witness.WitnessMasterID)).group_by(Witness.CaseMasterID).all()
        kpis["witness_statements"] = sum(count for case_id, count in witness_rows if case_id in scoped)

    recent = frame.sort_values("registered", ascending=False).head(8)
    timeline = [{
        "case_id": int(row.CaseMasterID), "case_no": row.CaseNo, "registered_date": row.registered.date().isoformat(),
        "station_name": station_names.get(int(row.station_id), f"Station #{int(row.station_id)}"),
        "ai_risk_score": None if pd.isna(row.risk) else float(row.risk), "ai_risk_level": row.level,
        "status": status_names.get(int(row.status_id)) if pd.notna(row.status_id) else None,
    } for row in recent.itertuples()]

    # Investigating officers ranked by open cases; "high workload" = above the 75th percentile of their peers
    open_cases = frame[open_mask]
    per_officer = open_cases.groupby("officer_id").size().sort_values(ascending=False)
    threshold = float(per_officer.quantile(0.75)) if len(per_officer) else 0.0
    officers = {o.OfficerID: o for o in db.query(Officer).filter(Officer.OfficerID.in_([int(i) for i in per_officer.head(5).index])).all()} if len(per_officer) else {}
    workload = []
    for officer_id, count in per_officer.head(5).items():
        officer = officers.get(int(officer_id))
        under_investigation = int(frame[(frame["officer_id"] == officer_id) & frame["status_id"].isin(groups["investigation"])].shape[0])
        workload.append({
            "officer_id": int(officer_id),
            "officer_name": (f"{officer.Rank + ' ' if officer and officer.Rank else ''}{officer.Name}" if officer else f"Officer #{int(officer_id)}"),
            "rank": officer.Rank if officer else None, "assigned_cases": int(count),
            "pending_investigations": under_investigation,
            "workload_status": "High workload" if count > threshold else "Typical",
        })

    breakdown = [{"status": name, "count": int((frame["status_id"] == status_id).sum())} for status_id, name in sorted(status_names.items())]

    top_crimes = analytics.top_counts(frame["head_id"], reference_data.crime_head_names(db), 1)
    window = analytics.best_window(analytics.hourly_counts(frame))
    overdue = analytics.overdue_investigations(db, frame, as_of)
    brief = (f"{kpis['active_firs']} of {total} FIRs are open and {kpis['critical_cases']} are rated High or Severe by the risk model. "
             + (f"Most frequent crime: {top_crimes[0][0]} ({top_crimes[0][1]} FIRs). " if top_crimes else "")
             + (f"Incidents peak between {analytics.window_label(window)}. " if window else "")
             + f"{overdue['count']} of {overdue['under_investigation']} investigations are past the statutory window.")

    patrol = predictive_service.get_patrol_strategy(db, current_user, district_id=district_id, station_id=station_id)
    alerts = predictive_service.get_early_warnings(db, current_user, district_id=district_id)["alerts"]
    return {
        "kpis": kpis,
        "recent_fir_timeline": timeline,
        "officer_workload": workload,
        "investigation_progress": breakdown,
        "ai_command_brief": brief,
        "ai_patrol_recommendations": [{
            "priority": patrol["priority_level"], "timing": patrol["suggested_timing"],
            "sector": patrol["patrol_route"][0] if patrol["patrol_route"] else None, "action": patrol["reasoning"],
        }] if patrol["patrol_route"] else [],
        "recent_ai_alerts": [{"id": a["alert_id"], "type": a["alert_type"], "severity": a["risk_level"], "message": a["evidence"]} for a in alerts[:3]],
    }
