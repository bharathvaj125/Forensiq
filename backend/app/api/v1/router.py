from fastapi import APIRouter
from app.api.v1.endpoints import (
    cases, auth, network, admin, officers,
    audit, search, hotspot, intelligence,
    assistant, collaboration, notifications, reports,
    predictive, task_delegation, court
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(cases.router, prefix="/cases", tags=["cases"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(network.router, prefix="/network", tags=["network"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(officers.router, prefix="/officers", tags=["officers"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(hotspot.router, prefix="/hotspot", tags=["hotspot"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
api_router.include_router(collaboration.router, prefix="/collaboration", tags=["collaboration"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(predictive.router, prefix="/predictive", tags=["predictive"])
api_router.include_router(task_delegation.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(court.router, prefix="/court", tags=["court"])

