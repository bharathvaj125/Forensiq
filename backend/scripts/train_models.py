"""Train and save the ML artifacts from the seed CSVs (database/seeds/data).

    python scripts/train_models.py

Writes app/ml/saved_models/risk_scoring_rf.joblib and repeat_offender.joblib.
Run scripts/evaluate_models.py afterwards for the full evaluation against the dataset's ground truth.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib  # noqa: E402

from app.db.data_repair import find_seed_dir  # noqa: E402
from app.ml.features import load_seed_tables  # noqa: E402
from app.ml.models.repeat_offender import linkage  # noqa: E402
from app.ml.models.repeat_offender.train import train_linkage_artifact  # noqa: E402
from app.ml.models.risk_scoring.scorer import ARTIFACT_PATH as RISK_ARTIFACT  # noqa: E402
from app.ml.models.risk_scoring.train import train_risk_artifact  # noqa: E402

if __name__ == "__main__":
    seed_dir = find_seed_dir()
    if not seed_dir:
        raise SystemExit("Seed CSV directory (database/seeds/data) not found.")

    print("== Risk model ==")
    risk = train_risk_artifact(seed_dir)
    RISK_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(risk, RISK_ARTIFACT)
    print(json.dumps({"saved": str(RISK_ARTIFACT), "version": risk["version"], "chosen": risk["chosen_config"],
                      "cross_validation": risk["cross_validation"]["chosen"]}, indent=2))

    print("== Repeat-offender linkage model ==")
    link = train_linkage_artifact(load_seed_tables(seed_dir))
    joblib.dump(link, linkage.ARTIFACT_PATH)
    print(json.dumps({"saved": str(linkage.ARTIFACT_PATH), "version": link["version"], "trained_on": link["trained_on"],
                      "cross_validation": link["cross_validation"], "feature_importance": link["feature_importance"]}, indent=2))
