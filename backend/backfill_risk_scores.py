"""Re-score every case with the current risk model and persist the result.

    python backfill_risk_scores.py
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.migrations import ensure_columns  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.services import risk_service  # noqa: E402


def backfill_all_risk_scores() -> int:
    ensure_columns(engine)
    db = SessionLocal()
    try:
        started = time.time()
        count = risk_service.score_cases(db)
        print(f"Scored {count} cases in {time.time() - started:.1f}s")
        return count
    finally:
        db.close()


if __name__ == "__main__":
    backfill_all_risk_scores()
