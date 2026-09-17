from app.schemas.base import SanitizedBaseModel
from typing import Optional, Literal
from pydantic import Field

class WitnessCreate(SanitizedBaseModel):
    WitnessName: str = Field(..., min_length=2, max_length=100, description="Full name of the witness")
    AgeYear: Optional[int] = Field(None, ge=0, le=150, description="Age in years")
    GenderID: Optional[int] = Field(None, gt=0)
    Occupation: Optional[str] = Field(None, max_length=100)
    Address: Optional[str] = Field(None, max_length=255)
    WitnessType: Optional[Literal["Eye Witness", "Material Witness", "Character Witness", "Expert Witness"]] = Field(
        None, description="Role of the witness in the case"
    )
    StatementSummary: Optional[str] = Field(None, min_length=5, description="Summary of the witness's statement")
    IsCooperative: bool = Field(True, description="Cooperative status indicator")

class Witness(WitnessCreate):
    WitnessMasterID: int
    CaseMasterID: int

    class Config:
        from_attributes = True
