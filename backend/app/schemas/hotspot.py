from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class HotspotPoint(BaseModel):
    latitude: float
    longitude: float
    weight: Optional[float] = None
    BriefFacts: Optional[str] = None
    CaseNo: Optional[str] = None
    CaseMasterID: Optional[int] = None
    DistrictID: Optional[int] = None
    PoliceStationID: Optional[int] = None
    PoliceStationName: Optional[str] = None
    CrimeHeadID: Optional[int] = None
    CrimeHeadName: Optional[str] = None
    AIRiskScore: Optional[float] = None
    AIRiskLevel: Optional[str] = None
    IncidentFromDate: Optional[str] = None

class HotspotResponse(BaseModel):
    points: List[HotspotPoint]
    total_points: int
    total_matching: int  # geocoded cases matching the filters; `points` holds the highest-risk `limit` of them

class PredictedHotspot(BaseModel):
    rank: int
    latitude: float
    longitude: float
    relative_density: float  # kernel density at the centre relative to the densest hotspot (1.0 = densest)
    radius_m: int
    location_name: str
    district_name: Optional[str] = None
    case_count: int
    open_cases: int
    high_risk_cases: int
    high_risk_lift: float
    repeat_offender_profiles: int
    top_crimes: List[dict]
    peak_window: Optional[str] = None
    risk_level: str
    reason: str
    top_factors: List[str]

class PredictedHotspotResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    as_of_date: Optional[str] = None
    hotspots: List[PredictedHotspot]
    warning: Optional[str] = None

class MapDistrict(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    cases: int

class MapStation(BaseModel):
    id: int
    name: str
    district_id: Optional[int] = None
    latitude: float
    longitude: float
    cases: int

class MapCrimeHead(BaseModel):
    id: int
    name: str
    cases: int

class MapLayersResponse(BaseModel):
    as_of_date: str
    geocoded_cases: int
    bounds: Optional[List[List[float]]] = None  # [[south, west], [north, east]] of the geocoded cases
    districts: List[MapDistrict]
    stations: List[MapStation]
    crime_heads: List[MapCrimeHead]
