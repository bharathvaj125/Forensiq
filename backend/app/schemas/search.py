from pydantic import BaseModel
from typing import List, Optional
from app.schemas.case_master import CaseMaster

class SearchResultAccused(BaseModel):
    AccusedMasterID: int
    CaseMasterID: int
    AccusedName: str
    Occupation: Optional[str] = None
    AgeYear: Optional[int] = None

    class Config:
        from_attributes = True

class SearchResultEvidence(BaseModel):
    EvidenceID: int
    CaseMasterID: int
    EvidenceName: str
    EvidenceType: Optional[str] = None

    class Config:
        from_attributes = True

class UnifiedSearchResponse(BaseModel):
    cases: List[CaseMaster]
    accused: List[SearchResultAccused]
    evidence: List[SearchResultEvidence]
