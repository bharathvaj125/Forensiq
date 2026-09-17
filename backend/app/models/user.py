from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"

    UserID = Column(Integer, primary_key=True, index=True)
    Username = Column(String, unique=True, nullable=False, index=True)
    PasswordHash = Column(String, nullable=False)
    Email = Column(String, nullable=False)
    OfficerID = Column(Integer, ForeignKey("officer.OfficerID"), nullable=True)
    IsActive = Column(Boolean, default=True, nullable=False)
    CreatedAt = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    
    # --- RBAC Link ---
    RoleID = Column(Integer, ForeignKey("roles.RoleID"), nullable=True)

    # --- ORM Relationships ---
    annotations = relationship("CaseAnnotation", back_populates="user", cascade="all, delete-orphan")
    role = relationship("Role")
