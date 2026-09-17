from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class CrimeType(Base):
    __tablename__ = "crime_type"

    CrimeHeadID = Column(Integer, primary_key=True, index=True)
    CrimeGroupName = Column(String, index=True)
    Active = Column(Integer)
