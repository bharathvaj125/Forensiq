"""Idempotent repair of seed data the original loader lost or fabricated.

Run against an already-seeded database with:  python scripts/sync_reference_data.py
Needs the seed CSVs (database/seeds/data), so it is a developer/ops step, not part of the
Render container (whose build context is backend/ only).
"""

import csv
import logging
import os
from collections import Counter, defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.bulk import bulk_update as _bulk_update
from app.db.seed_parsing import parse_flag, parse_gender, parse_id_suffix
from app.models.accused import Accused
from app.models.case_master import CaseMaster
from app.models.case_status_master import CaseStatusMaster
from app.models.officer import Officer
from app.models.victim import Victim

logger = logging.getLogger("ksp_backend")

PLACEHOLDER_PREFIX = "Placeholder Officer #"


def find_seed_dir() -> str | None:
    here = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(os.path.dirname(here))
    for base in (backend_dir, os.path.dirname(backend_dir)):
        candidate = os.path.join(base, "database", "seeds", "data")
        if os.path.isdir(candidate):
            return candidate
    return None


def _read(seed_dir: str, name: str) -> list[dict]:
    with open(os.path.join(seed_dir, name), encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def sync_case_status_master(db: Session, seed_dir: str) -> int:
    """Derive CaseStatusID -> name by joining CaseMaster.csv (ids) with CrimeCases_AI.csv (names)."""
    ids = {row["CaseMasterID"]: row["CaseStatusID"] for row in _read(seed_dir, "CaseMaster.csv")}
    votes: dict[int, Counter] = defaultdict(Counter)
    for row in _read(seed_dir, "CrimeCases_AI.csv"):
        status_id = ids.get(row["CaseMasterID"])
        if status_id and row.get("CaseStatusName"):
            votes[int(float(status_id))][row["CaseStatusName"].strip()] += 1

    changed = 0
    for status_id, counter in sorted(votes.items()):
        name = counter.most_common(1)[0][0]
        record = db.get(CaseStatusMaster, status_id)
        if record is None:
            db.add(CaseStatusMaster(CaseStatusID=status_id, CaseStatusName=name))
            changed += 1
        elif record.CaseStatusName != name:
            record.CaseStatusName = name
            changed += 1
    db.commit()
    return changed


def sync_accused_identity(db: Session, seed_dir: str) -> int:
    """Restore gender, criminal-profile, gang and repeat-offender fields dropped by the loader.

    PersonID is set to the numeric criminal-profile id: the CSV's own PersonID column is only the
    accused's slot within a case (A1 = primary accused, A2 = first co-accused, ...), not an identity.
    """
    updates = []
    for row in _read(seed_dir, "Accused.csv"):
        profile = parse_id_suffix(row.get("CriminalProfileID"))
        updates.append({
            "AccusedMasterID": int(row["AccusedMasterID"]),
            "GenderID": parse_gender(row.get("GenderID")),
            "CriminalProfileID": profile,
            "PersonID": profile,
            "GangID": parse_id_suffix(row.get("GangID")),
            "IsRepeatOffender": parse_flag(row.get("IsRepeatOffender")),
        })
    _bulk_update(db, Accused, "AccusedMasterID", "bigint", {
        "GenderID": "int", "CriminalProfileID": "int", "PersonID": "int", "GangID": "int", "IsRepeatOffender": "int",
    }, updates)
    return len(updates)


def sync_victim_fields(db: Session, seed_dir: str) -> int:
    updates = []
    for row in _read(seed_dir, "Victim.csv"):
        updates.append({
            "VictimMasterID": int(row["VictimMasterID"]),
            "GenderID": parse_gender(row.get("GenderID")),
            "VictimProfileID": parse_id_suffix(row.get("VictimProfileID")),
            "IsRepeatVictim": parse_flag(row.get("IsRepeatVictim")),
        })
    _bulk_update(db, Victim, "VictimMasterID", "bigint", {
        "GenderID": "int", "VictimProfileID": "int", "IsRepeatVictim": "int",
    }, updates)
    return len(updates)


def normalise_placeholder_officers(db: Session) -> int:
    """CaseMaster references officer ids missing from Officer.csv; the loader invented rows for them
    (Male, 5 years of service, station 1). Replace the invented attributes with what the data supports:
    the station/district of the cases they investigate and their real case count."""
    placeholders = db.query(Officer).filter(Officer.Name.like(f"{PLACEHOLDER_PREFIX}%")).all()
    if not placeholders:
        return 0

    from app.models.police_station import PoliceStation
    station_district = dict(db.query(PoliceStation.UnitID, PoliceStation.DistrictID).all())
    per_officer: dict[int, Counter] = defaultdict(Counter)
    for officer_id, station_id, count in db.query(
        CaseMaster.PolicePersonID, CaseMaster.PoliceStationID, func.count(CaseMaster.CaseMasterID)
    ).group_by(CaseMaster.PolicePersonID, CaseMaster.PoliceStationID).all():
        if officer_id is not None:
            per_officer[officer_id][station_id] = count

    rows = []
    for officer in placeholders:
        stations = per_officer.get(officer.OfficerID)
        station_id = stations.most_common(1)[0][0] if stations else officer.PoliceStationID
        rows.append({
            "OfficerID": officer.OfficerID,
            "Name": f"Officer #{officer.OfficerID}",
            "Gender": None,
            "Rank": None,
            "YearsOfService": None,
            "BadgeNumber": f"UNLISTED-{officer.OfficerID}",
            "PoliceStationID": station_id,
            "DistrictID": station_district.get(station_id, officer.DistrictID),
            "AssignedCaseCount": sum(stations.values()) if stations else 0,
        })
    _bulk_update(db, Officer, "OfficerID", "int", {
        "Name": "text", "Gender": "text", "Rank": "text", "YearsOfService": "int", "BadgeNumber": "text",
        "PoliceStationID": "int", "DistrictID": "int", "AssignedCaseCount": "int",
    }, rows)
    return len(rows)


def remove_fictional_court_cases(db: Session) -> int:
    """Delete the invented court cases the original seeder inserted (CaseNo 'KSP-<year>-CT-<n>', linked to no FIR)."""
    from app.models.court_case import CourtCase
    removed = db.query(CourtCase).filter(CourtCase.CaseMasterID.is_(None), CourtCase.CaseNo.like("KSP-%-CT-%")).delete(synchronize_session=False)
    db.commit()
    return removed


def purge_generated_notifications(db: Session) -> int:
    """The old notification list inserted an 'Incident Logged: FIR #...' row per recent case for any user with none.
    Those were never events for the user; delete them (real notifications come from assignments and tasks)."""
    from app.models.notification import Notification
    removed = db.query(Notification).filter(Notification.Title.like("Incident Logged: FIR #%")).delete(synchronize_session=False)
    db.commit()
    return removed


def repair_all(db: Session) -> dict:
    seed_dir = find_seed_dir()
    if not seed_dir:
        raise FileNotFoundError("Seed CSV directory (database/seeds/data) not found; run this from the repo checkout.")
    summary = {
        "case_status_rows_changed": sync_case_status_master(db, seed_dir),
        "accused_rows_synced": sync_accused_identity(db, seed_dir),
        "victim_rows_synced": sync_victim_fields(db, seed_dir),
        "placeholder_officers_normalised": normalise_placeholder_officers(db),
        "fictional_court_cases_removed": remove_fictional_court_cases(db),
        "generated_notifications_removed": purge_generated_notifications(db),
    }
    logger.info("Seed data repair: %s", summary)
    return summary
