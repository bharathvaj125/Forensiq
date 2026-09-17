from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class Permission(Base):
    __tablename__ = "permissions"

    PermissionID = Column(Integer, primary_key=True, index=True)
    PermissionCode = Column(String, unique=True, nullable=False)
    Description = Column(String, nullable=True)
