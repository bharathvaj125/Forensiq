"""Train the repeat-offender linkage model on the dataset's criminal-profile identities."""

from __future__ import annotations

import platform
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import average_precision_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupKFold, cross_val_predict

from app.ml.models.repeat_offender.linkage import (
    BLOCK_PREFIX, MIN_NAME_SIMILARITY, PAIR_FEATURES, normalise_name, pair_features,
)

MODEL_VERSION = "repeat-offender-linkage-v1"
DECISION_THRESHOLD = 0.5


def _records(tables: dict) -> list[dict]:
    cases = tables["cases"][["CaseMasterID", "CrimeRegisteredDate", "PoliceStationID"]]
    merged = tables["accused"].merge(cases, on="CaseMasterID")
    records = []
    for row in merged.itertuples(index=False):
        records.append({
            "id": int(row.AccusedMasterID),
            "name": row.AccusedName,
            "age": None if pd.isna(row.AgeYear) else int(row.AgeYear),
            "gender": row.GenderID,
            "occupation": row.Occupation,
            "address": row.Address,
            "station_id": int(row.PoliceStationID),
            "registered": pd.to_datetime(row.CrimeRegisteredDate).date(),
            "profile": None if pd.isna(row.CriminalProfileID) else str(row.CriminalProfileID),
        })
    return records


def build_pairs(tables: dict) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Labelled record pairs: at least one side has a known profile; label = same profile."""
    blocks: dict[tuple, list[dict]] = {}
    for record in _records(tables):
        key = (normalise_name(record["name"])[:BLOCK_PREFIX], record["gender"])
        blocks.setdefault(key, []).append(record)

    rows, labels, groups = [], [], []
    for members in blocks.values():
        for index, a in enumerate(members):
            if a["profile"] is None:
                continue
            for b in members:
                if b is a or (b["profile"] is not None and b["id"] < a["id"]):
                    continue
                features = pair_features(a, b)
                if features[0] < MIN_NAME_SIMILARITY:
                    continue
                rows.append(features)
                labels.append(int(a["profile"] == b["profile"]))
                groups.append(a["profile"])
    return pd.DataFrame(rows, columns=PAIR_FEATURES), np.asarray(labels), np.asarray(groups)


def train_linkage_artifact(tables: dict) -> dict:
    features, labels, groups = build_pairs(tables)
    model = GradientBoostingClassifier(n_estimators=150, max_depth=3, random_state=42)
    probability = cross_val_predict(model, features, labels, cv=GroupKFold(n_splits=5), groups=groups, method="predict_proba")[:, 1]
    predicted = (probability >= DECISION_THRESHOLD).astype(int)
    model.fit(features, labels)
    return {
        "model": model,
        "features": PAIR_FEATURES,
        "version": MODEL_VERSION,
        "decision_threshold": DECISION_THRESHOLD,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "library": {"scikit-learn": sklearn.__version__, "python": platform.python_version()},
        "trained_on": {"pairs": int(len(labels)), "same_person_pairs": int(labels.sum()),
                       "profiles": int(len(set(groups)))},
        "cross_validation": {
            "scheme": "GroupKFold(5) grouped by criminal profile",
            "roc_auc": round(float(roc_auc_score(labels, probability)), 4),
            "average_precision": round(float(average_precision_score(labels, probability)), 4),
            "precision": round(float(precision_score(labels, predicted)), 4),
            "recall": round(float(recall_score(labels, predicted)), 4),
        },
        "feature_importance": {name: round(float(value), 4) for name, value in zip(PAIR_FEATURES, model.feature_importances_)},
    }
