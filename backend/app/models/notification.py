from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base

class Notification(Base):
    __tablename__ = "notifications"

    NotificationID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    Title = Column(String, nullable=False)
    Message = Column(String, nullable=False)
    IsRead = Column(Boolean, default=False, nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
