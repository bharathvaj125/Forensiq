"""Database tools the chat assistant can call.

Every tool is read-only (except create_case_report, which the user must ask for), scoped to the caller's
jurisdiction, resolves human names to ids through the reference tables, and returns compact JSON the model
must quote from. Nothing here returns text the model could mistake for an instruction except case narratives,
which the system prompt tells the model to treat as data."""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Callable

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.models.accused import Accused
from app.models.case_master import CaseMaster
from app.models.evidence import Evidence
from app.models.officer import Officer
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.victim import Victim
from app.services import analytics, network_service, predictive_service, reference_data

MAX_ROWS = 25
FACTS_SNIPPET = 220


@dataclass
class ToolContext:
    db: Session
    user: User
    case_ids: list[int] = field(default_factory=list)
    download_url: str | None = None
    cache: dict = field(default_factory=dict)
    _frame: pd.DataFrame | None = None
    _as_of: date | None = None

    def remember(self, ids) -> None:
        for case_id in ids:
            if int(case_id) not in self.case_ids and len(self.case_ids) < 20:
                self.case_ids.append(int(case_id))

    @property
    def as_of(self) -> date:
        if self._as_of is None:
            self._as_of = analytics.as_of_date(self.db)
        return self._as_of

    @property
    def frame(self) -> pd.DataFrame:
        if self._frame is None:
            frame = analytics.load_cases(self.db, self.user)
            self._frame = frame[frame["registered"] <= pd.Timestamp(self.as_of)].copy()
        return self._frame


def _py(value: Any) -> Any:
    """Make numpy / pandas / date values JSON-safe."""
    if isinstance(value, dict):
        return {str(k): _py(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_py(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if math.isnan(value) or math.isinf(value) else round(float(value), 4)
    if isinstance(value, (pd.Timestamp, datetime, date)):
        return value.date().isoformat() if isinstance(value, (pd.Timestamp, datetime)) else value.isoformat()
    if value is pd.NaT:
        return None
    return value


def _match(options: dict[int, str], text: str, label: str) -> tuple[list[int], str | None]:
    needle = text.strip().lower()
    exact = [key for key, name in options.items() if name.lower() == needle]
    if exact:
        return exact, None
    partial = [key for key, name in options.items() if needle in name.lower()]
    if partial:
        return partial, None
    sample = ", ".join(sorted(options.values())[:12])
    return [], f"No {label} matches '{text}'. Valid examples: {sample}"


def filtered_frame(ctx: ToolContext, args: dict) -> tuple[pd.DataFrame, dict, str | None]:
    """Apply the common filters (district, station, crime_type, status, risk_level, dates) to the scoped cases."""
    frame = ctx.frame
    applied: dict = {}
    db = ctx.db
    if args.get("district"):
        ids, error = _match(reference_data.district_names(db), args["district"], "district")
        if error:
            return frame.iloc[0:0], applied, error
        frame = frame[frame["district_id"].isin(ids)]
        applied["district"] = [reference_data.district_names(db)[i] for i in ids]
    if args.get("station"):
        ids, error = _match(reference_data.station_names(db), args["station"], "police station")
        if error:
            return frame.iloc[0:0], applied, error
        frame = frame[frame["station_id"].isin(ids)]
        applied["station"] = [reference_data.station_names(db)[i] for i in ids[:5]]
    if args.get("crime_type"):
        ids, error = _match(reference_data.crime_head_names(db), args["crime_type"], "crime type")
        if error:
            return frame.iloc[0:0], applied, error
        frame = frame[frame["head_id"].isin(ids)]
        applied["crime_type"] = [reference_data.crime_head_names(db)[i] for i in ids]
    if args.get("status"):
        groups = reference_data.status_groups(db)
        word = args["status"].strip().lower()
        if word in groups:
            ids = groups[word]
        else:
            ids, error = _match(reference_data.status_names(db), args["status"], "case status")
            if error:
                return frame.iloc[0:0], applied, error
        frame = frame[frame["status_id"].isin(ids)]
        applied["status"] = [reference_data.status_names(db)[i] for i in ids]
    if args.get("risk_level"):
        level = args["risk_level"].strip().capitalize()
        if level not in ("Low", "Medium", "High", "Severe"):
            return frame.iloc[0:0], applied, "risk_level must be one of Low, Medium, High, Severe."
        frame = frame[frame["level"] == level]
        applied["risk_level"] = level
    for key, comparison in (("date_from", lambda f, d: f[f["registered"] >= d]), ("date_to", lambda f, d: f[f["registered"] <= d])):
        if args.get(key):
            try:
                frame = comparison(frame, pd.Timestamp(args[key]))
                applied[key] = args[key]
            except (ValueError, TypeError):
                return frame.iloc[0:0], applied, f"{key} must be an ISO date (YYYY-MM-DD)."
    return frame, applied, None


def _case_row(ctx: ToolContext, row) -> dict:
    db = ctx.db
    return {
        "case_id": int(row.CaseMasterID), "case_no": row.CaseNo, "crime_no": int(row.CrimeNo) if pd.notna(row.CrimeNo) else None,
        "registered": row.registered.date().isoformat(),
        "station": reference_data.station_names(db).get(int(row.station_id)),
        "district": reference_data.district_names(db).get(int(row.district_id)) if pd.notna(row.district_id) else None,
        "crime_type": reference_data.crime_head_names(db).get(int(row.head_id)) if pd.notna(row.head_id) else None,
        "status": reference_data.status_names(db).get(int(row.status_id)) if pd.notna(row.status_id) else None,
        "risk_score": None if pd.isna(row.risk) else round(float(row.risk), 3), "risk_level": row.level,
    }


# ------------------------------------------------------------------------------------------------ tools

def _scope_text(applied: dict) -> str:
    if not applied:
        return "ALL districts and ALL crime types in the caller's jurisdiction (no filter applied)"
    return "only cases matching " + "; ".join(f"{key}={value}" for key, value in applied.items())


def overview(ctx: ToolContext, **filters) -> dict:
    """Summary of the cases matching the filters (all cases when none are given)."""
    frame, applied, error = filtered_frame(ctx, filters)
    if error:
        return {"error": error}
    db = ctx.db
    if frame.empty:
        return {"scope": _scope_text(applied), "cases": 0, "note": "No cases match."}
    groups = reference_data.status_groups(db)
    status_names = reference_data.status_names(db)
    return _py({
        "scope": _scope_text(applied),
        "cases": len(frame), "data_up_to": ctx.as_of, "first_registration": frame["registered"].min(),
        "open_cases": int(analytics.is_open(frame, groups).sum()), "closed_cases": int(frame["status_id"].isin(groups["closed"]).sum()),
        "rated_high_or_severe": int(analytics.high_risk(frame).sum()),
        "by_status": {status_names.get(int(k), str(k)): int(v) for k, v in frame["status_id"].value_counts().items()},
        "top_districts": analytics.top_counts(frame["district_id"], reference_data.district_names(db), 5),
        "top_crime_types": analytics.top_counts(frame["head_id"], reference_data.crime_head_names(db), 5),
        "repeat_offender_profiles": len({p for s in analytics.repeat_profiles_by_case(db, set(int(i) for i in frame["CaseMasterID"])).values() for p in s}),
    })


def count_cases(ctx: ToolContext, group_by: str = "none", top_n: int = 10, **filters) -> dict:
    frame, applied, error = filtered_frame(ctx, filters)
    if error:
        return {"error": error}
    db = ctx.db
    top_n = max(1, min(int(top_n or 10), MAX_ROWS))
    total = len(frame)
    labels: pd.Series | None
    if group_by in (None, "", "none"):
        return _py({"scope": _scope_text(applied), "total": total})
    if group_by == "district":
        labels = frame["district_id"].map(reference_data.district_names(db))
    elif group_by == "station":
        labels = frame["station_id"].map(reference_data.station_names(db))
    elif group_by == "crime_type":
        labels = frame["head_id"].map(reference_data.crime_head_names(db))
    elif group_by == "status":
        labels = frame["status_id"].map(reference_data.status_names(db))
    elif group_by == "risk_level":
        labels = frame["level"]
    elif group_by == "month":
        labels = frame["registered"].dt.strftime("%Y-%m")
    elif group_by == "year":
        labels = frame["registered"].dt.year.astype(str)
    elif group_by == "weekday":
        labels = frame["incident"].dt.day_name()
    elif group_by == "hour":
        labels = frame["incident"].dt.hour.map(lambda h: f"{int(h):02d}:00" if pd.notna(h) else None)
    else:
        return {"error": "group_by must be one of none, district, station, crime_type, status, risk_level, month, year, weekday, hour."}
    counts = labels.dropna().value_counts()
    chronological = group_by in ("month", "year", "hour")
    ordered = counts.sort_index().tail(top_n) if chronological else counts.head(top_n)
    return _py({"scope": _scope_text(applied), "total": total, "group_by": group_by,
                "rows": [{"label": str(k), "count": int(v), "share": round(int(v) / total, 4) if total else 0} for k, v in ordered.items()],
                "groups_not_shown": max(len(counts) - len(ordered), 0)})


def search_cases(ctx: ToolContext, text: str | None = None, sort_by: str = "risk", limit: int = 10, **filters) -> dict:
    frame, applied, error = filtered_frame(ctx, filters)
    if error:
        return {"error": error}
    if text:
        matches = {row[0] for row in apply_jurisdiction_filter(
            ctx.db.query(CaseMaster.CaseMasterID).filter(CaseMaster.BriefFacts.ilike(f"%{text}%") | CaseMaster.CaseNo.ilike(f"%{text}%")),
            ctx.db, ctx.user).all()}
        frame = frame[frame["CaseMasterID"].isin(matches)]
        applied["text"] = text
    total = len(frame)
    if sort_by == "date":
        frame = frame.sort_values("registered", ascending=False)
    elif sort_by == "oldest":
        frame = frame.sort_values("registered", ascending=True)
    else:
        frame = frame.sort_values("risk", ascending=False, na_position="last")
    shown = frame.head(max(1, min(int(limit or 10), MAX_ROWS)))
    facts = dict(ctx.db.query(CaseMaster.CaseMasterID, CaseMaster.BriefFacts).filter(CaseMaster.CaseMasterID.in_([int(i) for i in shown["CaseMasterID"]])).all())
    rows = []
    for row in shown.itertuples():
        item = _case_row(ctx, row)
        item["facts"] = (facts.get(int(row.CaseMasterID)) or "")[:FACTS_SNIPPET]
        rows.append(item)
    ctx.remember(shown["CaseMasterID"])
    return _py({"filters": applied, "matching_cases": total, "shown": len(rows), "sorted_by": sort_by, "cases": rows})


def _resolve_case(ctx: ToolContext, case_ref: str) -> tuple[list[CaseMaster], str | None]:
    reference = str(case_ref).strip().replace("FIR", "").replace("#", "").strip()
    if not reference.isdigit():
        return [], "case_ref must be a number: a CaseMasterID, a 9-digit CaseNo, or an 18-digit CrimeNo."
    number = int(reference)
    query = apply_jurisdiction_filter(ctx.db.query(CaseMaster), ctx.db, ctx.user)
    if len(reference) >= 15:
        found = query.filter(CaseMaster.CrimeNo == number).all()
    elif len(reference) == 9:
        found = query.filter(CaseMaster.CaseNo == reference).limit(6).all()
    else:
        found = query.filter(CaseMaster.CaseMasterID == number).all()
    if not found:
        return [], f"No case visible to you matches {case_ref}."
    return found, None


def get_case(ctx: ToolContext, case_ref: str, **_) -> dict:
    cases, error = _resolve_case(ctx, case_ref)
    if error:
        return {"error": error}
    db = ctx.db
    if len(cases) > 1:
        ctx.remember(c.CaseMasterID for c in cases)
        stations = reference_data.station_names(db)
        return {"note": "This case number is shared by several FIRs (CaseNo repeats across stations). Use the case_id of one of these.",
                "matches": [{"case_id": c.CaseMasterID, "case_no": c.CaseNo, "crime_no": c.CrimeNo, "station": stations.get(c.PoliceStationID),
                             "registered": c.CrimeRegisteredDate.isoformat() if c.CrimeRegisteredDate else None} for c in cases]}
    case = cases[0]
    ctx.remember([case.CaseMasterID])
    accused = db.query(Accused).filter(Accused.CaseMasterID == case.CaseMasterID).all()
    victims = db.query(Victim).filter(Victim.CaseMasterID == case.CaseMasterID).all()
    evidence = db.query(Evidence.EvidenceType).filter(Evidence.CaseMasterID == case.CaseMasterID).all()
    vehicles = db.query(Vehicle).filter(Vehicle.CaseMasterID == case.CaseMasterID).all()
    officer = db.get(Officer, case.PolicePersonID) if case.PolicePersonID else None
    station = reference_data.station_names(db).get(case.PoliceStationID)
    district = reference_data.district_names(db).get(reference_data.station_districts(db).get(case.PoliceStationID))

    factors = None
    try:
        from app.ml.features import case_feature_frame
        from app.ml.models.risk_scoring import scorer
        result = scorer.predict_risk(case_feature_frame(db, [case]).iloc[0].to_dict(), reference_data.risk_value_labels(db))
        factors = [f["description"] for f in result["top_factors"][:3]]
    except Exception:
        factors = None

    return _py({
        "case_id": case.CaseMasterID, "case_no": case.CaseNo, "crime_no": case.CrimeNo, "station": station, "district": district,
        "registered": case.CrimeRegisteredDate, "incident_from": case.IncidentFromDate,
        "reporting_delay_hours": round((case.InfoReceivedPSDate - case.IncidentFromDate).total_seconds() / 3600, 1) if case.InfoReceivedPSDate and case.IncidentFromDate else None,
        "crime_type": reference_data.crime_head_names(db).get(case.CrimeMajorHeadID),
        "crime_subtype": reference_data.crime_subhead_names(db).get(case.CrimeMinorHeadID),
        "status": reference_data.status_names(db).get(case.CaseStatusID), "heinous": case.GravityOffenceID == 1,
        "investigating_officer": officer.Name if officer else None,
        "risk": {"score": case.AIRiskScore, "level": case.AIRiskLevel, "meaning": "estimated probability of a High/Severe rating", "top_factors": factors},
        "facts": case.BriefFacts,
        "accused": [{"name": a.AccusedName, "age": a.AgeYear, "criminal_profile": a.CriminalProfileID, "repeat_offender": bool(a.IsRepeatOffender), "gang_id": a.GangID} for a in accused],
        "victims": [{"name": v.VictimName, "age": v.AgeYear, "injury": v.InjurySeverity} for v in victims][:5],
        "evidence_items": dict(Counter(e[0] for e in evidence)),
        "vehicles": [{"registration": v.RegistrationNumber, "type": v.VehicleType, "role": v.InvolvementRole} for v in vehicles],
    })


def find_accused(ctx: ToolContext, name: str | None = None, profile_id: int | None = None, limit: int = 10, **_) -> dict:
    if not name and not profile_id:
        return {"error": "Provide a name or a criminal profile id."}
    query = ctx.db.query(Accused, CaseMaster).join(CaseMaster, Accused.CaseMasterID == CaseMaster.CaseMasterID)
    query = apply_jurisdiction_filter(query, ctx.db, ctx.user)
    if profile_id:
        query = query.filter(Accused.CriminalProfileID == int(profile_id))
    if name:
        query = query.filter(Accused.AccusedName.ilike(f"%{name.strip()}%"))
    rows = query.all()
    people: dict[Any, dict] = {}
    for accused, case in rows:
        key = ("profile", accused.CriminalProfileID) if accused.CriminalProfileID else ("record", accused.AccusedMasterID)
        person = people.setdefault(key, {"name": accused.AccusedName, "ages": set(), "criminal_profile": accused.CriminalProfileID, "gang_id": accused.GangID,
                                         "repeat_offender": bool(accused.IsRepeatOffender), "cases": []})
        person["ages"].add(accused.AgeYear)
        person["cases"].append({"case_id": case.CaseMasterID, "case_no": case.CaseNo, "registered": case.CrimeRegisteredDate,
                                "crime_type": reference_data.crime_head_names(ctx.db).get(case.CrimeMajorHeadID),
                                "status": reference_data.status_names(ctx.db).get(case.CaseStatusID)})
    ordered = sorted(people.values(), key=lambda p: -len(p["cases"]))[:max(1, min(int(limit or 10), 15))]
    for person in ordered:
        person["ages"] = sorted(a for a in person["ages"] if a is not None)
        person["total_cases"] = len(person["cases"])
        person["cases"] = sorted(person["cases"], key=lambda c: str(c["registered"]), reverse=True)[:6]
        ctx.remember(c["case_id"] for c in person["cases"][:3])
    return _py({"people_found": len(people), "people": ordered})


def repeat_offenders(ctx: ToolContext, top_n: int = 10, district: str | None = None, **_) -> dict:
    frame, applied, error = filtered_frame(ctx, {"district": district} if district else {})
    if error:
        return {"error": error}
    scoped = set(int(i) for i in frame["CaseMasterID"])
    rows = ctx.db.query(Accused.CriminalProfileID, Accused.AccusedName, Accused.CaseMasterID, Accused.GangID).filter(Accused.CriminalProfileID.isnot(None)).all()
    profiles: dict[int, dict] = {}
    for profile, name, case_id, gang in rows:
        if case_id in scoped:
            entry = profiles.setdefault(profile, {"profile": profile, "name": name, "cases": set(), "gang_id": gang})
            entry["cases"].add(case_id)
    ranked = sorted(profiles.values(), key=lambda p: -len(p["cases"]))
    by_case = frame.set_index("CaseMasterID")
    heads = reference_data.crime_head_names(ctx.db)
    result = []
    for entry in ranked[:max(1, min(int(top_n or 10), MAX_ROWS))]:
        crimes = Counter(heads.get(int(by_case.loc[c, "head_id"])) for c in entry["cases"])
        result.append({"profile": entry["profile"], "name": entry["name"], "case_count": len(entry["cases"]), "gang_id": entry["gang_id"],
                       "main_crime_types": [name for name, _ in crimes.most_common(2)]})
    return _py({"filters": applied, "repeat_offender_profiles": len(profiles), "top": result})


def get_hotspots(ctx: ToolContext, top_n: int = 5, **filters) -> dict:
    frame, applied, error = filtered_frame(ctx, filters)
    if error:
        return {"error": error}
    hotspots = analytics.compute_hotspots(ctx.db, frame, limit=max(1, min(int(top_n or 5), 10)))
    return _py({"filters": applied, "method": "kernel density estimation over incident coordinates", "hotspots": [{
        "rank": h["rank"], "area": h["location_name"], "district": h["district_name"], "cases": h["case_count"], "open": h["open_cases"],
        "high_or_severe": h["high_risk_cases"], "risk_level": h["risk_level"], "repeat_offender_profiles": h["repeat_offender_profiles"],
        "main_crimes": h["top_crimes"], "peak_window": analytics.window_label(h["peak_window"]),
    } for h in hotspots]})


def get_anomalies(ctx: ToolContext, top_n: int = 10, **_) -> dict:
    from app.services import intelligence_service
    result = intelligence_service.detect_case_anomalies(ctx.db, ctx.user)
    findings = result["Findings"][:max(1, min(int(top_n or 10), MAX_ROWS))]
    ctx.remember(f["CaseMasterID"] for f in findings[:5])
    return _py({"method": "robust z-score of reporting delay (cutoff 3.5)", "cases_analysed": result["CasesAnalysed"],
                "flagged": len(result["Findings"]), "top": [{"case_id": f["CaseMasterID"], "case_no": f["CaseNo"], "z_score": f["ZScore"], "why": f["Factors"][0]} for f in findings]})


def get_forecast(ctx: ToolContext, **filters) -> dict:
    frame, applied, error = filtered_frame(ctx, filters)
    if error:
        return {"error": error}
    forecast = analytics.forecast_next_period(frame, ctx.as_of)
    return _py({"filters": applied, "data_up_to": ctx.as_of, "next_30_days_expected_firs": forecast["predicted"], "last_30_days_actual_firs": forecast["recent_actual"],
                "trend": forecast["trend"], "backtest_accuracy": forecast["backtest_accuracy"], "method": "Ridge regression on daily registrations"})


def get_early_warnings(ctx: ToolContext, **_) -> dict:
    alerts = predictive_service.get_early_warnings(ctx.db, ctx.user)["alerts"]
    return _py({"active": len(alerts), "alerts": [{"type": a["alert_type"], "title": a["title"], "level": a["risk_level"], "evidence": a["evidence"],
                                                   "stations": a["affected_stations"]} for a in alerts]})


def get_gang_networks(ctx: ToolContext, top_n: int = 5, **_) -> dict:
    result = network_service.get_gang_communities(ctx.db, ctx.user)
    return _py({"method": "greedy-modularity communities over co-accused, shared-vehicle, same-district and recorded links between repeat offenders",
                "networks_found": len(result["Communities"]), "top": [{
                    "size": c["Size"], "leader": c["LeaderName"], "cases": c["CaseCount"], "registry_gangs": c["RecordedGangs"], "members": c["MemberNames"][:8]}
                    for c in result["Communities"][:max(1, min(int(top_n or 5), 10))]]})


def patrol_plan(ctx: ToolContext, district: str | None = None, station: str | None = None, **_) -> dict:
    district_id = station_id = None
    if district:
        ids, error = _match(reference_data.district_names(ctx.db), district, "district")
        if error:
            return {"error": error}
        district_id = ids[0]
    if station:
        ids, error = _match(reference_data.station_names(ctx.db), station, "police station")
        if error:
            return {"error": error}
        station_id = ids[0]
    plan = predictive_service.get_patrol_strategy(ctx.db, ctx.user, district_id=district_id, station_id=station_id)
    return _py({k: plan[k] for k in ("district_name", "recommended_officers", "recommended_cars", "recommended_bikes", "suggested_shift",
                                     "suggested_timing", "priority_level", "patrol_route", "reasoning")})


def find_similar_cases(ctx: ToolContext, case_ref: str, top_n: int = 5, **_) -> dict:
    from app.services import intelligence_service
    cases, error = _resolve_case(ctx, case_ref)
    if error or len(cases) != 1:
        return {"error": error or "That case number is shared by several FIRs; use a case_id."}
    result = intelligence_service.find_similar_cases(ctx.db, cases[0].CaseMasterID, ctx.user, limit=max(1, min(int(top_n or 5), 10)))
    ctx.remember([cases[0].CaseMasterID, *[m["CaseMasterID"] for m in result["Matches"][:3]]])
    return _py({"source_case": cases[0].CaseNo, "method": "semantic similarity of case narratives (Gemini embeddings, cosine distance)",
                "matches": [{"case_id": m["CaseMasterID"], "case_no": m["CaseNo"], "similarity": m["SimilarityScore"], "facts": (m["BriefFacts"] or "")[:FACTS_SNIPPET]} for m in result["Matches"]]})


def list_reference(ctx: ToolContext, kind: str, district: str | None = None, **_) -> dict:
    db = ctx.db
    if kind == "districts":
        return {"districts": sorted(reference_data.district_names(db).values())}
    if kind == "crime_types":
        return {"crime_types": sorted(reference_data.crime_head_names(db).values())}
    if kind == "statuses":
        return {"statuses": sorted(reference_data.status_names(db).values()), "groups": ["open", "closed", "investigation", "chargesheet", "trial", "convicted"]}
    if kind == "stations":
        stations = reference_data.station_names(db)
        if district:
            ids, error = _match(reference_data.district_names(db), district, "district")
            if error:
                return {"error": error}
            mapping = reference_data.station_districts(db)
            stations = {i: n for i, n in stations.items() if mapping.get(i) in ids}
        return {"stations": sorted(stations.values())[:60], "total": len(stations)}
    return {"error": "kind must be districts, stations, crime_types or statuses."}


def create_case_report(ctx: ToolContext, case_ref: str, **_) -> dict:
    from app.services import report_service
    cases, error = _resolve_case(ctx, case_ref)
    if error or len(cases) != 1:
        return {"error": error or "That case number is shared by several FIRs; use a case_id."}
    job = report_service.create_report_job(ctx.db, cases[0].CaseMasterID, ctx.user)
    ctx.download_url = f"/api/v1/reports/jobs/{job.ReportJobID}/download"
    ctx.remember([cases[0].CaseMasterID])
    return {"status": "report generation started", "case_no": cases[0].CaseNo, "download_url": ctx.download_url}


# ----------------------------------------------------------------------------------------- declarations

_FILTERS = {
    "district": {"type": "STRING", "description": "District name or fragment, e.g. 'Belagavi'."},
    "station": {"type": "STRING", "description": "Police station name or fragment."},
    "crime_type": {"type": "STRING", "description": "Crime category name or fragment, e.g. 'cyber', 'women'. Use list_reference(kind=crime_types) for names."},
    "status": {"type": "STRING", "description": "Case status name fragment (e.g. 'Pending Trial') or a group: open, closed, investigation, chargesheet, trial, convicted."},
    "risk_level": {"type": "STRING", "enum": ["Low", "Medium", "High", "Severe"], "description": "Model risk level."},
    "date_from": {"type": "STRING", "description": "Registered on/after this ISO date."},
    "date_to": {"type": "STRING", "description": "Registered on/before this ISO date."},
}


def _declaration(name: str, description: str, properties: dict | None = None, required: list[str] | None = None) -> dict:
    declaration: dict = {"name": name, "description": description}
    if properties is not None:
        declaration["parameters"] = {"type": "OBJECT", "properties": properties, **({"required": required} if required else {})}
    return declaration


TOOLS: dict[str, tuple[dict, Callable]] = {
    "overview": (_declaration("overview", "Summary of FIRs: total, open/closed, rated High/Severe, status breakdown, top districts and crime types, repeat-offender profiles, date range. Covers EVERY district unless you pass a filter, so pass district / crime_type / etc. whenever the question names one.", _FILTERS), overview),
    "count_cases": (_declaration("count_cases", "Count FIRs, optionally filtered and grouped. Use for any 'how many' or 'which district/crime/month has the most' question.", {
        **_FILTERS, "group_by": {"type": "STRING", "enum": ["none", "district", "station", "crime_type", "status", "risk_level", "month", "year", "weekday", "hour"]},
        "top_n": {"type": "INTEGER", "description": "Max groups to return (default 10)."}}), count_cases),
    "search_cases": (_declaration("search_cases", "List FIRs matching filters and/or text in the case facts or case number, with risk score and a facts snippet.", {
        **_FILTERS, "text": {"type": "STRING", "description": "Words to look for in the case facts or case number."},
        "sort_by": {"type": "STRING", "enum": ["risk", "date", "oldest"]}, "limit": {"type": "INTEGER"}}), search_cases),
    "get_case": (_declaration("get_case", "Full detail of one FIR: facts, station, status, risk score with its top drivers, accused (with repeat-offender/gang info), victims, evidence, vehicles.", {
        "case_ref": {"type": "STRING", "description": "CaseMasterID, 9-digit CaseNo, or 18-digit CrimeNo."}}, ["case_ref"]), get_case),
    "find_accused": (_declaration("find_accused", "Look up accused persons by name fragment or criminal profile id; shows their cases, repeat-offender status and gang.", {
        "name": {"type": "STRING"}, "profile_id": {"type": "INTEGER"}, "limit": {"type": "INTEGER"}}), find_accused),
    "repeat_offenders": (_declaration("repeat_offenders", "Repeat offenders (recorded criminal profiles) ranked by number of cases, optionally within a district.", {
        "district": _FILTERS["district"], "top_n": {"type": "INTEGER"}}), repeat_offenders),
    "get_hotspots": (_declaration("get_hotspots", "Crime hotspots found by kernel density estimation, with case counts, risk, main crimes and peak hours.", {**_FILTERS, "top_n": {"type": "INTEGER"}}), get_hotspots),
    "get_anomalies": (_declaration("get_anomalies", "FIRs flagged as anomalous because they were reported unusually late.", {"top_n": {"type": "INTEGER"}}), get_anomalies),
    "get_forecast": (_declaration("get_forecast", "Expected number of FIRs over the next 30 days and recent trend, optionally filtered.", _FILTERS), get_forecast),
    "get_early_warnings": (_declaration("get_early_warnings", "Active early-warning alerts: statistically significant crime spikes, repeat-offender activity, overdue investigations."), get_early_warnings),
    "get_gang_networks": (_declaration("get_gang_networks", "Networks of linked repeat offenders (possible gangs) with leaders, sizes and registry gang labels.", {"top_n": {"type": "INTEGER"}}), get_gang_networks),
    "patrol_plan": (_declaration("patrol_plan", "Recommended patrol deployment (units, timing, route) for a district or station, derived from hotspots and incident timing.", {
        "district": _FILTERS["district"], "station": _FILTERS["station"]}), patrol_plan),
    "find_similar_cases": (_declaration("find_similar_cases", "Cases whose narrative is semantically similar to a given case (modus operandi match).", {
        "case_ref": {"type": "STRING"}, "top_n": {"type": "INTEGER"}}, ["case_ref"]), find_similar_cases),
    "list_reference": (_declaration("list_reference", "List valid district, station, crime type or status names.", {
        "kind": {"type": "STRING", "enum": ["districts", "stations", "crime_types", "statuses"]}, "district": _FILTERS["district"]}, ["kind"]), list_reference),
    "create_case_report": (_declaration("create_case_report", "Start generation of the PDF report for one case. Only when the user explicitly asks for a report or PDF.", {
        "case_ref": {"type": "STRING"}}, ["case_ref"]), create_case_report),
}


def declarations() -> list[dict]:
    return [declaration for declaration, _ in TOOLS.values()]


def execute(ctx: ToolContext, name: str, args: dict) -> dict:
    """Run a tool; failures come back as {'error': ...} so the model can recover instead of the request failing."""
    if name not in TOOLS:
        return {"error": f"Unknown tool {name}."}
    key = (name, repr(sorted((args or {}).items())))
    if name != "create_case_report" and key in ctx.cache:  # reads are idempotent; a re-run on another model reuses them
        return ctx.cache[key]
    try:
        result = TOOLS[name][1](ctx, **(args or {}))
    except Exception as exc:  # noqa: BLE001 - surfaced to the model as data
        ctx.db.rollback()
        return {"error": f"{name} failed: {type(exc).__name__}: {exc}"}
    if name != "create_case_report":
        ctx.cache[key] = result
    return result
