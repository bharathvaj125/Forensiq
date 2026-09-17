from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base

class ReportJob(Base):
    __tablename__ = "report_jobs"

    ReportJobID = Column(Integer, primary_key=True, index=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"), nullable=False)
    Status = Column(String, default="pending", nullable=False)  # pending, completed, failed
    PDFBytes = Column(LargeBinary, nullable=True)
    CompiledAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    PDFUrl = Column(String, nullable=True)
    CreatedBy = Column(Integer, ForeignKey("users.UserID"), nullable=True)
