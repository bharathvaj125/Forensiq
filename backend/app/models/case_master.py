from sqlalchemy import Column, Integer, String, Date, DateTime, Float, Text, BigInteger, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class CaseMaster(Base):
    __tablename__ = "case_master"

    CaseMasterID = Column(BigInteger, primary_key=True, index=True)
    CrimeNo = Column(BigInteger, unique=True, index=True)
    CaseNo = Column(String, index=True)
    CrimeRegisteredDate = Column(Date)
    PolicePersonID = Column(Integer, ForeignKey("officer.OfficerID"))
    PoliceStationID = Column(Integer, ForeignKey("police_station.UnitID"), index=True)
    CaseCategoryID = Column(Integer)
    GravityOffenceID = Column(Integer)
    CrimeMajorHeadID = Column(Integer)
    CrimeMinorHeadID = Column(Integer)
    CaseStatusID = Column(Integer, index=True)
    CourtID = Column(Integer)
    IncidentFromDate = Column(DateTime)
    IncidentToDate = Column(DateTime)
    InfoReceivedPSDate = Column(DateTime)
    latitude = Column(Float)
    longitude = Column(Float)
    BriefFacts = Column(Text)

    # --- Metadata Extensions ---
    InvestigationPriority = Column(String, default="Medium")
    AIRiskScore = Column(Float, default=0.0)
    CaseSensitivity = Column(String, default="Standard")
    UpdatedAt = Column(DateTime(timezone=True), onupdate=func.now())
    CreatedBy = Column(Integer, ForeignKey("users.UserID"), nullable=True)
    UpdatedBy = Column(Integer, ForeignKey("users.UserID"), nullable=True)

    # --- ORM Relationships ---
    assignments = relationship("CaseAssignment", back_populates="case", cascade="all, delete-orphan")
    annotations = relationship("CaseAnnotation", back_populates="case", cascade="all, delete-orphan")
    accused_list = relationship("Accused", back_populates="case", cascade="all, delete-orphan")
    victims = relationship("Victim", back_populates="case", cascade="all, delete-orphan")
    witnesses = relationship("Witness", back_populates="case", cascade="all, delete-orphan")
    evidence_items = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    vehicles = relationship("Vehicle", back_populates="case", cascade="all, delete-orphan")
    embeddings = relationship("CaseEmbedding", back_populates="case", cascade="all, delete-orphan")
