from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class OfficerBase(BaseModel):
    PoliceStationID: int
    DistrictID: int
    Name: str
    Gender: Optional[str] = None
    Rank: Optional[str] = None
    BadgeNumber: Optional[str] = None
    YearsOfService: Optional[int] = None
    AssignedCaseCount: Optional[int] = 0

class OfficerOut(OfficerBase):
    OfficerID: int

    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    OfficerID: int
    AssignmentRole: str

class CaseAssignment(BaseModel):
    CaseAssignmentID: int
    CaseMasterID: int
    OfficerID: int
    AssignmentRole: str
    AssignedDate: datetime
    UnassignedDate: Optional[datetime] = None
    IsActive: bool
    officer: Optional[OfficerOut] = None

    class Config:
        from_attributes = True
