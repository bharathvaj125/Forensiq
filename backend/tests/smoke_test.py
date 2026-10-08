"""End-to-end smoke test of a running Forensiq API. Read-only: it never writes data.

    python tests/smoke_test.py                                   # local backend
    python tests/smoke_test.py https://host/api/v1 --llm         # also exercise the chatbot (uses Gemini quota)

Credentials come from SMOKE_USER / SMOKE_PASSWORD (defaults: the seeded demo admin). Exit code 1 if anything fails.
Besides status codes it checks invariants that would have caught the original silent failures: no placeholder
numbers, internally consistent counts, scores in range, and model-backed features that really are model-backed."""

import os
import sys
import time

import httpx

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = ARGS[0] if ARGS else "http://127.0.0.1:8000/api/v1"
WITH_LLM = "--llm" in sys.argv
USER = os.getenv("SMOKE_USER", "ksp_admin")
PASSWORD = os.getenv("SMOKE_PASSWORD", "change_me")

results: list[tuple[str, bool, str]] = []
client = httpx.Client(timeout=180)


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, bool(ok), detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name:<52} {detail}")
    return bool(ok)


def get(path: str, headers=None, **kw):
    started = time.time()
    try:
        response = client.get(BASE + path, headers=headers, **kw)
    except Exception as exc:  # noqa: BLE001
        check(f"GET {path}", False, f"{type(exc).__name__}: {exc}")
        return None
    elapsed = time.time() - started
    if response.status_code != 200:
        check(f"GET {path}", False, f"HTTP {response.status_code} {response.text[:150]!r}")
        return None
    response.elapsed_seconds = elapsed  # type: ignore[attr-defined]
    return response


def main() -> int:
    health = client.get(BASE.replace("/api/v1", "") + "/health").json()
    check("health: database reachable, not on fallback", health.get("status") == "online" and health.get("database") == "healthy",
          f"{health}")

    login = client.post(BASE + "/auth/login", json={"Username": USER, "Password": PASSWORD})
    if not check("auth: login", login.status_code == 200, f"HTTP {login.status_code}"):
        return 1
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    check("auth: wrong password rejected", client.post(BASE + "/auth/login", json={"Username": USER, "Password": "x"}).status_code == 401)
    check("auth: missing / bad / query-string token rejected",
          client.get(BASE + "/cases").status_code == 401 and client.get(BASE + "/cases", headers={"Authorization": "Bearer junk"}).status_code == 401
          and client.get(BASE + f"/cases?token={login.json()['access_token']}").status_code == 401)
    me = get("/auth/me", headers).json()
    check("auth: /me lists permissions", me.get("Username") == USER and "cases:read" in me.get("Permissions", []), f"{len(me.get('Permissions', []))} permissions")

    # ---- cases
    listing = get("/cases?page=1&page_size=5", headers).json()
    case = listing["data"][0]
    case_id = case["CaseMasterID"]
    check("cases: list returns scored cases", case.get("AIRiskScore") is not None and case.get("AIRiskLevel") in ("Low", "Medium", "High", "Severe"),
          f"id={case_id} score={case.get('AIRiskScore')} level={case.get('AIRiskLevel')}")
    for sub in ("accused", "victims", "evidence", "vehicles", "witnesses"):
        r = get(f"/cases/{case_id}/{sub}", headers)
        check(f"cases: /{sub}", r is not None and isinstance(r.json(), list), f"n={len(r.json()) if r else '-'}")
    statuses = get("/cases/districts-and-stations", headers)
    check("cases: districts and stations", statuses is not None and len(statuses.json()) > 0, f"districts={len(statuses.json()) if statuses else 0}")

    # ---- models
    risk = get(f"/intelligence/cases/{case_id}/predict", headers).json()
    check("risk: score in [0,1] with explanation", 0 <= risk["AIRiskScore"] <= 1 and len(risk["TopRiskFactors"]) >= 5 and risk.get("ModelVersion"),
          f"{risk['AIRiskScore']} {risk['RiskLevel']} {risk.get('ModelVersion')}")
    check("risk: class probabilities sum to 1", abs(sum(risk["ClassProbabilities"].values()) - 1) < 0.01)
    card = get("/intelligence/risk-model", headers).json()
    check("risk: model card reports cross-validated metrics", card["cross_validation"]["accuracy"] > card["majority_class_accuracy"],
          f"acc={card['cross_validation']['accuracy']} baseline={card['majority_class_accuracy']}")
    anomalies = get("/intelligence/anomalies", headers).json()
    check("anomalies: robust z-score over all cases", anomalies["CasesAnalysed"] > 1000 and all(f["ZScore"] >= anomalies["Cutoff"] for f in anomalies["Findings"]),
          f"{len(anomalies['Findings'])} flagged of {anomalies['CasesAnalysed']}")
    forecast = get("/intelligence/forecast/crime-trend?horizon_days=14", headers).json()
    check("forecast: 14 points", len(forecast["points"]) == 14, forecast["trend"])
    accused = get(f"/cases/{case_id}/accused", headers).json()
    profiled = None
    for item in get("/network/gangs", headers).json()["Communities"][:1]:
        check("gangs: networks of linked repeat offenders", item["Size"] >= 3 and item["LeaderName"], f"size={item['Size']} leader={item['LeaderName']}")
    gangs = get("/network/gangs", headers).json()
    check("gangs: at least one network", len(gangs["Communities"]) > 0, f"{len(gangs['Communities'])} networks")
    similar = get(f"/intelligence/cases/{case_id}/similar", headers)
    check("similar cases: pgvector search runs", similar is not None, f"matches={len(similar.json()['Matches']) if similar else '-'}")
    del accused, profiled

    # ---- map / network
    hot = get("/hotspot", headers).json()
    check("hotspot: geocoded points", hot["total_points"] > 0, f"{hot['total_points']}")
    predicted = get("/hotspot/predicted", headers).json()
    check("hotspot: KDE hotspots have evidence", len(predicted["hotspots"]) > 0 and all(h["top_factors"] for h in predicted["hotspots"]), f"{len(predicted['hotspots'])}")
    graph = get("/network/graph", headers).json()
    risk_values = {n["risk_score"] for n in graph["nodes"] if n["node_type"] == "Person" and n["risk_score"] is not None}
    check("network graph: nodes derived from data (varied risk values)", graph["total_nodes"] > 50 and len(risk_values) > 5,
          f"nodes={graph['total_nodes']} edges={graph['total_edges']} distinct person risks={len(risk_values)}")

    # ---- predictive module (previously static)
    dash = get("/predictive/dashboard", headers).json()
    hourly_total = sum(h["count"] for h in dash["hourly_distribution"])
    check("predictive: counts consistent", hourly_total <= dash["total_cases_analyzed"] and dash["total_cases_analyzed"] > 1000,
          f"cases={dash['total_cases_analyzed']} hourly={hourly_total}")
    check("predictive: forecast is model-based", dash["forecast_trend"] and dash["predicted_30day_cases"] > 0 and dash["forecast_backtest_accuracy"] is not None,
          f"{dash['predicted_30day_cases']} FIRs, backtest {dash['forecast_backtest_accuracy']}")
    texts = " ".join(x["prediction"] + x["why_explanation"] for x in dash["xai_explanations"])
    check("predictive: no placeholder figures", "210" not in texts and "4.8%" not in texts and dash["growth_rate_pct"] != 4.8, f"growth={dash['growth_rate_pct']}")
    hotspots = get("/predictive/hotspots", headers).json()
    check("predictive: hotspots from case data", hotspots["total_hotspots"] > 0 and all(h["case_count"] > 0 for h in hotspots["hotspots"]),
          f"top={hotspots['hotspots'][0]['location_name']} n={hotspots['hotspots'][0]['case_count']}")
    patrol = get("/predictive/patrol-strategy", headers).json()
    check("predictive: patrol plan states its basis", "Rule-based allocation" in patrol["reasoning"] and len(patrol["patrol_route"]) > 0, patrol["suggested_timing"])
    warnings = get("/predictive/early-warnings", headers).json()
    check("predictive: early warnings are computed", warnings["active_alerts_count"] == len(warnings["alerts"]),
          f"{warnings['active_alerts_count']} alerts: {[a['alert_type'] for a in warnings['alerts']]}")
    station = get("/cases/station-command-center", headers).json()
    check("station center: tallies only", station["kpis"]["total_firs"] > 0 and "active_warrants" not in station["kpis"] and "patrol_units" not in station,
          f"open={station['kpis']['active_firs']}")

    # ---- court
    court = get("/court/cases?limit=20", headers).json()
    check("court: real FIRs in court stages", court["total"] > 0 and all(i["CaseMasterID"] and i["TrialStage"] for i in court["items"]),
          f"total={court['total']} stages={court['stage_counts']}")
    trial = get("/court/cases?stage=trial&limit=5", headers).json()
    check("court: stage filter", trial["total"] > 0 and all(i["RecordedStatus"] == "Pending Trial" for i in trial["items"]), f"{trial['total']}")

    # ---- reports, admin, misc
    csv = get("/reports/export/csv", headers)
    check("reports: CSV export fast and complete", csv is not None and csv.text.count("\n") > 1000 and csv.elapsed_seconds < 60,
          f"{csv.text.count(chr(10)) if csv else 0} rows in {getattr(csv, 'elapsed_seconds', 0):.1f}s")
    get("/reports/history", headers)
    get(f"/reports/cases/{case_id}/summary", headers)
    for path in ("/admin/users", "/officers", "/audit", "/notifications", "/collaboration/agencies", "/collaboration/requests",
                 "/tasks/assigned-to-me", "/tasks/subordinate-officers"):
        r = get(path, headers)
        check(f"GET {path}", r is not None, f"n={len(r.json()) if r is not None and isinstance(r.json(), list) else '-'}")
    search = get("/search?q=Police", headers)
    check("search: finds cases", search is not None and len(search.json()["cases"]) > 0)

    # ---- reference data, map layers, case chronology, admin, assistant status (all previously hardcoded in the UI)
    options = get("/reference/options", headers).json()
    check("reference: districts, stations, crime types, statuses come from the database",
          len(options["districts"]) > 20 and len(options["stations"]) > 100 and len(options["crime_heads"]) >= 10 and len(options["case_statuses"]) >= 5,
          f"{len(options['districts'])} districts, {len(options['stations'])} stations, {len(options['crime_heads'])} crime types")
    layers = get("/hotspot/layers", headers).json()
    check("map layers: stations and districts positioned from FIR coordinates", len(layers["stations"]) > 100 and layers["bounds"] is not None,
          f"{len(layers['stations'])} stations, {layers['geocoded_cases']} geocoded FIRs")
    hotspots_all = get("/hotspot/predicted", headers).json()["hotspots"]
    shared = sum(h["case_count"] for h in hotspots_all)
    check("hotspots do not overlap (no FIR counted twice)", len({h["location_name"] + str(h["latitude"]) for h in hotspots_all}) == len(hotspots_all) and shared <= layers["geocoded_cases"],
          f"{len(hotspots_all)} hotspots hold {shared} of {layers['geocoded_cases']} FIRs")
    timeline = get(f"/cases/{case_id}/timeline", headers).json()
    check("case timeline: dated events in order", len(timeline["events"]) >= 3 and [e["at"] for e in timeline["events"]] == sorted(e["at"] for e in timeline["events"]),
          f"{len(timeline['events'])} events")
    roles = get("/admin/roles", headers).json()
    check("admin: roles list their permissions and holders", any(r["RoleName"] == "Admin" and "users:manage" in r["Permissions"] for r in roles), f"{len(roles)} roles")
    health = get("/admin/system-health", headers).json()
    check("admin: system health read from the database", health["database"]["dialect"] == "postgresql" and any(t["table_name"] == "case_master" and t["row_count"] > 1000 for t in health["tables"]),
          f"{len(health['tables'])} tables, {health['scoring']['scored_with_current_model']}/{health['scoring']['cases']} cases scored")
    status = get("/assistant/status", headers).json()
    check("assistant status: real case count", status["cases_in_scope"] > 1000, f"{status['cases_in_scope']} FIRs, available={status['available']}")
    invalid = client.post(BASE + "/cases", headers=headers, json={"PoliceStationID": 19, "CrimeMajorHeadID": 2, "CrimeMinorHeadID": 5, "CaseCategoryID": 1,
                                                                 "GravityOffenceID": 2, "IncidentFromDate": "2999-01-01T10:00:00", "latitude": 15.8,
                                                                 "longitude": 74.4, "BriefFacts": "an incident dated far in the future must be refused"})
    check("FIR registration refuses a future incident", invalid.status_code == 422, f"HTTP {invalid.status_code}")
    unauth = client.get(BASE + "/reports/jobs/1/download")
    check("report download requires login", unauth.status_code in (401, 403), f"HTTP {unauth.status_code}")

    # ---- chatbot (optional: uses quota)
    if WITH_LLM:
        r = client.post(BASE + "/assistant/query", headers=headers, json={"query": "How many FIRs are registered in total?"})
        ok = r.status_code == 200 and r.json()["answer"] and r.json()["tools_used"]
        check("assistant: answers using database tools", ok, f"HTTP {r.status_code} model={r.json().get('model_version') if r.status_code == 200 else r.text[:120]}")
        r = client.post(BASE + "/predictive/assistant-query", headers=headers, json={"query": "Which district needs the most attention?"})
        check("command-centre chat: grounded answer", r.status_code == 200 and r.json()["supporting_data"]["tool_results"], f"HTTP {r.status_code}")

    failed = [name for name, ok, _ in results if not ok]
    print(f"\n===== {len(results) - len(failed)}/{len(results)} passed against {BASE} =====")
    for name in failed:
        print("FAILED:", name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
