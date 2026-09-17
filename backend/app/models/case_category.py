from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class CaseCategory(Base):
    __tablename__ = "case_category"

    CaseCategoryID = Column(Integer, primary_key=True, index=True)
    CaseCategoryName = Column(String, nullable=False)
