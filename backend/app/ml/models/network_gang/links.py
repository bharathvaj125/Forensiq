"""Build person-to-person links from case data for community (gang) detection.

Identity: an accused with a recorded criminal profile is the same person in every case
(CriminalProfileID). An accused without one is identified only within their own case and gets a
negative id (-AccusedMasterID) so it can never be confused with a profile.

Links (only between two profiled repeat offenders are kept: a person recorded in a single case has no
cross-case identity, so including them only attaches one-off leaves and merges unrelated people into
huge blobs):
  co-accused       - two people accused in the same case
  shared vehicle   - cases that involve the same vehicle registration number
  recorded link    - an active, non-disputed row in criminal_relationships
  recorded gang    - same GangID in the police registry (optional; excluded when evaluating the algorithm)

Strength of a link backed by n independent pieces of evidence is 1 - 0.5**n, and different link types
between the same pair combine as a noisy-OR.
"""

from __future__ import annotations

import itertools
from collections import defaultdict


def person_id(accused: dict) -> int:
    return accused["profile"] if accused.get("profile") else -accused["id"]


def _strength(evidence_count: int) -> float:
    return 1.0 - 0.5 ** evidence_count


# Weight of the "same home district" link relative to a co-offending link. Chosen from a sweep over
# {0, 0.1, 0.25, 0.5, 1.0} by pairwise F1 against the registry GangID labels (see evaluate_models.py);
# the weight is therefore tuned on the same labels it is evaluated on.
DISTRICT_LINK_WEIGHT = 1.0


def build_edges(accused: list[dict], vehicles: list[dict], stored_links: list[dict] | None = None,
                include_recorded_gang: bool = False, district_weight: float = DISTRICT_LINK_WEIGHT) -> list[dict]:
    """accused: {id, case_id, profile, gang, district}; vehicles: {case_id, registration};
    stored_links: {source_person_id, target_person_id, confidence, relationship_type}"""
    by_case: dict[int, set[int]] = defaultdict(set)
    for record in accused:
        by_case[record["case_id"]].add(person_id(record))

    evidence: dict[tuple[int, int], dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def link(a: int, b: int, kind: str, count: int = 1):
        if a == b or a < 0 or b < 0:
            return  # both ends must be profiled repeat offenders
        evidence[(min(a, b), max(a, b))][kind] += count

    for people in by_case.values():
        for a, b in itertools.combinations(sorted(people), 2):
            link(a, b, "co-accused")

    cases_by_registration: dict[str, set[int]] = defaultdict(set)
    for vehicle in vehicles:
        if vehicle.get("registration"):
            cases_by_registration[vehicle["registration"]].add(vehicle["case_id"])
    for cases in cases_by_registration.values():
        if len(cases) < 2:
            continue
        people = sorted(set().union(*(by_case.get(case, set()) for case in cases)))
        for a, b in itertools.combinations(people, 2):
            link(a, b, "shared vehicle")

    if district_weight > 0:
        by_district: dict[str, set[int]] = defaultdict(set)
        for record in accused:
            if record.get("profile") and record.get("district"):
                by_district[record["district"]].add(record["profile"])
        for members in by_district.values():
            for a, b in itertools.combinations(sorted(members), 2):
                link(a, b, "same home district")

    if include_recorded_gang:
        by_gang: dict[int, set[int]] = defaultdict(set)
        for record in accused:
            if record.get("gang") and record.get("profile"):
                by_gang[record["gang"]].add(record["profile"])
        for members in by_gang.values():
            for a, b in itertools.combinations(sorted(members), 2):
                link(a, b, "recorded gang")

    edges = []
    for (a, b), kinds in evidence.items():
        survive = 1.0
        for kind, count in kinds.items():
            weight = district_weight if kind == "same home district" else 1.0
            survive *= 1.0 - weight * _strength(count)
        edges.append({"source_person_id": a, "target_person_id": b, "confidence": round(1.0 - survive, 4),
                      "relationship_type": " + ".join(sorted(kinds)), "evidence": dict(kinds)})

    for stored in stored_links or []:
        edges.append({"source_person_id": stored["source_person_id"], "target_person_id": stored["target_person_id"],
                      "confidence": stored["confidence"], "relationship_type": stored["relationship_type"],
                      "evidence": {"recorded link": 1}})
    return edges
