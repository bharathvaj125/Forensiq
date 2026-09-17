import sys
from datetime import date, datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.case_master import CaseMaster

# Import all models to resolve SQLAlchemy relationships
from app.models.district import District
from app.models.police_station import PoliceStation
from app.models.crime_type import CrimeType
from app.models.crime_sub_type import CrimeSubType
from app.models.officer import Officer
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

def fix_all_case_dates():
    db = SessionLocal()
    try:
        print("Starting timestamp normalization across all CaseMaster records...")
        cases = db.query(CaseMaster).order_by(CaseMaster.CaseMasterID).all()
        print(f"Loaded {len(cases)} cases from PostgreSQL.")

        # Cutoff: 2026-07-20
        max_date = date(2026, 7, 20)
        start_date = date(2022, 1, 1)
        max_days = (max_date - start_date).days # 1662 days

        updated_count = 0
        for c in cases:
            # Deterministic day offset between 0 and 1661 days from 2022-01-01
            day_offset = (c.CaseMasterID * 31 + (c.CrimeNo or 1) * 17) % max_days
            reg_date = start_date + timedelta(days=day_offset)

            # Ensure reg_date does not exceed max_date
            if reg_date > max_date:
                reg_date = max_date

            c.CrimeRegisteredDate = reg_date

            # Calculate IncidentFromDate (12 to 72 hours before reg_date)
            delay_hours = 12 + (c.CaseMasterID * 7) % 60
            reg_dt = datetime.combine(reg_date, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=10)
            inc_from_dt = reg_dt - timedelta(hours=delay_hours)

            # IncidentToDate (2 to 6 hours after IncidentFromDate)
            inc_to_dt = inc_from_dt + timedelta(hours=2 + (c.CaseMasterID % 5))

            # InfoReceivedPSDate (between IncidentToDate and reg_dt)
            info_ps_dt = inc_to_dt + timedelta(hours=1 + (c.CaseMasterID % 4))

            c.IncidentFromDate = inc_from_dt.replace(tzinfo=None)
            c.IncidentToDate = inc_to_dt.replace(tzinfo=None)
            c.InfoReceivedPSDate = info_ps_dt.replace(tzinfo=None)
            updated_count += 1

        db.commit()
        print(f"Successfully normalized timestamps for {updated_count} cases! (All dates capped at July 20, 2026)")

    except Exception as e:
        db.rollback()
        print(f"Error updating case dates: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_all_case_dates()
