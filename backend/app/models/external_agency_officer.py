from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base

class ExternalAgencyOfficer(Base):
    __tablename__ = "external_agency_officers"

    AgencyOfficerID = Column(Integer, primary_key=True, index=True)
    AgencyID = Column(Integer, ForeignKey("external_agencies.AgencyID"), nullable=False, index=True)
    OfficerIDCode = Column(String(100), unique=True, nullable=False, index=True)
    Username = Column(String(100), unique=True, nullable=False, index=True)
    AccessPassword = Column(String(100), nullable=False)
    OfficerName = Column(String(255), nullable=False)
    Designation = Column(String(150), nullable=False)
    OfficialEmail = Column(String(255), nullable=False)
    Phone = Column(String(50), nullable=True)
    IdentityNumber = Column(String(100), nullable=True)
    Status = Column(String(50), default="Active", nullable=False)  # Active, Suspended, Deactivated
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
