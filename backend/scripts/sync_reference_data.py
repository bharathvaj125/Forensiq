"""Repair already-seeded data from the seed CSVs. Safe to re-run.

    export DATABASE_URL=...   (otherwise falls back to the local SQLite file)
    python scripts/sync_reference_data.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import Base  # noqa: E402
from app.db.data_repair import repair_all  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        print(repair_all(session))
    finally:
        session.close()
