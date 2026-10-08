"""Court monitoring: FIRs that have reached a court stage (charge-sheeted, in trial, judgment), with the hearing
details officers record against them. Court *names* are not in the dataset, only court ids."""

from datetime import date, timedelta
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.models.accused import Accused
from app.models.case_master import CaseMaster
from app.models.court_case import CourtCase
from app.models.user import User
from app.services import analytics, audit_service, reference_data

router = APIRouter()

STAGE_GROUPS = {"chargesheet": "chargesheet", "trial": "trial", "disposed": "convicted", "convicted": "convicted"}


class HearingUpdate(BaseModel):
    TrialStage: Optional[str] = None
    CaseStatus: Optional[str] = None
    JudgeBench: Optional[str] = None
    PublicProsecutor: Optional[str] = None
    DefenseCounsel: Optional[str] = None
    NextHearingDate: Optional[str] = None
    OrderNotes: Optional[str] = None

    @field_validator("NextHearingDate")
    @classmethod
    def _iso_date(cls, value):
        if value:
            date.fromisoformat(value)  # a malformed date would break the hearing summary comparisons
        return value or None


def _court_name(court_id) -> Optional[str]:
    return f"Court #{int(court_id)}" if court_id is not None and court_id == court_id else None


def _item(row, status_name: str, hearing: Optional[CourtCase], facts: str, accused: list[str], names: dict) -> dict:
    station = names["station"].get(int(row.station_id))
    registered = [{"stage": "FIR registered", "date": row.registered.date().isoformat(), "status": "Completed", "note": f"Registered at {station}"}]
    return {
        "CaseMasterID": int(row.CaseMasterID),
        "CaseNo": row.CaseNo,
        "FIRNo": str(int(row.CrimeNo)) if row.CrimeNo == row.CrimeNo else None,
        "DistrictName": names["district"].get(int(row.district_id)) if row.district_id == row.district_id else None,
        "PoliceStationName": names["station"].get(int(row.station_id)),
        "CourtName": _court_name(row.court_id),
        "RegisteredDate": row.registered.date().isoformat(),
        "TrialStage": (hearing.TrialStage if hearing and hearing.TrialStage else status_name),
        "CaseStatus": (hearing.CaseStatus if hearing and hearing.CaseStatus else status_name),
        "RecordedStatus": status_name,
        "OffenceSummary": facts,
        "AccusedNames": ", ".join(accused) if accused else None,
        "AIRiskLevel": row.level,
        "JudgeBench": hearing.JudgeBench if hearing else None,
        "PublicProsecutor": hearing.PublicProsecutor if hearing else None,
        "DefenseCounsel": hearing.DefenseCounsel if hearing else None,
        "NextHearingDate": hearing.NextHearingDate if hearing else None,
        "OrderNotes": hearing.OrderNotes if hearing else None,
        "Milestones": registered + (list(hearing.Milestones or []) if hearing else []),
    }


@router.get("/cases")
def get_court_cases(
    stage: Optional[str] = Query(None, description="chargesheet | trial | disposed, or part of a status name"),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    groups = reference_data.status_groups(db)
    status_names = reference_data.status_names(db)
    court_stage_ids = groups["chargesheet"] + groups["trial"] + groups["convicted"]

    as_of = analytics.as_of_date(db)
    frame = analytics.load_cases(db, current_user)
    future_dated = int((frame["registered"] > pd.Timestamp(as_of)).sum())
    frame = frame[frame["status_id"].isin(court_stage_ids) & (frame["registered"] <= pd.Timestamp(as_of))]
    frame = frame.assign(court_id=None)
    court_ids = dict(apply_jurisdiction_filter(db.query(CaseMaster.CaseMasterID, CaseMaster.CourtID), db, current_user).all())
    frame["court_id"] = frame["CaseMasterID"].map(court_ids)

    stage_counts = {status_names[i]: int((frame["status_id"] == i).sum()) for i in court_stage_ids}
    scope_ids = [int(i) for i in frame["CaseMasterID"]]
    recorded = db.query(CourtCase.NextHearingDate).filter(CourtCase.CaseMasterID.in_(scope_ids)).all() if scope_ids else []
    today = date.today().isoformat()
    week_end = (date.today() + timedelta(days=7)).isoformat()
    hearings_summary = {
        "records": len(recorded),
        "scheduled": sum(1 for (d,) in recorded if d and d >= today),
        "next_7_days": sum(1 for (d,) in recorded if d and today <= d <= week_end),
        "overdue": sum(1 for (d,) in recorded if d and d < today),
    }
    if stage and stage.lower() != "all":
        wanted = groups[STAGE_GROUPS[stage.lower()]] if stage.lower() in STAGE_GROUPS else [
            i for i in court_stage_ids if stage.lower() in status_names[i].lower()]
        frame = frame[frame["status_id"].isin(wanted)]
    if search:
        needle = search.strip()
        matches = {row[0] for row in apply_jurisdiction_filter(
            db.query(CaseMaster.CaseMasterID).filter(CaseMaster.BriefFacts.ilike(f"%{needle}%") | CaseMaster.CaseNo.ilike(f"%{needle}%")),
            db, current_user).all()}
        by_number = frame["CrimeNo"].astype("Int64").astype(str).str.contains(needle, regex=False, na=False)
        frame = frame[frame["CaseMasterID"].isin(matches) | by_number]

    total = len(frame)
    page = frame.sort_values("registered", ascending=False).iloc[offset:offset + limit]
    ids = [int(i) for i in page["CaseMasterID"]]
    facts = dict(db.query(CaseMaster.CaseMasterID, CaseMaster.BriefFacts).filter(CaseMaster.CaseMasterID.in_(ids)).all()) if ids else {}
    accused: dict[int, list[str]] = {}
    for case_id, name in db.query(Accused.CaseMasterID, Accused.AccusedName).filter(Accused.CaseMasterID.in_(ids)).all() if ids else []:
        accused.setdefault(case_id, []).append(name)
    hearings = {h.CaseMasterID: h for h in db.query(CourtCase).filter(CourtCase.CaseMasterID.in_(ids)).all()} if ids else {}
    names = {"district": reference_data.district_names(db), "station": reference_data.station_names(db)}

    items = [_item(row, status_names[int(row.status_id)], hearings.get(int(row.CaseMasterID)), facts.get(int(row.CaseMasterID)) or "",
                   accused.get(int(row.CaseMasterID), []), names) for row in page.itertuples()]
    return {"total": total, "stage_counts": stage_counts, "hearings": hearings_summary, "future_dated_excluded": future_dated,
            "as_of_date": as_of.isoformat(), "items": items}


@router.put("/cases/{case_master_id}/hearing")
def record_hearing(
    case_master_id: int,
    payload: HearingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("court:update")),
):
    """Create or update the hearing record for an FIR the caller can see. Appends a dated milestone."""
    case = apply_jurisdiction_filter(db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_master_id), db, current_user).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found or access denied.")
    status_name = reference_data.status_names(db).get(case.CaseStatusID, "")

    record = db.query(CourtCase).filter(CourtCase.CaseMasterID == case_master_id).first()
    if record is None:
        record = CourtCase(CaseMasterID=case_master_id, CaseNo=str(case.CrimeNo), FIRNo=str(case.CrimeNo),
                           CourtName=_court_name(case.CourtID) or "Court not recorded", TrialStage=status_name, Milestones=[])
        db.add(record)

    changes = payload.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(record, field, value)
    if changes:
        note = changes.get("OrderNotes") or ", ".join(f"{k}: {v}" for k, v in changes.items())
        record.Milestones = list(record.Milestones or []) + [{
            "stage": changes.get("TrialStage") or record.TrialStage, "date": date.today().isoformat(),
            "status": "Completed", "note": f"{note} (recorded by {current_user.Username})"}]
    db.commit()
    audit_service.log_action(db=db, user_id=current_user.UserID, action="UPDATE_COURT_HEARING", module="Court Monitoring",
                             resource_id=str(case_master_id), new_val=str(changes))
    return {"message": "Hearing record saved", "CaseMasterID": case_master_id, "CourtCaseID": record.CourtCaseID}
