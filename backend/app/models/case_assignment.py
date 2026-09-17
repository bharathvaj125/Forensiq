from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, BigInteger
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class CaseAssignment(Base):
    __tablename__ = "case_assignments"

    CaseAssignmentID = Column(BigInteger, primary_key=True, index=True)
    CaseMasterID = Column(BigInteger, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    OfficerID = Column(Integer, ForeignKey("officer.OfficerID"), nullable=False, index=True)
    AssignmentRole = Column(String, nullable=False)
    AssignedDate = Column(DateTime, nullable=False)
    UnassignedDate = Column(DateTime, nullable=True)
    IsActive = Column(Boolean, default=True, nullable=False)

    # --- ORM Relationships ---
    case = relationship("CaseMaster", back_populates="assignments")
    officer = relationship("Officer", back_populates="assignments")
