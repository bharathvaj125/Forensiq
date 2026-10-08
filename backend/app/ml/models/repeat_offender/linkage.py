"""Repeat-offender record linkage: do two accused records describe the same person?

A logistic-regression pair classifier trained on the seed data's known criminal-profile identities
(see train.py). Candidate records are first blocked by gender and the start of the name, then scored.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import joblib

ARTIFACT_PATH = Path(__file__).parents[2] / "saved_models" / "repeat_offender.joblib"
PAIR_FEATURES = ["name_similarity", "exact_name", "age_difference", "same_occupation", "same_district", "years_apart", "same_station"]
MIN_NAME_SIMILARITY = 0.7  # blocking threshold: pairs below this are never scored
BLOCK_PREFIX = 2           # candidates must share the first N letters of the name

_DISTRICT_PATTERN = re.compile(r",\s*([^,]+),\s*Karnataka\s*$")


def jaro_winkler(s1: str, s2: str) -> float:
    s1_len, s2_len = len(s1), len(s2)
    if s1_len == 0 and s2_len == 0:
        return 1.0
    if s1_len == 0 or s2_len == 0:
        return 0.0
    match_bound = max(0, (max(s1_len, s2_len) // 2) - 1)
    s1_matches = [False] * s1_len
    s2_matches = [False] * s2_len
    matches = 0
    for i in range(s1_len):
        for j in range(max(0, i - match_bound), min(s2_len, i + match_bound + 1)):
            if not s2_matches[j] and s1[i] == s2[j]:
                s1_matches[i] = s2_matches[j] = True
                matches += 1
                break
    if matches == 0:
        return 0.0
    transpositions = 0
    k = 0
    for i in range(s1_len):
        if s1_matches[i]:
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1
    transpositions //= 2
    jaro = (matches / s1_len + matches / s2_len + (matches - transpositions) / matches) / 3.0
    prefix = 0
    for i in range(min(4, s1_len, s2_len)):
        if s1[i] != s2[i]:
            break
        prefix += 1
    return jaro + prefix * 0.1 * (1.0 - jaro)


def address_district(address: str | None) -> str | None:
    match = _DISTRICT_PATTERN.search((address or "").replace("\n", " ").strip())
    return match.group(1).strip().lower() if match else None


def normalise_name(name: str | None) -> str:
    return (name or "").strip().lower()


def pair_features(a: dict, b: dict) -> list[float]:
    """a / b: {name, age, occupation, address, station_id, registered (date)}"""
    name_a, name_b = normalise_name(a["name"]), normalise_name(b["name"])
    district_a, district_b = address_district(a.get("address")), address_district(b.get("address"))
    registered_a, registered_b = a.get("registered"), b.get("registered")
    years_apart = abs((registered_a - registered_b).days) / 365.0 if registered_a and registered_b else 0.0
    return [
        jaro_winkler(name_a, name_b),
        float(name_a == name_b),
        float(abs((a.get("age") or 0) - (b.get("age") or 0))),
        float(bool(a.get("occupation")) and a.get("occupation") == b.get("occupation")),
        float(district_a is not None and district_a == district_b),
        years_apart,
        float(a.get("station_id") is not None and a.get("station_id") == b.get("station_id")),
    ]


@lru_cache(maxsize=1)
def load_artifact() -> dict:
    if not ARTIFACT_PATH.exists():
        raise FileNotFoundError(f"Linkage model missing at {ARTIFACT_PATH}. Train it with: python scripts/train_models.py")
    return joblib.load(ARTIFACT_PATH)


def link_candidates(source: dict, candidates: list[dict]) -> list[dict]:
    """Score candidate records against the source; return probable matches, most likely first."""
    artifact = load_artifact()
    scored = []
    for candidate in candidates:
        features = pair_features(source, candidate)
        if features[0] < MIN_NAME_SIMILARITY:
            continue
        probability = float(artifact["model"].predict_proba([features])[0][1])
        if probability >= artifact["decision_threshold"]:
            factors = []
            if features[1]:
                factors.append("Identical name")
            else:
                factors.append(f"Similar name (Jaro-Winkler {features[0]:.2f})")
            factors.append(f"Age differs by {int(features[2])} year(s)")
            if features[4]:
                factors.append("Same home district")
            if features[3]:
                factors.append("Same occupation")
            if features[6]:
                factors.append("Registered at the same police station")
            scored.append({"record": candidate, "confidence": round(probability, 4), "factors": factors})
    return sorted(scored, key=lambda item: item["confidence"], reverse=True)
