from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class Act(Base):
    __tablename__ = "act"

    ActCode = Column(Integer, primary_key=True, index=True)
    ActName = Column(String, nullable=False)
