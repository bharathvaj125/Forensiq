from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class Accused(Base):
    __tablename__ = "accused"

    AccusedMasterID = Column(BigInteger, primary_key=True, index=True)
    CaseMasterID = Column(BigInteger, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    AccusedName = Column(String, index=True)
    AgeYear = Column(Integer)
    GenderID = Column(Integer)
    PersonID = Column(Integer, index=True)
    Occupation = Column(String)
    Address = Column(String)
    CriminalProfileID = Column(Integer, index=True)
    GangID = Column(Integer, index=True)
    IsRepeatOffender = Column(Integer, default=0)

    # --- ORM Relationships ---
    case = relationship("CaseMaster", back_populates="accused_list")
