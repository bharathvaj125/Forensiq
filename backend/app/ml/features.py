"""Feature engineering shared by training (seed CSVs) and inference (database rows).

Both paths build the same columns from the same definitions, so a model trained on the seed data
sees identical features when it scores a live case.
"""

from __future__ import annotations

import os
from datetime import datetime, time

import pandas as pd

# GravityOffenceID 1 is "Heinous" in the dataset (1,762 cases in CaseMaster == 1,762 "Heinous" in CrimeCases_AI).
HEINOUS_GRAVITY_ID = 1

RISK_FEATURES = [
    "IsHeinous",
    "ReportingDelayHours",
    "NumberOfAccused",
    "NumberOfVictims",
    "NumberOfEvidenceItems",
    "NumberOfVehicles",
    "IncidentHour",
    "IncidentWeekday",
    "HasRepeatAccused",
    "CrimeMajorHeadID",
    "CrimeMinorHeadID",
    "CaseCategoryID",
]

FEATURE_LABELS = {
    "IsHeinous": "Heinous offence classification",
    "ReportingDelayHours": "Reporting delay (hours)",
    "NumberOfAccused": "Number of accused",
    "NumberOfVictims": "Number of victims",
    "NumberOfEvidenceItems": "Evidence items",
    "NumberOfVehicles": "Vehicles involved",
    "IncidentHour": "Hour of incident",
    "IncidentWeekday": "Day of week of incident",
    "HasRepeatAccused": "Repeat offender among accused",
    "CrimeMajorHeadID": "Crime category",
    "CrimeMinorHeadID": "Crime sub-category",
    "CaseCategoryID": "Case category",
}

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def reporting_delay_hours(incident_from, info_received=None, registered=None) -> float:
    """Hours between the incident and the police receiving the information (same definition as the dataset)."""
    if incident_from is None:
        return 0.0
    end = info_received
    if end is None and registered is not None:
        end = datetime.combine(registered, time.min)
    if end is None:
        return 0.0
    return max(0.0, (end - incident_from).total_seconds() / 3600.0)


def _count_by_case(db, model, ids):
    from sqlalchemy import func
    query = db.query(model.CaseMasterID, func.count()).group_by(model.CaseMasterID)
    if ids is not None:
        counts: dict[int, int] = {}
        for start in range(0, len(ids), 800):
            chunk = ids[start:start + 800]
            for case_id, total in query.filter(model.CaseMasterID.in_(chunk)).all():
                counts[case_id] = total
        return counts
    return {case_id: total for case_id, total in query.all()}


def case_feature_frame(db, cases=None) -> pd.DataFrame:
    """Risk-model features for the given CaseMaster rows (all cases when `cases` is None), indexed by CaseMasterID."""
    from app.models.accused import Accused
    from app.models.case_master import CaseMaster
    from app.models.evidence import Evidence
    from app.models.vehicle import Vehicle
    from app.models.victim import Victim

    if cases is None:
        cases = db.query(CaseMaster).all()
        ids = None
    else:
        cases = list(cases)
        ids = [case.CaseMasterID for case in cases]
        if not ids:
            return pd.DataFrame(columns=RISK_FEATURES)
        if len(ids) > 1500:
            ids = None  # large batches: one grouped query per table is cheaper than many chunked IN-queries

    accused = _count_by_case(db, Accused, ids)
    victims = _count_by_case(db, Victim, ids)
    evidence = _count_by_case(db, Evidence, ids)
    vehicles = _count_by_case(db, Vehicle, ids)

    repeat_query = db.query(Accused.CaseMasterID).filter(Accused.IsRepeatOffender == 1).distinct()
    repeat_cases: set[int] = set()
    if ids is None:
        repeat_cases = {row[0] for row in repeat_query.all()}
    else:
        for start in range(0, len(ids), 800):
            repeat_cases |= {row[0] for row in repeat_query.filter(Accused.CaseMasterID.in_(ids[start:start + 800])).all()}

    rows = []
    for case in cases:
        incident = case.IncidentFromDate
        rows.append({
            "CaseMasterID": case.CaseMasterID,
            "IsHeinous": int(case.GravityOffenceID == HEINOUS_GRAVITY_ID),
            "ReportingDelayHours": reporting_delay_hours(incident, case.InfoReceivedPSDate, case.CrimeRegisteredDate),
            "NumberOfAccused": accused.get(case.CaseMasterID, 0),
            "NumberOfVictims": victims.get(case.CaseMasterID, 0),
            "NumberOfEvidenceItems": evidence.get(case.CaseMasterID, 0),
            "NumberOfVehicles": vehicles.get(case.CaseMasterID, 0),
            "IncidentHour": incident.hour if incident else -1,
            "IncidentWeekday": incident.weekday() if incident else -1,
            "HasRepeatAccused": int(case.CaseMasterID in repeat_cases),
            "CrimeMajorHeadID": case.CrimeMajorHeadID or 0,
            "CrimeMinorHeadID": case.CrimeMinorHeadID or 0,
            "CaseCategoryID": case.CaseCategoryID or 0,
        })
    frame = pd.DataFrame(rows).set_index("CaseMasterID")
    return frame[RISK_FEATURES]


# ---------------------------------------------------------------- seed CSV path (training / evaluation)

def load_seed_tables(seed_dir: str) -> dict[str, pd.DataFrame]:
    def read(name):
        return pd.read_csv(os.path.join(seed_dir, name))
    return {
        "cases": read("CaseMaster.csv"),
        "ai": read("CrimeCases_AI.csv"),
        "accused": read("Accused.csv"),
        "victims": read("Victim.csv"),
        "evidence": read("Evidence.csv"),
        "vehicles": read("Vehicle.csv"),
    }


def seed_feature_frame(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """The same RISK_FEATURES as case_feature_frame, computed from the seed CSVs. Indexed by CaseMasterID."""
    cases = tables["cases"].copy()
    incident = pd.to_datetime(cases["IncidentFromDate"])
    received = pd.to_datetime(cases["InfoReceivedPSDate"])
    registered = pd.to_datetime(cases["CrimeRegisteredDate"])
    end = received.fillna(registered)
    delay = ((end - incident).dt.total_seconds() / 3600.0).clip(lower=0).fillna(0.0)

    def per_case(table, column=None, agg="size"):
        grouped = tables[table].groupby("CaseMasterID")
        return grouped.size() if agg == "size" else grouped[column].agg(agg)

    repeat = tables["accused"].assign(_r=tables["accused"]["IsRepeatOffender"].astype(str).str.lower().isin(["true", "1"]))
    repeat_cases = set(repeat.loc[repeat["_r"], "CaseMasterID"])

    frame = pd.DataFrame({
        "CaseMasterID": cases["CaseMasterID"],
        "IsHeinous": (cases["GravityOffenceID"] == HEINOUS_GRAVITY_ID).astype(int),
        "ReportingDelayHours": delay.values,
        "NumberOfAccused": cases["CaseMasterID"].map(per_case("accused")).fillna(0).astype(int),
        "NumberOfVictims": cases["CaseMasterID"].map(per_case("victims")).fillna(0).astype(int),
        "NumberOfEvidenceItems": cases["CaseMasterID"].map(per_case("evidence")).fillna(0).astype(int),
        "NumberOfVehicles": cases["CaseMasterID"].map(per_case("vehicles")).fillna(0).astype(int),
        "IncidentHour": incident.dt.hour.fillna(-1).astype(int).values,
        "IncidentWeekday": incident.dt.weekday.fillna(-1).astype(int).values,
        "HasRepeatAccused": cases["CaseMasterID"].isin(repeat_cases).astype(int),
        "CrimeMajorHeadID": cases["CrimeMajorHeadID"].fillna(0).astype(int),
        "CrimeMinorHeadID": cases["CrimeMinorHeadID"].fillna(0).astype(int),
        "CaseCategoryID": cases["CaseCategoryID"].fillna(0).astype(int),
    })
    return frame.set_index("CaseMasterID")[RISK_FEATURES]


def seed_risk_labels(tables: dict[str, pd.DataFrame]) -> pd.Series:
    """Ground-truth RiskLabel (Low / Medium / High / Severe) indexed by CaseMasterID."""
    return tables["ai"].set_index("CaseMasterID")["RiskLabel"]
