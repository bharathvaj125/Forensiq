"""Append-only audit record for every AI inference issued by the Core Backend."""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from app.db.base_class import Base


class AIModelRun(Base):
    __tablename__ = "ai_model_runs"

    AIModelRunID = Column(BigInteger, primary_key=True, index=True)
    UserID = Column(BigInteger, ForeignKey("users.UserID"), nullable=False, index=True)
    Capability = Column(String, nullable=False, index=True)
    ModelName = Column(String, nullable=False)
    ModelVersion = Column(String, nullable=False)
    ResourceID = Column(String, nullable=True, index=True)
    ResultSummary = Column(Text, nullable=True)
    CreatedAt = Column(DateTime(timezone=True), nullable=False, default=func.now())
