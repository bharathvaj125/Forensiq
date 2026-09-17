from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User

# Services & Schemas
from app.services import relationship_service, network_service
from app.schemas.network import CriminalRelationship, GangCommunityResponse, RelationshipCreate, RelationshipVerify

from typing import Optional
from fastapi import Query
from app.schemas.network import CriminalRelationship, GangCommunityResponse, RelationshipCreate, RelationshipVerify, NetworkGraphResponse

router = APIRouter()


@router.get("/graph", response_model=NetworkGraphResponse, summary="Get Enterprise Criminal Intelligence Graph")
def get_graph(
    district_id: Optional[int] = Query(None, alias="districtId"),
    station_id: Optional[int] = Query(None, alias="stationId"),
    crime_category: Optional[str] = Query(None, alias="crimeCategory"),
    start_date: Optional[str] = Query(None, alias="startDate"),
    end_date: Optional[str] = Query(None, alias="endDate"),
    node_types: Optional[str] = Query(None, alias="nodeTypes"),
    relationship_types: Optional[str] = Query(None, alias="relationshipTypes"),
    min_confidence: float = Query(0.0, alias="minConfidence"),
    search_query: Optional[str] = Query(None, alias="searchQuery"),
    limit: int = Query(150, alias="limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """
    Returns enterprise-grade dynamic criminal intelligence graph nodes and edges generated strictly from PostgreSQL.
    Guarded with jurisdiction access filters and multi-entity relationship scoring.
    """
    d_id = district_id if isinstance(district_id, int) else None
    s_id = station_id if isinstance(station_id, int) else None
    return network_service.get_dynamic_network_graph(
        db=db,
        current_user=current_user,
        district_id=d_id,
        station_id=s_id,
        crime_category=crime_category,
        start_date=start_date,
        end_date=end_date,
        node_types=node_types,
        relationship_types=relationship_types,
        min_confidence=min_confidence,
        search_query=search_query,
        limit=limit,
    )


@router.get("/gangs", response_model=GangCommunityResponse, summary="Detect Criminal Communities")
def get_gangs(
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read")),
):
    """Return communities inferred only from relationship edges visible to the caller."""
    return network_service.get_gang_communities(db, current_user)

@router.post("/relationships", response_model=CriminalRelationship, status_code=status.HTTP_201_CREATED, summary="Establish Suspect Link")
def establish_link(
    relationship_in: RelationshipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """
    Creates a new suspect network relationship connection (edge).
    """
    return relationship_service.establish_suspect_link(
        db=db,
        source_person_id=relationship_in.SourcePersonID,
        target_person_id=relationship_in.TargetPersonID,
        rel_type=relationship_in.RelationshipType,
        current_user=current_user
    )

@router.put("/relationships/{relationship_id}/verify", response_model=CriminalRelationship, summary="Verify Suspect Link")
def verify_link(
    relationship_id: int,
    verification_in: RelationshipVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:update"))
):
    """
    Applies verification status (Confirmed/Disputed/Pending) to a suspect relationship connection.
    """
    return relationship_service.verify_suspect_link(
        db=db,
        relationship_id=relationship_id,
        verify_status=verification_in.Status,
        current_user=current_user
    )
