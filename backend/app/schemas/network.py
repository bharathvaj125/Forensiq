from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from typing import List

class RelationshipCreate(BaseModel):
    SourcePersonID: int
    TargetPersonID: int
    RelationshipType: str
    EvidenceSource: Optional[str] = None

class RelationshipVerify(BaseModel):
    Status: str

class CriminalRelationship(BaseModel):
    RelationshipID: int
    SourcePersonID: int
    TargetPersonID: int
    RelationshipType: str
    ConfidenceScore: float
    CreatedBy: int
    CreatedAt: datetime
    EvidenceSource: Optional[str] = None
    VerifiedBy: Optional[int] = None
    VerifiedDate: Optional[datetime] = None
    Status: str
    Active: bool

    class Config:
        from_attributes = True


class GangCommunity(BaseModel):
    MemberPersonIDs: List[int]
    Confidence: float
    Explanation: str


class GangCommunityResponse(BaseModel):
    ModelVersion: str
    Communities: List[GangCommunity]


class GraphNodeData(BaseModel):
    id: str
    label: str
    node_type: str  # Person, Victim, Witness, FIR, PoliceStation, Vehicle, Weapon, Evidence, Address, PhoneNumber, BankAccount, Organization
    sub_type: Optional[str] = "Standard"
    centrality: int = 1
    case_count: int = 1
    risk_score: float = 0.5
    details: str
    ai_summary: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    address: Optional[str] = None
    registration_no: Optional[str] = None


class GraphEdgeData(BaseModel):
    id: str
    source: str
    target: str
    relationship: str
    confidence: float = 1.0
    evidence_source: Optional[str] = None


from pydantic import BaseModel, ConfigDict

class NetworkGraphResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    nodes: List[GraphNodeData]
    edges: List[GraphEdgeData]
    total_nodes: int
    total_edges: int
    gang_count: int = 0
    model_version: str = "ksp-graph-intelligence-v2"
