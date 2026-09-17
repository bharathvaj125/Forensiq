"""
Structured pre-filter (crime sub-head/district/year) + embedding-distance ranking logic (SAD Section 18.1.3).
"""

import numpy as np


def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Calculate the cosine similarity between two vectors."""
    a = np.asarray(v1, dtype=float)
    b = np.asarray(v2, dtype=float)
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))


def search_similar_cases(
    query_vector: list[float],
    candidates: list[dict],
    district: str = None,
    crime_type: str = None,
    year: int = None,
    limit: int = 10,
) -> list[dict]:
    """
    Perform hybrid filtering (district, crime_type, year) and rank candidates
    by cosine similarity.
    """
    filtered = []
    for c in candidates:
        if district and c.get("district") != district:
            continue
        if crime_type and c.get("crime_type") != crime_type:
            continue
        if year and c.get("year") != year:
            continue

        c_vector = c.get("vector")
        if not c_vector:
            continue

        sim = cosine_similarity(query_vector, c_vector)
        # Cosine distance to similarity confidence mapping
        confidence = float(max(0.0, min(1.0, (sim + 1.0) / 2.0)))

        filtered.append({
            "case_master_id": c["case_master_id"],
            "similarity_score": round(sim, 4),
            "confidence_score": round(confidence, 4),
            "metadata": {
                "district": c.get("district"),
                "crime_type": c.get("crime_type"),
                "year": c.get("year"),
            }
        })

    filtered.sort(key=lambda x: x["similarity_score"], reverse=True)
    return filtered[:limit]
