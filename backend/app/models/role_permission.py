from sqlalchemy import Column, Integer, ForeignKey
from app.db.base_class import Base

class RolePermission(Base):
    __tablename__ = "role_permissions"

    RoleID = Column(Integer, ForeignKey("roles.RoleID"), primary_key=True)
    PermissionID = Column(Integer, ForeignKey("permissions.PermissionID"), primary_key=True)
