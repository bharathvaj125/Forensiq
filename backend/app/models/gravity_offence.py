from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class GravityOffence(Base):
    __tablename__ = "gravity_offence"

    GravityOffenceID = Column(Integer, primary_key=True, index=True)
    GravityOffenceName = Column(String, nullable=False)
