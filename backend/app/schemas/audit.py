from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AuditLogOut(BaseModel):
    AuditLogID: int
    Timestamp: datetime
    UserID: Optional[int] = None
    Action: str
    ModuleName: str
    ResourceID: Optional[str] = None
    ClientIP: Optional[str] = None
    UserAgent: Optional[str] = None
    ScopeAccessed: Optional[str] = None
    XReason: Optional[str] = None
    OldValue: Optional[str] = None
    NewValue: Optional[str] = None

    class Config:
        from_attributes = True
