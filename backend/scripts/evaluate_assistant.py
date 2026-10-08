"""Check the chat assistant's answers against ground truth computed by independent SQL.

    python scripts/evaluate_assistant.py

Each case asks a question, computes the right figures directly from the database, and checks that the
answer contains them and does not contain known-wrong figures. Uses the Gemini quota (a few calls per question)."""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import assistant_service  # noqa: E402


def scalar(db, sql, **params):
    return db.execute(text(sql), params).scalar()


def rows(db, sql, **params):
    return db.execute(text(sql), params).fetchall()


OPEN = """case_master."CaseStatusID" IN (SELECT "CaseStatusID" FROM case_status_master
          WHERE lower("CaseStatusName") NOT LIKE 'closed%' AND lower("CaseStatusName") NOT LIKE 'disposed%')"""
IN_DISTRICT = """case_master."PoliceStationID" IN (SELECT "UnitID" FROM police_station
                 WHERE "DistrictID" = (SELECT "DistrictID" FROM district WHERE "DistrictName" = :d))"""
AS_OF = """case_master."CrimeRegisteredDate" <= CURRENT_DATE"""


def build_cases(db):
    districts = rows(db, f"""SELECT d."DistrictName", count(*) c FROM case_master JOIN police_station p ON p."UnitID" = case_master."PoliceStationID"
                            JOIN district d ON d."DistrictID" = p."DistrictID" WHERE {AS_OF} GROUP BY 1 ORDER BY c DESC""")
    top, second = districts[0], districts[1]
    top_name, second_name = top[0], second[0]

    total = scalar(db, f"SELECT count(*) FROM case_master WHERE {IN_DISTRICT} AND {AS_OF}", d=top_name)
    open_ = scalar(db, f"SELECT count(*) FROM case_master WHERE {IN_DISTRICT} AND {OPEN} AND {AS_OF}", d=top_name)
    high = scalar(db, f"""SELECT count(*) FROM case_master WHERE {IN_DISTRICT} AND "AIRiskLevel" IN ('High','Severe') AND {AS_OF}""", d=second_name)
    crime = rows(db, f"""SELECT t."CrimeGroupName", count(*) c FROM case_master JOIN crime_type t ON t."CrimeHeadID" = case_master."CrimeMajorHeadID"
                        WHERE {IN_DISTRICT} AND {AS_OF} GROUP BY 1 ORDER BY c DESC LIMIT 1""", d=second_name)[0]
    year_total = scalar(db, f"""SELECT count(*) FROM case_master WHERE extract(year FROM "CrimeRegisteredDate") = 2024 AND {AS_OF}""")
    case = rows(db, """SELECT m."CaseMasterID", p."UnitName", s."CaseStatusName" FROM case_master m JOIN police_station p ON p."UnitID" = m."PoliceStationID"
                      JOIN case_status_master s ON s."CaseStatusID" = m."CaseStatusID" WHERE m."CaseMasterID" = 4321""")[0]
    ranked = rows(db, """SELECT "AccusedName", count(distinct "CaseMasterID") c FROM accused WHERE "CriminalProfileID" IS NOT NULL
                        GROUP BY "CriminalProfileID", "AccusedName" ORDER BY c DESC""")
    tied_names = [name for name, count in ranked if count == ranked[0][1]]  # several offenders can share the top count
    wrong_total = scalar(db, f"SELECT count(*) FROM case_master WHERE {AS_OF}")

    return [
        {"q": f"How many FIRs are registered in {top_name} and how many of them are still open?",
         "expect": [str(total), str(open_)], "forbid": [f"{wrong_total:,}", str(wrong_total)]},
        {"q": f"How many cases in {second_name} are rated High or Severe by the risk model?", "expect": [str(high)], "forbid": []},
        {"q": f"Which crime type has the most FIRs in {second_name}, and how many?", "expect": [crime[0], str(crime[1])], "forbid": []},
        {"q": "Which district has the most FIRs?", "expect": [top_name, str(top[1])], "forbid": []},
        {"q": "How many FIRs were registered in 2024?", "expect": [str(year_total)], "forbid": []},
        {"q": f"For case {case[0]}, which police station registered it and what is its current status?", "expect": [case[1], case[2]], "forbid": []},
        {"q": "Which repeat offender has the most cases, and how many?", "expect": [str(ranked[0][1])], "expect_any": tied_names, "forbid": []},
        {"q": "Write me a poem about the sea.", "expect": [], "forbid": [], "no_tools": True},
    ]


if __name__ == "__main__":
    db = SessionLocal()
    admin = db.query(User).filter(User.Username == "ksp_admin").first()
    cases = build_cases(db)
    passed = 0
    for case in cases:
        started = time.time()
        try:
            result = assistant_service.run_agent(db, admin, case["q"])
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] {case['q']}\n        {type(exc).__name__}: {getattr(exc, 'detail', exc)}")
            continue
        answer = result["answer"]
        flat = answer.replace(",", "")
        missing = [e for e in case["expect"] if e.replace(",", "") not in flat]
        if case.get("expect_any") and not any(name in answer for name in case["expect_any"]):
            missing.append(f"one of {case['expect_any']}")
        wrong = [f for f in case["forbid"] if f in answer or f in flat]
        tools = [item["tool"] for item in result["tools_used"]]
        ok = not missing and not wrong and (not case.get("no_tools") or not tools)
        passed += ok
        print(f"[{'PASS' if ok else 'FAIL'}] {time.time() - started:4.1f}s {result['model']} tools={tools}\n        Q: {case['q']}")
        if not ok:
            print(f"        missing={missing} wrong={wrong}\n        A: {answer[:400]}")
    print(f"\n{passed}/{len(cases)} answers matched ground truth")
