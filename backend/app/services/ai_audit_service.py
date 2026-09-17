import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.ai_model_run import AIModelRun


def log_ai_run(db: Session, user_id: int, capability: str, model_name: str, model_version: str, resource_id: str | None, summary: dict) -> None:
    db.add(AIModelRun(
        UserID=user_id,
        Capability=capability,
        ModelName=model_name,
        ModelVersion=model_version,
        ResourceID=resource_id,
        ResultSummary=json.dumps(summary, default=str),
    ))
    db.commit()
