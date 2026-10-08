"""Predictive intelligence: dashboard, hotspot rankings, patrol strategy and early warnings.

Every figure is computed from case records through app.services.analytics. When there is nothing to
report the response says so (empty lists, zeros) - nothing is filled in with illustrative values."""

from __future__ import annotations

import math
from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import analytics, cache, reference_data

READ_TTL = 90  # seconds; any case write clears the cache

OFFICERS_PER_PATROL_UNIT = 2  # staffing assumption for the patrol plan (stated in the plan's reasoning)
DASHBOARD_ROWS = 8
PRESET_DAYS = {"24h": 1, "7d": 7, "1m": 30, "3m": 90, "1y": 365}

# Specialist units suggested for a crime category, matched on words in the crime-type name.
SPECIALIST_UNITS = [
    ("cyber", "Cyber Crime Cell"), ("women", "Women Safety Patrol"), ("narcotic", "Anti-Narcotics Squad"),
    ("children", "Child Protection Unit"), ("trafficking", "Anti-Human-Trafficking Unit"), ("economic", "Economic Offences liaison"),
    ("traffic", "Traffic Enforcement Unit"), ("property", "Night Beat Patrol"), ("body", "Rapid Response Unit"),
    ("public order", "Crowd & Public Order Unit"), ("state", "Intelligence Wing liaison"),
]


def _unit_for(head_name: str) -> str:
    lowered = head_name.lower()
    return next((unit for keyword, unit in SPECIALIST_UNITS if keyword in lowered), "Investigation support team")


def _scoped_frame(db: Session, user: User, **filters) -> tuple[pd.DataFrame, date, int]:
    as_of = analytics.as_of_date(db)
    frame = analytics.load_cases(db, user, **filters)
    future = int((frame["registered"] > pd.Timestamp(as_of)).sum())
    return frame[frame["registered"] <= pd.Timestamp(as_of)].copy(), as_of, future


def _percent_change(recent: int, previous: int) -> float:
    return round((recent - previous) / max(previous, 1) * 100.0, 1)


def _trend_text(recent: int, previous: int) -> str:
    """Up/down only when the difference exceeds two standard deviations of a Poisson difference."""
    change = _percent_change(recent, previous)
    if abs(recent - previous) <= 2.0 * math.sqrt(recent + previous):
        return f"➡️ Stable ({change:+.0f}%)"
    return f"⬆️ Increasing ({change:+.0f}%)" if recent > previous else f"⬇️ Decreasing ({change:+.0f}%)"


# --------------------------------------------------------------------------------------- dashboard

@cache.per_user(READ_TTL)
def get_predictive_dashboard(
    db: Session,
    current_user: User,
    district_id: Optional[int] = None,
    station_id: Optional[int] = None,
    crime_category: Optional[str] = None,
    date_preset: Optional[str] = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    frame, as_of, future = _scoped_frame(db, current_user, district_id=district_id, station_id=station_id,
                                         crime_category=crime_category, start_date=start_date, end_date=end_date)
    if date_preset in PRESET_DAYS:
        frame = analytics.in_window(frame, as_of, PRESET_DAYS[date_preset])

    crime_names = reference_data.crime_head_names(db)
    station_names = reference_data.station_names(db)
    district_names = reference_data.district_names(db)
    groups = reference_data.status_groups(db)
    total = len(frame)

    hourly = analytics.hourly_counts(frame)
    top_hours = sorted(range(24), key=lambda h: -hourly[h])[:3] if sum(hourly) else []
    hourly_distribution = [{"hour": h, "count": hourly[h], "peak_label": "Peak hour" if h in top_hours else None} for h in range(24)]

    weekday = analytics.weekday_counts(frame)
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dow_total = sum(weekday) or 1
    dow_distribution = [{"dow_index": i, "day_name": day_names[i], "count": weekday[i], "pct": round(weekday[i] / dow_total * 100, 1)} for i in range(7)]

    forecast = analytics.forecast_next_period(frame, as_of)
    monthly = frame.groupby(frame["registered"].dt.strftime("%Y-%m")).size().sort_index()
    monthly_trend = [{"year_month": month, "historical_count": int(count), "forecast_count": None, "data_type": "Historical"} for month, count in monthly.items()]
    if monthly_trend and monthly_trend[-1]["year_month"] == as_of.strftime("%Y-%m") and as_of != (pd.Timestamp(as_of) + pd.offsets.MonthEnd(0)).date():
        monthly_trend[-1]["year_month"] += f" (to {as_of.day})"  # a partial month would otherwise look like a collapse in registrations
    if forecast["predicted"] is not None:
        next_month = (pd.Timestamp(as_of) + pd.Timedelta(days=30)).strftime("%Y-%m")
        monthly_trend.append({"year_month": f"{next_month} (Forecast)", "historical_count": 0, "forecast_count": forecast["predicted"], "data_type": "Predicted Forecast"})
    recent_actual = forecast["recent_actual"]
    growth = _percent_change(forecast["predicted"], recent_actual) if forecast["predicted"] is not None else 0.0

    # Districts: recent 30 days vs the 30 days before, ranked by volume; risk level is relative to the other districts shown.
    district_rows = []
    if not frame.empty:
        recent = analytics.in_window(frame, as_of, 30)
        previous = analytics.in_window(frame, as_of, 60, 30)
        for district, group in frame.groupby("district_id"):
            share = float(analytics.high_risk(group).mean())
            district_rows.append({"district_name": district_names.get(int(district), f"District #{int(district)}"), "case_count": int(len(group)),
                                  "growth_pct": _percent_change(int((recent["district_id"] == district).sum()), int((previous["district_id"] == district).sum())),
                                  "share": share})
        district_rows.sort(key=lambda row: -row["case_count"])
        district_rows = district_rows[:DASHBOARD_ROWS]
        shares = sorted(row["share"] for row in district_rows)
        for row in district_rows:
            rank = (shares.index(row["share"]) + 1) / len(shares)
            row["risk_level"] = "CRITICAL" if rank > 0.67 else "HIGH" if rank > 0.34 else "MODERATE"
            del row["share"]

    station_rows = []
    if not frame.empty:
        open_cases = frame[analytics.is_open(frame, groups)]
        for station, group in open_cases.groupby("station_id"):
            investigators = max(int(group["officer_id"].nunique()), 1)
            station_rows.append({"station_name": station_names.get(int(station), f"Station #{int(station)}"),
                                 "case_count": int((frame["station_id"] == station).sum()), "pending_cases": int(len(group)),
                                 "workload_score": round(len(group) / investigators, 2)})
        station_rows.sort(key=lambda row: -row["pending_cases"])
        station_rows = station_rows[:DASHBOARD_ROWS]

    category_rows = []
    if not frame.empty:
        recent90 = analytics.in_window(frame, as_of, 90)
        previous90 = analytics.in_window(frame, as_of, 180, 90)
        for head, group in frame.groupby("head_id"):
            category_rows.append({"category_name": crime_names.get(int(head), f"#{int(head)}"), "case_count": int(len(group)),
                                  "trend_direction": _trend_text(int((recent90["head_id"] == head).sum()), int((previous90["head_id"] == head).sum()))})
        category_rows.sort(key=lambda row: -row["case_count"])

    hotspots = analytics.compute_hotspots(db, frame, limit=10)
    alerts = _collect_alerts(db, frame, as_of)
    plan = _patrol_numbers(hotspots)
    open_total = int(analytics.is_open(frame, groups).sum()) if not frame.empty else 0
    window = analytics.best_window(hourly)

    explanations = []
    if forecast["predicted"] is not None:
        top_district = district_rows[0] if district_rows else None
        explanations.append({
            "title": "30-Day Registration Forecast",
            "prediction": f"About {forecast['predicted']} FIRs are expected over the next 30 days ({growth:+.1f}% against the {recent_actual} registered in the last 30 days).",
            "why_explanation": (f"Ridge-regression trend over daily registrations (trend: {forecast['trend']})"
                                + (f"; busiest district {top_district['district_name']} with {top_district['case_count']} FIRs" if top_district else "")
                                + (f"; busiest hour of day {top_hours[0]:02d}:00" if top_hours else "") + "."),
            "confidence": forecast["backtest_accuracy"],
            "supporting_stats": [f"{total} FIRs analysed (registered up to {as_of.isoformat()})",
                                 (f"Backtest: the same method forecasting the last 30 days from earlier data was within {(1 - forecast['backtest_accuracy']) * 100:.0f}% of the {recent_actual} actually registered"
                                  if forecast["backtest_accuracy"] is not None else "Backtest unavailable (not enough history)"),
                                 (f"Most frequent crime category: {category_rows[0]['category_name']} ({category_rows[0]['case_count']} FIRs)" if category_rows else "No category data")],
            "data_sources": "case_master (CrimeRegisteredDate), crime_type, police_station",
        })
    if window:
        explanations.append({
            "title": "Peak Incident Hours",
            "prediction": f"{window['share']:.0%} of incidents happen between {analytics.window_label(window)}.",
            "why_explanation": f"Hour-of-day distribution of {sum(hourly)} incidents; the three busiest hours are {', '.join(f'{h:02d}:00' for h in top_hours)}.",
            "confidence": None,
            "supporting_stats": [f"{window['incidents']} of {sum(hourly)} incidents fall inside the window",
                                 f"{open_total} FIRs are still open ({open_total / total:.0%} of those analysed)"],
            "data_sources": "case_master (IncidentFromDate)",
        })
    repeaters = analytics.repeat_offender_activity(db, frame, as_of)
    if repeaters:
        explanations.append({
            "title": "Repeat-Offender Activity",
            "prediction": f"{len(repeaters)} repeat offender(s) have two or more FIRs registered in the last 90 days.",
            "why_explanation": "Criminal-profile identities recorded on accused persons, counted over the last 90 days.",
            "confidence": None,
            "supporting_stats": [f"{r['name']}: {r['recent_cases']} FIRs ({', '.join(r['stations'][:2])})" for r in repeaters[:3]],
            "data_sources": "accused (CriminalProfileID), case_master",
        })

    return {
        "total_cases_analyzed": total,
        "predicted_30day_cases": forecast["predicted"] or 0,
        "growth_rate_pct": growth,
        "high_risk_hotspot_count": sum(1 for h in hotspots if h["risk_level"] in ("Critical", "High")),
        "patrol_squads_recommended": plan["units"],
        "early_warnings_active": len(alerts),
        "backlog_workload_index": round(open_total / total * 100, 1) if total else 0.0,
        "open_cases": open_total,
        "peak_window": analytics.window_label(window), "peak_window_share": window["share"] if window else None,
        "peak_shift": analytics.shift_name(window),
        "hourly_distribution": hourly_distribution,
        "dow_distribution": dow_distribution,
        "monthly_trend": monthly_trend,
        "district_rankings": district_rows,
        "station_rankings": station_rows,
        "category_rankings": category_rows,
        "xai_explanations": explanations,
        "as_of_date": as_of.isoformat(),
        "future_dated_cases_excluded": future,
        "forecast_trend": forecast["trend"],
        "forecast_backtest_accuracy": forecast["backtest_accuracy"],
    }


# --------------------------------------------------------------------------------------- hotspots

def _peak_text(window: dict | None) -> str:
    return analytics.window_label(window) or "no incident times recorded"


@cache.per_user(READ_TTL)
def get_hotspot_rankings(db: Session, current_user: User, district_id: Optional[int] = None,
                         station_id: Optional[int] = None, crime_category: Optional[str] = None) -> dict:
    frame, _, _ = _scoped_frame(db, current_user, district_id=district_id, station_id=station_id, crime_category=crime_category)
    hotspots = analytics.compute_hotspots(db, frame, limit=10)
    return {
        "total_hotspots": len(hotspots),
        "hotspots": [{
            "rank": h["rank"], "location_name": h["location_name"], "latitude": h["latitude"], "longitude": h["longitude"],
            "hotspot_score": h["hotspot_score"], "risk_level": h["risk_level"], "case_count": h["case_count"],
            "repeat_offenders_count": h["repeat_offender_profiles"], "pending_cases": h["open_cases"],
            "peak_window": _peak_text(h["peak_window"]), "reason": h["reason"],
        } for h in hotspots],
        "model_version": analytics.HOTSPOT_MODEL_VERSION,
    }


# ------------------------------------------------------------------------------------------ patrol

def _patrol_numbers(hotspots: list[dict]) -> dict:
    """One mobile car per Critical hotspot, one bike unit per High hotspot, OFFICERS_PER_PATROL_UNIT officers per unit."""
    cars = sum(1 for h in hotspots if h["risk_level"] == "Critical")
    bikes = sum(1 for h in hotspots if h["risk_level"] == "High")
    if cars + bikes == 0 and hotspots:
        bikes = 1  # always cover the densest hotspot
    return {"cars": cars, "bikes": bikes, "units": cars + bikes, "officers": (cars + bikes) * OFFICERS_PER_PATROL_UNIT}


def _route_order(hotspots: list[dict]) -> list[dict]:
    """Nearest-neighbour ordering starting from the densest hotspot."""
    remaining = list(hotspots)
    if not remaining:
        return []
    route = [remaining.pop(0)]
    while remaining:
        last = route[-1]
        nxt = min(remaining, key=lambda h: (h["latitude"] - last["latitude"]) ** 2 + (h["longitude"] - last["longitude"]) ** 2)
        remaining.remove(nxt)
        route.append(nxt)
    return route


@cache.per_user(READ_TTL)
def get_patrol_strategy(db: Session, current_user: User, district_id: Optional[int] = None, station_id: Optional[int] = None) -> dict:
    frame, as_of, _ = _scoped_frame(db, current_user, district_id=district_id, station_id=station_id)
    scope = "Statewide"
    if station_id:
        scope = reference_data.station_names(db).get(station_id, f"Station #{station_id}")
    elif district_id:
        scope = reference_data.district_names(db).get(district_id, f"District #{district_id}")

    hotspots = analytics.compute_hotspots(db, frame, limit=8)
    if not hotspots:
        return {"district_name": scope, "recommended_officers": 0, "recommended_cars": 0, "recommended_bikes": 0,
                "suggested_shift": "n/a", "suggested_timing": "n/a", "priority_level": "NONE", "patrol_route": [],
                "reasoning": "No geocoded cases in this scope, so no patrol plan can be derived.", "resource_recommendations": []}

    window = analytics.best_window(analytics.hourly_counts(frame))
    plan = _patrol_numbers(hotspots)
    crime_names = reference_data.crime_head_names(db)
    top_heads = analytics.top_counts(frame["head_id"], crime_names, 3)
    recent_by_head = analytics.in_window(frame, as_of, 30)["head_id"].value_counts()
    head_ids = {name: head_id for head_id, name in crime_names.items()}

    recommendations = [{
        "unit_type": _unit_for(name), "quantity": 1,
        "justification": f"{count} {name} FIRs ({count / len(frame):.0%} of cases in scope); {int(recent_by_head.get(head_ids.get(name), 0))} in the last 30 days.",
        "data_support": "case_master x crime_type",
    } for name, count in top_heads]

    top = hotspots[0]
    return {
        "district_name": scope,
        "recommended_officers": plan["officers"], "recommended_cars": plan["cars"], "recommended_bikes": plan["bikes"],
        "officers_per_unit": OFFICERS_PER_PATROL_UNIT, "hotspots_considered": len(hotspots),
        "suggested_shift": analytics.shift_name(window) or "n/a",
        "suggested_timing": analytics.window_label(window) or "n/a",
        "priority_level": top["risk_level"].upper(),
        "patrol_route": [h["location_name"] for h in _route_order(hotspots)],
        "reasoning": (
            f"{len(hotspots)} KDE hotspots found in {scope}; the densest ({top['location_name']}) holds {top['case_count']} FIRs, "
            f"{top['high_risk_cases']} rated High/Severe. {window['share']:.0%} of incidents fall in {analytics.window_label(window)}. "
            f"Rule-based allocation: one mobile car per Critical hotspot ({plan['cars']}), one bike unit per High hotspot ({plan['bikes']}), "
            f"{OFFICERS_PER_PATROL_UNIT} officers per unit."
        ),
        "resource_recommendations": recommendations,
    }


# --------------------------------------------------------------------------------- early warnings

def _collect_alerts(db: Session, frame: pd.DataFrame, as_of) -> list[dict]:
    alerts = []
    for spike in analytics.detect_spikes(db, frame, as_of)[:6]:
        place = spike["district_name"] or "statewide"
        alerts.append({
            "alert_type": "Crime Spike",
            "title": f"{spike['head_name']} spike ({place})",
            "confidence": spike["confidence"], "risk_level": spike["risk_level"],
            "evidence": f"{spike['recent_count']} FIRs in the last 30 days against an expected {spike['expected_count']} (baseline: previous six 30-day periods).",
            "reason": f"One-sided Poisson test p = {spike['p_value']:.2g}, below the Bonferroni threshold for {spike['tests_run']} tests (family-wise 5%).",
            "affected_stations": spike["stations"],
            "suggested_action": f"Review recent {spike['head_name']} FIRs in {place}; consider the {_unit_for(spike['head_name'])}.",
        })
    repeaters = analytics.repeat_offender_activity(db, frame, as_of)
    if repeaters:
        stations = sorted({s for r in repeaters for s in r["stations"]})[:4]
        alerts.append({
            "alert_type": "Repeat Offender Activity",
            "title": f"{len(repeaters)} repeat offender(s) with multiple recent FIRs",
            "confidence": None, "risk_level": "High",
            "evidence": "; ".join(f"{r['name']}: {r['recent_cases']} FIRs" for r in repeaters[:3]) + " in the last 90 days.",
            "reason": "Accused persons with a recorded criminal profile appearing in two or more FIRs registered in the last 90 days.",
            "affected_stations": stations,
            "suggested_action": "Cross-check the linked FIRs for common modus operandi and review history-sheet surveillance.",
        })
    overdue = analytics.overdue_investigations(db, frame, as_of)
    if overdue["count"]:
        alerts.append({
            "alert_type": "Overdue Investigations",
            "title": f"{overdue['count']} investigations past the statutory window",
            "confidence": None, "risk_level": "High" if overdue["count"] >= 0.25 * max(overdue["under_investigation"], 1) else "Medium",
            "evidence": f"{overdue['count']} of {overdue['under_investigation']} 'Under Investigation' FIRs are older than 90 days (heinous) or 60 days (other).",
            "reason": "Statutory investigation windows under BNSS section 187, measured from the FIR registration date.",
            "affected_stations": [name for name, _ in overdue["top_stations"]],
            "suggested_action": "Review charge-sheet readiness or seek extension for the oldest cases at the listed stations.",
        })
    for index, alert in enumerate(alerts, start=1):
        alert["alert_id"] = f"EW-{index:03d}"
    return alerts


@cache.per_user(READ_TTL)
def get_early_warnings(db: Session, current_user: User, district_id: Optional[int] = None) -> dict:
    frame, as_of, _ = _scoped_frame(db, current_user, district_id=district_id)
    alerts = _collect_alerts(db, frame, as_of)
    return {"active_alerts_count": len(alerts), "alerts": alerts}


# ------------------------------------------------------------------------------------------- chat

def process_assistant_query(db: Session, current_user: User, query_text: str,
                            district_id: Optional[int] = None, station_id: Optional[int] = None) -> dict:
    """Command-centre chat: answered by the same data-grounded agent as the main assistant, scoped to the
    district / station selected on the screen unless the question names another place."""
    from app.services import assistant_service
    scope = (reference_data.station_names(db).get(station_id) if station_id
             else reference_data.district_names(db).get(district_id) if district_id else None)
    prompt = f"[The user has {scope} selected on screen: answer for {scope} unless the question names somewhere else.] {query_text}" if scope else query_text
    result = assistant_service.answer_for_command_centre(db, current_user, prompt)
    result["query"] = query_text
    return result
