from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.models.case_master import CaseMaster
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.schemas.hotspot import HotspotResponse, HotspotPoint, PredictedHotspotResponse
from app.services import hotspot_service

router = APIRouter()


@router.get("/predicted", response_model=PredictedHotspotResponse, summary="Get Predicted Crime Hotspots")
def get_predicted_hotspots(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Return explainable KDE predictions only for the caller's visible jurisdiction."""
    return hotspot_service.get_predicted_hotspots(db, current_user)

@router.get("", response_model=HotspotResponse, summary="Get Crime Hotspots")
def get_hotspots(
    district_id: Optional[int] = Query(None, alias="districtId", description="Filter by District ID"),
    station_id: Optional[int] = Query(None, alias="stationId", description="Filter by Police Station ID"),
    crime_type: Optional[str] = Query(None, alias="crimeType", description="Filter by crime category key"),
    limit: int = Query(250, ge=1, le=1000, description="Max points to return for fast UI rendering"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves coordinate points of active crime cases to construct hotspots and heatmaps.
    Implicitly filters locations based on row-level officer jurisdiction parameters.
    """
    query = db.query(CaseMaster).filter(
        CaseMaster.latitude != 0.0,
        CaseMaster.longitude != 0.0
    )
    query = apply_jurisdiction_filter(query, db, current_user)
    
    if district_id is not None and isinstance(district_id, int):
        from app.models.police_station import PoliceStation
        ps_subquery = db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID == district_id).subquery()
        query = query.filter(CaseMaster.PoliceStationID.in_(ps_subquery))

    if station_id is not None and isinstance(station_id, int):
        query = query.filter(CaseMaster.PoliceStationID == station_id)
        
    if crime_type:
        ckey = crime_type.lower()
        if ckey == "burglary":
            query = query.filter(
                (CaseMaster.BriefFacts.ilike("%burgla%")) | 
                (CaseMaster.BriefFacts.ilike("%house%")) | 
                (CaseMaster.BriefFacts.ilike("%lurking%")) | 
                (CaseMaster.CrimeMajorHeadID == 2)
            )
        elif ckey == "theft":
            query = query.filter(
                (CaseMaster.BriefFacts.ilike("%theft%")) | 
                (CaseMaster.BriefFacts.ilike("%vehicle%")) | 
                (CaseMaster.BriefFacts.ilike("%stolen%")) | 
                (CaseMaster.CrimeMajorHeadID == 2)
            )
        elif ckey == "cyber":
            query = query.filter(
                (CaseMaster.BriefFacts.ilike("%cyber%")) | 
                (CaseMaster.BriefFacts.ilike("%bank%")) | 
                (CaseMaster.BriefFacts.ilike("%fraud%")) | 
                (CaseMaster.CrimeMajorHeadID == 7)
            )
        elif ckey == "assault":
            query = query.filter(
                (CaseMaster.BriefFacts.ilike("%assault%")) | 
                (CaseMaster.BriefFacts.ilike("%robbery%")) | 
                (CaseMaster.BriefFacts.ilike("%murder%")) | 
                (CaseMaster.CrimeMajorHeadID == 1)
            )
        elif ckey == "women":
            query = query.filter(
                (CaseMaster.BriefFacts.ilike("%dowry%")) | 
                (CaseMaster.BriefFacts.ilike("%molest%")) | 
                (CaseMaster.BriefFacts.ilike("%rape%")) | 
                (CaseMaster.CrimeMajorHeadID == 3)
            )
        elif ckey == "narcotics":
            query = query.filter(
                (CaseMaster.BriefFacts.ilike("%ganja%")) | 
                (CaseMaster.BriefFacts.ilike("%ndps%")) | 
                (CaseMaster.CrimeMajorHeadID == 8)
            )

    query = query.order_by(CaseMaster.AIRiskScore.desc(), CaseMaster.CaseMasterID.desc()).limit(limit)
    cases = query.all()

    # Attach district and station names
    from app.crud.case_crud import _attach_district_info
    _attach_district_info(db, cases)

    points = [
        HotspotPoint(
            latitude=case.latitude,
            longitude=case.longitude,
            weight=float(case.AIRiskScore or 1.0),
            BriefFacts=case.BriefFacts,
            CaseNo=case.CaseNo,
            CaseMasterID=case.CaseMasterID,
            DistrictID=getattr(case, "DistrictID", None),
            PoliceStationID=case.PoliceStationID,
            PoliceStationName=getattr(case, "PoliceStationName", None),
            CrimeHeadID=getattr(case, "CrimeMajorHeadID", None),
            AIRiskScore=float(case.AIRiskScore or 0.0),
            IncidentFromDate=case.IncidentFromDate.isoformat() if case.IncidentFromDate else None
        )
        for case in cases
    ]
    return HotspotResponse(
        points=points,
        total_points=len(points)
    )
