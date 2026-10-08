import logging
from datetime import date

from sqlalchemy.orm import Session, selectinload
from sqlalchemy import String, cast, func, or_, desc
from app.models.case_master import CaseMaster
from app.models.police_station import PoliceStation
from app.models.district import District
from app.models.user import User
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.services import cache

def _attach_district_info(db: Session, cases: list[CaseMaster]):
    if not cases:
        return
    ps_rows = db.query(PoliceStation, District.DistrictName)\
        .outerjoin(District, District.DistrictID == PoliceStation.DistrictID).all()
    ps_dict = {
        ps.UnitID: (ps.DistrictID, dname or f"District #{ps.DistrictID}", ps.UnitName) 
        for ps, dname in ps_rows
    }
    for c in cases:
        if c.PoliceStationID in ps_dict:
            did, dname, psname = ps_dict[c.PoliceStationID]
            setattr(c, "DistrictID", did)
            setattr(c, "DistrictName", dname)
            setattr(c, "PoliceStationName", psname)

def get_case_by_id(db: Session, case_id: int, user: User) -> CaseMaster | None:
    """
    Retrieves a single case record by CaseMasterID.
    Enforces row-level jurisdiction scopes and eagerly loads related child entities 
    using selectinload to avoid N+1 query latencies.
    """
    query = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id)
    query = apply_jurisdiction_filter(query, db, user)
    options = (
        selectinload(CaseMaster.accused_list),
        selectinload(CaseMaster.victims),
        selectinload(CaseMaster.witnesses),
        selectinload(CaseMaster.evidence_items),
        selectinload(CaseMaster.vehicles),
        selectinload(CaseMaster.assignments),
        selectinload(CaseMaster.annotations),
        selectinload(CaseMaster.embeddings)
    )
    query = query.options(*options)
    res = query.first()
    if not res:
        # Check if the user has an active, approved collaboration request for this case
        from app.models.external_agency_officer import ExternalAgencyOfficer
        from app.models.collaboration_access import CollaborationAccess

        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == user.Username).first()
        if officer:
            acc = db.query(CollaborationAccess).filter(
                CollaborationAccess.AgencyOfficerID == officer.AgencyOfficerID,
                CollaborationAccess.Status == True
            ).first()
            if acc:
                bypass_query = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id).options(*options)
                res = bypass_query.first()
    if res:
        _attach_district_info(db, [res])
    return res

def get_cases_paginated(
    db: Session,
    user: User,
    skip: int = 0,
    limit: int = 50,
    search: str = None,
    district_id: int = None,
    station_id: int = None,
    status_id: int = None,
    sort_by: str = None,
    risk_levels: list[str] | None = None,
    status_group: str | None = None,
    crime_category: str | None = None,
) -> tuple[list[CaseMaster], int]:
    """
    Retrieves a paginated list of cases alongside the total count matching the criteria.
    Implicitly applies row-level jurisdiction constraints based on the active user profile.
    """
    query = db.query(CaseMaster)
    query = apply_jurisdiction_filter(query, db, user)

    # Filters
    if district_id is not None and isinstance(district_id, int):
        ps_subquery = db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID == district_id).subquery()
        query = query.filter(CaseMaster.PoliceStationID.in_(ps_subquery))
    if station_id is not None and isinstance(station_id, int):
        query = query.filter(CaseMaster.PoliceStationID == station_id)
    if status_id is not None:
        query = query.filter(CaseMaster.CaseStatusID == status_id)
    if status_group:
        from app.services import reference_data
        query = query.filter(CaseMaster.CaseStatusID.in_(reference_data.status_groups(db).get(status_group.lower(), [-1])))
    if risk_levels:
        query = query.filter(CaseMaster.AIRiskLevel.in_(risk_levels))
    if crime_category:
        from app.services.case_filters import apply_case_filters
        query = apply_case_filters(query, db, crime_category=crime_category)
    query = query.filter(CaseMaster.CrimeRegisteredDate <= date.today())  # registrations dated in the future are data errors
    if search:
        query = query.filter(
            or_(
                CaseMaster.CaseNo.ilike(f"%{search}%"),
                CaseMaster.BriefFacts.ilike(f"%{search}%")
            )
        )

    # Fast Count matching query
    total_count = query.count()

    # Sorting
    if sort_by == "date_desc":
        query = query.order_by(desc(CaseMaster.CrimeRegisteredDate))
    elif sort_by == "date_asc":
        query = query.order_by(CaseMaster.CrimeRegisteredDate)
    elif sort_by == "priority_desc":
        query = query.order_by(desc(CaseMaster.InvestigationPriority))
    elif sort_by == "risk_desc":
        query = query.order_by(desc(CaseMaster.AIRiskScore).nullslast())
    elif sort_by == "risk_asc":
        query = query.order_by(CaseMaster.AIRiskScore.asc().nullslast())
    else:
        query = query.order_by(desc(CaseMaster.CaseMasterID))

    cases = query.offset(skip).limit(limit).all()
    _attach_district_info(db, cases)
    return cases, total_count

def _unit_prefix(db: Session, station_id: int) -> str:
    """The 6-digit unit prefix of existing CrimeNo values at this station, else its district, else any case."""
    from app.models.police_station import PoliceStation as Station
    prefix = func.substr(cast(CaseMaster.CrimeNo, String), 1, 6)
    for scope in (
        CaseMaster.PoliceStationID == station_id,
        CaseMaster.PoliceStationID.in_(
            db.query(Station.UnitID).filter(Station.DistrictID == db.query(Station.DistrictID).filter(Station.UnitID == station_id).scalar_subquery())
        ),
        None,
    ):
        query = db.query(prefix)
        if scope is not None:
            query = query.filter(scope)
        value = query.order_by(CaseMaster.CaseMasterID.desc()).limit(1).scalar()
        if value:
            return value
    raise ValueError("Cannot derive a CrimeNo prefix: there are no existing cases.")


def assign_case_numbers(db: Session, data: dict) -> dict:
    """Fill in CaseNo (year + 5-digit sequence at the station) and CrimeNo (station unit prefix +
    3-digit station + CaseNo) following the dataset's numbering, guaranteeing CrimeNo is unique."""
    station_id = data["PoliceStationID"]
    registered = data.get("CrimeRegisteredDate") or date.today()
    year = str(registered.year)

    if not data.get("CaseNo"):
        last = db.query(func.max(CaseMaster.CaseNo)).filter(
            CaseMaster.PoliceStationID == station_id, CaseMaster.CaseNo.like(f"{year}%")
        ).scalar()
        sequence = int(last[len(year):]) + 1 if last and last[len(year):].isdigit() else 1
        data["CaseNo"] = f"{year}{sequence:05d}"

    if not data.get("CrimeNo"):
        prefix = _unit_prefix(db, station_id)
        sequence = int(data["CaseNo"][len(year):])
        while True:
            candidate = int(f"{prefix}{station_id:03d}{year}{sequence:05d}")
            if not db.query(CaseMaster.CaseMasterID).filter(CaseMaster.CrimeNo == candidate).first():
                data["CrimeNo"] = candidate
                break
            sequence += 1
    return data


def create_case(db: Session, case_data: dict, related: dict | None = None) -> CaseMaster:
    """Creates a new CaseMaster record, assigns FIR numbers if absent, stores the accused / victims / witnesses /
    vehicles recorded with it in the same transaction, and scores it with the risk model."""
    from app.models.accused import Accused
    from app.models.vehicle import Vehicle
    from app.models.victim import Victim
    from app.models.witness import Witness

    for ai_field in ("AIRiskScore", "AIRiskLevel", "AIRiskModelVersion"):
        case_data.pop(ai_field, None)
    case_data = assign_case_numbers(db, case_data)
    columns = {column.key for column in CaseMaster.__table__.columns}
    db_case = CaseMaster(**{key: value for key, value in case_data.items() if key in columns})  # drop response-only fields (e.g. DistrictName)
    db.add(db_case)
    db.flush()  # assigns CaseMasterID so the related rows can reference it
    related = related or {}
    for model, key in ((Accused, "Accused"), (Victim, "Victims"), (Witness, "Witnesses"), (Vehicle, "Vehicles")):
        for position, item in enumerate(related.get(key) or [], start=1):
            values = dict(item)
            if model is Accused:
                values["PersonID"] = position  # the accused's slot within the case, as in the imported records
            db.add(model(CaseMasterID=db_case.CaseMasterID, **values))
    db.commit()
    cache.clear()
    db.refresh(db_case)
    try:
        from app.services import risk_service
        risk_service.score_cases(db, [db_case])
        db.refresh(db_case)
    except Exception:
        # Leave the case unscored rather than invent a score; startup re-scoring picks it up.
        logging.getLogger("ksp_backend").exception("Risk scoring failed for new case %s", db_case.CaseMasterID)
    return db_case

def update_case(db: Session, case_db: CaseMaster, case_data: dict) -> CaseMaster:
    """Updates fields on an existing CaseMaster record."""
    for key, value in case_data.items():
        setattr(case_db, key, value)
    db.commit()
    cache.clear()
    db.refresh(case_db)
    return case_db

def delete_case(db: Session, case_id: int) -> bool:
    """Deletes a CaseMaster record by CaseMasterID."""
    db_case = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id).first()
    if not db_case:
        return False
    db.delete(db_case)
    db.commit()
    cache.clear()
    return True
