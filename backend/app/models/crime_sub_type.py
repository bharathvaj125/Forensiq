from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base_class import Base

class CrimeSubType(Base):
    __tablename__ = "crime_sub_type"

    CrimeSubHeadID = Column(Integer, primary_key=True, index=True)
    CrimeHeadID = Column(Integer, ForeignKey("crime_type.CrimeHeadID"))
    CrimeHeadName = Column(String, index=True)
    SeqID = Column(Integer)
