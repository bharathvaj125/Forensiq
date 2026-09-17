"""
DAY 5a — MO (modus operandi) similarity.

Compares every case's narrative text to every other case's, using LaBSE
(validated on Day 1) to catch similar methods even in different wording or
different languages.

RESULT FROM FIRST RUN (kept here so the reasoning isn't lost): raw text
similarity alone matched 2,917 of 7,140 possible pairs (41%) at threshold
0.55 — and unrelated noise burglary cases scored HIGHER on average (0.772)
than the real D1 cluster itself (0.718). That means text similarity was
picking up "this reads like a generic burglary report," not "this is the
same gang." Raising the threshold couldn't have fixed this, since the
false positives were already scoring better than the true positives.

FIX: exactly the same principle as entity resolution — a weak signal needs
corroboration. An MO-similarity hit only counts if EITHER:
  (a) entity resolution already linked this pair (reinforcing evidence), OR
  (b) the two cases are close in both time and place — same district,
      within PROXIMITY_DAYS of each other.
A text-similarity score with no entity link AND no spatio-temporal
proximity is treated as noise, not evidence, no matter how high the score.

Needs LaBSE, so this runs on your own machine (network access to
huggingface.co needed):

    python mo_similarity.py

Requires data/entity_matches.json to already exist (run entity_resolution.py
first). Output: data/mo_matches.json
"""

import json
import os
from datetime import date

from sentence_transformers import SentenceTransformer, util

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CASES_PATH = os.path.join(SCRIPT_DIR, "..", "data", "cases.json")
ENTITY_MATCHES_PATH = os.path.join(SCRIPT_DIR, "..", "data", "entity_matches.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "..", "data", "mo_matches.json")

MODEL_NAME = "sentence-transformers/LaBSE"  # validated on Day 1
SIMILARITY_THRESHOLD = 0.55
PROXIMITY_DAYS = 120  # generous window — same rough period, tune later if needed


def main():
    with open(CASES_PATH, encoding="utf-8") as f:
        cases = json.load(f)
    with open(ENTITY_MATCHES_PATH, encoding="utf-8") as f:
        entity_matches = json.load(f)

    entity_linked_pairs = {frozenset((m["case_a"], m["case_b"])) for m in entity_matches}
    case_by_id = {c["case_id"]: c for c in cases}

    model = SentenceTransformer(MODEL_NAME)

    texts = [c["description_en"] for c in cases]
    embeddings = model.encode(texts, convert_to_tensor=True, show_progress_bar=True)
    sim_matrix = util.cos_sim(embeddings, embeddings)

    def close_in_time_and_place(a, b):
        if a["district"] != b["district"]:
            return False
        days_apart = abs((date.fromisoformat(a["date"]) - date.fromisoformat(b["date"])).days)
        return days_apart <= PROXIMITY_DAYS

    matches = []
    dropped_uncorroborated = 0
    n = len(cases)
    for i in range(n):
        for j in range(i + 1, n):
            score = sim_matrix[i][j].item()
            if score < SIMILARITY_THRESHOLD:
                continue
            case_a, case_b = cases[i], cases[j]
            pair_key = frozenset((case_a["case_id"], case_b["case_id"]))

            if pair_key in entity_linked_pairs:
                corroboration = "entity-linked"
            elif close_in_time_and_place(case_a, case_b):
                corroboration = "spatio-temporal proximity"
            else:
                dropped_uncorroborated += 1
                continue  # text similarity alone — not enough, drop it

            matches.append({
                "case_a": case_a["case_id"],
                "case_b": case_b["case_id"],
                "score": round(score, 3),
                "corroboration": corroboration,
                "evidence": (
                    f"{case_a['case_id']} and {case_b['case_id']} describe a similar "
                    f"method (MO similarity {score:.2f}), corroborated by {corroboration}"
                ),
            })

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(matches, f, ensure_ascii=False, indent=2)

    print(f"Found {len(matches)} corroborated matches -> {os.path.abspath(OUTPUT_PATH)}")
    print(f"Dropped {dropped_uncorroborated} text-similar-but-uncorroborated pairs\n")

    # --- Validation against seeded ground truth ---
    gt_by_case = {c["case_id"]: c["_gt_cluster"] for c in cases}

    print("VALIDATION against seeded ground truth:")
    for cid in ["A1", "B1", "C1", "D1"]:
        cluster_cases = [c["case_id"] for c in cases if c["_gt_cluster"] == cid]
        found = sum(1 for m in matches if m["case_a"] in cluster_cases and m["case_b"] in cluster_cases)
        possible = len(cluster_cases) * (len(cluster_cases) - 1) // 2
        print(f"  {cid}: {found}/{possible} within-cluster pairs matched")

    print()
    print("  D1 has no entity links at all (confirmed on Day 4), so it depends")
    print("  entirely on spatio-temporal corroboration here. If D1 isn't fully")
    print("  matched now, PROXIMITY_DAYS may need to be widened.")

    # --- Re-check the template-collision problem with corroboration applied ---
    d1_cases = [c["case_id"] for c in cases if c["_gt_cluster"] == "D1"]
    noise_burglary_cases = [
        c["case_id"] for c in cases
        if c["_gt_cluster"] is None and c["crime_type"] == "burglary"
    ]
    fp_after_fix = sum(
        1 for m in matches
        if (m["case_a"] in d1_cases and m["case_b"] in noise_burglary_cases)
        or (m["case_b"] in d1_cases and m["case_a"] in noise_burglary_cases)
    )
    possible_fp = len(d1_cases) * len(noise_burglary_cases)
    print()
    print(f"D1 vs unrelated noise burglary, AFTER corroboration fix: {fp_after_fix}/{possible_fp}")
    print("(compare this to the 51/57 from the uncorroborated first run)")


if __name__ == "__main__":
    main()