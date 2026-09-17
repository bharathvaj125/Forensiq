from pydantic import BaseModel
from typing import List

class RiskFactor(BaseModel):
    FeatureName: str
    ImpactScore: float
    Description: str

class PredictRiskResponse(BaseModel):
    CaseMasterID: int
    AIRiskScore: float
    RiskLevel: str
    TopRiskFactors: List[RiskFactor]


class SimilarityFactor(BaseModel):
    FeatureName: str
    Description: str


class SimilarCaseMatch(BaseModel):
    CaseMasterID: int
    CaseNo: str | None
    SimilarityScore: float
    BriefFacts: str | None
    TopFactors: List[SimilarityFactor]


class SimilarCasesResponse(BaseModel):
    SourceCaseMasterID: int
    ModelName: str
    ModelVersion: str
    Matches: List[SimilarCaseMatch]


class EmbeddingBackfillResponse(BaseModel):
    Processed: int
    Created: int
    Updated: int
    ModelName: str
    ModelVersion: str


class ForecastPoint(BaseModel):
    date: str
    predicted_count: float


from pydantic import BaseModel, ConfigDict

class CrimeTrendForecastResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    trend: str
    points: List[ForecastPoint]


class RepeatOffenderMatch(BaseModel):
    AccusedMasterID: int
    Confidence: float
    Factors: List[str]


class RepeatOffenderResponse(BaseModel):
    ModelVersion: str
    Matches: List[RepeatOffenderMatch]


class AnomalyFinding(BaseModel):
    CaseMasterID: int
    AnomalyScore: float
    Factors: List[str]


class AnomalyResponse(BaseModel):
    ModelVersion: str
    Findings: List[AnomalyFinding]
