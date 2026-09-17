from sqlalchemy import Column, Integer, ForeignKey
from app.db.base_class import Base

class UserJurisdiction(Base):
    __tablename__ = "user_jurisdictions"

    UserJurisdictionID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"), nullable=True)
    UnitID = Column(Integer, ForeignKey("police_station.UnitID"), nullable=True)
