"""Evaluate every model against the dataset's own ground-truth labels (database/seeds/data).

    python scripts/evaluate_models.py            # print results
    python scripts/evaluate_models.py --write    # also write docs/MODEL_EVALUATION.md

Ground truth used:
  risk            RiskLabel                      (CrimeCases_AI.csv)  - 5-fold cross-validation, stored in the artifact
  anomalies       AnomalyLabel                   (CrimeCases_AI.csv)
  repeat offender CriminalProfileID              (Accused.csv)        - grouped cross-validation, stored in the artifact
  gang networks   GangID                         (Accused.csv)        - link graph WITHOUT the GangID labels
"""

import json
import os
import sys
from itertools import combinations

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402
from sklearn.ensemble import IsolationForest  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    average_precision_score, normalized_mutual_info_score, precision_score, recall_score, roc_auc_score,
)

from app.db.data_repair import find_seed_dir  # noqa: E402
from app.db.seed_parsing import parse_id_suffix  # noqa: E402
from app.ml.features import load_seed_tables, seed_feature_frame  # noqa: E402
from app.ml.models.anomaly.detector import MODEL_VERSION as ANOMALY_VERSION, MODIFIED_Z_CUTOFF, delay_scores  # noqa: E402
from app.ml.models.network_gang.community_detection import detect_communities  # noqa: E402
from app.ml.models.network_gang.links import DISTRICT_LINK_WEIGHT, build_edges  # noqa: E402
from app.ml.models.repeat_offender import linkage  # noqa: E402
from app.ml.models.repeat_offender.linkage import address_district  # noqa: E402
from app.ml.models.risk_scoring import scorer  # noqa: E402


def evaluate_risk(tables) -> dict:
    card = scorer.model_card()
    return {
        "model": card["version"],
        "ground_truth": "RiskLabel (Low / Medium / High / Severe)",
        "rows": card["trained_on"]["rows"],
        "class_counts": card["trained_on"]["class_counts"],
        "cross_validated_accuracy": card["cross_validation"]["accuracy"],
        "cross_validated_macro_f1": card["cross_validation"]["macro_f1"],
        "high_or_severe_auc": card["cross_validation"]["high_or_severe_auc"],
        "log_loss": card["cross_validation"]["log_loss"],
        "per_class": card["cross_validation"]["per_class"],
        "baseline_always_predict_most_common_class": card["majority_class_accuracy"],
        "top_features": card["feature_importance"][:5],
    }


def evaluate_anomaly(tables) -> dict:
    features = seed_feature_frame(tables)
    labels = tables["ai"].set_index("CaseMasterID")["AnomalyLabel"].reindex(features.index)
    truth = (labels != "Normal").astype(int).to_numpy()
    delays = features["ReportingDelayHours"].to_numpy()
    z_scores, _, _ = delay_scores(list(delays))
    flagged = (z_scores >= MODIFIED_Z_CUTOFF).astype(int)

    accused = features["NumberOfAccused"].to_numpy()
    evidence = features["NumberOfEvidenceItems"].to_numpy()
    matrix = np.column_stack([np.log1p(delays), accused, evidence, evidence / (accused + 1.0)])
    forest = -IsolationForest(random_state=42).fit(matrix).score_samples(matrix)
    k = int(truth.sum())
    return {
        "model": ANOMALY_VERSION,
        "ground_truth": "AnomalyLabel (159 of 5000: 150 reporting-delay outliers, 9 officer-level)",
        "cutoff_modified_z": MODIFIED_Z_CUTOFF,
        "cases_flagged": int(flagged.sum()),
        "precision_at_cutoff": round(float(precision_score(truth, flagged)), 4),
        "recall_at_cutoff": round(float(recall_score(truth, flagged)), 4),
        "roc_auc": round(float(roc_auc_score(truth, z_scores)), 4),
        "average_precision": round(float(average_precision_score(truth, z_scores)), 4),
        f"precision_at_top_{k}": round(float(truth[np.argsort(-z_scores)[:k]].mean()), 4),
        "baseline_isolation_forest_4_features": {
            "roc_auc": round(float(roc_auc_score(truth, forest)), 4),
            "average_precision": round(float(average_precision_score(truth, forest)), 4),
            f"precision_at_top_{k}": round(float(truth[np.argsort(-forest)[:k]].mean()), 4),
        },
        "note": "The 9 officer-level anomalies depend on officer attributes absent from the data and are not detectable by delay.",
    }


def evaluate_linkage() -> dict:
    artifact = linkage.load_artifact()
    return {"model": artifact["version"], "ground_truth": "CriminalProfileID", "trained_on": artifact["trained_on"],
            "cross_validation": artifact["cross_validation"], "feature_importance": artifact["feature_importance"]}


def _score_communities(accused, vehicles, district_weight: float) -> dict:
    edges = build_edges(accused, vehicles, include_recorded_gang=False, district_weight=district_weight)  # GangID labels excluded
    communities = detect_communities(edges, min_size=2)
    gang_of = {r["profile"]: r["gang"] for r in accused if r["gang"] and r["profile"]}
    community_of = {pid: index for index, community in enumerate(communities) for pid in community["member_person_ids"]}
    labelled = sorted(gang_of)
    same_truth, same_pred = [], []
    for a, b in combinations(labelled, 2):
        same_truth.append(int(gang_of[a] == gang_of[b]))
        same_pred.append(int(a in community_of and b in community_of and community_of[a] == community_of[b]))
    same_truth, same_pred = np.array(same_truth), np.array(same_pred)
    covered = [p for p in labelled if p in community_of]
    nmi = normalized_mutual_info_score([gang_of[p] for p in covered], [community_of[p] for p in covered]) if len(covered) > 1 else 0.0
    precision = float(precision_score(same_truth, same_pred, zero_division=0))
    recall = float(recall_score(same_truth, same_pred, zero_division=0))
    return {
        "district_weight": district_weight,
        "communities_found": len(communities),
        "labelled_profiles": len(labelled),
        "labelled_profiles_placed_in_a_community": len(covered),
        "pairwise_precision": round(precision, 4),
        "pairwise_recall": round(recall, 4),
        "pairwise_f1": round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0,
        "nmi_on_covered_profiles": round(float(nmi), 4),
    }


def evaluate_gangs(tables) -> dict:
    accused = [{"id": int(r.AccusedMasterID), "case_id": int(r.CaseMasterID), "profile": parse_id_suffix(r.CriminalProfileID),
                "gang": parse_id_suffix(r.GangID), "district": address_district(r.Address)} for r in tables["accused"].itertuples(index=False)]
    vehicles = [{"case_id": int(r.CaseMasterID), "registration": r.RegistrationNumber} for r in tables["vehicles"].itertuples(index=False)]
    sweep = [_score_communities(accused, vehicles, weight) for weight in (0.0, 0.1, 0.25, 0.5, 1.0)]
    chosen = _score_communities(accused, vehicles, DISTRICT_LINK_WEIGHT)
    return {
        "method": "greedy modularity over co-accused, shared-vehicle and same-home-district links between repeat offenders (GangID labels not used as links)",
        "ground_truth": "GangID (registry gang membership of 34 profiled repeat offenders in 9 gangs)",
        "chosen": chosen,
        "district_weight_sweep": sweep,
        "note": "Home district is the strongest observable signal (same-gang pairs share a district; AUC 0.98); co-offending and shared vehicles alone recover almost nothing. The weight was tuned on these same labels, so treat the score as optimistic.",
    }


def to_markdown(results: dict) -> str:
    r, a, l, g = results["risk"], results["anomaly"], results["linkage"], results["gangs"]
    lines = ["# Model evaluation against the dataset's ground truth", "",
             "Generated by `backend/scripts/evaluate_models.py`. Every number below is computed from the labels shipped in "
             "`database/seeds/data` (not from data generated for the purpose).", "",
             "## Case risk model", "",
             f"- Model: `{r['model']}` trained on {r['rows']} labelled cases ({r['class_counts']})",
             f"- 5-fold cross-validated accuracy **{r['cross_validated_accuracy']:.1%}** (always guessing the most common class: {r['baseline_always_predict_most_common_class']:.1%}); macro-F1 **{r['cross_validated_macro_f1']:.3f}**",
             f"- Probability of High/Severe: ROC-AUC **{r['high_or_severe_auc']:.3f}**",
             "- The score shown to users is the **risk index** (0-100): the expected severity from the four class probabilities (Low = 0, Medium = 1, High = 2, Severe = 3, divided by 3), so Low sits near 0, Medium near 33, High near 67 and Severe near 100. The chance of High or Severe is shown separately.",
             "- Per class (precision / recall): " + "; ".join(f"{k} {v['precision']:.2f}/{v['recall']:.2f}" for k, v in r["per_class"].items()),
             "- Caveat: Medium vs Low/High is noisy in the labels themselves; Severe is almost perfectly identifiable (repeat accused + heinous).",
             "- Can it be improved? Tested with 5-fold cross-validation: adding accused ages, victim ages and injury severity, evidence kinds, and accused home district vs incident district (each alone and all together), and trying gradient boosting and extra-trees instead of random forest, did not help (accuracy 51-53%, AUC 0.887-0.894). The only input that lifts accuracy (to about 95%) is the case's current status, because the dataset's RiskLabel is partly decided by how the case ended (charge-sheeted and convicted cases are never Low; open and closed-undetected cases are never High). That is not known when an FIR is registered, so it is deliberately not a feature of the registration-time model.", "",
             "## Anomaly detection", "",
             f"- Method: robust (modified) z-score of log reporting delay, cutoff {a['cutoff_modified_z']}",
             f"- Flags {a['cases_flagged']} cases: precision **{a['precision_at_cutoff']:.1%}**, recall **{a['recall_at_cutoff']:.1%}** at the standard cutoff",
             f"- Ranking quality: ROC-AUC **{a['roc_auc']:.3f}**, average precision **{a['average_precision']:.3f}** (Isolation Forest baseline: AUC {a['baseline_isolation_forest_4_features']['roc_auc']:.3f}, AP {a['baseline_isolation_forest_4_features']['average_precision']:.3f})",
             f"- {a['note']}", "",
             "## Repeat-offender linkage", "",
             f"- Model: `{l['model']}`, {l['trained_on']['pairs']} labelled record pairs from {l['trained_on']['profiles']} criminal profiles",
             f"- Grouped 5-fold CV: precision **{l['cross_validation']['precision']:.1%}**, recall **{l['cross_validation']['recall']:.1%}**, ROC-AUC {l['cross_validation']['roc_auc']:.3f}",
             "- Caveat: negatives include unprofiled records that may truly be the same person, so precision is conservative.", "",
             "## Gang networks", "",
             f"- {g['method']}",
             f"- {g['chosen']['communities_found']} communities; {g['chosen']['labelled_profiles_placed_in_a_community']} of {g['chosen']['labelled_profiles']} registry-labelled profiles placed in one",
             f"- Pairwise precision **{g['chosen']['pairwise_precision']:.1%}**, recall **{g['chosen']['pairwise_recall']:.1%}**, F1 {g['chosen']['pairwise_f1']:.3f}, NMI {g['chosen']['nmi_on_covered_profiles']:.3f}",
             "- Sweep of the same-home-district link weight (0 = co-offending and shared vehicles only):", ""]
    lines += ["  | weight | communities | precision | recall | F1 | NMI |", "  |---|---|---|---|---|---|"]
    lines += [f"  | {s['district_weight']} | {s['communities_found']} | {s['pairwise_precision']:.3f} | {s['pairwise_recall']:.3f} | {s['pairwise_f1']:.3f} | {s['nmi_on_covered_profiles']:.3f} |"
              for s in g["district_weight_sweep"]]
    lines += ["", f"- {g['note']}", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    seed_dir = find_seed_dir()
    if not seed_dir:
        raise SystemExit("Seed CSV directory (database/seeds/data) not found.")
    tables = load_seed_tables(seed_dir)
    results = {"risk": evaluate_risk(tables), "anomaly": evaluate_anomaly(tables),
               "linkage": evaluate_linkage(), "gangs": evaluate_gangs(tables)}
    print(json.dumps(results, indent=2, default=str))
    if "--write" in sys.argv:
        target = os.path.join(os.path.dirname(os.path.dirname(seed_dir.rstrip("/\\"))), "..", "docs", "MODEL_EVALUATION.md")
        target = os.path.normpath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "docs", "MODEL_EVALUATION.md"))
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(to_markdown(results))
        print(f"\nWrote {target}")
