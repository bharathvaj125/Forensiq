from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.auth import RoleOut


class UserCreate(BaseModel):
    Username: str = Field(..., min_length=3, max_length=50)
    Password: str
    Email: str
    OfficerID: Optional[int] = None
    RoleID: Optional[int] = None
    Rank: Optional[str] = None
    # Details of the officer record created together with the account (ignored when OfficerID links an existing one)
    OfficerName: Optional[str] = Field(None, max_length=150)
    BadgeNumber: Optional[str] = Field(None, max_length=50)
    DistrictID: Optional[int] = None
    PoliceStationID: Optional[int] = None


class UserRoleUpdate(BaseModel):
    RoleID: int


class PasswordReset(BaseModel):
    NewPassword: str


class UserActiveUpdate(BaseModel):
    IsActive: bool


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


class AdminUserOut(BaseModel):
    """A platform account with the officer behind it and the scope it can see."""
    UserID: int
    Username: str
    Email: str
    IsActive: bool
    CreatedAt: datetime
    role: Optional[RoleOut] = None
    OfficerID: Optional[int] = None
    OfficerName: Optional[str] = None
    Rank: Optional[str] = None
    BadgeNumber: Optional[str] = None
    ScopeLevel: str  # Statewide / District / Station / Granted access only / None
    ScopeDescription: str


class RoleDetail(BaseModel):
    RoleID: int
    RoleName: str
    Description: Optional[str] = None
    Permissions: list[str]
    ScopeLevel: str
    Users: int
