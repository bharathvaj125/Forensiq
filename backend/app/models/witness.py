from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean, BigInteger
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class Witness(Base):
    __tablename__ = "witness"

    WitnessMasterID = Column(BigInteger, primary_key=True, index=True)
    CaseMasterID = Column(BigInteger, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    WitnessName = Column(String, nullable=False, index=True)
    AgeYear = Column(Integer, nullable=True)
    GenderID = Column(Integer, nullable=True)
    Occupation = Column(String, nullable=True)
    Address = Column(String, nullable=True)
    WitnessType = Column(String, nullable=True)
    StatementSummary = Column(Text, nullable=True)
    IsCooperative = Column(Boolean, default=True, nullable=False)

    # --- ORM Relationships ---
    case = relationship("CaseMaster", back_populates="witnesses")
