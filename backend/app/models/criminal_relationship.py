from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, BigInteger, Boolean
from app.db.base_class import Base

class CriminalRelationship(Base):
    __tablename__ = "criminal_relationships"

    RelationshipID = Column(BigInteger, primary_key=True, index=True)
    SourcePersonID = Column(Integer, nullable=False, index=True)
    TargetPersonID = Column(Integer, nullable=False, index=True)
    RelationshipType = Column(String, nullable=False)
    ConfidenceScore = Column(Float, default=1.0, nullable=False)
    CreatedBy = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    CreatedAt = Column(DateTime, nullable=False)

    # --- Verification & Audit Extensions ---
    EvidenceSource = Column(String, nullable=True)
    VerifiedBy = Column(Integer, ForeignKey("users.UserID"), nullable=True)
    VerifiedDate = Column(DateTime, nullable=True)
    Status = Column(String, default="Pending") # Pending, Confirmed, Disputed
    Active = Column(Boolean, default=True, nullable=False)
