from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class ExternalAgency(Base):
    __tablename__ = "external_agencies"

    AgencyID = Column(Integer, primary_key=True, index=True)
    AgencyCode = Column(String(50), unique=True, nullable=False, index=True)
    AgencyName = Column(String(255), nullable=False)
    AgencyType = Column(String(100), nullable=False)  # Central Investigation, State Agency, Forensic, Financial Intelligence
    HeadOffice = Column(String(255), nullable=True)
    OfficialEmail = Column(String(255), nullable=False)
    ContactNumber = Column(String(50), nullable=True)
    Status = Column(String(50), default="Active", nullable=False)  # Active, Inactive
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
