from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TaskTimelineEventOut(BaseModel):
    EventID: int
    TaskID: int
    Status: str
    Note: Optional[str] = None
    UpdatedByUserID: int
    UpdatedByUsername: Optional[str] = None
    Timestamp: datetime

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    Title: str
    Description: str
    AssignedToUserID: int
    CaseMasterID: Optional[int] = None
    DistrictID: Optional[int] = None
    UnitID: Optional[int] = None
    Priority: str = "Medium"
    DueDate: Optional[str] = None

class TaskStatusUpdate(BaseModel):
    Status: str
    Note: Optional[str] = None

class TaskDelegationOut(BaseModel):
    TaskID: int
    Title: str
    Description: str
    CaseMasterID: Optional[int] = None
    CaseNo: Optional[str] = None
    
    AssignedByUserID: int
    AssignedByUsername: Optional[str] = None
    AssignedByRank: Optional[str] = None
    
    AssignedToUserID: int
    AssignedToUsername: Optional[str] = None
    AssignedToRank: Optional[str] = None
    
    DistrictID: Optional[int] = None
    UnitID: Optional[int] = None
    
    Priority: str
    Status: str
    DueDate: Optional[str] = None
    CreatedAt: datetime
    UpdatedAt: datetime
    
    timeline_events: List[TaskTimelineEventOut] = []

    class Config:
        from_attributes = True
