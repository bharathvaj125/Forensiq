from app.db.base_class import Base

# Geographic and Unit Masters
from app.models.state import State
from app.models.district import District
from app.models.unit_type import UnitType
from app.models.police_station import PoliceStation

# Case Metadata Lookups
from app.models.case_category import CaseCategory
from app.models.gravity_offence import GravityOffence
from app.models.case_status_master import CaseStatusMaster
from app.models.crime_type import CrimeType
from app.models.crime_sub_type import CrimeSubType
from app.models.act import Act
from app.models.section import Section

# Auth and Permissions
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user_jurisdiction import UserJurisdiction

# Core Investigative Records
from app.models.officer import Officer
from app.models.case_master import CaseMaster
from app.models.accused import Accused
from app.models.victim import Victim
from app.models.witness import Witness
from app.models.evidence import Evidence
from app.models.vehicle import Vehicle

# Dynamic Assignments, Annotations, Networks, and Auditing
from app.models.case_assignment import CaseAssignment
from app.models.case_annotation import CaseAnnotation
from app.models.criminal_relationship import CriminalRelationship
from app.models.audit_log import AuditLog
from app.models.case_embedding import CaseEmbedding
from app.models.ai_model_run import AIModelRun
from app.models.report_job import ReportJob
from app.models.notification import Notification
from app.models.collaboration_request import CollaborationRequest
from app.models.external_agency import ExternalAgency
from app.models.external_agency_officer import ExternalAgencyOfficer
from app.models.collaboration_access import CollaborationAccess
from app.models.court_case import CourtCase

# Export all models for Alembic and Base metadata detection
__all__ = [
    "Base",
    "State",
    "District",
    "UnitType",
    "PoliceStation",
    "CaseCategory",
    "GravityOffence",
    "CaseStatusMaster",
    "CrimeType",
    "CrimeSubType",
    "Act",
    "Section",
    "User",
    "Role",
    "Permission",
    "RolePermission",
    "UserJurisdiction",
    "Officer",
    "CaseMaster",
    "Accused",
    "Victim",
    "Witness",
    "Evidence",
    "Vehicle",
    "CaseAssignment",
    "CaseAnnotation",
    "CriminalRelationship",
    "AuditLog",
    "CaseEmbedding",
    "AIModelRun",
    "ReportJob",
    "Notification",
    "CollaborationRequest",
    "ExternalAgency",
    "ExternalAgencyOfficer",
    "CollaborationAccess",
    "CourtCase"
]
