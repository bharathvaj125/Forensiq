"""Lookups of reference data held in the database (crime types, statuses, districts, stations).

Everything that turns an id into a name, or an id into a business group (open / closed), reads these
tables so no code has to hardcode what a status or crime head means. The tables change rarely, so lookups
are cached for a few minutes (and every caller gets its own copy to modify freely).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.case_status_master import CaseStatusMaster
from app.models.crime_sub_type import CrimeSubType
from app.models.crime_type import CrimeType
from app.models.district import District
from app.models.police_station import PoliceStation
from app.services import cache

TTL_SECONDS = 600


def _cached(name: str, factory):
    return cache.get_or_compute(("reference", name), TTL_SECONDS, factory)


def crime_head_names(db: Session) -> dict[int, str]:
    return dict(_cached("crime_heads", lambda: {row.CrimeHeadID: row.CrimeGroupName for row in db.query(CrimeType).all()}))


def crime_subhead_names(db: Session) -> dict[int, str]:
    return dict(_cached("crime_subheads", lambda: {row.CrimeSubHeadID: row.CrimeHeadName for row in db.query(CrimeSubType).all()}))


def district_names(db: Session) -> dict[int, str]:
    return dict(_cached("districts", lambda: {row.DistrictID: row.DistrictName for row in db.query(District).all()}))


def station_names(db: Session) -> dict[int, str]:
    return dict(_cached("stations", lambda: {row.UnitID: row.UnitName for row in db.query(PoliceStation).all()}))


def station_districts(db: Session) -> dict[int, int]:
    return dict(_cached("station_districts", lambda: {row.UnitID: row.DistrictID for row in db.query(PoliceStation).all()}))


def status_names(db: Session) -> dict[int, str]:
    return dict(_cached("statuses", lambda: {row.CaseStatusID: row.CaseStatusName for row in db.query(CaseStatusMaster).all()}))


def status_groups(db: Session) -> dict[str, list[int]]:
    """Group status ids by what their *name* says (names come from the database, not from code)."""
    names = status_names(db)
    closed = [i for i, n in names.items() if n.lower().startswith(("closed", "disposed"))]
    return {
        "closed": closed,
        "open": [i for i in names if i not in closed],
        "investigation": [i for i, n in names.items() if "investigation" in n.lower()],
        "chargesheet": [i for i, n in names.items() if "charge" in n.lower()],
        "trial": [i for i, n in names.items() if "trial" in n.lower()],
        "convicted": [i for i, n in names.items() if "convicted" in n.lower()],
    }


def risk_value_labels(db: Session) -> dict[str, dict[int, str]]:
    """Display names for the id-valued risk features, used in explanations."""
    return {"CrimeMajorHeadID": crime_head_names(db), "CrimeMinorHeadID": crime_subhead_names(db)}
