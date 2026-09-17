from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class Victim(Base):
    __tablename__ = "victim"

    VictimMasterID = Column(BigInteger, primary_key=True, index=True)
    CaseMasterID = Column(BigInteger, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    VictimName = Column(String, index=True)
    AgeYear = Column(Integer)
    GenderID = Column(Integer)
    VictimPolice = Column(Integer, default=0)
    Occupation = Column(String)
    Address = Column(String)
    InjurySeverity = Column(String)
    RelationshipToAccused = Column(String)
    VictimProfileID = Column(Integer)
    IsRepeatVictim = Column(Integer, default=0)

    # --- ORM Relationships ---
    case = relationship("CaseMaster", back_populates="victims")
