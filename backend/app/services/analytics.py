"""Analytics computed from case records.

Windows are measured back from the latest registration date in the data (never from a hardcoded date),
hotspots come from kernel density estimation, early warnings from Poisson tests of recent counts against
the preceding baseline, and timing recommendations from the hour-of-day distribution of incidents.
Nothing here returns a value that was not computed from the rows passed in."""

from __future__ import annotations

import copy
from collections import Counter, defaultdict
from datetime import date

import numpy as np
import pandas as pd
from scipy.stats import poisson
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.ml.models.hotspot.predictor import CLUSTER_RADIUS_DEG, find_hotspots
from app.ml.models.hotspot.predictor import MODEL_VERSION as HOTSPOT_MODEL_VERSION  # noqa: F401 (re-exported)
from app.models.accused import Accused
from app.models.case_master import CaseMaster
from app.models.user import User
from app.services import cache, reference_data
from app.services.case_filters import apply_case_filters

CASE_COLUMNS = ["CaseMasterID", "CaseNo", "CrimeNo", "registered", "incident", "received", "station_id", "head_id",
                "minor_id", "status_id", "risk", "level", "lat", "lon", "gravity", "officer_id"]

RECENT_DAYS = 30            # "recent" window for spike detection and growth
BASELINE_PERIODS = 6        # preceding 30-day periods used as the baseline rate
FAMILYWISE_ALPHA = 0.05     # family-wise error rate for the spike tests (Bonferroni across all tests)
MIN_SPIKE_COUNT = 5         # ignore spikes on fewer than this many recent cases
SHIFT_HOURS = 6             # length of the patrol window searched for
CLUSTER_RADIUS_M = round(CLUSTER_RADIUS_DEG * 111_320)  # metres per degree of latitude
HIGH_LEVELS = ("High", "Severe")
# BNSS 187: investigation must finish within 90 days for offences punishable by 10+ years (heinous), otherwise 60
STATUTORY_DAYS = {"heinous": 90, "other": 60}


# ------------------------------------------------------------------------------------- loading

def as_of_date(db: Session) -> date:
    """The latest registration date on or before today (the dataset contains future-dated registrations)."""
    latest = db.query(func.max(CaseMaster.CrimeRegisteredDate)).filter(CaseMaster.CrimeRegisteredDate <= date.today()).scalar()
    return latest or date.today()


FRAME_TTL_SECONDS = 60
HOTSPOT_TTL_SECONDS = 120


def load_cases(db: Session, user: User, **filters) -> pd.DataFrame:
    """Jurisdiction-scoped cases as a DataFrame (one row per case). filters: see case_filters.apply_case_filters.
    Cached briefly per user and filter set (callers get their own copy); cache.clear() on any case change."""
    key = ("cases", user.UserID, tuple(sorted((k, v) for k, v in filters.items() if v is not None)))
    return cache.get_or_compute(key, FRAME_TTL_SECONDS, lambda: _load_cases(db, user, **filters)).copy()


def _load_cases(db: Session, user: User, **filters) -> pd.DataFrame:
    query = db.query(
        CaseMaster.CaseMasterID, CaseMaster.CaseNo, CaseMaster.CrimeNo, CaseMaster.CrimeRegisteredDate,
        CaseMaster.IncidentFromDate, CaseMaster.InfoReceivedPSDate, CaseMaster.PoliceStationID,
        CaseMaster.CrimeMajorHeadID, CaseMaster.CrimeMinorHeadID, CaseMaster.CaseStatusID, CaseMaster.AIRiskScore,
        CaseMaster.AIRiskLevel, CaseMaster.latitude, CaseMaster.longitude, CaseMaster.GravityOffenceID,
        CaseMaster.PolicePersonID,
    )
    query = apply_jurisdiction_filter(query, db, user)
    query = apply_case_filters(query, db, **filters)
    frame = pd.DataFrame([tuple(row) for row in query.all()], columns=CASE_COLUMNS)
    frame["registered"] = pd.to_datetime(frame["registered"])
    frame["incident"] = pd.to_datetime(frame["incident"])
    frame["received"] = pd.to_datetime(frame["received"])
    frame["district_id"] = frame["station_id"].map(reference_data.station_districts(db))
    return frame


def repeat_profiles_by_case(db: Session, case_ids: set[int]) -> dict[int, set[int]]:
    rows = db.query(Accused.CaseMasterID, Accused.CriminalProfileID).filter(Accused.CriminalProfileID.isnot(None)).all()
    by_case: dict[int, set[int]] = defaultdict(set)
    for case_id, profile in rows:
        if case_id in case_ids:
            by_case[case_id].add(profile)
    return by_case


# -------------------------------------------------------------------------------- primitives

def high_risk(frame: pd.DataFrame) -> pd.Series:
    return frame["level"].isin(HIGH_LEVELS)


def is_open(frame: pd.DataFrame, groups: dict[str, list[int]]) -> pd.Series:
    return frame["status_id"].isin(groups["open"])


def in_window(frame: pd.DataFrame, as_of: date, days_back_start: int, days_back_end: int = 0) -> pd.DataFrame:
    """Cases registered in (as_of - start, as_of - end]."""
    end = pd.Timestamp(as_of) - pd.Timedelta(days=days_back_end)
    start = pd.Timestamp(as_of) - pd.Timedelta(days=days_back_start)
    return frame[(frame["registered"] > start) & (frame["registered"] <= end)]


def hourly_counts(frame: pd.DataFrame) -> list[int]:
    hours = frame["incident"].dropna().dt.hour
    counts = hours.value_counts()
    return [int(counts.get(hour, 0)) for hour in range(24)]


def weekday_counts(frame: pd.DataFrame) -> list[int]:
    days = frame["incident"].dropna().dt.weekday
    counts = days.value_counts()
    return [int(counts.get(day, 0)) for day in range(7)]


def best_window(hourly: list[int], length: int = SHIFT_HOURS) -> dict | None:
    """The contiguous (wrapping) block of `length` hours holding the most incidents."""
    total = sum(hourly)
    if total == 0:
        return None
    sums = [sum(hourly[(start + offset) % 24] for offset in range(length)) for start in range(24)]
    start = int(np.argmax(sums))
    return {"start_hour": start, "end_hour": (start + length) % 24, "incidents": int(sums[start]), "share": round(sums[start] / total, 4)}


def window_label(window: dict | None) -> str | None:
    return f"{window['start_hour']:02d}:00 - {window['end_hour']:02d}:00 hrs" if window else None


def shift_name(window: dict | None) -> str | None:
    if not window:
        return None
    midpoint = (window["start_hour"] + SHIFT_HOURS / 2) % 24
    if midpoint >= 22 or midpoint < 5:
        return "Night shift"
    if midpoint < 12:
        return "Morning shift"
    if midpoint < 17:
        return "Afternoon shift"
    return "Evening shift"


def top_counts(series: pd.Series, names: dict[int, str], n: int = 3) -> list[tuple[str, int]]:
    counts = series.dropna().astype(int).value_counts().head(n)
    return [(names.get(int(key), f"#{int(key)}"), int(count)) for key, count in counts.items()]


# ----------------------------------------------------------------------------------- hotspots

def compute_hotspots(db: Session, frame: pd.DataFrame, limit: int = 10) -> list[dict]:
    """KDE hotspots with statistics from the cases inside each one (all counts are real tallies).
    Cached on the content of the frame, so the dashboard, map and predictive screens share one computation."""
    geocoded = frame[frame["lat"].notna() & (frame["lat"] != 0) & (frame["lon"] != 0)].reset_index(drop=True)
    if geocoded.empty:
        return []
    fingerprint = int(pd.util.hash_pandas_object(geocoded[["CaseMasterID", "lat", "lon", "level", "status_id", "incident"]], index=False).sum())
    return copy.deepcopy(cache.get_or_compute(("hotspots", fingerprint, limit), HOTSPOT_TTL_SECONDS, lambda: _compute_hotspots(db, geocoded, limit)))


def _compute_hotspots(db: Session, geocoded: pd.DataFrame, limit: int) -> list[dict]:
    crime_names = reference_data.crime_head_names(db)
    station_names = reference_data.station_names(db)
    district_names = reference_data.district_names(db)
    groups = reference_data.status_groups(db)
    repeat_by_case = repeat_profiles_by_case(db, set(int(i) for i in geocoded["CaseMasterID"]))
    baseline_share = float(high_risk(geocoded).mean()) or None

    results = []
    for rank, cluster in enumerate(find_hotspots(geocoded[["lat", "lon"]].to_numpy(), limit), start=1):
        members = geocoded.iloc[cluster["member_indices"]]
        count = len(members)
        high = int(high_risk(members).sum())
        share = high / count if count else 0.0
        lift = share / baseline_share if baseline_share else 0.0
        profiles = set().union(*(repeat_by_case.get(int(c), set()) for c in members["CaseMasterID"]))
        window = best_window(hourly_counts(members))
        station_id = members["station_id"].mode().iloc[0]
        district_id = members["district_id"].mode().iloc[0] if members["district_id"].notna().any() else None
        crimes = top_counts(members["head_id"], crime_names, 2)
        risk_level = "Critical" if lift >= 2.0 else "High" if lift >= 1.5 else "Medium" if lift >= 1.0 else "Low"
        location = f"{station_names.get(int(station_id), f'Station #{int(station_id)}')} area"
        reason = (
            f"{count} FIRs within about 4 km ({int(is_open(members, groups).sum())} still open); "
            f"{high} rated High/Severe by the risk model ({lift:.1f}x the average share); "
            f"{len(profiles)} repeat-offender profile(s) involved"
            + (f"; main crimes: {', '.join(f'{name} ({n})' for name, n in crimes)}" if crimes else "")
            + (f"; most incidents between {window_label(window)}" if window else "") + "."
        )
        results.append({
            "rank": rank, "latitude": cluster["latitude"], "longitude": cluster["longitude"],
            "relative_density": cluster["relative_density"], "hotspot_score": round(cluster["relative_density"] * 100, 1),
            "radius_m": CLUSTER_RADIUS_M,
            "location_name": location, "district_name": district_names.get(int(district_id)) if district_id is not None else None,
            "case_count": count, "open_cases": int(is_open(members, groups).sum()), "high_risk_cases": high,
            "high_risk_lift": round(lift, 2), "repeat_offender_profiles": len(profiles), "top_crimes": crimes,
            "peak_window": window, "risk_level": risk_level, "reason": reason,
            "member_case_ids": [int(c) for c in members["CaseMasterID"]],
        })
    return results


# ------------------------------------------------------------------------------ early warnings

def detect_spikes(db: Session, frame: pd.DataFrame, as_of: date) -> list[dict]:
    """Crime-head and district x crime-head cells whose last-30-day count is improbably high given the
    previous six 30-day periods (one-sided Poisson test, Bonferroni-corrected across all cells tested)."""
    if frame.empty:
        return []
    crime_names = reference_data.crime_head_names(db)
    station_names = reference_data.station_names(db)
    district_names = reference_data.district_names(db)
    recent = in_window(frame, as_of, RECENT_DAYS)
    baseline = in_window(frame, as_of, RECENT_DAYS * (BASELINE_PERIODS + 1), RECENT_DAYS)

    cells: dict[tuple, dict] = {}
    for scope_name, keys in (("statewide", [None]), ("district", list(frame["district_id"].dropna().unique()))):
        for scope_id in keys:
            r_scope = recent if scope_id is None else recent[recent["district_id"] == scope_id]
            b_scope = baseline if scope_id is None else baseline[baseline["district_id"] == scope_id]
            for head in frame["head_id"].dropna().unique():
                k = int((r_scope["head_id"] == head).sum())
                expected = float((b_scope["head_id"] == head).sum()) / BASELINE_PERIODS
                if k >= MIN_SPIKE_COUNT or expected >= 1.0:
                    cells[(scope_name, scope_id, int(head))] = {"k": k, "expected": expected}

    tests = max(len(cells), 1)
    threshold = FAMILYWISE_ALPHA / tests
    alerts = []
    for (scope_name, scope_id, head), cell in cells.items():
        k, expected = cell["k"], cell["expected"]
        if k < MIN_SPIKE_COUNT or expected <= 0 or k <= expected:
            continue
        p_value = float(poisson.sf(k - 1, expected))
        if p_value >= threshold:
            continue
        subset = recent[recent["head_id"] == head]
        if scope_name == "district":
            subset = subset[subset["district_id"] == scope_id]
        stations = [station_names.get(int(s), f"Station #{int(s)}") for s in subset["station_id"].value_counts().head(3).index]
        lift = k / expected
        alerts.append({
            "type": "Crime spike", "scope": "district" if scope_name == "district" else "statewide",
            "district_id": int(scope_id) if scope_id is not None else None,
            "district_name": district_names.get(int(scope_id)) if scope_id is not None else None,
            "head_id": head, "head_name": crime_names.get(head, f"#{head}"), "recent_count": k,
            "expected_count": round(expected, 2), "lift": round(lift, 2), "p_value": p_value,
            "confidence": round(min(0.9999, 1.0 - p_value), 4),
            "risk_level": "Critical" if lift >= 3 else "High" if lift >= 2 else "Medium",
            "stations": stations, "tests_run": tests,
        })
    return sorted(alerts, key=lambda a: (a["p_value"], -a["lift"]))


def repeat_offender_activity(db: Session, frame: pd.DataFrame, as_of: date, days: int = 90) -> list[dict]:
    """Criminal profiles with two or more cases registered in the last `days` days."""
    recent = in_window(frame, as_of, days)
    if recent.empty:
        return []
    recent_ids = set(int(c) for c in recent["CaseMasterID"])
    rows = db.query(Accused.CriminalProfileID, Accused.AccusedName, Accused.CaseMasterID).filter(Accused.CriminalProfileID.isnot(None)).all()
    cases_of: dict[int, set[int]] = defaultdict(set)
    names: dict[int, Counter] = defaultdict(Counter)
    for profile, name, case_id in rows:
        if case_id in recent_ids:
            cases_of[profile].add(case_id)
            names[profile][name] += 1
    station_by_case = dict(zip(recent["CaseMasterID"].astype(int), recent["station_id"].astype(int)))
    station_names = reference_data.station_names(db)
    result = []
    for profile, cases in cases_of.items():
        if len(cases) >= 2:
            stations = sorted({station_names.get(station_by_case[c], f"Station #{station_by_case[c]}") for c in cases})
            result.append({"profile_id": profile, "name": names[profile].most_common(1)[0][0], "recent_cases": len(cases), "stations": stations})
    return sorted(result, key=lambda item: -item["recent_cases"])


def overdue_investigations(db: Session, frame: pd.DataFrame, as_of: date) -> dict:
    """Open 'Under Investigation' cases older than the statutory investigation window (90 days for heinous, else 60)."""
    groups = reference_data.status_groups(db)
    active = frame[frame["status_id"].isin(groups["investigation"])]
    age = (pd.Timestamp(as_of) - active["registered"]).dt.days
    limit = np.where(active["gravity"] == 1, STATUTORY_DAYS["heinous"], STATUTORY_DAYS["other"])
    overdue = active[age > limit]
    station_names = reference_data.station_names(db)
    top = [(station_names.get(int(s), f"Station #{int(s)}"), int(n)) for s, n in overdue["station_id"].value_counts().head(3).items()]
    return {"count": int(len(overdue)), "under_investigation": int(len(active)), "top_stations": top}


# ----------------------------------------------------------------------------------- forecasting

def forecast_next_period(frame: pd.DataFrame, as_of: date, horizon: int = RECENT_DAYS) -> dict:
    """Ridge-regression forecast of registrations over the next `horizon` days plus a backtest of the same
    method on the most recent `horizon` days (fit on the data before them)."""
    from app.ml.models.forecasting.forecaster import forecast_crime_trend

    history = frame[frame["registered"] <= pd.Timestamp(as_of)]
    if len(history) < 30:
        return {"predicted": None, "trend": "insufficient data", "backtest_accuracy": None, "recent_actual": int(len(in_window(frame, as_of, horizon)))}
    forecast = forecast_crime_trend([d.date().isoformat() for d in history["registered"]], horizon)
    predicted = float(sum(point["predicted_count"] for point in forecast["points"]))

    cutoff = pd.Timestamp(as_of) - pd.Timedelta(days=horizon)
    earlier = history[history["registered"] <= cutoff]
    actual = int(len(history) - len(earlier))
    accuracy = None
    if len(earlier) >= 30 and actual > 0:
        past = forecast_crime_trend([d.date().isoformat() for d in earlier["registered"]], horizon)
        past_total = float(sum(point["predicted_count"] for point in past["points"]))
        accuracy = round(max(0.0, 1.0 - abs(past_total - actual) / actual), 4)
    return {"predicted": int(round(predicted)), "trend": forecast["trend"], "backtest_accuracy": accuracy,
            "recent_actual": actual, "model_version": forecast["model_version"]}
