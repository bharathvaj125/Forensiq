"""Per-case explanation of the risk model by decision-path attribution (Saabas method).

For each tree in the forest the path a case takes from root to leaf is walked, and the change in the
tree's estimated probability of a High/Severe rating at every split is credited to the feature that
split on. Contributions are averaged over the forest, so that

    bias + sum(contributions) == the forest's predicted probability of High/Severe.

This is a transparent path-based attribution, not SHAP / Shapley values.
"""

from __future__ import annotations

import numpy as np

from app.ml.features import FEATURE_LABELS, WEEKDAYS


class PathExplainer:
    def __init__(self, model, feature_names: list[str], target_classes: tuple[int, ...]):
        self.model = model
        self.feature_names = feature_names
        self.target_classes = list(target_classes)
        self._node_probabilities = []
        for estimator in model.estimators_:
            values = estimator.tree_.value[:, 0, :]
            totals = values.sum(axis=1)
            totals[totals == 0] = 1.0
            self._node_probabilities.append(values[:, self.target_classes].sum(axis=1) / totals)

    def explain(self, row: np.ndarray) -> tuple[float, dict[str, float]]:
        contributions = np.zeros(len(self.feature_names))
        bias = 0.0
        sample = np.asarray([row], dtype=float)
        for estimator, node_probability in zip(self.model.estimators_, self._node_probabilities):
            path = estimator.decision_path(sample).indices
            bias += node_probability[path[0]]
            split_features = estimator.tree_.feature
            for parent, child in zip(path[:-1], path[1:]):
                contributions[split_features[parent]] += node_probability[child] - node_probability[parent]
        n_trees = len(self.model.estimators_)
        return bias / n_trees, {name: float(value / n_trees) for name, value in zip(self.feature_names, contributions)}


def _value_text(name: str, value: float, value_labels: dict[str, dict[int, str]]) -> str:
    if name in ("IsHeinous", "HasRepeatAccused"):
        return "Yes" if value >= 1 else "No"
    if name == "IncidentWeekday":
        return WEEKDAYS[int(value)] if 0 <= int(value) < 7 else "unknown"
    if name == "IncidentHour":
        return f"{int(value):02d}:00" if value >= 0 else "unknown"
    if name in value_labels:
        return value_labels[name].get(int(value), f"#{int(value)}")
    return f"{value:.4g}"  # four significant figures: 0.0240899 hours reads as 0.02409


def describe_factor(name: str, value: float, contribution: float, reference: dict, value_labels: dict) -> str:
    label = FEATURE_LABELS.get(name, name)
    points = abs(contribution) * 100.0
    verb = "raises" if contribution > 0 else "lowers"
    text = f"{label}: {_value_text(name, value, value_labels)} {verb} the estimated chance of a High/Severe rating by {points:.1f} percentage points"
    typical = reference.get(name, {}).get("median")
    if typical is not None and name not in ("IsHeinous", "HasRepeatAccused", "IncidentWeekday", "IncidentHour") and name not in value_labels:
        text += f" (typical case: {typical:.4g})"
    return text + "."


def explain_case(artifact: dict, row: dict, value_labels: dict | None = None) -> dict:
    from app.ml.models.risk_scoring.train import HIGH_CLASS_INDEXES

    value_labels = value_labels or {}
    explainer = PathExplainer(artifact["model"], artifact["features"], HIGH_CLASS_INDEXES)
    vector = np.asarray([row[name] for name in artifact["features"]], dtype=float)
    bias, contributions = explainer.explain(vector)

    total = sum(abs(v) for v in contributions.values()) or 1.0
    factors = []
    for name, contribution in contributions.items():
        factors.append({
            "feature": name,
            "contribution": round(contribution, 4),
            "percentage": round(abs(contribution) / total * 100.0, 2),
            "direction": "increase" if contribution > 0 else "decrease",
            "description": describe_factor(name, row[name], contribution, artifact["reference"], value_labels),
        })
    factors.sort(key=lambda item: abs(item["contribution"]), reverse=True)
    return {"baseline_probability": round(bias, 4), "factors": factors}


def global_importance(artifact: dict) -> list[dict]:
    importances = artifact["model"].feature_importances_
    ranking = [
        {"feature_name": name, "label": FEATURE_LABELS.get(name, name), "global_importance": round(float(weight), 4)}
        for name, weight in zip(artifact["features"], importances)
    ]
    return sorted(ranking, key=lambda item: item["global_importance"], reverse=True)
