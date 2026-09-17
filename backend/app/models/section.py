from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base_class import Base

class Section(Base):
    __tablename__ = "section"

    SectionID = Column(Integer, primary_key=True, index=True)
    SectionCode = Column(String, nullable=False, index=True)
    ActCode = Column(Integer, ForeignKey("act.ActCode"), nullable=False)
