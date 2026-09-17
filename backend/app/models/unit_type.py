from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class UnitType(Base):
    __tablename__ = "unit_type"

    UnitTypeID = Column(Integer, primary_key=True, index=True)
    UnitTypeName = Column(String, nullable=False)
