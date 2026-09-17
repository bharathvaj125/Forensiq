from functools import lru_cache

@lru_cache(maxsize=1)
def _get_repeat_offender_model():
    """Load serialized TF-IDF repeat offender linkage model. Fail-fast if absent."""
    import joblib
    from pathlib import Path
    model_path = Path(__file__).parents[2] / "saved_models" / "repeat_offender.joblib"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Required ML artifact 'repeat_offender.joblib' is missing from {model_path.parent}. "
            f"Run 'python train_and_save_all_models.py' before deploying to Catalyst AppSail."
        )
    return joblib.load(model_path)


def jaro_winkler(s1: str, s2: str) -> float:
    """Calculate the Jaro-Winkler similarity between two strings."""
    s1_len = len(s1)
    s2_len = len(s2)
    if s1_len == 0 and s2_len == 0:
        return 1.0
    if s1_len == 0 or s2_len == 0:
        return 0.0

    match_bound = max(0, (max(s1_len, s2_len) // 2) - 1)
    s1_matches = [False] * s1_len
    s2_matches = [False] * s2_len

    matches = 0
    for i in range(s1_len):
        start = max(0, i - match_bound)
        end = min(s2_len, i + match_bound + 1)
        for j in range(start, end):
            if not s2_matches[j] and s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
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
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return jaro + prefix * 0.1 * (1.0 - jaro)


def initials_match(name1: str, name2: str) -> bool:
    """Check if the initials of the two names match sequentially."""
    w1 = [w[0] for w in name1.split() if w]
    w2 = [w[0] for w in name2.split() if w]
    if len(w1) >= 2 and len(w2) >= 2:
        return w1 == w2
    return False


def resolve_repeat_offenders(source: dict, candidates: list[dict]) -> list[dict]:
    """Resolve repeat offenders with fuzzy matching, alias checks, and confidence calibration."""
    matches = []
    source_name = (source.get("name") or "").strip().lower()
    if not source_name:
        return []

    for candidate in candidates:
        if candidate["accused_master_id"] == source["accused_master_id"]:
            continue

        candidate_name = (candidate.get("name") or "").strip().lower()
        if not candidate_name:
            continue

        factors: list[str] = []
        score = 0.0

        # 1. Identity references (Strong signal)
        if source.get("person_id") and source["person_id"] == candidate.get("person_id"):
            score += 0.65
            factors.append("Shared police identity reference")

        # 2. Fuzzy name matching
        jw_score = jaro_winkler(source_name, candidate_name)
        if jw_score >= 0.85:
            score += 0.20
            factors.append(f"Strong name similarity (Jaro-Winkler: {round(jw_score * 100, 1)}%)")
        elif initials_match(source_name, candidate_name):
            score += 0.15
            factors.append("Matching initials pattern")
        elif jw_score >= 0.70:
            score += 0.08
            factors.append(f"Moderate spelling name similarity (Jaro-Winkler: {round(jw_score * 100, 1)}%)")

        # 3. Demographic checks
        if source.get("gender_id") and source["gender_id"] == candidate.get("gender_id"):
            score += 0.05
            factors.append("Same recorded gender")

        if source.get("age") and candidate.get("age"):
            age_diff = abs(source["age"] - candidate["age"])
            if age_diff <= 2:
                score += 0.10
                factors.append("Compatible age band (tight match)")
            elif age_diff <= 5:
                score += 0.05
                factors.append("Within standard age deviation band")

        # 4. History check
        if candidate.get("case_count", 1) > 1:
            score += 0.05
            factors.append("Appears in multiple case records")

        # Minimum linkage threshold (e.g. 45% similarity)
        if score >= 0.45:
            matches.append({
                "accused_master_id": candidate["accused_master_id"],
                "confidence": round(min(score, 1.0), 4),
                "factors": factors
            })

    return sorted(matches, key=lambda item: item["confidence"], reverse=True)[:20]
