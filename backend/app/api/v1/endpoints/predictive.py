from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User

from app.schemas.predictive import (
    PredictiveDashboardResponse,
    HotspotRankingResponse,
    PatrolStrategyResponse,
    EarlyWarningsResponse,
    AssistantQueryRequest,
    AssistantQueryResponse,
)
from app.services import predictive_service

router = APIRouter()


@router.get("/dashboard", response_model=PredictiveDashboardResponse, summary="Get Predictive Analytics & XAI Dashboard")
def get_predictive_dashboard(
    district_id: Optional[int] = Query(None, alias="districtId"),
    station_id: Optional[int] = Query(None, alias="stationId"),
    crime_category: Optional[str] = Query(None, alias="crimeCategory"),
    date_preset: Optional[str] = Query("all", alias="datePreset"),
    start_date: Optional[str] = Query(None, alias="startDate"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns enterprise-grade dynamic predictive analytics, diurnal shift distributions, monthly forecasts,
    and Explainable AI (XAI) factors derived strictly from PostgreSQL.
    """
    d_id = district_id if isinstance(district_id, int) else None
    s_id = station_id if isinstance(station_id, int) else None
    return predictive_service.get_predictive_dashboard(
        db=db,
        current_user=current_user,
        district_id=d_id,
        station_id=s_id,
        crime_category=crime_category,
        date_preset=date_preset,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/hotspots", response_model=HotspotRankingResponse, summary="Get KDE Hotspot Rankings")
def get_hotspots(
    district_id: Optional[int] = Query(None, alias="districtId"),
    station_id: Optional[int] = Query(None, alias="stationId"),
    crime_category: Optional[str] = Query(None, alias="crimeCategory"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns dynamic KDE spatial hotspot rankings, risk levels, and evidence-based reasons.
    """
    d_id = district_id if isinstance(district_id, int) else None
    s_id = station_id if isinstance(station_id, int) else None
    return predictive_service.get_hotspot_rankings(
        db=db,
        current_user=current_user,
        district_id=d_id,
        station_id=s_id,
        crime_category=crime_category,
    )


@router.get("/patrol-strategy", response_model=PatrolStrategyResponse, summary="Get Dynamic Patrol Allocation Strategy")
def get_patrol_strategy(
    district_id: Optional[int] = Query(None, alias="districtId"),
    station_id: Optional[int] = Query(None, alias="stationId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns recommended officer allocations, patrol vehicles, shift timings, and resource optimizations.
    """
    d_id = district_id if isinstance(district_id, int) else None
    s_id = station_id if isinstance(station_id, int) else None
    return predictive_service.get_patrol_strategy(
        db=db,
        current_user=current_user,
        district_id=d_id,
        station_id=s_id,
    )


@router.get("/early-warnings", response_model=EarlyWarningsResponse, summary="Get Early Warning System Alerts")
def get_early_warnings(
    district_id: Optional[int] = Query(None, alias="districtId"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns dynamic Early Warning System alerts for crime spikes, cyber fraud, and repeat offender movement.
    """
    d_id = district_id if isinstance(district_id, int) else None
    return predictive_service.get_early_warnings(
        db=db,
        current_user=current_user,
        district_id=d_id,
    )


@router.post("/assistant-query", response_model=AssistantQueryResponse, summary="Operational Command AI Chatbot Query")
def process_assistant_query(
    body: AssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Processes operational command center AI queries referencing actual PostgreSQL database statistics.
    """
    return predictive_service.process_assistant_query(
        db=db,
        current_user=current_user,
        query_text=body.query,
    )
