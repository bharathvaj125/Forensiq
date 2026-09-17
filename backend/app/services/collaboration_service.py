from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from fastapi import HTTPException, status

from app.models.external_agency import ExternalAgency
from app.models.external_agency_officer import ExternalAgencyOfficer
from app.models.collaboration_request import CollaborationRequest
from app.models.collaboration_access import CollaborationAccess
from app.models.case_master import CaseMaster
from app.models.evidence import Evidence
from app.models.accused import Accused
from app.models.police_station import PoliceStation
from app.models.district import District
from app.models.user import User
from app.models.role import Role
from app.models.audit_log import AuditLog
from app.core.security import hash_password

# Seed Default Agencies, Officers, and User Accounts for Login Integration
def seed_default_agencies_if_needed(db: Session):
    # Ensure Role "ExternalAgencyOfficer" exists
    ext_role = db.query(Role).filter(Role.RoleName == "ExternalAgencyOfficer").first()
    if not ext_role:
        ext_role = Role(RoleName="ExternalAgencyOfficer", Description="External Agency Investigating Officer Access Role")
        db.add(ext_role)
        db.commit()
        db.refresh(ext_role)

    agency_count = db.query(ExternalAgency).count()
    if agency_count == 0:
        default_agencies = [
            {
                "AgencyCode": "CBI",
                "AgencyName": "Central Bureau of Investigation",
                "AgencyType": "Central Investigation Agency",
                "HeadOffice": "CBI Headquarters, CGO Complex, New Delhi",
                "OfficialEmail": "collaboration@cbi.gov.in",
                "ContactNumber": "+91-11-24361273",
            },
            {
                "AgencyCode": "NIA",
                "AgencyName": "National Investigation Agency",
                "AgencyType": "Counter-Terrorism & Security",
                "HeadOffice": "NIA Hqrs, CGO Complex, New Delhi",
                "OfficialEmail": "interagency@nia.gov.in",
                "ContactNumber": "+91-11-24368200",
            },
            {
                "AgencyCode": "ED",
                "AgencyName": "Enforcement Directorate",
                "AgencyType": "Financial Intelligence & Money Laundering",
                "HeadOffice": "Pravahan Bhawan, APJ Abdul Kalam Road, New Delhi",
                "OfficialEmail": "case.intel@ed.gov.in",
                "ContactNumber": "+91-11-23339100",
            },
            {
                "AgencyCode": "KSCFSL",
                "AgencyName": "Karnataka State Forensic Science Laboratory",
                "AgencyType": "Forensic Science & Ballistics",
                "HeadOffice": "FSL Complex, Madiwala, Bengaluru",
                "OfficialEmail": "director.fsl@karnataka.gov.in",
                "ContactNumber": "+91-80-22942426",
            },
            {
                "AgencyCode": "NCRB",
                "AgencyName": "National Crime Records Bureau",
                "AgencyType": "Crime Records & Fingerprint Verification",
                "HeadOffice": "NH-8, Mahipalpur, New Delhi",
                "OfficialEmail": "fpb@ncrb.gov.in",
                "ContactNumber": "+91-11-26782252",
            },
        ]

        for item in default_agencies:
            agency = ExternalAgency(**item, Status="Active")
            db.add(agency)
        db.commit()

    # Seed 3 Default External Officers and sync User Accounts
    cbi = db.query(ExternalAgency).filter(ExternalAgency.AgencyCode == "CBI").first()
    fsl = db.query(ExternalAgency).filter(ExternalAgency.AgencyCode == "KSCFSL").first()
    ed = db.query(ExternalAgency).filter(ExternalAgency.AgencyCode == "ED").first()

    officers_seed = [
        {
            "agency_id": cbi.AgencyID if cbi else 1,
            "code": "CBI-SP-0402",
            "username": "cbi_sp_verma",
            "password": "cbi@password2026",
            "name": "Ramesh Verma, IPS",
            "designation": "Superintendent of Police (Anti-Corruption)",
            "email": "r.verma@cbi.gov.in",
            "phone": "+91-9876543210"
        },
        {
            "agency_id": fsl.AgencyID if fsl else 4,
            "code": "FSL-DNA-108",
            "username": "fsl_dna_sunita",
            "password": "fsl@password2026",
            "name": "Dr. Sunita Kulkarni",
            "designation": "Chief DNA & Ballistics Analyst",
            "email": "s.kulkarni@fsl.karnataka.gov.in",
            "phone": "+91-9845012345"
        },
        {
            "agency_id": ed.AgencyID if ed else 3,
            "code": "ED-JD-301",
            "username": "ed_jd_hegde",
            "password": "ed@password2026",
            "name": "Vikramaditya Hegde",
            "designation": "Joint Director (Financial Crimes)",
            "email": "v.hegde@ed.gov.in",
            "phone": "+91-9741009988"
        }
    ]

    for item in officers_seed:
        off = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == item["username"]).first()
        if not off:
            off = ExternalAgencyOfficer(
                AgencyID=item["agency_id"],
                OfficerIDCode=item["code"],
                Username=item["username"],
                AccessPassword=item["password"],
                OfficerName=item["name"],
                Designation=item["designation"],
                OfficialEmail=item["email"],
                Phone=item["phone"],
                Status="Active"
            )
            db.add(off)
            db.commit()
            db.refresh(off)

        usr = db.query(User).filter(User.Username == item["username"]).first()
        if not usr:
            usr = User(
                Username=item["username"],
                Email=item["email"],
                PasswordHash=hash_password(item["password"]),
                RoleID=ext_role.RoleID,
                IsActive=True
            )
            db.add(usr)
            db.commit()

    # Seed distinct default requests & active approved access records for all 3 officers
    cbi_off = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == "cbi_sp_verma").first()
    fsl_off = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == "fsl_dna_sunita").first()
    ed_off = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == "ed_jd_hegde").first()

    default_seed_requests = [
        {
            "officer": cbi_off,
            "case_id": 1,
            "scope": "District",
            "reason": "CBI Anti-Corruption & Financial Cyber Fraud Inter-State Investigation",
            "agency_id": cbi_off.AgencyID if cbi_off else 1
        },
        {
            "officer": fsl_off,
            "case_id": 3,
            "scope": "Case",
            "reason": "KSCFSL Forensic DNA & Ballistics Poisoning Analysis Verification",
            "agency_id": fsl_off.AgencyID if fsl_off else 4
        },
        {
            "officer": ed_off,
            "case_id": 2,
            "scope": "State",
            "reason": "ED Money Laundering & Hawala Asset Recovery Investigation",
            "agency_id": ed_off.AgencyID if ed_off else 3
        }
    ]

    for seed in default_seed_requests:
        if seed["officer"]:
            existing_req = db.query(CollaborationRequest).filter(CollaborationRequest.TargetAgencyOfficerID == seed["officer"].AgencyOfficerID).first()
            if not existing_req:
                start_d = datetime.now(timezone.utc)
                end_d = start_d + timedelta(days=30)
                req = CollaborationRequest(
                    CaseMasterID=seed["case_id"],
                    AgencyID=seed["agency_id"],
                    RequestedByOfficerID=1,
                    TargetAgencyOfficerID=seed["officer"].AgencyOfficerID,
                    Priority="High",
                    Reason=seed["reason"],
                    RequestedModules="FIR, Evidence, AI Assistant, Crime Network",
                    RequestedPermissions="View FIR, View Evidence, Upload Reports, Use AI",
                    Status="Approved",
                    StartDate=start_d,
                    ExpiryDate=end_d,
                    Remarks=seed["scope"]
                )
                db.add(req)
                db.commit()
                db.refresh(req)

                acc = CollaborationAccess(
                    RequestID=req.RequestID,
                    AgencyOfficerID=seed["officer"].AgencyOfficerID,
                    CaseMasterID=seed["case_id"],
                    AccessScopeLevel=seed["scope"],
                    DistrictID=5 if seed["scope"] == "District" else None,
                    PermissionViewFIR=True,
                    PermissionViewEvidence=True,
                    PermissionUploadDocuments=True,
                    PermissionUploadReports=True,
                    PermissionUseAI=True,
                    PermissionComment=True,
                    PermissionDownload=True,
                    PermissionViewVictims=True,
                    PermissionViewWitnesses=True,
                    PermissionViewAccused=True,
                    PermissionViewCrimeNetwork=True,
                    PermissionViewPredictiveIntel=True,
                    PermissionViewGIS=True,
                    PermissionExport=True,
                    AccessStart=start_d,
                    AccessEnd=end_d,
                    Status=True
                )
                db.add(acc)
                db.commit()


# External Officer Authentication Login
def authenticate_external_officer(db: Session, login_data: dict) -> dict:
    username = login_data.get("username", "").strip()
    password = login_data.get("password", "").strip()

    officer = db.query(ExternalAgencyOfficer).filter(
        or_(
            ExternalAgencyOfficer.Username == username,
            ExternalAgencyOfficer.OfficerIDCode == username
        )
    ).first()

    if not officer or officer.AccessPassword != password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid officer username or password.")

    agency = db.query(ExternalAgency).filter(ExternalAgency.AgencyID == officer.AgencyID).first()

    return {
        "status": "authenticated",
        "officer": {
            "officer_id": officer.AgencyOfficerID,
            "name": officer.OfficerName,
            "username": officer.Username,
            "code": officer.OfficerIDCode,
            "designation": officer.Designation,
            "email": officer.OfficialEmail,
            "agency_id": officer.AgencyID,
            "agency_code": agency.AgencyCode if agency else "N/A",
            "agency_name": agency.AgencyName if agency else "External Agency"
        }
    }


# Get Agencies
def get_external_agencies(db: Session) -> List[ExternalAgency]:
    seed_default_agencies_if_needed(db)
    return db.query(ExternalAgency).order_by(ExternalAgency.AgencyName.asc()).all()

# Create Agency (Admin)
def create_external_agency(db: Session, agency_data: dict, current_user: User) -> ExternalAgency:
    existing = db.query(ExternalAgency).filter(ExternalAgency.AgencyCode == agency_data.get("AgencyCode")).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Agency code '{agency_data.get('AgencyCode')}' already registered.")

    agency = ExternalAgency(
        AgencyCode=agency_data["AgencyCode"].upper().strip(),
        AgencyName=agency_data["AgencyName"].strip(),
        AgencyType=agency_data.get("AgencyType", "Specialized Agency"),
        HeadOffice=agency_data.get("HeadOffice"),
        OfficialEmail=agency_data["OfficialEmail"].strip(),
        ContactNumber=agency_data.get("ContactNumber"),
        Status="Active"
    )
    db.add(agency)
    db.commit()
    db.refresh(agency)
    return agency


# Get Officers (Returns credentials for Admin view)
def get_external_agency_officers(db: Session, agency_id: Optional[int] = None) -> List[dict]:
    seed_default_agencies_if_needed(db)
    query = db.query(ExternalAgencyOfficer)
    if agency_id:
        query = query.filter(ExternalAgencyOfficer.AgencyID == agency_id)
    officers = query.order_by(ExternalAgencyOfficer.OfficerName.asc()).all()

    results = []
    for o in officers:
        agency = db.query(ExternalAgency).filter(ExternalAgency.AgencyID == o.AgencyID).first()
        results.append({
            "AgencyOfficerID": o.AgencyOfficerID,
            "AgencyID": o.AgencyID,
            "AgencyCode": agency.AgencyCode if agency else "N/A",
            "AgencyName": agency.AgencyName if agency else "Agency",
            "OfficerIDCode": o.OfficerIDCode,
            "Username": o.Username,
            "AccessPassword": o.AccessPassword,
            "OfficerName": o.OfficerName,
            "Designation": o.Designation,
            "OfficialEmail": o.OfficialEmail,
            "Phone": o.Phone,
            "IdentityNumber": o.IdentityNumber,
            "Status": o.Status
        })
    return results


# Create Officer (Admin) and sync User
def create_external_agency_officer(db: Session, officer_data: dict, current_user: User) -> ExternalAgencyOfficer:
    existing = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.OfficerIDCode == officer_data.get("OfficerIDCode")).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Officer ID code '{officer_data.get('OfficerIDCode')}' already registered.")

    username = officer_data.get("Username") or officer_data["OfficerIDCode"].lower().replace("-", "_")
    password = officer_data.get("AccessPassword") or f"{officer_data['OfficerIDCode'].lower()}@2026"

    officer = ExternalAgencyOfficer(
        AgencyID=officer_data["AgencyID"],
        OfficerIDCode=officer_data["OfficerIDCode"].strip(),
        Username=username.strip(),
        AccessPassword=password.strip(),
        OfficerName=officer_data["OfficerName"].strip(),
        Designation=officer_data.get("Designation", "Investigating Officer"),
        OfficialEmail=officer_data["OfficialEmail"].strip(),
        Phone=officer_data.get("Phone"),
        IdentityNumber=officer_data.get("IdentityNumber"),
        Status="Active"
    )
    db.add(officer)
    db.commit()
    db.refresh(officer)

    # Sync User
    ext_role = db.query(Role).filter(Role.RoleName == "ExternalAgencyOfficer").first()
    usr = db.query(User).filter(User.Username == username).first()
    if not usr:
        usr = User(
            Username=username,
            Email=officer.OfficialEmail,
            PasswordHash=hash_password(password),
            RoleID=ext_role.RoleID if ext_role else 2,
            IsActive=True
        )
        db.add(usr)
        db.commit()

    return officer


# Officer Access Request Submission (Uses logged-in user profile)
def create_external_officer_request(db: Session, req_data: dict, current_user: User = None) -> CollaborationRequest:
    officer = None
    username_to_check = req_data.get("Username") or (current_user.Username if current_user else None)

    if username_to_check:
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == username_to_check).first()

    if not officer and req_data.get("AgencyOfficerID"):
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.AgencyOfficerID == req_data["AgencyOfficerID"]).first()

    if not officer and current_user:
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.OfficialEmail == current_user.Email).first()

    case_id = req_data.get("CaseMasterID")
    if case_id:
        case = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Target police case not found.")

    duration_days = int(req_data.get("DurationDays", 14))
    start_d = datetime.now(timezone.utc)
    expiry_d = start_d + timedelta(days=duration_days)

    req = CollaborationRequest(
        CaseMasterID=case_id or 1,
        AgencyID=officer.AgencyID if officer else 1,
        RequestedByOfficerID=1,
        TargetAgencyOfficerID=officer.AgencyOfficerID if officer else 1,
        Priority=req_data.get("Priority", "High"),
        Reason=req_data.get("Reason", "Inter-agency crime investigation access request"),
        RequestedModules=req_data.get("RequestedModules", "FIR, Evidence, AI Assistant, Crime Network"),
        RequestedPermissions=req_data.get("RequestedPermissions", "View FIR, View Evidence, Upload Reports, Use AI"),
        Status="Pending Approval",
        StartDate=start_d,
        ExpiryDate=expiry_d,
        Remarks=req_data.get("RequestedScopeLevel", "Case")
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Log Audit
    db.add(AuditLog(
        UserID=current_user.UserID if current_user else 1,
        Action="OFFICER_SUBMIT_ACCESS_REQUEST",
        ModuleName="INTER_AGENCY_COLLABORATION",
        ResourceID=str(req.RequestID),
        ClientIP="127.0.0.1"
    ))
    db.commit()

    return req


# AI Agency Recommendation Engine
def recommend_agency_for_case(db: Session, case_id: int) -> dict:
    case = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    facts = (case.BriefFacts or "").lower()

    if any(k in facts for k in ["bank", "cyber", "fraud", "money laundering", "hawala", "cheating", "financial", "crore", "lakh"]):
        agency_code = "ED"
        confidence = 0.93
        reason = f"FIR Brief Facts cite financial irregularity / monetary fraud. Enforcement Directorate (ED) recommended for anti-money laundering scope."
    elif any(k in facts for k in ["interstate", "kidnap", "extortion", "syndicate", "gang", "cbi", "corruption", "bribe"]):
        agency_code = "CBI"
        confidence = 0.89
        reason = f"Case facts indicate multi-jurisdictional syndicate / interstate offences. Central Bureau of Investigation (CBI) recommended."
    elif any(k in facts for k in ["terror", "bomb", "explosive", "unlawful assembly", "uapa", "conspiracy", "national security"]):
        agency_code = "NIA"
        confidence = 0.98
        reason = f"FIR citations contain counter-terrorism / explosive keywords. National Investigation Agency (NIA) recommended."
    elif any(k in facts for k in ["dna", "poison", "ballistics", "chemical", "blood", "forensic", "postmortem", "viscera"]):
        agency_code = "KSCFSL"
        confidence = 0.95
        reason = f"Case evidence requires advanced DNA / chemical ballistics analysis. Karnataka State Forensic Science Laboratory (KSCFSL) recommended."
    else:
        agency_code = "NCRB"
        confidence = 0.91
        reason = f"Inter-state suspect identification & fingerprint record verification recommended via National Crime Records Bureau (NCRB)."

    agency = db.query(ExternalAgency).filter(ExternalAgency.AgencyCode == agency_code).first()

    return {
        "case_id": case_id,
        "case_no": case.CaseNo,
        "recommended_agency_code": agency_code,
        "recommended_agency_id": agency.AgencyID if agency else None,
        "recommended_agency_name": agency.AgencyName if agency else agency_code,
        "confidence_score": confidence,
        "ai_explanation": reason,
        "cited_facts": case.BriefFacts[:200] if case.BriefFacts else "Standard IPC Investigation"
    }


# List Collaboration Requests
def get_collaboration_requests(db: Session, current_user: User) -> List[dict]:
    seed_default_agencies_if_needed(db)

    query = db.query(CollaborationRequest)

    # If logged-in user is an External Officer, show ONLY their submitted requests
    if current_user and current_user.role and current_user.role.RoleName == "ExternalAgencyOfficer":
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == current_user.Username).first()
        if officer:
            query = query.filter(CollaborationRequest.TargetAgencyOfficerID == officer.AgencyOfficerID)

    requests = query.order_by(CollaborationRequest.CreatedAt.desc()).all()
    results = []

    for req in requests:
        case = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == req.CaseMasterID).first()
        agency = db.query(ExternalAgency).filter(ExternalAgency.AgencyID == req.AgencyID).first()
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.AgencyOfficerID == req.TargetAgencyOfficerID).first() if req.TargetAgencyOfficerID else None

        results.append({
            "request_id": req.RequestID,
            "case_id": req.CaseMasterID,
            "case_no": case.CaseNo if case else f"Case #{req.CaseMasterID}",
            "brief_facts": case.BriefFacts[:120] if case else "",
            "agency_id": req.AgencyID,
            "agency_code": agency.AgencyCode if agency else "N/A",
            "agency_name": agency.AgencyName if agency else "External Agency",
            "target_agency_officer_id": req.TargetAgencyOfficerID,
            "target_agency_officer_name": officer.OfficerName if officer else "External Officer",
            "officer_username": officer.Username if officer else "officer",
            "priority": req.Priority,
            "reason": req.Reason,
            "requested_modules": req.RequestedModules,
            "requested_permissions": req.RequestedPermissions,
            "requested_scope_level": req.Remarks or "Case",
            "status": req.Status,
            "start_date": req.StartDate.isoformat() if req.StartDate else None,
            "expiry_date": req.ExpiryDate.isoformat() if req.ExpiryDate else None,
            "created_at": req.CreatedAt.isoformat() if req.CreatedAt else None
        })

    return results


# Admin Granular Access Approval
def approve_collaboration_request(db: Session, request_id: int, approval_config: dict, current_user: User) -> dict:
    req = db.query(CollaborationRequest).filter(CollaborationRequest.RequestID == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Collaboration request not found.")

    req.Status = "Approved"
    req.ApprovedByOfficerID = current_user.OfficerID or 1
    db.commit()

    scope_level = approval_config.get("AccessScopeLevel", "Case")
    duration_days = int(approval_config.get("DurationDays", 14))

    start_d = datetime.now(timezone.utc)
    end_d = start_d + timedelta(days=duration_days)
    target_officer_id = req.TargetAgencyOfficerID or 1

    access = CollaborationAccess(
        RequestID=req.RequestID,
        AgencyOfficerID=target_officer_id,
        CaseMasterID=req.CaseMasterID if scope_level == "Case" else None,
        AccessScopeLevel=scope_level,
        DistrictID=approval_config.get("DistrictID"),
        PoliceStationID=approval_config.get("PoliceStationID"),
        PermissionViewFIR=approval_config.get("PermissionViewFIR", True),
        PermissionViewEvidence=approval_config.get("PermissionViewEvidence", True),
        PermissionUploadDocuments=approval_config.get("PermissionUploadDocuments", True),
        PermissionUploadReports=approval_config.get("PermissionUploadReports", True),
        PermissionUseAI=approval_config.get("PermissionUseAI", True),
        PermissionComment=approval_config.get("PermissionComment", True),
        PermissionDownload=approval_config.get("PermissionDownload", True),
        PermissionViewVictims=approval_config.get("PermissionViewVictims", False),
        PermissionViewWitnesses=approval_config.get("PermissionViewWitnesses", False),
        PermissionViewAccused=approval_config.get("PermissionViewAccused", True),
        PermissionViewCrimeNetwork=approval_config.get("PermissionViewCrimeNetwork", True),
        PermissionViewPredictiveIntel=approval_config.get("PermissionViewPredictiveIntel", False),
        PermissionViewGIS=approval_config.get("PermissionViewGIS", False),
        PermissionExport=approval_config.get("PermissionExport", True),
        PermissionDelete=False,
        PermissionCloseCase=False,
        PermissionManageUsers=False,
        AccessStart=start_d,
        AccessEnd=end_d,
        Status=True
    )
    db.add(access)
    db.commit()

    db.add(AuditLog(
        UserID=current_user.UserID,
        Action="ADMIN_APPROVE_GRANULAR_ACCESS",
        ModuleName="INTER_AGENCY_COLLABORATION",
        ResourceID=str(req.RequestID),
        ClientIP="127.0.0.1"
    ))
    db.commit()

    return {
        "status": "success",
        "message": f"Request #{request_id} approved. Granted {scope_level}-Level access for {duration_days} days."
    }


def reject_collaboration_request(db: Session, request_id: int, remarks: str, current_user: User) -> dict:
    req = db.query(CollaborationRequest).filter(CollaborationRequest.RequestID == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Collaboration request not found.")

    req.Status = "Rejected"
    req.Remarks = remarks
    db.commit()
    return {"status": "rejected", "message": f"Request #{request_id} rejected."}


# External Officer Workspace Dashboard (Resolves officer automatically from session)
def get_external_officer_workspace(db: Session, current_user: User, officer_id: Optional[int] = None) -> dict:
    officer = None
    if current_user and current_user.role and current_user.role.RoleName == "ExternalAgencyOfficer":
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.Username == current_user.Username).first()

    if not officer and officer_id:
        officer = db.query(ExternalAgencyOfficer).filter(ExternalAgencyOfficer.AgencyOfficerID == officer_id).first()

    if not officer:
        officer = db.query(ExternalAgencyOfficer).first()

    if not officer:
        return {"officer": None, "assigned_cases": []}

    access_records = db.query(CollaborationAccess).filter(
        CollaborationAccess.AgencyOfficerID == officer.AgencyOfficerID,
        CollaborationAccess.Status == True
    ).all()

    assigned_cases = []
    now = datetime.now(timezone.utc)

    for acc in access_records:
        if acc.AccessEnd and acc.AccessEnd.replace(tzinfo=timezone.utc) < now:
            acc.Status = False
            db.commit()
            continue

        if acc.AccessScopeLevel == "State":
            cases = db.query(CaseMaster).limit(20).all()
        elif acc.AccessScopeLevel == "District":
            dist_id = acc.DistrictID or 1
            ps_ids = db.query(PoliceStation.UnitID).filter(PoliceStation.DistrictID == dist_id).all()
            p_list = [p[0] for p in ps_ids]
            cases = db.query(CaseMaster).filter(CaseMaster.PoliceStationID.in_(p_list)).limit(20).all()
            if not cases:
                cases = db.query(CaseMaster).limit(10).all()
        elif acc.AccessScopeLevel == "Station" and acc.PoliceStationID:
            cases = db.query(CaseMaster).filter(CaseMaster.PoliceStationID == acc.PoliceStationID).limit(20).all()
        else:
            c = db.query(CaseMaster).filter(CaseMaster.CaseMasterID == acc.CaseMasterID).first()
            cases = [c] if c else []

        for case in cases:
            evidences = db.query(Evidence).filter(Evidence.CaseMasterID == case.CaseMasterID).all()
            accused_list = db.query(Accused).filter(Accused.CaseMasterID == case.CaseMasterID).all()

            assigned_cases.append({
                "access_id": acc.AccessID,
                "scope_level": acc.AccessScopeLevel,
                "case_id": case.CaseMasterID,
                "case_no": case.CaseNo,
                "crime_registered_date": case.CrimeRegisteredDate.isoformat() if case.CrimeRegisteredDate else None,
                "brief_facts": case.BriefFacts if acc.PermissionViewFIR else "[RESTRICTED]",
                "permissions": {
                    "view_fir": acc.PermissionViewFIR,
                    "view_evidence": acc.PermissionViewEvidence,
                    "upload_reports": acc.PermissionUploadReports,
                    "use_ai": acc.PermissionUseAI,
                    "view_accused": acc.PermissionViewAccused,
                    "view_crime_network": acc.PermissionViewCrimeNetwork,
                    "view_predictive_intel": acc.PermissionViewPredictiveIntel,
                    "view_gis": acc.PermissionViewGIS,
                    "download": acc.PermissionDownload,
                    "export": acc.PermissionExport,
                },
                "access_expires_at": acc.AccessEnd.isoformat() if acc.AccessEnd else None,
                "evidences": [
                    {
                        "evidence_id": e.EvidenceID,
                        "evidence_type": e.EvidenceType,
                        "description": e.Description
                    } for e in (evidences if acc.PermissionViewEvidence else [])
                ],
                "accused": [
                    {
                        "accused_id": a.AccusedMasterID,
                        "name": a.AccusedName,
                        "status": getattr(a, "Occupation", "Suspect")
                    } for a in (accused_list if acc.PermissionViewAccused else [])
                ]
            })

    return {
        "officer": {
            "officer_id": officer.AgencyOfficerID,
            "name": officer.OfficerName,
            "username": officer.Username,
            "code": officer.OfficerIDCode,
            "designation": officer.Designation,
            "email": officer.OfficialEmail,
            "agency_id": officer.AgencyID
        },
        "assigned_cases": assigned_cases
    }


# Audit Logs
def get_collaboration_audit_logs(db: Session) -> List[dict]:
    logs = db.query(AuditLog).filter(
        or_(
            AuditLog.Action.ilike("%COLLABORATION%"),
            AuditLog.Action.ilike("%AGENCY%"),
            AuditLog.Action.ilike("%ACCESS%"),
            AuditLog.Action.ilike("%OFFICER%")
        )
    ).order_by(AuditLog.Timestamp.desc()).limit(100).all()

    return [
        {
            "log_id": log.LogID,
            "timestamp": log.Timestamp.isoformat() if log.Timestamp else None,
            "user_id": log.UserID,
            "action": log.Action,
            "details": log.Details,
            "ip_address": log.IPAddress
        } for log in logs
    ]
