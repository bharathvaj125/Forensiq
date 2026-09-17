from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Optional

class LoginRequest(BaseModel):
    Username: str
    Password: str

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, values):
        if isinstance(values, dict):
            u = values.get("Username") or values.get("username")
            p = values.get("Password") or values.get("password")
            if u: values["Username"] = u
            if p: values["Password"] = p
        return values

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class RoleOut(BaseModel):
    RoleID: int
    RoleName: str
    Description: str

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    UserID: int
    Username: str
    Email: str
    OfficerID: Optional[int] = None
    Rank: Optional[str] = None
    IsActive: bool
    CreatedAt: datetime
    role: Optional[RoleOut] = None

    class Config:
        from_attributes = True
