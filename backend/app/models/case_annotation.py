from sqlalchemy import Column, Integer, String, ForeignKey, Text, Boolean, DateTime, BigInteger
from sqlalchemy.sql import func
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class CaseAnnotation(Base):
    __tablename__ = "case_annotations"

    AnnotationID = Column(BigInteger, primary_key=True, index=True)
    CaseMasterID = Column(BigInteger, ForeignKey("case_master.CaseMasterID"), nullable=False, index=True)
    UserID = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    NotesText = Column(Text, nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    Category = Column(String, nullable=False)
    IsDeleted = Column(Boolean, default=False, nullable=False)

    # --- ORM Relationships ---
    case = relationship("CaseMaster", back_populates="annotations")
    user = relationship("User", back_populates="annotations")
