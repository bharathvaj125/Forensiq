from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class District(Base):
    __tablename__ = "district"

    DistrictID = Column(Integer, primary_key=True, index=True)
    DistrictName = Column(String, index=True)
    StateID = Column(Integer)
    Active = Column(Integer)
