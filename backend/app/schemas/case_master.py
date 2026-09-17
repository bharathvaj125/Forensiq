from app.schemas.base import SanitizedBaseModel
from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import Field, BaseModel

class CaseMasterBase(SanitizedBaseModel):
    CrimeNo: int = Field(..., gt=0, description="Crime number must be a positive integer")
    CaseNo: str = Field(..., min_length=3, max_length=50, description="Unique Case Number identifier")
    CrimeRegisteredDate: date
    PolicePersonID: int = Field(..., gt=0)
    PoliceStationID: int = Field(..., gt=0)
    CaseCategoryID: int = Field(..., gt=0)
    GravityOffenceID: int = Field(..., gt=0)
    CrimeMajorHeadID: int = Field(..., gt=0)
    CrimeMinorHeadID: int = Field(..., gt=0)
    CaseStatusID: int = Field(..., gt=0)
    CourtID: Optional[int] = None
    IncidentFromDate: datetime
    IncidentToDate: datetime
    InfoReceivedPSDate: datetime
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    BriefFacts: str = Field(..., min_length=10, description="Descriptive brief facts of the case")
    InvestigationPriority: Optional[Literal["Low", "Medium", "High"]] = Field("Medium", description="Investigation priority level")
    AIRiskScore: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="AI-driven threat risk score")
    CaseSensitivity: Optional[Literal["Standard", "Sensitive", "High Profile"]] = Field("Standard", description="Sensitivity classification")
    DistrictID: Optional[int] = None
    DistrictName: Optional[str] = None
    PoliceStationName: Optional[str] = None

class CaseMasterCreate(CaseMasterBase):
    pass

class CaseMaster(CaseMasterBase):
    CaseMasterID: int

    class Config:
        from_attributes = True

# --- Standard Paginated Response Envelope ---

class PaginatedMeta(BaseModel):
    total: int
    page: int
    pageSize: int

class PaginatedCaseResponse(BaseModel):
    data: List[CaseMaster]
    meta: PaginatedMeta
    appliedScope: str
