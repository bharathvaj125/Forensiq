from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class State(Base):
    __tablename__ = "state"

    StateID = Column(Integer, primary_key=True, index=True)
    StateName = Column(String, nullable=False)
    Active = Column(Integer, nullable=False)
