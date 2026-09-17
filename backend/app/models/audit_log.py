from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, BigInteger
from sqlalchemy.sql import func
from app.db.base_class import Base

class AuditLog(Base):
    __tablename__ = "audit_log"

    AuditLogID = Column(Integer, primary_key=True, autoincrement=True, index=True)
    Timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)
    UserID = Column(Integer, ForeignKey("users.UserID"), nullable=True, index=True)
    Action = Column(String, nullable=False)
    ModuleName = Column(String, nullable=False)
    ResourceID = Column(String, nullable=True)
    ClientIP = Column(String, nullable=True)
    UserAgent = Column(String, nullable=True)
    ScopeAccessed = Column(String, nullable=True)
    XReason = Column(Text, nullable=True)

    # --- Compliance State Logging ---
    OldValue = Column(Text, nullable=True)
    NewValue = Column(Text, nullable=True)
