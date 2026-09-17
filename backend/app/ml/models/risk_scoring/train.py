"""
Training script for the risk scoring model against labeled case data.
"""

import os
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier


def generate_synthetic_crime_data(path: str, num_records: int = 1000):
    """Generate high-quality synthetic crime data to seed the risk model training."""
    np.random.seed(42)
    gravity_options = ["Heinous", "Non-Heinous"]
    gravity = np.random.choice(gravity_options, size=num_records, p=[0.25, 0.75])

    delay = np.random.exponential(scale=24.0, size=num_records)
    age = np.random.randint(5, 730, size=num_records)
    num_accused = np.random.poisson(lam=1.5, size=num_records) + 1
    num_evidence = np.random.poisson(lam=3.0, size=num_records)

    raw_score = (
        (gravity == "Heinous").astype(int) * 0.40 +
        (delay > 48.0).astype(int) * 0.15 +
        (age > 180).astype(int) * 0.15 +
        (num_accused >= 3).astype(int) * 0.15 +
        (num_evidence <= 1).astype(int) * 0.15
    )

    risk_labels = []
    for score in raw_score:
        if score >= 0.60:
            risk_labels.append("High")
        elif score >= 0.30:
            risk_labels.append("Medium")
        else:
            risk_labels.append("Low")

    df = pd.DataFrame({
        "GravityOffenceName": gravity,
        "ReportingDelayHours": delay,
        "CaseAgeDays": age,
        "NumberOfAccused": num_accused,
        "NumberOfEvidenceItems": num_evidence,
        "RiskLabel": risk_labels
    })

    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    print(f"Generated {num_records} synthetic crime records at {path}.")


def train_risk_model(data_path: str) -> RandomForestClassifier:
    """Train and return the RandomForestClassifier on the training dataset."""
    if not os.path.exists(data_path):
        generate_synthetic_crime_data(data_path)

    data = pd.read_csv(data_path)

    data["GravityOffenceName"] = data["GravityOffenceName"].fillna("Non-Heinous")
    data["ReportingDelayHours"] = pd.to_numeric(data["ReportingDelayHours"], errors="coerce").fillna(0.0)
    data["CaseAgeDays"] = pd.to_numeric(data["CaseAgeDays"], errors="coerce").fillna(0.0)
    data["NumberOfAccused"] = pd.to_numeric(data["NumberOfAccused"], errors="coerce").fillna(0.0)
    data["NumberOfEvidenceItems"] = pd.to_numeric(data["NumberOfEvidenceItems"], errors="coerce").fillna(0.0)
    data["RiskLabel"] = data["RiskLabel"].fillna("Medium")

    features = pd.DataFrame({
        "GravityOffenceID": data["GravityOffenceName"].eq("Heinous").astype(int),
        "ReportingDelayHours": data["ReportingDelayHours"],
        "CaseAgeDays": data["CaseAgeDays"],
        "NumberOfAccused": data["NumberOfAccused"],
        "NumberOfEvidenceItems": data["NumberOfEvidenceItems"]
    })

    target = data["RiskLabel"].map({"Low": 0, "Medium": 1, "High": 2, "Severe": 2}).fillna(1).astype(int)

    model = RandomForestClassifier(
        n_estimators=160,
        max_depth=8,
        min_samples_leaf=3,
        random_state=42,
        class_weight="balanced"
    )
    model.fit(features, target)
    return model
