from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class CaseStatusMaster(Base):
    __tablename__ = "case_status_master"

    CaseStatusID = Column(Integer, primary_key=True, index=True)
    CaseStatusName = Column(String, nullable=False)
