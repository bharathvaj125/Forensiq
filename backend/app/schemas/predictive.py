from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class HourlyPoint(BaseModel):
    hour: int
    count: int
    peak_label: Optional[str] = None


class DayOfWeekPoint(BaseModel):
    dow_index: int
    day_name: str
    count: int
    pct: float


class MonthlyTrendPoint(BaseModel):
    year_month: str
    historical_count: int
    forecast_count: Optional[int] = None
    data_type: str  # 'Historical' or 'Predicted Forecast'


class DistrictRankingPoint(BaseModel):
    district_name: str
    case_count: int
    growth_pct: float
    risk_level: str


class StationWorkloadPoint(BaseModel):
    station_name: str
    case_count: int
    pending_cases: int
    workload_score: float


class CategoryTrendPoint(BaseModel):
    category_name: str
    case_count: int
    trend_direction: str


class XAIExplanation(BaseModel):
    title: str
    prediction: str
    why_explanation: str
    confidence: float
    supporting_stats: List[str]
    data_sources: str


from pydantic import BaseModel, ConfigDict

class PredictiveDashboardResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    total_cases_analyzed: int
    predicted_30day_cases: int
    growth_rate_pct: float
    high_risk_hotspot_count: int
    patrol_squads_recommended: int
    early_warnings_active: int
    backlog_workload_index: float
    hourly_distribution: List[HourlyPoint]
    dow_distribution: List[DayOfWeekPoint]
    monthly_trend: List[MonthlyTrendPoint]
    district_rankings: List[DistrictRankingPoint]
    station_rankings: List[StationWorkloadPoint]
    category_rankings: List[CategoryTrendPoint]
    xai_explanations: List[XAIExplanation]
    model_version: str = "ksp-xai-predictive-v3"


class HotspotDetail(BaseModel):
    rank: int
    location_name: str
    latitude: float
    longitude: float
    hotspot_score: float
    risk_level: str  # Very Low, Low, Medium, High, Critical
    case_count: int
    repeat_offenders_count: int
    pending_cases: int
    peak_window: str
    reason: str


class HotspotRankingResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    total_hotspots: int
    hotspots: List[HotspotDetail]
    model_version: str = "ksp-kde-hotspot-v3"


class ResourceRecommendation(BaseModel):
    unit_type: str  # Cyber Team, Dog Squad, Forensics, Traffic Support, Drone Surveillance, Women Officers
    quantity: int
    justification: str
    data_support: str


class PatrolStrategyResponse(BaseModel):
    district_name: str
    recommended_officers: int
    recommended_cars: int
    recommended_bikes: int
    suggested_shift: str
    suggested_timing: str
    priority_level: str  # CRITICAL, HIGH, MEDIUM
    patrol_route: List[str]
    reasoning: str
    resource_recommendations: List[ResourceRecommendation]


class EarlyWarningAlert(BaseModel):
    alert_id: str
    alert_type: str
    title: str
    confidence: float
    risk_level: str  # Critical, High, Medium
    evidence: str
    reason: str
    affected_stations: List[str]
    suggested_action: str


class EarlyWarningsResponse(BaseModel):
    active_alerts_count: int
    alerts: List[EarlyWarningAlert]


class AssistantQueryRequest(BaseModel):
    query: str
    district_id: Optional[int] = None
    station_id: Optional[int] = None


class AssistantQueryResponse(BaseModel):
    query: str
    answer: str
    supporting_data: Dict[str, Any]
    recommended_actions: List[str]
