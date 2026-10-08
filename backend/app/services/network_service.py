"""Criminal-network analysis: gang communities and the investigation link graph.

Everything shown is derived from case records: identities come from recorded criminal profiles,
link strengths from the amount of supporting evidence, risk values from the risk model, and
communities from greedy-modularity detection over those links."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Dict, List, Optional

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.middleware.jurisdiction_scope import apply_jurisdiction_filter
from app.ml.models.network_gang.community_detection import detect_communities
from app.ml.models.network_gang.links import build_edges, person_id
from app.ml.models.repeat_offender.linkage import address_district
from app.models.accused import Accused
from app.models.case_master import CaseMaster
from app.models.criminal_relationship import CriminalRelationship
from app.models.evidence import Evidence
from app.models.police_station import PoliceStation
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.victim import Victim
from app.services import ai_audit_service
from app.services.case_filters import apply_case_filters

COMMUNITY_MODEL_VERSION = "network-greedy-modularity-v2"
MIN_NETWORK_SIZE = 3  # fewer than three linked people is a pair, not a network


def _accused_dict(accused: Accused) -> dict:
    return {"id": accused.AccusedMasterID, "case_id": accused.CaseMasterID, "profile": accused.CriminalProfileID,
            "gang": accused.GangID, "name": accused.AccusedName, "district": address_district(accused.Address)}


def _person_names(accused_rows: list[dict]) -> dict[int, str]:
    names: dict[int, Counter] = defaultdict(Counter)
    for record in accused_rows:
        names[person_id(record)][record["name"] or "Unknown"] += 1
    return {pid: counter.most_common(1)[0][0] for pid, counter in names.items()}


def _person_label(pid: int, names: dict[int, str]) -> str:
    return names.get(pid, f"Person {pid}")


def get_gang_communities(db: Session, current_user: User, min_size: int = MIN_NETWORK_SIZE) -> dict:
    """Networks of linked people anchored on repeat offenders, within the caller's jurisdiction."""
    accused_query = db.query(Accused).join(CaseMaster, Accused.CaseMasterID == CaseMaster.CaseMasterID)
    accused_rows = [_accused_dict(a) for a in apply_jurisdiction_filter(accused_query, db, current_user, model_class=CaseMaster).all()]
    if not accused_rows:
        return {"ModelVersion": COMMUNITY_MODEL_VERSION, "Communities": []}

    case_ids = {record["case_id"] for record in accused_rows}
    vehicle_query = db.query(Vehicle.CaseMasterID, Vehicle.RegistrationNumber).join(CaseMaster, Vehicle.CaseMasterID == CaseMaster.CaseMasterID)
    vehicles = [{"case_id": cid, "registration": reg}
                for cid, reg in apply_jurisdiction_filter(vehicle_query, db, current_user, model_class=CaseMaster).all()
                if cid in case_ids]

    profiles = {record["profile"] for record in accused_rows if record["profile"]}
    stored = [
        {"source_person_id": link.SourcePersonID, "target_person_id": link.TargetPersonID,
         "confidence": link.ConfidenceScore, "relationship_type": link.RelationshipType}
        for link in db.query(CriminalRelationship).filter(CriminalRelationship.Active.is_(True), CriminalRelationship.Status != "Disputed").all()
        if link.SourcePersonID in profiles and link.TargetPersonID in profiles
    ]

    edges = build_edges(accused_rows, vehicles, stored, include_recorded_gang=True)
    communities = detect_communities(edges, min_size=min_size)

    names = _person_names(accused_rows)
    cases_of: dict[int, set[int]] = defaultdict(set)
    gang_of: dict[int, set[int]] = defaultdict(set)
    for record in accused_rows:
        cases_of[person_id(record)].add(record["case_id"])
        if record["gang"] and record["profile"]:
            gang_of[record["profile"]].add(record["gang"])

    results = []
    for community in communities:
        members = set(community["member_person_ids"])
        link_kinds: Counter = Counter()
        for edge in edges:
            if edge["source_person_id"] in members and edge["target_person_id"] in members:
                for kind, count in edge["evidence"].items():
                    link_kinds[kind] += 1
        gang_counts = Counter(g for pid in members for g in gang_of.get(pid, ()))
        recorded = [f"GNG{gang:04d} ({count} member{'s' if count != 1 else ''})" for gang, count in gang_counts.most_common()]
        case_count = len(set().union(*(cases_of.get(pid, set()) for pid in members)))
        leader = community["leader_person_id"]
        link_text = ", ".join(f"{count} {kind} link{'s' if count != 1 else ''}" for kind, count in link_kinds.most_common())
        explanation = (
            f"{community['size']} linked people across {case_count} case(s); {link_text}. "
            f"Most central member: {_person_label(leader, names)} (PageRank {community['leader_pagerank']:.2f}). "
            + (f"Registry gang affiliation: {', '.join(recorded)}." if recorded else "No registry gang affiliation recorded for any member.")
        )
        results.append({
            "MemberPersonIDs": community["member_person_ids"],
            "Confidence": community["mean_link_strength"],
            "Explanation": explanation,
            "Size": community["size"],
            "Density": community["density"],
            "LeaderPersonID": leader,
            "LeaderName": _person_label(leader, names),
            "LeaderPageRank": community["leader_pagerank"],
            "MemberNames": [_person_label(pid, names) for pid in community["member_person_ids"]],
            "CaseCount": case_count,
            "RecordedGangs": recorded,
        })

    ai_audit_service.log_ai_run(db, current_user.UserID, "network_community", "greedy_modularity", COMMUNITY_MODEL_VERSION,
                                None, {"community_count": len(results), "min_size": min_size})
    return {"ModelVersion": COMMUNITY_MODEL_VERSION, "Communities": results}


def _classify_evidence(evidence_type: str) -> tuple[str, str]:
    lowered = evidence_type.lower()
    if "weapon" in lowered or "firearm" in lowered:
        return "Weapon", "Seized weapon"
    if "bank" in lowered or "ledger" in lowered or "financial" in lowered:
        return "BankAccount", "Financial record"
    if "call detail" in lowered or "phone" in lowered or "sim" in lowered:
        return "PhoneNumber", "Telecom record"
    return "Evidence", "Case evidence"


def get_dynamic_network_graph(
    db: Session,
    current_user: User,
    district_id: Optional[int] = None,
    station_id: Optional[int] = None,
    crime_category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    node_types: Optional[str] = None,
    relationship_types: Optional[str] = None,
    min_confidence: float = 0.0,
    search_query: Optional[str] = None,
    limit: int = 150,
) -> dict:
    """Link-analysis graph of the highest-risk cases matching the filters, with people, vehicles,
    evidence, victims, stations and detected networks as nodes."""
    query = apply_jurisdiction_filter(db.query(CaseMaster), db, current_user)
    query = apply_case_filters(query, db, district_id=district_id, station_id=station_id, crime_category=crime_category,
                               start_date=start_date, end_date=end_date, search=search_query)
    cases = query.order_by(CaseMaster.AIRiskScore.desc().nullslast(), CaseMaster.CaseMasterID.desc()).limit(limit).all()
    if not cases:
        return {"nodes": [], "edges": [], "total_nodes": 0, "total_edges": 0, "gang_count": 0, "model_version": "network-graph-v3"}

    case_ids = [c.CaseMasterID for c in cases]
    case_by_id = {c.CaseMasterID: c for c in cases}
    accused_list = db.query(Accused).filter(Accused.CaseMasterID.in_(case_ids)).all()
    vehicles = db.query(Vehicle).filter(Vehicle.CaseMasterID.in_(case_ids)).all()
    evidence_items = db.query(Evidence).filter(Evidence.CaseMasterID.in_(case_ids)).all()
    victims = db.query(Victim).filter(Victim.CaseMasterID.in_(case_ids)).all()
    station_ids = {c.PoliceStationID for c in cases if c.PoliceStationID}
    stations = {ps.UnitID: ps.UnitName for ps in db.query(PoliceStation).filter(PoliceStation.UnitID.in_(station_ids)).all()} if station_ids else {}

    nodes: Dict[str, dict] = {}
    edges: List[dict] = []
    seen_edges: set = set()

    def add_edge(source: str, target: str, relationship: str, confidence: float, evidence_source: str):
        if source == target or confidence < min_confidence:
            return
        key = (min(source, target), max(source, target), relationship)
        if key in seen_edges:
            return
        seen_edges.add(key)
        edges.append({"id": f"edge-{len(edges) + 1}", "source": source, "target": target, "relationship": relationship,
                      "confidence": round(confidence, 2), "evidence_source": evidence_source})

    # FIR and station nodes
    station_scores: dict[int, list[float]] = defaultdict(list)
    for case in cases:
        station_name = stations.get(case.PoliceStationID, f"Station #{case.PoliceStationID}")
        registered = case.CrimeRegisteredDate.strftime("%Y-%m-%d") if case.CrimeRegisteredDate else "unknown date"
        level = f"AI risk {case.AIRiskScore:.2f} ({case.AIRiskLevel})" if case.AIRiskScore is not None else "not yet risk-scored"
        nodes[f"case-{case.CaseMasterID}"] = {
            "id": f"case-{case.CaseMasterID}", "label": f"FIR #{case.CaseNo or case.CaseMasterID}", "node_type": "FIR",
            "sub_type": "Case File", "centrality": 1, "case_count": 1, "risk_score": case.AIRiskScore,
            "details": f"Registered at {station_name} on {registered}; {level}. {case.BriefFacts or ''}".strip(),
            "ai_summary": f"FIR #{case.CaseNo} at {station_name}; {level}.",
        }
        if case.PoliceStationID:
            sid = f"station-{case.PoliceStationID}"
            if case.AIRiskScore is not None:
                station_scores[case.PoliceStationID].append(case.AIRiskScore)
            if sid not in nodes:
                nodes[sid] = {"id": sid, "label": station_name, "node_type": "PoliceStation", "sub_type": "Police Station",
                              "centrality": 1, "case_count": 1, "risk_score": None, "details": f"Police station: {station_name}."}
            else:
                nodes[sid]["case_count"] += 1
            add_edge(f"case-{case.CaseMasterID}", sid, "Registered at station", 1.0, "FIR register")
    for station_pk, scores in station_scores.items():
        nodes[f"station-{station_pk}"]["risk_score"] = round(sum(scores) / len(scores), 4)

    # People: identity by recorded criminal profile, else the single accused record
    people: Dict[int, dict] = {}
    for accused in accused_list:
        record = _accused_dict(accused)
        pid = person_id(record)
        info = people.setdefault(pid, {"names": Counter(), "age": accused.AgeYear, "occupation": accused.Occupation,
                                       "address": accused.Address, "cases": set(), "profile": accused.CriminalProfileID, "gangs": set()})
        info["names"][accused.AccusedName or "Unknown"] += 1
        info["cases"].add(accused.CaseMasterID)
        if accused.GangID:
            info["gangs"].add(accused.GangID)

    profile_totals = {}
    profiles = [info["profile"] for info in people.values() if info["profile"]]
    if profiles:
        profile_totals = dict(db.query(Accused.CriminalProfileID, func.count(distinct(Accused.CaseMasterID)))
                              .filter(Accused.CriminalProfileID.in_(profiles)).group_by(Accused.CriminalProfileID).all())

    for pid, info in people.items():
        name = info["names"].most_common(1)[0][0]
        node_id = f"person-cp{pid}" if pid > 0 else f"person-a{-pid}"
        risks = [case_by_id[c].AIRiskScore for c in info["cases"] if case_by_id[c].AIRiskScore is not None]
        repeat = bool(info["profile"])
        total = profile_totals.get(info["profile"], len(info["cases"]))
        gang_text = f" Registry gang: {', '.join(f'GNG{g:04d}' for g in sorted(info['gangs']))}." if info["gangs"] else ""
        nodes[node_id] = {
            "id": node_id, "label": name, "node_type": "Person",
            "sub_type": "Repeat Offender" if repeat else "Accused",
            "centrality": len(info["cases"]) + 1, "case_count": len(info["cases"]),
            "risk_score": round(max(risks), 4) if risks else None,
            "age": info["age"], "occupation": info["occupation"], "address": info["address"],
            "details": (f"{name}. {'Recorded criminal profile CP%05d with %d case(s) on record.' % (info['profile'], total) if repeat else 'No prior criminal profile on record.'}"
                        f" In {len(info['cases'])} FIR(s) in this view.{gang_text}"),
            "ai_summary": (f"{name} appears in {total} case(s) under criminal profile CP{info['profile']:05d}.{gang_text}" if repeat
                           else f"{name} is accused in {len(info['cases'])} case in this view with no recorded profile."),
        }
        for case_id in info["cases"]:
            add_edge(node_id, f"case-{case_id}", "Accused in FIR", 1.0, "FIR accused register")

    # Shared addresses (only a link when two different people give the same address)
    by_address: dict[str, set[int]] = defaultdict(set)
    for pid, info in people.items():
        if info["address"] and len(info["address"]) > 5:
            by_address[info["address"].replace("\n", ", ").strip()].add(pid)
    for address, members in by_address.items():
        if len(members) < 2:
            continue
        address_id = f"address-{abs(hash(address))}"
        nodes[address_id] = {"id": address_id, "label": address[:40], "node_type": "Address", "sub_type": "Shared Address",
                             "centrality": 1, "case_count": len(members), "risk_score": None, "details": f"Address shared by {len(members)} people: {address}"}
        for pid in members:
            add_edge(f"person-cp{pid}" if pid > 0 else f"person-a{-pid}", address_id, "Same address", 1.0, "Accused address register")

    # Vehicles
    for vehicle in vehicles:
        vehicle_id = f"vehicle-{vehicle.RegistrationNumber or vehicle.VehicleID}"
        case_score = case_by_id[vehicle.CaseMasterID].AIRiskScore
        if vehicle_id not in nodes:
            nodes[vehicle_id] = {
                "id": vehicle_id, "label": f"{vehicle.RegistrationNumber or 'Vehicle'}", "node_type": "Vehicle",
                "sub_type": vehicle.InvolvementRole or "Vehicle", "centrality": 1, "case_count": 1, "risk_score": case_score,
                "registration_no": vehicle.RegistrationNumber,
                "details": f"{vehicle.Color or ''} {vehicle.Make or ''} {vehicle.Model or ''} ({vehicle.VehicleType or 'vehicle'}); role: {vehicle.InvolvementRole or 'unspecified'}.".strip(),
            }
        add_edge(f"case-{vehicle.CaseMasterID}", vehicle_id, "Involved vehicle", 1.0, "Vehicle register")

    # Evidence items
    for item in evidence_items:
        node_type, sub_type = _classify_evidence(item.EvidenceType or "")
        evidence_id = f"evidence-{item.EvidenceID}"
        nodes[evidence_id] = {"id": evidence_id, "label": item.EvidenceType or "Evidence", "node_type": node_type, "sub_type": sub_type,
                              "centrality": 1, "case_count": 1, "risk_score": None,
                              "details": f"{item.EvidenceType}: {item.Description or 'no description recorded'}"}
        add_edge(f"case-{item.CaseMasterID}", evidence_id, f"Evidence: {sub_type.lower()}", 1.0, "Evidence register")

    # Victims
    for victim in victims:
        victim_id = f"victim-{victim.VictimMasterID}"
        nodes[victim_id] = {"id": victim_id, "label": f"{victim.VictimName} (victim)", "node_type": "Victim", "sub_type": "Victim",
                            "centrality": 1, "case_count": 1, "risk_score": None,
                            "details": f"Victim {victim.VictimName}, age {victim.AgeYear if victim.AgeYear is not None else 'not recorded'}."}
        add_edge(f"case-{victim.CaseMasterID}", victim_id, "Victim in FIR", 1.0, "FIR complainant record")

    # Person-to-person links and detected networks among the people in view
    person_records = [_accused_dict(a) for a in accused_list]
    vehicle_records = [{"case_id": v.CaseMasterID, "registration": v.RegistrationNumber} for v in vehicles]
    person_edges = build_edges(person_records, vehicle_records)
    for edge in person_edges:
        a, b = edge["source_person_id"], edge["target_person_id"]
        source = f"person-cp{a}" if a > 0 else f"person-a{-a}"
        target = f"person-cp{b}" if b > 0 else f"person-a{-b}"
        if source in nodes and target in nodes:
            label = edge["relationship_type"].replace("co-accused", "Co-accused").replace("shared vehicle", "Shared vehicle").replace("same home district", "Same home district")
            add_edge(source, target, label, edge["confidence"], "Derived from case records")

    names = _person_names(person_records)
    communities = detect_communities(person_edges, min_size=MIN_NETWORK_SIZE)
    for index, community in enumerate(communities, start=1):
        org_id = f"network-{index}"
        leader = community["leader_person_id"]
        nodes[org_id] = {
            "id": org_id, "label": f"Detected network #{index}", "node_type": "Organization", "sub_type": "Detected network",
            "centrality": community["size"] + 1, "case_count": community["size"], "risk_score": None,
            "details": (f"{community['size']} linked people, density {community['density']:.2f}, mean link strength "
                        f"{community['mean_link_strength']:.2f}. Most central: {_person_label(leader, names)}."),
            "ai_summary": f"Community found by greedy-modularity detection over co-accused and shared-vehicle links; most central member {_person_label(leader, names)} (PageRank {community['leader_pagerank']:.2f}).",
        }
        for pid in community["member_person_ids"]:
            add_edge(f"person-cp{pid}" if pid > 0 else f"person-a{-pid}", org_id, "Member of detected network",
                     community["mean_link_strength"], "Greedy-modularity community detection")

    degree: Counter = Counter()
    for edge in edges:
        degree[edge["source"]] += 1
        degree[edge["target"]] += 1
    for node_id, count in degree.items():
        if node_id in nodes:
            nodes[node_id]["centrality"] = max(nodes[node_id]["centrality"], count + 1)

    final_nodes = list(nodes.values())
    if node_types:
        wanted = {t.strip() for t in node_types.split(",")}
        final_nodes = [n for n in final_nodes if n["node_type"] in wanted]
    valid = {n["id"] for n in final_nodes}
    wanted_relationships = {r.strip().lower() for r in relationship_types.split(",")} if relationship_types else None
    final_edges = [e for e in edges if e["source"] in valid and e["target"] in valid
                   and (wanted_relationships is None or any(r in e["relationship"].lower() for r in wanted_relationships))]

    return {"nodes": final_nodes, "edges": final_edges, "total_nodes": len(final_nodes), "total_edges": len(final_edges),
            "gang_count": len(communities), "model_version": "network-graph-v3"}
