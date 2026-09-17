from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base

class CollaborationAccess(Base):
    __tablename__ = "collaboration_access"

    AccessID = Column(Integer, primary_key=True, index=True)
    RequestID = Column(Integer, ForeignKey("collaboration_requests.RequestID"), nullable=False, index=True)
    AgencyOfficerID = Column(Integer, ForeignKey("external_agency_officers.AgencyOfficerID"), nullable=False, index=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"), nullable=True, index=True)

    AccessScopeLevel = Column(String(50), default="Case", nullable=False)  # Case, Station, District, State
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"), nullable=True)
    PoliceStationID = Column(Integer, ForeignKey("police_station.UnitID"), nullable=True)

    PermissionViewFIR = Column(Boolean, default=True, nullable=False)
    PermissionViewEvidence = Column(Boolean, default=False, nullable=False)
    PermissionUploadDocuments = Column(Boolean, default=False, nullable=False)
    PermissionUploadReports = Column(Boolean, default=False, nullable=False)
    PermissionUseAI = Column(Boolean, default=False, nullable=False)
    PermissionComment = Column(Boolean, default=False, nullable=False)
    PermissionDownload = Column(Boolean, default=False, nullable=False)
    PermissionViewVictims = Column(Boolean, default=False, nullable=False)
    PermissionViewWitnesses = Column(Boolean, default=False, nullable=False)
    PermissionViewAccused = Column(Boolean, default=False, nullable=False)
    PermissionViewCrimeNetwork = Column(Boolean, default=False, nullable=False)
    PermissionViewPredictiveIntel = Column(Boolean, default=False, nullable=False)
    PermissionViewGIS = Column(Boolean, default=False, nullable=False)
    PermissionExport = Column(Boolean, default=False, nullable=False)
    PermissionDelete = Column(Boolean, default=False, nullable=False)
    PermissionCloseCase = Column(Boolean, default=False, nullable=False)
    PermissionManageUsers = Column(Boolean, default=False, nullable=False)

    AccessStart = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    AccessEnd = Column(DateTime(timezone=True), nullable=False)
    Status = Column(Boolean, default=True, nullable=False)  # True = Active, False = Expired/Revoked
