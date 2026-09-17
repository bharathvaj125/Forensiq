from sqlalchemy.orm import declarative_base

# Declarative base class for all SQLAlchemy models.
# This is separated to resolve circular import dependencies.
Base = declarative_base()
