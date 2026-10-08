"""Shared case filters used by analytics endpoints.

crime_category is matched against the real crime_type table: either a numeric CrimeHeadID or a
(case-insensitive) fragment of a crime head name, e.g. "cyber" or "Crimes Against Women"."""

from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.case_master import CaseMaster
from app.models.police_station import PoliceStation
from app.services import reference_data


def resolve_crime_heads(db: Session, crime_category: str | None) -> list[int] | None:
    if not crime_category or not crime_category.strip() or crime_category.strip().lower() == "all":
        return None
    text = crime_category.strip()
    if text.isdigit():
        return [int(text)]
    needle = text.lower()
    matches = [head_id for head_id, name in reference_data.crime_head_names(db).items() if needle in name.lower()]
    return matches or [-1]  # unknown category -> empty result rather than silently ignoring the filter


def _parse_date(value: str, label: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{label} must be an ISO date (YYYY-MM-DD).")


def apply_case_filters(query, db: Session, *, district_id=None, station_id=None, crime_category=None,
                       start_date=None, end_date=None, search=None):
    if isinstance(station_id, int):
        query = query.filter(CaseMaster.PoliceStationID == station_id)
    elif isinstance(district_id, int):
        stations = db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID == district_id).subquery()
        query = query.filter(CaseMaster.PoliceStationID.in_(stations))

    heads = resolve_crime_heads(db, crime_category)
    if heads is not None:
        query = query.filter(CaseMaster.CrimeMajorHeadID.in_(heads))
    if start_date:
        query = query.filter(CaseMaster.CrimeRegisteredDate >= _parse_date(start_date, "start_date"))
    if end_date:
        query = query.filter(CaseMaster.CrimeRegisteredDate <= _parse_date(end_date, "end_date"))
    if search:
        pattern = f"%{search}%"
        query = query.filter(CaseMaster.CaseNo.ilike(pattern) | CaseMaster.BriefFacts.ilike(pattern))
    return query
