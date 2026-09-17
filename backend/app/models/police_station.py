from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class PoliceStation(Base):
    __tablename__ = "police_station"

    UnitID = Column(Integer, primary_key=True, index=True)
    UnitName = Column(String, index=True)
    TypeID = Column(Integer)
    ParentUnit = Column(Integer)
    StateID = Column(Integer)
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"))
    Active = Column(Integer)

    district = relationship("District")
