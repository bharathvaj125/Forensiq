from sqlalchemy import Column, Integer, String, ForeignKey, BigInteger
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class Vehicle(Base):
    __tablename__ = "vehicle"

    VehicleID = Column(BigInteger, primary_key=True, index=True)
    CaseMasterID = Column(BigInteger, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    RegistrationNumber = Column(String, index=True)
    VehicleType = Column(String)
    Make = Column(String)
    Model = Column(String)
    Color = Column(String)
    InvolvementRole = Column(String)

    # --- ORM Relationships ---
    case = relationship("CaseMaster", back_populates="vehicles")
