"""Train the case risk model on the dataset's real RiskLabel (CrimeCases_AI.csv).

    python scripts/train_models.py

Every metric stored in the artifact comes from 5-fold stratified cross-validation on the labelled data.
"""

from __future__ import annotations

import platform
from datetime import datetime, timezone

import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, log_loss, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from app.ml.features import RISK_FEATURES, load_seed_tables, seed_feature_frame, seed_risk_labels

RISK_CLASSES = ["Low", "Medium", "High", "Severe"]
HIGH_CLASS_INDEXES = (2, 3)  # the score is P(High) + P(Severe)
MODEL_VERSION = "risk-rf-v4-real-labels"


def _cv_metrics(y: np.ndarray, proba: np.ndarray) -> dict:
    pred = proba.argmax(axis=1)
    precision, recall, f1, support = precision_recall_fscore_support(y, pred, labels=range(len(RISK_CLASSES)), zero_division=0)
    high_probability = proba[:, list(HIGH_CLASS_INDEXES)].sum(axis=1)
    return {
        "accuracy": round(float(accuracy_score(y, pred)), 4),
        "macro_f1": round(float(f1_score(y, pred, average="macro")), 4),
        "log_loss": round(float(log_loss(y, proba, labels=range(len(RISK_CLASSES)))), 4),
        "high_or_severe_auc": round(float(roc_auc_score((y >= HIGH_CLASS_INDEXES[0]).astype(int), high_probability)), 4),
        "per_class": {
            name: {"precision": round(float(precision[i]), 4), "recall": round(float(recall[i]), 4),
                   "f1": round(float(f1[i]), 4), "support": int(support[i])}
            for i, name in enumerate(RISK_CLASSES)
        },
    }


def train_risk_artifact(seed_dir: str) -> dict:
    tables = load_seed_tables(seed_dir)
    features = seed_feature_frame(tables)
    labels = seed_risk_labels(tables).reindex(features.index)
    y = labels.map({name: i for i, name in enumerate(RISK_CLASSES)}).astype(int).to_numpy()

    candidates = {
        "class_weight=balanced": {"class_weight": "balanced"},
        "class_weight=None": {"class_weight": None},
    }
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results = {}
    for name, options in candidates.items():
        model = RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=42, n_jobs=-1, **options)
        proba = cross_val_predict(model, features, y, cv=folds, method="predict_proba")
        results[name] = _cv_metrics(y, proba)

    chosen = max(results, key=lambda key: results[key]["macro_f1"])
    final = RandomForestClassifier(n_estimators=300, min_samples_leaf=3, random_state=42, n_jobs=1, **candidates[chosen])
    final.fit(features, y)

    majority_share = float(np.bincount(y).max() / len(y))
    reference = {
        name: {"median": float(features[name].median()), "p25": float(features[name].quantile(0.25)),
               "p75": float(features[name].quantile(0.75)), "p90": float(features[name].quantile(0.90))}
        for name in RISK_FEATURES
    }
    return {
        "model": final,
        "features": RISK_FEATURES,
        "classes": RISK_CLASSES,
        "version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "trained_on": {"source": "CrimeCases_AI.csv RiskLabel", "rows": int(len(y)),
                       "class_counts": {name: int((y == i).sum()) for i, name in enumerate(RISK_CLASSES)}},
        "library": {"scikit-learn": sklearn.__version__, "python": platform.python_version()},
        "chosen_config": chosen,
        "cross_validation": {"folds": 5, "candidates": results, "chosen": results[chosen],
                             "majority_class_accuracy": round(majority_share, 4)},
        "reference": reference,
    }
