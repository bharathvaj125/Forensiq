"""Describes, in words, what cases an account can see, mirroring the rules apply_jurisdiction_filter enforces."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.middleware.jurisdiction_scope import STATEWIDE_ROLES
from app.models.officer import Officer
from app.models.user import User
from app.models.user_jurisdiction import UserJurisdiction
from app.services import reference_data


def describe_scope(db: Session, user: User, jurisdictions: list[UserJurisdiction] | None = None, officer: Officer | None = None) -> tuple[str, str]:
    """Returns (level, description): level is Statewide / District / Station / Granted access only / None."""
    role = user.role.RoleName if user.role else None
    if role in STATEWIDE_ROLES:
        return "Statewide", f"{role} role: every district and station"
    if role == "ExternalAgencyOfficer":
        return "Granted access only", "Only the cases an administrator has shared through the Inter-Agency Vault"
    if jurisdictions is None:
        jurisdictions = db.query(UserJurisdiction).filter(UserJurisdiction.UserID == user.UserID).all()
    if officer is None and user.OfficerID:
        officer = db.query(Officer).filter(Officer.OfficerID == user.OfficerID).first()
    districts, stations = reference_data.district_names(db), reference_data.station_names(db)
    names = [stations.get(j.UnitID, f"Station #{j.UnitID}") for j in jurisdictions if j.Active and j.UnitID]
    if names:
        return "Station", ", ".join(names)
    names = [districts.get(j.DistrictID, f"District #{j.DistrictID}") for j in jurisdictions if j.Active and j.DistrictID]
    if names:
        return "District", ", ".join(names)
    if officer and officer.PoliceStationID:
        return "Station", f"{stations.get(officer.PoliceStationID, '#' + str(officer.PoliceStationID))} (from the officer record)"
    if officer and officer.DistrictID:
        return "District", f"{districts.get(officer.DistrictID, '#' + str(officer.DistrictID))} (from the officer record)"
    return "None", "No jurisdiction assigned: this account sees no cases"
