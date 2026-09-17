import sys
import os
import time

sys.path.insert(0, os.path.abspath("backend"))

from app.db.session import SessionLocal
from app.models.case_master import CaseMaster
from app.services.intelligence_service import predict_case_risk
from app.models.user import User

def backfill_all_risk_scores(batch_size: int = 500):
    print("\n========================================================")
    print("      AI RISK SCORE DATABASE BATCH REFRESH              ")
    print("========================================================\n")

    db = SessionLocal()
    try:
        dummy_admin = db.query(User).filter(User.UserID == 1).first()
        if not dummy_admin:
            dummy_admin = User(UserID=1, Username="ksp_admin", IsActive=True)

        total_cases = db.query(CaseMaster).count()
        seed_cases = db.query(CaseMaster).filter(CaseMaster.AIRiskScore == 0.55).all()
        print(f"Total Database Cases: {total_cases}")
        print(f"Cases requiring prediction refresh (AIRiskScore == 0.55): {len(seed_cases)}")

        updated_count = 0
        t0 = time.time()

        for case in seed_cases:
            res = predict_case_risk(db, case, dummy_admin)
            new_score = res.get("score")
            if new_score is not None:
                case.AIRiskScore = new_score
                updated_count += 1

            if updated_count % 100 == 0:
                db.commit()
                print(f"  Processed {updated_count}/{len(seed_cases)} cases...")

        db.commit()
        elapsed = time.time() - t0
        print(f"\n[SUCCESS] Successfully backfilled {updated_count} cases with genuine ML RandomForest scores in {elapsed:.2f}s!")

        # Post-backfill verification
        distinct_scores = db.query(CaseMaster.AIRiskScore).distinct().count()
        print(f"Post-backfill distinct AIRiskScore count: {distinct_scores}")

        sample_cases = db.query(CaseMaster.CaseMasterID, CaseMaster.CaseNo, CaseMaster.AIRiskScore, CaseMaster.GravityOffenceID).limit(10).all()
        print("\nUpdated Sample Scores:")
        for c in sample_cases:
            print(f"  Case #{c.CaseMasterID} | AIRiskScore: {c.AIRiskScore} | Gravity: {c.GravityOffenceID}")

    finally:
        db.close()

if __name__ == "__main__":
    backfill_all_risk_scores()
