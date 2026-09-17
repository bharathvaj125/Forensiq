import csv
import os
from datetime import datetime
from sqlalchemy.orm import Session
import logging

from app.models.district import District
from app.models.police_station import PoliceStation
from app.models.crime_type import CrimeType
from app.models.crime_sub_type import CrimeSubType
from app.models.officer import Officer
from app.models.case_master import CaseMaster
from app.models.accused import Accused
from app.models.victim import Victim
from app.models.evidence import Evidence
from app.models.vehicle import Vehicle
from app.models.user import User
from app.core.security import hash_password
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission

logger = logging.getLogger("ksp_backend")

# --- Generic Seeding Helper ---
def seed_table(db: Session, model_class, csv_filename, mapper_func):
    """
    Checks if a table already contains rows. If not, reads the specified CSV
    file from the database mount, parses rows with the mapper, and bulk-saves to DB.
    """
    if db.query(model_class).first() is not None:
        logger.info(f"Table '{model_class.__tablename__}' is already seeded.")
        return

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    candidate_paths = [
        os.path.join(base_dir, "database", "seeds", "data", csv_filename),
        os.path.join(os.path.dirname(base_dir), "database", "seeds", "data", csv_filename),
        f"/database/seeds/data/{csv_filename}"
    ]
    csv_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            csv_path = p
            break

    if not csv_path:
        logger.warning(f"Seed file for {csv_filename} not found. Skipping.")
        return

    logger.info(f"Seeding '{model_class.__tablename__}' from {csv_path}...")
    try:
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            objects_to_insert = []
            for row in reader:
                obj = mapper_func(row)
                if obj:
                    objects_to_insert.append(obj)

            db.bulk_save_objects(objects_to_insert)
            db.commit()
            logger.info(f"Successfully seeded {len(objects_to_insert)} records into '{model_class.__tablename__}'!")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding '{model_class.__tablename__}': {e}")


# --- CSV Mappers ---

def map_district(row):
    return District(
        DistrictID=int(row['DistrictID']),
        DistrictName=row['DistrictName'],
        StateID=int(row['StateID']),
        Active=int(row['Active'])
    )

def map_police_station(row):
    parent = row.get('ParentUnit')
    return PoliceStation(
        UnitID=int(row['UnitID']),
        UnitName=row['UnitName'],
        TypeID=int(row['TypeID']),
        ParentUnit=int(float(parent.strip())) if parent and parent.strip() and parent != 'nan' else None,
        StateID=int(row['StateID']),
        DistrictID=int(row['DistrictID']),
        Active=int(row['Active'])
    )

def map_crime_type(row):
    return CrimeType(
        CrimeHeadID=int(row['CrimeHeadID']),
        CrimeGroupName=row['CrimeGroupName'],
        Active=int(row['Active'])
    )

def map_crime_sub_type(row):
    return CrimeSubType(
        CrimeSubHeadID=int(row['CrimeSubHeadID']),
        CrimeHeadID=int(row['CrimeHeadID']),
        CrimeHeadName=row['CrimeHeadName'],
        SeqID=int(row['SeqID'])
    )

def map_officer(row):
    yos = row.get('YearsOfService')
    cases = row.get('AssignedCaseCount')
    return Officer(
        OfficerID=int(row['OfficerID']),
        PoliceStationID=int(row['PoliceStationID']),
        DistrictID=int(row['DistrictID']),
        Name=row['Name'],
        Gender=row['Gender'],
        Rank=row['Rank'],
        BadgeNumber=row['BadgeNumber'],
        YearsOfService=int(float(yos.strip())) if yos and yos.strip() and yos != 'nan' else 0,
        AssignedCaseCount=int(float(cases.strip())) if cases and cases.strip() and cases != 'nan' else 0
    )

def map_case_master(row):
    def parse_dt(dt_str):
        if not dt_str or dt_str.strip() == '' or dt_str == 'nan':
            return None
        try:
            return datetime.strptime(dt_str.strip(), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                return datetime.strptime(dt_str.strip(), "%Y-%m-%d")
            except ValueError:
                return None

    def parse_d(d_str):
        if not d_str or d_str.strip() == '' or d_str == 'nan':
            return None
        try:
            return datetime.strptime(d_str.strip(), "%Y-%m-%d").date()
        except ValueError:
            try:
                return datetime.strptime(d_str.strip(), "%Y-%m-%d %H:%M:%S").date()
            except ValueError:
                return None

    def parse_int(val):
        if not val or val.strip() == '' or val == 'nan':
            return None
        try:
            return int(float(val.strip()))
        except ValueError:
            return None

    def parse_float(val):
        if not val or val.strip() == '' or val == 'nan':
            return 0.0
        try:
            return float(val.strip())
        except ValueError:
            return 0.0

    return CaseMaster(
        CaseMasterID=int(row['CaseMasterID']),
        CrimeNo=int(row['CrimeNo']),
        CaseNo=row['CaseNo'],
        CrimeRegisteredDate=parse_d(row['CrimeRegisteredDate']),
        PolicePersonID=parse_int(row['PolicePersonID']),
        PoliceStationID=parse_int(row['PoliceStationID']),
        CaseCategoryID=parse_int(row['CaseCategoryID']),
        GravityOffenceID=parse_int(row['GravityOffenceID']),
        CrimeMajorHeadID=parse_int(row['CrimeMajorHeadID']),
        CrimeMinorHeadID=parse_int(row['CrimeMinorHeadID']),
        CaseStatusID=parse_int(row['CaseStatusID']),
        CourtID=parse_int(row['CourtID']),
        IncidentFromDate=parse_dt(row['IncidentFromDate']),
        IncidentToDate=parse_dt(row['IncidentToDate']),
        InfoReceivedPSDate=parse_dt(row['InfoReceivedPSDate']),
        latitude=parse_float(row['latitude']),
        longitude=parse_float(row['longitude']),
        BriefFacts=row['BriefFacts'],
        InvestigationPriority="High" if row.get('RiskLabel') == "High" else ("Low" if row.get('RiskLabel') == "Low" else "Medium"),
        AIRiskScore=0.85 if row.get('RiskLabel') == "High" else (0.25 if row.get('RiskLabel') == "Low" else 0.55)
    )

def map_accused(row):
    def parse_int(val):
        if not val or val.strip() == '' or val == 'nan':
            return None
        try:
            return int(float(val.strip()))
        except ValueError:
            return None

    return Accused(
        AccusedMasterID=int(row['AccusedMasterID']),
        CaseMasterID=int(row['CaseMasterID']),
        AccusedName=row['AccusedName'],
        AgeYear=parse_int(row['AgeYear']),
        GenderID=parse_int(row['GenderID']),
        PersonID=parse_int(row['PersonID']),
        Occupation=row['Occupation'],
        Address=row['Address'],
        CriminalProfileID=parse_int(row['CriminalProfileID']),
        GangID=parse_int(row['GangID']),
        IsRepeatOffender=parse_int(row['IsRepeatOffender'])
    )

def map_victim(row):
    def parse_int(val):
        if not val or val.strip() == '' or val == 'nan':
            return None
        try:
            return int(float(val.strip()))
        except ValueError:
            return None

    return Victim(
        VictimMasterID=int(row['VictimMasterID']),
        CaseMasterID=int(row['CaseMasterID']),
        VictimName=row['VictimName'],
        AgeYear=parse_int(row['AgeYear']),
        GenderID=parse_int(row['GenderID']),
        VictimPolice=parse_int(row['VictimPolice']),
        Occupation=row['Occupation'],
        Address=row['Address'],
        InjurySeverity=row['InjurySeverity'],
        RelationshipToAccused=row['RelationshipToAccused'],
        VictimProfileID=parse_int(row['VictimProfileID']),
        IsRepeatVictim=parse_int(row['IsRepeatVictim'])
    )

def map_evidence(row):
    def parse_dt(dt_str):
        if not dt_str or dt_str.strip() == '' or dt_str == 'nan':
            return None
        try:
            return datetime.strptime(dt_str.strip(), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                return datetime.strptime(dt_str.strip(), "%Y-%m-%d")
            except ValueError:
                return None

    return Evidence(
        EvidenceID=int(row['EvidenceID']),
        CaseMasterID=int(row['CaseMasterID']),
        EvidenceType=row['EvidenceType'],
        Description=row['Description'],
        CollectionDate=parse_dt(row['CollectionDate'])
    )

def map_vehicle(row):
    return Vehicle(
        VehicleID=int(row['VehicleID']),
        CaseMasterID=int(row['CaseMasterID']),
        RegistrationNumber=row['RegistrationNumber'],
        VehicleType=row['VehicleType'],
        Make=row['Make'],
        Model=row['Model'],
        Color=row['Color'],
        InvolvementRole=row['InvolvementRole']
    )


def seed_officers(db: Session):
    """
    Seeds the officer table from Officer.csv. Also generates placeholder officer records
    for IDs 586 through 3205 to satisfy foreign key references in CaseMaster.csv.
    """
    if db.query(Officer).first() is not None:
        logger.info("Table 'officer' is already seeded.")
        return

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    candidate_paths = [
        os.path.join(base_dir, "database", "seeds", "data", "Officer.csv"),
        os.path.join(os.path.dirname(base_dir), "database", "seeds", "data", "Officer.csv"),
        "/database/seeds/data/Officer.csv"
    ]
    csv_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            csv_path = p
            break

    if not csv_path:
        logger.warning("Seed file for Officer.csv not found. Skipping.")
        return

    # Query a valid police station and district to use as fallbacks for placeholders
    first_ps = db.query(PoliceStation).first()
    if not first_ps:
        logger.error("Cannot seed officers: police_station table is empty!")
        return

    default_ps_id = first_ps.UnitID
    default_district_id = first_ps.DistrictID

    logger.info(f"Seeding 'officer' from {csv_path}...")
    try:
        objects_to_insert = []
        existing_ids = set()
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                obj = map_officer(row)
                if obj:
                    objects_to_insert.append(obj)
                    existing_ids.add(obj.OfficerID)

        # Generate placeholders for referenced IDs in CaseMaster up to 3205
        placeholders_count = 0
        for officer_id in range(1, 3205):
            if officer_id not in existing_ids:
                placeholder = Officer(
                    OfficerID=officer_id,
                    PoliceStationID=default_ps_id,
                    DistrictID=default_district_id,
                    Name=f"Placeholder Officer #{officer_id}",
                    Gender="Male",
                    Rank="Sub-Inspector",
                    BadgeNumber=f"P-{officer_id}",
                    YearsOfService=5,
                    AssignedCaseCount=0
                )
                objects_to_insert.append(placeholder)
                placeholders_count += 1

        db.bulk_save_objects(objects_to_insert)
        db.commit()
        logger.info(f"Successfully seeded {len(objects_to_insert)} officers ({placeholders_count} placeholders)!")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding 'officer': {e}")


def seed_roles_and_permissions(db: Session):
    """
    Seeds core RBAC roles, permissions, and grants permissions to roles idempotently.
    """
    logger.info("Seeding roles and permissions...")
    try:
        roles_data = [
            ("Admin", "Super Administrator with full statewide scope and access."),
            ("SCRB_Officer", "State Crime Records Bureau officer with statewide read scope."),
            ("SHO", "Station House Officer scoped to police station jurisdiction."),
            ("Constable", "Beat constable scoped to police station jurisdiction."),
            ("ExternalAgencyOfficer", "External agency officer with specialized cross-agency access.")
        ]
        
        role_map = {}
        for name, desc in roles_data:
            role = db.query(Role).filter(Role.RoleName == name).first()
            if not role:
                role = Role(RoleName=name, Description=desc)
                db.add(role)
                db.flush()
            role_map[name] = role

        perms_data = [
            ("cases:read", "Allow reading case file registries."),
            ("cases:create", "Allow registering new crime cases."),
            ("cases:update", "Allow updating existing crime cases."),
            ("cases:delete", "Allow soft deleting crime cases."),
            ("cases:annotate", "Allow writing case journal annotations."),
            ("users:manage", "Allow managing user accounts, roles, and boundaries.")
        ]

        perm_map = {}
        for code, desc in perms_data:
            perm = db.query(Permission).filter(Permission.PermissionCode == code).first()
            if not perm:
                perm = Permission(PermissionCode=code, Description=desc)
                db.add(perm)
                db.flush()
            perm_map[code] = perm

        # Role-Permission Mapping
        mappings = [
            ("SCRB_Officer", ["cases:read"]),
            ("SHO", ["cases:read", "cases:create", "cases:update", "cases:annotate"]),
            ("Constable", ["cases:read", "cases:annotate"]),
            ("Admin", ["cases:read", "cases:create", "cases:update", "cases:delete", "cases:annotate", "users:manage"]),
            ("ExternalAgencyOfficer", ["cases:read"])
        ]

        for r_name, p_codes in mappings:
            r_obj = role_map.get(r_name)
            if r_obj:
                for p_code in p_codes:
                    p_obj = perm_map.get(p_code)
                    if p_obj:
                        exists = db.query(RolePermission).filter(
                            RolePermission.RoleID == r_obj.RoleID,
                            RolePermission.PermissionID == p_obj.PermissionID
                        ).first()
                        if not exists:
                            db.add(RolePermission(RoleID=r_obj.RoleID, PermissionID=p_obj.PermissionID))

        db.commit()
        logger.info("Successfully seeded roles, permissions, and role-permission junctions!")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding roles and permissions: {e}")


def seed_users(db: Session):
    """
    Seeds and permanently updates default officer user accounts dynamically resolving role IDs.
    """
    from app.models.officer import Officer

    roles = {r.RoleName: r.RoleID for r in db.query(Role).all()}

    admin_role_id = roles.get("Admin", 1)
    scrb_role_id = roles.get("SCRB_Officer", 2)
    sho_role_id = roles.get("SHO", 3)
    constable_role_id = roles.get("Constable", 4)
    ext_role_id = roles.get("ExternalAgencyOfficer", 5)

    preset_users = [
        ("ksp_admin", "change_me", "admin@ksp.gov.in", admin_role_id, "System Administrator"),
        ("Bharathvaj", "change_me", "bharathvaj@ksp.gov.in", scrb_role_id, "DGP — Director General of Police"),
        ("ramesh", "change_me", "ramesh@ksp.gov.in", scrb_role_id, "SP — Superintendent of Police"),
        ("dysp_officer", "change_me", "dysp@ksp.gov.in", scrb_role_id, "DySP — Deputy Superintendent of Police"),
        ("pi_officer", "change_me", "pi@ksp.gov.in", sho_role_id, "PI — Police Inspector"),
        ("sho_officer", "change_me", "si@ksp.gov.in", sho_role_id, "PSI — Sub Inspector of Police"),
        ("constable_officer", "change_me", "asi@ksp.gov.in", constable_role_id, "ASI — Assistant Sub Inspector"),
        ("suda", "change_me", "suda@ksp.gov.in", constable_role_id, "PC — Police Constable"),
        ("cbi_sp_verma", "cbi@password2026", "verma@cbi.gov.in", ext_role_id, "SP — Central Bureau of Investigation"),
        ("fsl_dna_sunita", "fsl@password2026", "sunita@fsl.gov.in", ext_role_id, "FSL — Forensic Science Specialist"),
        ("ed_jd_hegde", "ed@password2026", "hegde@ed.gov.in", ext_role_id, "JD — Enforcement Directorate"),
    ]

    logger.info("Seeding and syncing preset officer user accounts...")
    try:
        for username, password, email, role_id, rank_title in preset_users:
            # Create or update Officer record
            badge_code = f"KSP-{username.upper()[:6]}"
            off = db.query(Officer).filter(Officer.Name == username).first()
            if not off:
                off = Officer(BadgeNumber=badge_code, Name=username, Rank=rank_title, AssignedCaseCount=0)
                db.add(off)
                db.commit()
                db.refresh(off)
            else:
                off.Rank = rank_title
                db.commit()

            # Create or permanently update User record
            u = db.query(User).filter(User.Username.ilike(username)).first()
            if not u:
                u = User(
                    Username=username,
                    PasswordHash=hash_password(password),
                    Email=email,
                    OfficerID=off.OfficerID if off else None,
                    RoleID=role_id,
                    IsActive=True
                )
                db.add(u)
            else:
                u.PasswordHash = hash_password(password)
                u.Email = email
                u.RoleID = role_id
                if off:
                    u.OfficerID = off.OfficerID
                u.IsActive = True
        db.commit()
        logger.info("Successfully seeded and permanently updated preset officer user accounts!")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding user accounts: {e}")

def reset_db_sequences(db: Session):
    """
    Resets PostgreSQL auto-increment sequences to MAX(id) + 1 to prevent IntegrityErrors
    after bulk seeding with explicit IDs.
    """
    if db.bind and db.bind.dialect.name == "postgresql":
        logger.info("PostgreSQL dialect active. Resetting auto-increment sequences...")
        seqs = {
            "district_DistrictID_seq": ("district", "DistrictID"),
            "crime_type_CrimeHeadID_seq": ("crime_type", "CrimeHeadID"),
            "roles_RoleID_seq": ("roles", "RoleID"),
            "permissions_PermissionID_seq": ("permissions", "PermissionID"),
            "unit_type_UnitTypeID_seq": ("unit_type", "UnitTypeID"),
            "case_category_CaseCategoryID_seq": ("case_category", "CaseCategoryID"),
            "gravity_offence_GravityOffenceID_seq": ("gravity_offence", "GravityOffenceID"),
            "case_status_master_CaseStatusID_seq": ("case_status_master", "CaseStatusID"),
            "act_ActCode_seq": ("act", "ActCode"),
            "police_station_UnitID_seq": ("police_station", "UnitID"),
            "crime_sub_type_CrimeSubHeadID_seq": ("crime_sub_type", "CrimeSubHeadID"),
            "section_SectionID_seq": ("section", "SectionID"),
            "officer_OfficerID_seq": ("officer", "OfficerID"),
            "users_UserID_seq": ("users", "UserID"),
            "case_master_CaseMasterID_seq": ("case_master", "CaseMasterID"),
            "user_jurisdictions_UserJurisdictionID_seq": ("user_jurisdictions", "UserJurisdictionID"),
            "criminal_relationships_RelationshipID_seq": ("criminal_relationships", "RelationshipID"),
            "audit_log_AuditLogID_seq": ("audit_log", "AuditLogID"),
            "accused_AccusedMasterID_seq": ("accused", "AccusedMasterID"),
            "victim_VictimMasterID_seq": ("victim", "VictimMasterID"),
            "evidence_EvidenceID_seq": ("evidence", "EvidenceID"),
            "vehicle_VehicleID_seq": ("vehicle", "VehicleID"),
            "witness_WitnessMasterID_seq": ("witness", "WitnessMasterID"),
            "case_assignments_CaseAssignmentID_seq": ("case_assignments", "CaseAssignmentID"),
            "case_annotations_AnnotationID_seq": ("case_annotations", "AnnotationID"),
            "case_embedding_EmbeddingID_seq": ("case_embedding", "EmbeddingID")
        }

        from sqlalchemy import text
        try:
            for seq, (table, col) in seqs.items():
                max_val_query = db.execute(text(f'SELECT MAX("{col}") FROM "{table}"'))
                max_val = max_val_query.scalar()
                if max_val is not None:
                    db.execute(text(f'SELECT setval(\'"{seq}"\', {max_val}, true)'))
            db.commit()
            logger.info("Successfully reset all PostgreSQL auto-increment sequences!")
        except Exception as e:
            db.rollback()
            logger.error(f"Error resetting sequences: {e}")
    else:
        logger.info("SQLite dialect active. Auto-increment sequence reset skipped.")


from app.models.court_case import CourtCase

def seed_court_cases(db: Session):
    try:
        if db.query(CourtCase).first() is not None:
            logger.info("Table 'court_cases' is already seeded.")
            return
    except Exception as e:
        logger.warning(f"Could not query 'court_cases' table: {e}")
        db.rollback()
        return

    logger.info("Seeding 'court_cases' table with Karnataka judicial monitoring records...")
    cases = [
        CourtCase(
            CaseNo="KSP-2026-CT-101",
            FIRNo="FIR-2025-0841",
            DistrictName="Bengaluru Urban",
            PoliceStationName="Vidhana Soudha PS",
            CourtName="High Court of Karnataka (Bench 4)",
            JudgeBench="Hon'ble Justice S. N. Patil",
            PublicProsecutor="Adv. K. M. Nataraj",
            DefenseCounsel="Adv. B. V. Acharya",
            TrialStage="Cross Examination of Forensic Witnesses",
            CaseStatus="Under Trial",
            NextHearingDate="2026-08-12",
            OrderNotes="FSL DNA Report marked as Exhibit P-42. Defense requested deferment for cross-examining Cyber Expert.",
            OffenceSummary="Serial Cyber Fraud & Money Laundering under Sec 303(2) BNS & Sec 66D IT Act",
            BNSSections="Sec 303(2) BNS, Sec 318 BNS, Sec 66D IT Act",
            AccusedNames="Ramesh Kumar & 3 Others",
            ComplainantName="State of Karnataka",
            Milestones=[
                {"stage": "FIR & Charge Sheet Submitted", "date": "2025-11-10", "status": "Completed", "note": "Charge Sheet filed under Sec 303(2) BNS & IT Act Sec 66D"},
                {"stage": "Cognizance & Framing of Charges", "date": "2026-01-15", "status": "Completed", "note": "Court framed charges against 4 accused entities"},
                {"stage": "Prosecution Evidence Logging", "date": "2026-04-20", "status": "Completed", "note": "P.W. 1 to P.W. 8 examined; 18 digital exhibits marked"},
                {"stage": "Cross Examination of Forensic Witnesses", "date": "2026-07-20", "status": "In Progress", "note": "FSL DNA Report marked as Exhibit P-42; cross-examination active"}
            ]
        ),
        CourtCase(
            CaseNo="KSP-2025-CT-084",
            FIRNo="FIR-2025-0112",
            DistrictName="Mysuru",
            PoliceStationName="Devaraja PS",
            CourtName="IV Additional City Civil & Sessions Court, Mysuru",
            JudgeBench="Hon'ble Judge R. H. Kalmath",
            PublicProsecutor="Adv. Ramesh Hegde",
            DefenseCounsel="Adv. M. S. Naik",
            TrialStage="Arguments & Final Briefing",
            CaseStatus="Reserved for Orders",
            NextHearingDate="2026-08-05",
            OrderNotes="Arguments concluded by Public Prosecutor. Judgment reserved for August 5, 2026.",
            OffenceSummary="Armed Robbery & Dacoity Conspiracy under Sec 310 BNS & Arms Act",
            BNSSections="Sec 310 BNS, Sec 311 BNS, Arms Act Sec 25",
            AccusedNames="Venkatesh @ Cobra & Gang",
            ComplainantName="State of Karnataka",
            Milestones=[
                {"stage": "Charges Framed", "date": "2025-08-12", "status": "Completed", "note": "Section 310 BNS charges formally framed"},
                {"stage": "Prosecution Evidence Completed", "date": "2026-02-14", "status": "Completed", "note": "22 prosecution witnesses examined"},
                {"stage": "Section 313 CrPC / BNSS Statement", "date": "2026-05-18", "status": "Completed", "note": "Accused statements recorded"},
                {"stage": "Final Arguments Concluded", "date": "2026-07-15", "status": "Completed", "note": "Reserved for Judgment on 2026-08-05"}
            ]
        ),
        CourtCase(
            CaseNo="KSP-2026-CT-209",
            FIRNo="FIR-2026-0045",
            DistrictName="Mangaluru / Dakshina Kannada",
            PoliceStationName="Urwa PS",
            CourtName="District & Sessions Court, Mangaluru",
            JudgeBench="Hon'ble Justice P. V. Bhat",
            PublicProsecutor="Adv. Suresh M.",
            DefenseCounsel="Adv. K. R. Rao",
            TrialStage="Framing of Charges",
            CaseStatus="Under Trial",
            NextHearingDate="2026-08-18",
            OrderNotes="Accused #1 produced via Video Conferencing from Central Jail Hindalga. Charges read over.",
            OffenceSummary="Commercial NDPS Narcotic Contraband Seizure",
            BNSSections="Sec 318 BNS, NDPS Act Sec 20(b)",
            AccusedNames="Mohammed Imran @ Drug Kingpin",
            ComplainantName="State of Karnataka (Narcotics Cell)",
            Milestones=[
                {"stage": "FIR Registered", "date": "2026-01-08", "status": "Completed", "note": "4.2kg Methamphetamine contraband seized"},
                {"stage": "Charge Sheet Filed", "date": "2026-04-02", "status": "Completed", "note": "Submitted with Chemical FSL Report"},
                {"stage": "Framing of Charges", "date": "2026-07-10", "status": "In Progress", "note": "Video conferencing link established with Hindalga Jail"}
            ]
        ),
        CourtCase(
            CaseNo="KSP-2025-CT-312",
            FIRNo="FIR-2025-0552",
            DistrictName="Hubballi-Dharwad",
            PoliceStationName="Suburban PS Hubballi",
            CourtName="III Addl. District Court, Hubballi",
            JudgeBench="Hon'ble Judge A. K. Joshi",
            PublicProsecutor="Adv. S. S. Patil",
            DefenseCounsel="Adv. V. G. Kulkarni",
            TrialStage="Summoning of Defense Witnesses",
            CaseStatus="Under Trial",
            NextHearingDate="2026-08-22",
            OrderNotes="D.W. 1 summons issued. Bail petition of Accused #2 rejected.",
            OffenceSummary="Extortion & Syndicate Organized Crime under BNS",
            BNSSections="Sec 308 BNS, Sec 111 BNS (Organized Crime)",
            AccusedNames="Sharath @ D-Gang Associate & 2 Others",
            ComplainantName="State of Karnataka",
            Milestones=[
                {"stage": "Pre-Trial Conference", "date": "2025-10-04", "status": "Completed", "note": "Evidence admissibility settled"},
                {"stage": "Prosecution Evidence", "date": "2026-03-12", "status": "Completed", "note": "Complainant and IO testimony concluded"},
                {"stage": "Defense Evidence", "date": "2026-07-02", "status": "In Progress", "note": "Summons issued to D.W. 1"}
            ]
        ),
        CourtCase(
            CaseNo="KSP-2026-CT-405",
            FIRNo="FIR-2026-0118",
            DistrictName="Belagavi",
            PoliceStationName="Camp PS Belagavi",
            CourtName="II ACMM Court, Belagavi",
            JudgeBench="Hon'ble Magistrate M. B. Deshpande",
            PublicProsecutor="Adv. B. R. Patil",
            DefenseCounsel="Adv. S. M. Kulkarni",
            TrialStage="Cognizance & Pre-Trial Notice",
            CaseStatus="Under Trial",
            NextHearingDate="2026-08-28",
            OrderNotes="Court took cognizance of BNS Charge Sheet. Summons issued to accused entities.",
            OffenceSummary="High-Value Land Record Forgery & Impersonation",
            BNSSections="Sec 336 BNS, Sec 338 BNS (Forgery)",
            AccusedNames="Basavaraj & Property Syndicate",
            ComplainantName="State of Karnataka",
            Milestones=[
                {"stage": "FIR Registered", "date": "2026-02-14", "status": "Completed", "note": "Fake Revenue Stamps & Land Documents seized"},
                {"stage": "Charge Sheet Submitted", "date": "2026-06-01", "status": "Completed", "note": "Submitted to II ACMM Court"},
                {"stage": "Cognizance Taken", "date": "2026-07-18", "status": "In Progress", "note": "Summons issued for initial appearance"}
            ]
        ),
        CourtCase(
            CaseNo="KSP-2025-CT-518",
            FIRNo="FIR-2025-0922",
            DistrictName="Kalaburagi",
            PoliceStationName="Station Bazaar PS",
            CourtName="Principal District Court, Kalaburagi",
            JudgeBench="Hon'ble Justice G. S. Hiremath",
            PublicProsecutor="Adv. H. G. Rathod",
            DefenseCounsel="Adv. C. M. Biradar",
            TrialStage="Verdict Announced - Conviction Executed",
            CaseStatus="Convicted",
            NextHearingDate="Disposed",
            OrderNotes="Accused #1 & #2 convicted under Sec 303(2) BNS. Sentenced to 7 Years Rigorous Imprisonment with ₹1,00,000 fine each.",
            OffenceSummary="Inter-State Armed Heist & Assault",
            BNSSections="Sec 303(2) BNS, Sec 109 BNS",
            AccusedNames="Santosh @ Gungloo & Anil",
            ComplainantName="State of Karnataka",
            Milestones=[
                {"stage": "Charges Framed", "date": "2025-05-10", "status": "Completed", "note": "Armed Dacoity & Assault charges framed"},
                {"stage": "Trial & Evidence Concluded", "date": "2026-01-20", "status": "Completed", "note": "19 witnesses and 34 exhibits evaluated"},
                {"stage": "Judicial Verdict", "date": "2026-06-30", "status": "Completed", "note": "Guilty Verdict Pronounced - 7 Years RI Executed"}
            ]
        )
    ]
    try:
        db.bulk_save_objects(cases)
        db.commit()
        logger.info(f"Successfully seeded {len(cases)} Court Monitoring cases into database!")
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding court cases: {e}")


# --- Orchestrated Seeding Pipeline ---

def seed_database(db: Session):
    """
    Executes the seeding pipeline in strict topological order to respect foreign key constraints.
    """
    # 1. Independent Master Tables
    seed_table(db, District, "District.csv", map_district)
    seed_table(db, CrimeType, "CrimeType.csv", map_crime_type)
    
    # 2. Level 1 Dependencies
    seed_table(db, PoliceStation, "PoliceStation.csv", map_police_station)
    seed_table(db, CrimeSubType, "CrimeSubType.csv", map_crime_sub_type)
    
    # 3. Level 2 Dependencies (Officer depends on PS & District)
    seed_officers(db)
    
    # 4. CaseMaster (Core Entity)
    seed_table(db, CaseMaster, "CaseMaster.csv", map_case_master)
    
    # 5. Child Entities dependent on CaseMaster
    seed_table(db, Accused, "Accused.csv", map_accused)
    seed_table(db, Victim, "Victim.csv", map_victim)
    seed_table(db, Evidence, "Evidence.csv", map_evidence)
    seed_table(db, Vehicle, "Vehicle.csv", map_vehicle)
    
    # 6. Default Roles & Identity Seeding
    seed_roles_and_permissions(db)
    seed_users(db)
    seed_court_cases(db)

    # 7. Sync Auto-increment Sequences
    reset_db_sequences(db)
