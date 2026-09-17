from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.dependencies import get_db
from app.core.permissions import verify_permission
from app.models.user import User
from app.crud import officer_crud
from app.schemas.officer import OfficerOut

router = APIRouter()

@router.get("", response_model=List[OfficerOut], summary="List Officers")
def list_officers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, alias="pageSize", description="Page size"),
    search: Optional[str] = Query(None, description="Search by name, rank, or badge number"),
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves a paginated list of officers from the database with keyword search filter.
    """
    skip = (page - 1) * page_size
    officers, _ = officer_crud.get_officers_paginated(
        db=db,
        skip=skip,
        limit=page_size,
        search=search
    )
    return officers

@router.get("/{officer_id}", response_model=OfficerOut, summary="Get Officer Details")
def read_officer(
    officer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(verify_permission("cases:read"))
):
    """
    Retrieves details of a specific officer by OfficerID.
    """
    officer = officer_crud.get_officer_by_id(db, officer_id)
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found."
        )
    return officer
