from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CollaborationRequestOut(BaseModel):
    CollaborationRequestID: int
    CaseMasterID: int
    RequestingOfficerID: int
    Justification: Optional[str] = None
    RequestStatus: str
    ApprovedAt: Optional[datetime] = None
    ExpiryAt: Optional[datetime] = None
    CreatedAt: datetime

    class Config:
        from_attributes = True

class CollaborationApprovalResponse(BaseModel):
    status: str
    message: str
