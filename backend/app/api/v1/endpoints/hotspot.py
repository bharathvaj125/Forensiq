from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.models.case_master import CaseMaster
from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.schemas.hotspot import HotspotResponse, HotspotPoint, MapLayersResponse, PredictedHotspotResponse
from app.services import analytics, hotspot_service, reference_data
from app.services.case_filters import apply_case_filters

router = APIRouter()


@router.get("/layers", response_model=MapLayersResponse, summary="Districts, stations and crime types for the map filters")
def get_map_layers(db: Session = Depends(get_db), current_user: User = Depends(verify_permission("cases:read"))):
    """Built from the caller's geocoded cases, so the filters only offer places and crime types that have data."""
    return hotspot_service.get_map_layers(db, current_user)


@router.get("/predicted", response_model=PredictedHotspotResponse, summary="Get Predicted Crime Hotspots")
def get_predicted_hotspots(
    district_id: Optional[int] = Query(None, alias="districtId"),
    station_id: Optional[int] = Query(None, alias="stationId"),
    crime_type: Optional[str] = Query(None, alias="crimeType", description="Crime head id or name fragment"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """KDE hotspots over the geocoded cases in the caller's jurisdiction."""
    return hotspot_service.get_predicted_hotspots(db, current_user, district_id=district_id, station_id=station_id,
                                                  crime_category=crime_type)


@router.get("", response_model=HotspotResponse, summary="Get Crime Hotspots")
def get_hotspots(
    district_id: Optional[int] = Query(None, alias="districtId", description="Filter by District ID"),
    station_id: Optional[int] = Query(None, alias="stationId", description="Filter by Police Station ID"),
    crime_type: Optional[str] = Query(None, alias="crimeType", description="Crime head id or name fragment, e.g. 7 or 'cyber'"),
    limit: int = Query(1000, ge=1, le=2000, description="Max points to return for fast UI rendering"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """Coordinates of the highest-risk geocoded cases for maps and heatmaps, within the caller's jurisdiction."""
    query = db.query(CaseMaster).filter(CaseMaster.latitude != 0.0, CaseMaster.longitude != 0.0,
                                        CaseMaster.CrimeRegisteredDate <= analytics.as_of_date(db))
    query = apply_jurisdiction_filter(query, db, current_user)
    query = apply_case_filters(query, db, district_id=district_id, station_id=station_id, crime_category=crime_type)
    total_matching = query.count()
    cases = query.order_by(CaseMaster.AIRiskScore.desc().nullslast(), CaseMaster.CaseMasterID.desc()).limit(limit).all()

    from app.crud.case_crud import _attach_district_info
    _attach_district_info(db, cases)
    crime_names = reference_data.crime_head_names(db)

    points = [
        HotspotPoint(
            latitude=case.latitude,
            longitude=case.longitude,
            weight=float(case.AIRiskScore) if case.AIRiskScore is not None else None,
            BriefFacts=(case.BriefFacts or "")[:220],  # the popup shows a snippet; the full text is in the case file
            CaseNo=case.CaseNo,
            CaseMasterID=case.CaseMasterID,
            DistrictID=getattr(case, "DistrictID", None),
            PoliceStationID=case.PoliceStationID,
            PoliceStationName=getattr(case, "PoliceStationName", None),
            CrimeHeadID=getattr(case, "CrimeMajorHeadID", None),
            CrimeHeadName=crime_names.get(case.CrimeMajorHeadID),
            AIRiskScore=float(case.AIRiskScore) if case.AIRiskScore is not None else None,
            AIRiskLevel=case.AIRiskLevel,
            IncidentFromDate=case.IncidentFromDate.isoformat() if case.IncidentFromDate else None
        )
        for case in cases
    ]
    return HotspotResponse(points=points, total_points=len(points), total_matching=total_matching)
