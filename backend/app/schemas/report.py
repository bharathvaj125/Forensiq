from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ReportSummary(BaseModel):
    CaseMasterID: int
    CaseNo: str
    BriefFacts: str
    TotalAccused: int
    TotalVictims: int
    TotalEvidence: int
    ReportGeneratedAt: datetime


class ReportJobOut(BaseModel):
    ReportJobID: int
    CaseMasterID: int
    Status: str
    CompiledAt: datetime
    PDFUrl: Optional[str] = None

    class Config:
        from_attributes = True


class ReportHistoryResponse(BaseModel):
    history: list[ReportJobOut]
