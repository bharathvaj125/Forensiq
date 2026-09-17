from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class TaskDelegation(Base):
    __tablename__ = "task_delegation"

    TaskID = Column(Integer, primary_key=True, index=True)
    Title = Column(String, nullable=False)
    Description = Column(Text, nullable=False)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID"), nullable=True)
    
    AssignedByUserID = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    AssignedToUserID = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    
    DistrictID = Column(Integer, ForeignKey("district.DistrictID"), nullable=True)
    UnitID = Column(Integer, ForeignKey("police_station.UnitID"), nullable=True)
    
    Priority = Column(String, default="Medium", nullable=False)  # Critical, High, Medium, Low
    Status = Column(String, default="Assigned", nullable=False)   # Assigned, In Progress, Evidence Collected, Under Review, Completed
    DueDate = Column(String, nullable=True)
    
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    UpdatedAt = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    assigned_by = relationship("User", foreign_keys=[AssignedByUserID])
    assigned_to = relationship("User", foreign_keys=[AssignedToUserID])
    case = relationship("CaseMaster")
    timeline_events = relationship("TaskTimelineEvent", back_populates="task", cascade="all, delete-orphan", order_by="TaskTimelineEvent.Timestamp.asc()")


class TaskTimelineEvent(Base):
    __tablename__ = "task_timeline_event"

    EventID = Column(Integer, primary_key=True, index=True)
    TaskID = Column(Integer, ForeignKey("task_delegation.TaskID"), nullable=False)
    Status = Column(String, nullable=False)
    Note = Column(Text, nullable=True)
    UpdatedByUserID = Column(Integer, ForeignKey("users.UserID"), nullable=False)
    Timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    task = relationship("TaskDelegation", back_populates="timeline_events")
    updated_by = relationship("User")
