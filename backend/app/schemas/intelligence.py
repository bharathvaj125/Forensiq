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
    ModelVersion: str | None = None
    Summary: str | None = None
    Confidence: float | None = None
    ConfidenceMeaning: str | None = None
    ClassProbabilities: dict[str, float] | None = None
    HighOrSevereProbability: float | None = None  # AIRiskScore is the 0-1 risk index; this is the chance of High or Severe


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
    SearchedCases: int | None = None  # cases that have an embedding and so can be matched
    TotalCases: int | None = None
    Matches: List[SimilarCaseMatch]


class EmbeddingBackfillResponse(BaseModel):
    Processed: int
    Created: int
    Updated: int
    Pending: int | None = None
    Note: str | None = None
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
    Linkage: str | None = None  # "Confirmed" (same recorded criminal profile) or "Probable" (model-linked)
    AccusedName: str | None = None
    CaseMasterID: int | None = None
    CaseNo: str | None = None


class RepeatOffenderResponse(BaseModel):
    ModelVersion: str
    Matches: List[RepeatOffenderMatch]


class AnomalyFinding(BaseModel):
    CaseMasterID: int
    AnomalyScore: float
    Factors: List[str]
    ZScore: float | None = None
    CaseNo: str | None = None


class AnomalyResponse(BaseModel):
    ModelVersion: str
    Findings: List[AnomalyFinding]
    CasesAnalysed: int | None = None
    Cutoff: float | None = None
