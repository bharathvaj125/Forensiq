from datetime import date, datetime

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.middleware.jurisdiction_scope import allowed_station_ids
from app.models.case_master import CaseMaster
from app.models.user import User
from app.crud import case_crud
from app.services import audit_service, reference_data

# Karnataka's geographic extent; a new FIR must be located inside it.
STATE_LAT_RANGE = (11.5, 18.5)
STATE_LON_RANGE = (74.0, 78.6)
RELATED_KEYS = ("Accused", "Victims", "Witnesses", "Vehicles")


def _naive(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=None) if value is not None else None


def register_new_case(db: Session, case_data: dict, current_user: User) -> CaseMaster:
    """
    Registers a new FIR: validates it, fills what the server owns (numbers, registration date, status, registering
    officer), stores the people and vehicles recorded with it in the same transaction, scores it, and audits it.
    """
    related = {key: case_data.pop(key, None) or [] for key in RELATED_KEYS}

    lat, lon = case_data.get("latitude"), case_data.get("longitude")
    if lat is None or lon is None or not (STATE_LAT_RANGE[0] <= lat <= STATE_LAT_RANGE[1]) or not (STATE_LON_RANGE[0] <= lon <= STATE_LON_RANGE[1]):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"Coordinates must fall within Karnataka (latitude {STATE_LAT_RANGE[0]}-{STATE_LAT_RANGE[1]}, longitude {STATE_LON_RANGE[0]}-{STATE_LON_RANGE[1]}).")

    station_id = case_data["PoliceStationID"]
    if station_id not in reference_data.station_names(db):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown police station.")
    allowed = allowed_station_ids(db, current_user)
    if allowed is not None and station_id not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only register FIRs at police stations within your jurisdiction.")

    now = datetime.now()
    incident_from = _naive(case_data["IncidentFromDate"])
    if incident_from > now:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The incident cannot be in the future.")
    incident_to = _naive(case_data.get("IncidentToDate")) or incident_from
    if incident_from > incident_to:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Incident From Date cannot be after Incident To Date.")
    info_received = _naive(case_data.get("InfoReceivedPSDate")) or now
    case_data.update(IncidentFromDate=incident_from, IncidentToDate=incident_to, InfoReceivedPSDate=max(info_received, incident_from))

    case_data["CrimeRegisteredDate"] = case_data.get("CrimeRegisteredDate") or date.today()
    if case_data["CrimeRegisteredDate"] > date.today():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The registration date cannot be in the future.")

    if not case_data.get("PolicePersonID"):
        if not current_user.OfficerID:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="Your account is not linked to an officer record, so the registering officer cannot be set.")
        case_data["PolicePersonID"] = current_user.OfficerID

    if not case_data.get("CaseStatusID"):
        groups = reference_data.status_groups(db)
        initial = sorted(groups["investigation"] or groups["open"])
        if not initial:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No case statuses are configured.")
        case_data["CaseStatusID"] = initial[0]

    db_case = case_crud.create_case(db, case_data, related)

    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="CREATE_CASE",
        module="Case Manager",
        resource_id=str(db_case.CaseMasterID),
        new_val=f"CrimeNo: {db_case.CrimeNo}, CaseNo: {db_case.CaseNo}"
    )

    return db_case

def transition_case_status(db: Session, case_id: int, new_status_id: int, current_user: User) -> CaseMaster:
    """
    Updates the operational lifecycle status of a case.
    """
    case_db = case_crud.get_case_by_id(db, case_id, current_user)
    if not case_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    old_status = str(case_db.CaseStatusID)
    updated_case = case_crud.update_case(db, case_db, {"CaseStatusID": new_status_id})
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="UPDATE_CASE_STATUS",
        module="Case Manager",
        resource_id=str(case_id),
        old_val=old_status,
        new_val=str(new_status_id)
    )
    
    return updated_case

def set_case_priority(db: Session, case_id: int, priority: str, current_user: User) -> CaseMaster:
    """
    Updates the investigation priority of a case.
    """
    case_db = case_crud.get_case_by_id(db, case_id, current_user)
    if not case_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found or access denied."
        )

    old_priority = case_db.InvestigationPriority
    updated_case = case_crud.update_case(db, case_db, {"InvestigationPriority": priority})
    
    # Audit log
    audit_service.log_action(
        db=db,
        user_id=current_user.UserID,
        action="UPDATE_CASE_PRIORITY",
        module="Case Manager",
        resource_id=str(case_id),
        old_val=old_priority,
        new_val=priority
    )
    
    return updated_case
