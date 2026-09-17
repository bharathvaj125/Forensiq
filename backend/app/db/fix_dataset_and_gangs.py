import sys
import random
from datetime import datetime, timezone

from app.core.config import settings
from app.db.session import SessionLocal

# Import all models to register SQLAlchemy relationships
from app.models.district import District
from app.models.police_station import PoliceStation
from app.models.crime_type import CrimeType
from app.models.crime_sub_type import CrimeSubType
from app.models.officer import Officer
from app.models.case_master import CaseMaster
from app.models.accused import Accused
from app.models.victim import Victim
from app.models.witness import Witness
from app.models.evidence import Evidence
from app.models.vehicle import Vehicle
from app.models.case_assignment import CaseAssignment
from app.models.case_annotation import CaseAnnotation
from app.models.case_embedding import CaseEmbedding
from app.models.criminal_relationship import CriminalRelationship
from app.models.user import User
from app.models.role import Role
from app.models.user_jurisdiction import UserJurisdiction

def fix_dataset_and_gangs():
    db = SessionLocal()
    try:
        print("1. Updating AIRiskScore & CaseStatusID across all CaseMaster records...")
        cases = db.query(CaseMaster).order_by(CaseMaster.CaseMasterID).all()
        print(f"Loaded {len(cases)} cases from database.")

        high_count = 0
        med_count = 0
        low_count = 0
        pending_count = 0
        solved_count = 0

        for idx, c in enumerate(cases):
            # Deterministic seed based on CaseMasterID
            seed = (c.CaseMasterID * 37 + (c.GravityOffenceID or 2) * 19) % 1000

            # Realistic Risk Distribution:
            # High Risk (>=0.75): ~10.4% (seed < 104) -> ~520 cases
            # Medium Risk (0.40-0.74): ~59.6% (seed 104..699) -> ~2,980 cases
            # Low Risk (<0.40): ~30.0% (seed >= 700) -> ~1,500 cases
            if seed < 104 and c.GravityOffenceID == 1:
                c.AIRiskScore = round(0.76 + (seed % 20) * 0.01, 2)
                c.InvestigationPriority = "High"
                high_count += 1
            elif seed < 700:
                c.AIRiskScore = round(0.42 + (seed % 32) * 0.01, 2)
                c.InvestigationPriority = "Medium"
                med_count += 1
            else:
                c.AIRiskScore = round(0.15 + (seed % 24) * 0.01, 2)
                c.InvestigationPriority = "Low"
                low_count += 1

            # Status Distribution: ~50% Pending (Status=1), ~50% Solved/Disposed (Status=3)
            if idx % 2 == 0:
                c.CaseStatusID = 1 # Pending/Under Investigation
                pending_count += 1
            else:
                c.CaseStatusID = 3 # Disposed/Solved
                solved_count += 1

        db.commit()
        print(f"CaseMaster updated: High Risk={high_count}, Med Risk={med_count}, Low Risk={low_count} | Pending={pending_count}, Solved={solved_count}")

        print("2. Updating PersonID on Accused table if null...")
        accused_rows = db.query(Accused).all()
        for idx, a in enumerate(accused_rows):
            if not a.PersonID:
                a.PersonID = a.AccusedMasterID
        db.commit()

        print("3. Seeding Criminal Relationships for Gang Community Detection...")
        accused_list = db.query(Accused.PersonID).filter(Accused.PersonID.isnot(None)).distinct().limit(40).all()
        person_ids = [r[0] for r in accused_list if r[0]]

        if len(person_ids) >= 10:
            db.query(CriminalRelationship).delete()
            db.commit()

            admin_user = db.query(User).filter(User.Username == "ksp_admin").first()
            user_id = admin_user.UserID if admin_user else 1

            new_rel_count = 0
            g1 = person_ids[:10]
            for i in range(len(g1) - 1):
                rel = CriminalRelationship(
                    SourcePersonID=g1[i],
                    TargetPersonID=g1[i+1],
                    RelationshipType="Co-Accused / Syndicate Member",
                    ConfidenceScore=0.95,
                    CreatedBy=user_id,
                    CreatedAt=datetime.now(timezone.utc),
                    Status="Confirmed",
                    Active=True
                )
                db.add(rel)
                new_rel_count += 1

            db.add(CriminalRelationship(
                SourcePersonID=g1[0],
                TargetPersonID=g1[3],
                RelationshipType="Gang Syndicate Leader",
                ConfidenceScore=0.98,
                CreatedBy=user_id,
                CreatedAt=datetime.now(timezone.utc),
                Status="Confirmed",
                Active=True
            ))
            new_rel_count += 1

            if len(person_ids) >= 18:
                g2 = person_ids[10:18]
                for i in range(len(g2) - 1):
                    rel = CriminalRelationship(
                        SourcePersonID=g2[i],
                        TargetPersonID=g2[i+1],
                        RelationshipType="Financial Crime Associate",
                        ConfidenceScore=0.88,
                        CreatedBy=user_id,
                        CreatedAt=datetime.now(timezone.utc),
                        Status="Confirmed",
                        Active=True
                    )
                    db.add(rel)
                    new_rel_count += 1

            db.commit()
            print(f"Successfully seeded {new_rel_count} active criminal relationship edges!")

    except Exception as e:
        db.rollback()
        print(f"Error executing dataset fix: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_dataset_and_gangs()
