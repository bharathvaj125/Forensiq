from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EvidenceCreate(BaseModel):
    EvidenceType: str
    Description: str
    CollectionDate: Optional[datetime] = None
    FileName: Optional[str] = None
    FileUrl: Optional[str] = None
    FileSize: Optional[int] = None

class EvidenceOut(BaseModel):
    EvidenceID: int
    CaseMasterID: int
    EvidenceType: Optional[str] = None
    Description: Optional[str] = None
    CollectionDate: Optional[datetime] = None
    FileName: Optional[str] = None
    FilePath: Optional[str] = None
    FileUrl: Optional[str] = None
    FileSize: Optional[int] = None
    UploadedBy: Optional[int] = None

    class Config:
        from_attributes = True
