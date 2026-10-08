from sqlalchemy import or_
from sqlalchemy.orm import Session, Query
from app.models.user import User
from app.models.case_master import CaseMaster
from app.models.police_station import PoliceStation
from app.models.user_jurisdiction import UserJurisdiction
from app.models.officer import Officer

# Roles whose holders see every case (senior investigative / oversight roles).
STATEWIDE_ROLES = ("Admin", "SCRB_Officer", "SHO")


def apply_jurisdiction_filter(query: Query, db: Session, user: User, model_class=CaseMaster) -> Query:
    """
    Enforces row-level geographic scoping.
    - Admins/SCRB_Officers bypass filtering (Statewide scope).
    - Other users (Constables, SHOs) are restricted to their user_jurisdictions.
    - Fallback defaults to the user's own officer assigned PoliceStationID and DistrictID.
    """
    # Allow full statewide case visibility for Senior Investigative Officer roles (Inspector, SP, DGP, Admin)
    if user.role and user.role.RoleName in STATEWIDE_ROLES:
        return query

    # Handle ExternalAgencyOfficer CollaborationAccess
    if user.role and user.role.RoleName == "ExternalAgencyOfficer":
        from app.models.external_agency_officer import ExternalAgencyOfficer
        from app.models.collaboration_access import CollaborationAccess

        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == user.Username).first()
        if officer:
            access_records = db.query(CollaborationAccess).filter(
                CollaborationAccess.AgencyOfficerID == officer.AgencyOfficerID,
                CollaborationAccess.Status == True
            ).all()

            if access_records:
                filters = []
                for acc in access_records:
                    if acc.AccessScopeLevel == "State":
                        return query
                    elif acc.AccessScopeLevel == "District" and acc.DistrictID:
                        subquery = db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID == acc.DistrictID).subquery()
                        filters.append(model_class.PoliceStationID.in_(subquery))
                    elif acc.AccessScopeLevel == "Station" and acc.PoliceStationID:
                        filters.append(model_class.PoliceStationID == acc.PoliceStationID)
                    elif acc.CaseMasterID:
                        filters.append(model_class.CaseMasterID == acc.CaseMasterID)

                if filters:
                    return query.filter(or_(*filters))

        # An external officer sees only what an administrator has granted; with no grant they see nothing.
        return query.filter(False)

    # Load explicit override scopes for the user
    jurisdictions = db.query(UserJurisdiction).filter(UserJurisdiction.UserID == user.UserID).all()
    
    ps_ids = []
    district_ids = []
    
    for j in jurisdictions:
        if j.UnitID:
            ps_ids.append(j.UnitID)
        elif j.DistrictID:
            district_ids.append(j.DistrictID)
            
    # Fallback to the officer profile details if no specific scopes are overridden
    if not ps_ids and not district_ids:
        if user.OfficerID:
            officer = db.query(Officer).filter(Officer.OfficerID == user.OfficerID).first()
            if officer:
                if officer.PoliceStationID:
                    ps_ids.append(officer.PoliceStationID)
                elif officer.DistrictID:
                    district_ids.append(officer.DistrictID)
                
    # If no scope can be resolved, force empty results
    if not ps_ids and not district_ids:
        return query.filter(False)

    # Construct filtering criteria
    filters = []
    if ps_ids:
        filters.append(model_class.PoliceStationID.in_(ps_ids))
    if district_ids:
        # Resolve all unit IDs that belong to the allowed districts
        subquery = db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID.in_(district_ids)).subquery()
        filters.append(model_class.PoliceStationID.in_(subquery))

    # Assigned Cases & Investigating Officer scope
    if model_class == CaseMaster and user.OfficerID:
        from app.models.case_assignment import CaseAssignment
        assignment_subquery = db.query(CaseAssignment.CaseMasterID).filter(
            CaseAssignment.OfficerID == user.OfficerID,
            CaseAssignment.IsActive == True
        ).subquery()
        filters.append(model_class.CaseMasterID.in_(assignment_subquery))

    return query.filter(or_(*filters))


def allowed_station_ids(db: Session, user: User) -> set[int] | None:
    """Police stations whose cases the user may register or manage; None means every station."""
    if user.role and user.role.RoleName in STATEWIDE_ROLES:
        return None
    if user.role and user.role.RoleName == "ExternalAgencyOfficer":
        return set()
    stations: set[int] = set()
    districts: set[int] = set()
    for j in db.query(UserJurisdiction).filter(UserJurisdiction.UserID == user.UserID).all():
        if j.UnitID:
            stations.add(j.UnitID)
        elif j.DistrictID:
            districts.add(j.DistrictID)
    if not stations and not districts and user.OfficerID:
        officer = db.query(Officer).filter(Officer.OfficerID == user.OfficerID).first()
        if officer and officer.PoliceStationID:
            stations.add(officer.PoliceStationID)
        elif officer and officer.DistrictID:
            districts.add(officer.DistrictID)
    if districts:
        stations |= {unit for (unit,) in db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID.in_(districts)).all()}
    return stations
