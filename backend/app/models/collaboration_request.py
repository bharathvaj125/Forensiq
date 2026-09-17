from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.base_class import Base

class CollaborationRequest(Base):
    __tablename__ = "collaboration_requests"

    RequestID = Column(Integer, primary_key=True, index=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    AgencyID = Column(Integer, ForeignKey("external_agencies.AgencyID"), nullable=False, index=True)
    RequestedByOfficerID = Column(Integer, ForeignKey("officer.OfficerID"), nullable=False)
    ApprovedByOfficerID = Column(Integer, ForeignKey("officer.OfficerID"), nullable=True)
    TargetAgencyOfficerID = Column(Integer, ForeignKey("external_agency_officers.AgencyOfficerID"), nullable=True)
    Priority = Column(String(50), default="High", nullable=False)  # Critical, High, Medium, Routine
    Reason = Column(Text, nullable=False)
    RequestedModules = Column(Text, nullable=True)  # Comma-separated or JSON list
    RequestedPermissions = Column(Text, nullable=True)  # Comma-separated or JSON list
    Status = Column(String(50), default="Pending Approval", nullable=False)  # Draft, Pending Approval, Approved, Rejected, Active, Completed, Expired, Cancelled
    StartDate = Column(DateTime(timezone=True), nullable=True)
    ExpiryDate = Column(DateTime(timezone=True), nullable=True)
    Remarks = Column(Text, nullable=True)
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
