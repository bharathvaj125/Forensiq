from app.schemas.base import SanitizedBaseModel
from datetime import datetime
from typing import Optional, Literal
from pydantic import Field

class AnnotationCreate(SanitizedBaseModel):
    NotesText: str = Field(..., min_length=5, description="Collaborative journal notes text content")
    Category: Literal["General Note", "Forensic Progress", "Accused Movement", "Evidence Log", "Case Journal"] = Field(
        ..., description="Category classification of the annotation"
    )

class CaseAnnotation(SanitizedBaseModel):
    AnnotationID: int
    CaseMasterID: int
    UserID: int
    NotesText: str
    CreatedAt: datetime
    Category: str
    IsDeleted: bool

    class Config:
        from_attributes = True
