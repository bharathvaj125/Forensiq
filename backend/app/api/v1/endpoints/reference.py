"""Lookup lists for filters and forms, read from the reference tables so no screen needs a hardcoded copy."""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_active_user, get_db
from app.db.seed_parsing import GENDER_LABELS
from app.models.case_category import CaseCategory
from app.models.case_master import CaseMaster
from app.models.crime_sub_type import CrimeSubType
from app.models.district import District
from app.models.evidence import Evidence
from app.models.gravity_offence import GravityOffence
from app.models.police_station import PoliceStation
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.victim import Victim
from app.models.witness import Witness
from app.services import cache, reference_data

router = APIRouter()

# The source data records gravity as 1 / 2 without names. The platform treats 1 as the heinous class (offences punishable
# with 10+ years: 90-day investigation window under BNSS 187) and 2 as the rest; this is the one place that says so.
GRAVITY_NAMES = {1: "Heinous (10+ years)", 2: "Other"}
VOCABULARY_TTL = 600


def _distinct(db: Session, column) -> list[str]:
    return [value for (value,) in db.query(column).filter(column.isnot(None), column != "").distinct().order_by(column).limit(60).all()]


def _vocabulary(db: Session) -> dict[str, list[str]]:
    """The terms already used in the records, so forms offer the vocabulary the data actually uses."""
    return {
        "injury_severity": _distinct(db, Victim.InjurySeverity),
        "relationship_to_accused": _distinct(db, Victim.RelationshipToAccused),
        "witness_type": _distinct(db, Witness.WitnessType),
        "evidence_type": _distinct(db, Evidence.EvidenceType),
        "vehicle_type": _distinct(db, Vehicle.VehicleType),
        "vehicle_role": _distinct(db, Vehicle.InvolvementRole),
    }


@router.get("/options", summary="Districts, stations, crime types, case statuses, categories and recorded vocabularies")
def get_options(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    groups = reference_data.status_groups(db)
    status_group = {i: group for group in ("closed", "open") for i in groups[group]}

    gravity = {g.GravityOffenceID: g.GravityOffenceName for g in db.query(GravityOffence).all()}
    in_use = [i for (i,) in db.query(CaseMaster.GravityOffenceID).distinct().order_by(CaseMaster.GravityOffenceID).all() if i]
    categories = {c.CaseCategoryID: c.CaseCategoryName for c in db.query(CaseCategory).all()}
    category_ids = [i for (i, n) in db.query(CaseMaster.CaseCategoryID, func.count()).group_by(CaseMaster.CaseCategoryID).order_by(func.count().desc()).all() if i]

    return {
        "districts": [{"id": d.DistrictID, "name": d.DistrictName} for d in db.query(District).order_by(District.DistrictName)],
        "stations": [{"id": s.UnitID, "name": s.UnitName, "district_id": s.DistrictID}
                     for s in db.query(PoliceStation).order_by(PoliceStation.UnitName)],
        "crime_heads": sorted(({"id": i, "name": n} for i, n in reference_data.crime_head_names(db).items()), key=lambda r: r["name"]),
        "crime_subheads": [{"id": c.CrimeSubHeadID, "head_id": c.CrimeHeadID, "name": c.CrimeHeadName}
                           for c in db.query(CrimeSubType).order_by(CrimeSubType.CrimeHeadName)],
        "case_statuses": [{"id": i, "name": n, "group": status_group.get(i, "open")} for i, n in sorted(reference_data.status_names(db).items())],
        "case_categories": [{"id": i, "name": categories.get(i) or f"Category {i}"} for i in category_ids],
        "gravity_levels": [{"id": i, "name": gravity.get(i) or GRAVITY_NAMES.get(i) or f"Level {i}"} for i in in_use],
        "genders": [{"id": i, "name": n} for i, n in GENDER_LABELS.items()],
        "vocabulary": cache.get_or_compute(("reference", "vocabulary"), VOCABULARY_TTL, lambda: _vocabulary(db)),
    }
