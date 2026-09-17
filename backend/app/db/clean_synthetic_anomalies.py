"""
PostgreSQL Dataset Behavioral Realism & Contradiction Sanitizer.
Cleans all 5,000 cases, accused, and victims to enforce realistic age, crime head, and brief facts alignment.
"""

from app.db.session import SessionLocal
from app.models.case_master import CaseMaster
from app.models.accused import Accused
from app.models.victim import Victim


REALISTIC_FACTS = {
    1: "The accused engaged in a physical altercation following a personal dispute, causing bodily injuries near a public location.",
    2: "The accused trespassed into a premises during late evening hours and committed theft of property and valuables.",
    3: "The accused subjected the complainant to persistent verbal harassment and intimidation near a public transit area.",
    4: "Offence registered under POCSO Act regarding harassment of a minor complainant near school premises.",
    7: "The accused created unauthorized online profiles to extort money and harass the victim through digital channels.",
    8: "The accused was intercepted transporting illegal narcotic substances in a concealed vehicle during a precinct checkpoint.",
    9: "The accused organized an unlawful assembly and created public order disturbances near a precinct boundary.",
    11: "Offence registered regarding property harassment and financial extortion targeted at a senior citizen resident.",
    12: "The accused operated a vehicle in a rash and negligent manner, endangering public safety on a primary road.",
    13: "The accused was intercepted transporting illicit liquor across district border checkpoints without valid permits."
}


def clean_dataset():
    db = SessionLocal()
    try:
        print("Starting PostgreSQL dataset contradiction cleaning...")
        cases = db.query(CaseMaster).all()
        cases_dict = {c.CaseMasterID: c for c in cases}

        accused_list = db.query(Accused).all()
        victims_list = db.query(Victim).all()

        fixed_pocso_count = 0
        fixed_senior_count = 0
        fixed_traffic_count = 0
        realigned_facts_count = 0

        # 1. Clean Accused & Victim age contradictions
        for acc in accused_list:
            c = cases_dict.get(acc.CaseMasterID)
            if not c:
                continue

            # Case A: Senior Citizen (Age >= 60) listed in POCSO / Minor cases (CrimeMajorHeadID == 4)
            if acc.AgeYear and acc.AgeYear >= 60 and c.CrimeMajorHeadID == 4:
                c.CrimeMajorHeadID = 11  # Reassign to Senior Citizen / Public Order
                c.BriefFacts = REALISTIC_FACTS[11]
                fixed_pocso_count += 1

            # Case B: Senior Citizen (Age >= 60) listed doing youth crimes (Footboard travel / stunt riding)
            if acc.AgeYear and acc.AgeYear >= 60 and c.BriefFacts and ("footboard" in c.BriefFacts.lower() or "stunt" in c.BriefFacts.lower()):
                acc.AgeYear = 22  # Reassign age to young adult
                c.CrimeMajorHeadID = 12  # Traffic offence
                c.BriefFacts = "The accused engaged in dangerous footboard travel on a public transport bus, causing public nuisance."
                fixed_traffic_count += 1

            # Case C: Senior Citizen in general cases (Ensure proper CrimeMajorHeadID = 11 if victim is senior)
            if acc.AgeYear and acc.AgeYear >= 60 and c.CrimeMajorHeadID not in [1, 2, 7, 8, 11, 13]:
                c.CrimeMajorHeadID = 11
                c.BriefFacts = REALISTIC_FACTS[11]
                fixed_senior_count += 1

        # 2. Clean Victim Age for POCSO Cases (CrimeMajorHeadID == 4)
        for vic in victims_list:
            c = cases_dict.get(vic.CaseMasterID)
            if not c:
                continue

            if c.CrimeMajorHeadID == 4:
                # Ensure victim age is a minor (14 - 16 yrs old)
                if not vic.AgeYear or vic.AgeYear >= 18:
                    vic.AgeYear = 15
                    c.BriefFacts = REALISTIC_FACTS[4]
                    fixed_pocso_count += 1

            # If victim is Senior Citizen (Age >= 60)
            if vic.AgeYear and vic.AgeYear >= 60:
                if c.CrimeMajorHeadID == 4:
                    c.CrimeMajorHeadID = 11
                    c.BriefFacts = REALISTIC_FACTS[11]

        # 3. Synchronize BriefFacts for all 5,000 cases to match CrimeMajorHeadID cleanly
        for c in cases:
            head_id = c.CrimeMajorHeadID or 2
            if head_id in REALISTIC_FACTS:
                # If facts are empty or contain contradictory phrases like "grandmother footboard"
                if not c.BriefFacts or "footboard" in c.BriefFacts.lower() or "mother-in-law" in c.BriefFacts.lower():
                    c.BriefFacts = REALISTIC_FACTS.get(head_id, REALISTIC_FACTS[2])
                    realigned_facts_count += 1

        db.commit()
        print(f"Successfully cleaned PostgreSQL dataset!")
        print(f"Fixed POCSO age contradictions: {fixed_pocso_count}")
        print(f"Fixed Senior footboard/youth contradictions: {fixed_traffic_count}")
        print(f"Fixed Senior citizen category alignments: {fixed_senior_count}")
        print(f"Re-aligned BriefFacts: {realigned_facts_count}")

    except Exception as e:
        db.rollback()
        print("Error cleaning dataset:", e)
    finally:
        db.close()


if __name__ == "__main__":
    clean_dataset()
