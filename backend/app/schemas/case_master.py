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
    InvestigationPriority: Optional[Literal["Low", "Medium", "High"]] = Field(None, description="Investigation priority level (AI-suggested, officer-adjustable)")
    AIRiskScore: Optional[float] = Field(None, ge=0.0, le=1.0, description="Model-estimated probability that the case is rated High or Severe")
    CaseSensitivity: Optional[Literal["Standard", "Sensitive", "High Profile"]] = Field("Standard", description="Sensitivity classification")
    DistrictID: Optional[int] = None
    DistrictName: Optional[str] = None
    PoliceStationName: Optional[str] = None

class CaseMasterCreate(CaseMasterBase):
    # Assigned by the server when omitted (see case_crud.assign_case_numbers and case_service.register_new_case).
    CrimeNo: Optional[int] = Field(None, gt=0)
    CaseNo: Optional[str] = Field(None, min_length=3, max_length=50)
    CrimeRegisteredDate: Optional[date] = None      # today
    PolicePersonID: Optional[int] = Field(None, gt=0)  # the registering user's officer record
    CaseStatusID: Optional[int] = Field(None, gt=0)    # the first "under investigation" status
    IncidentToDate: Optional[datetime] = None       # same as IncidentFromDate
    InfoReceivedPSDate: Optional[datetime] = None   # now


class AccusedIn(SanitizedBaseModel):
    AccusedName: str = Field(..., min_length=2, max_length=150)
    AgeYear: Optional[int] = Field(None, ge=0, le=120)
    GenderID: Optional[int] = Field(None, gt=0)
    Occupation: Optional[str] = None
    Address: Optional[str] = None


class VictimIn(SanitizedBaseModel):
    VictimName: str = Field(..., min_length=2, max_length=150)
    AgeYear: Optional[int] = Field(None, ge=0, le=120)
    GenderID: Optional[int] = Field(None, gt=0)
    Occupation: Optional[str] = None
    Address: Optional[str] = None
    InjurySeverity: Optional[str] = None
    RelationshipToAccused: Optional[str] = None


class WitnessIn(SanitizedBaseModel):
    WitnessName: str = Field(..., min_length=2, max_length=150)
    AgeYear: Optional[int] = Field(None, ge=0, le=120)
    GenderID: Optional[int] = Field(None, gt=0)
    Occupation: Optional[str] = None
    Address: Optional[str] = None
    WitnessType: Optional[str] = None
    StatementSummary: Optional[str] = None


class VehicleIn(SanitizedBaseModel):
    RegistrationNumber: Optional[str] = None
    VehicleType: Optional[str] = None
    Make: Optional[str] = None
    Model: Optional[str] = None
    Color: Optional[str] = None
    InvolvementRole: Optional[str] = None


class CaseRegistration(CaseMasterCreate):
    """An FIR with the people and vehicles recorded at registration, saved together or not at all."""
    Accused: List[AccusedIn] = Field(default_factory=list, max_length=20)
    Victims: List[VictimIn] = Field(default_factory=list, max_length=20)
    Witnesses: List[WitnessIn] = Field(default_factory=list, max_length=20)
    Vehicles: List[VehicleIn] = Field(default_factory=list, max_length=20)


class CaseMaster(CaseMasterBase):
    CaseMasterID: int
    AIRiskLevel: Optional[str] = None
    AIRiskModelVersion: Optional[str] = None

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
