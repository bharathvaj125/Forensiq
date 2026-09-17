from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    Username: str
    Password: str
    Email: str
    OfficerID: Optional[int] = None
    RoleID: Optional[int] = None
    Rank: Optional[str] = None

class UserJurisdictionCreate(BaseModel):
    UserID: int
    DistrictID: Optional[int] = None
    UnitID: Optional[int] = None
    Active: bool = True

class UserJurisdictionOut(BaseModel):
    UserJurisdictionID: int
    UserID: int
    DistrictID: Optional[int] = None
    UnitID: Optional[int] = None
    Active: bool

    class Config:
        from_attributes = True
