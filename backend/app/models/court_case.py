from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.db.base_class import Base
from datetime import datetime

class CourtCase(Base):
    __tablename__ = "court_cases"

    CourtCaseID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    CaseNo = Column(String(100), unique=True, index=True, nullable=False)
    FIRNo = Column(String(100), index=True)
    DistrictName = Column(String(100))
    PoliceStationName = Column(String(150))
    CourtName = Column(String(200), nullable=False)
    JudgeBench = Column(String(150))
    PublicProsecutor = Column(String(150))
    DefenseCounsel = Column(String(150))
    TrialStage = Column(String(100), nullable=False)
    CaseStatus = Column(String(50), default="Under Trial")
    NextHearingDate = Column(String(50))
    OrderNotes = Column(Text)
    OffenceSummary = Column(Text)
    BNSSections = Column(String(200))
    AccusedNames = Column(String(250))
    ComplainantName = Column(String(150))
    Milestones = Column(JSON, nullable=True)
    CreatedAt = Column(DateTime, default=datetime.utcnow)
    UpdatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
