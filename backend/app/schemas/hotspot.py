from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class HotspotPoint(BaseModel):
    latitude: float
    longitude: float
    weight: Optional[float] = 1.0
    BriefFacts: Optional[str] = None
    CaseNo: Optional[str] = None
    CaseMasterID: Optional[int] = None
    DistrictID: Optional[int] = None
    PoliceStationID: Optional[int] = None
    PoliceStationName: Optional[str] = None
    CrimeHeadID: Optional[int] = None
    AIRiskScore: Optional[float] = 0.0
    IncidentFromDate: Optional[str] = None

class HotspotResponse(BaseModel):
    points: List[HotspotPoint]
    total_points: int

class PredictedHotspot(BaseModel):
    latitude: float
    longitude: float
    confidence: float
    top_factors: List[str]

class PredictedHotspotResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    hotspots: List[PredictedHotspot]
