from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class Role(Base):
    __tablename__ = "roles"

    RoleID = Column(Integer, primary_key=True, index=True)
    RoleName = Column(String, unique=True, nullable=False)
    Description = Column(String, nullable=True)
