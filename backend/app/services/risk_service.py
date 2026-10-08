"""Scoring cases with the risk model and persisting the result."""

from __future__ import annotations

import logging

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.bulk import bulk_update
from app.ml.features import case_feature_frame
from app.ml.models.risk_scoring import scorer
from app.models.case_master import CaseMaster
from app.services import cache

logger = logging.getLogger("ksp_backend")


def score_cases(db: Session, cases: list[CaseMaster] | None = None) -> int:
    """Score the given cases (every case when None) and persist score, level and model version.

    InvestigationPriority is set from the AI level only for cases never scored before, or with no
    priority yet, so an officer's manual priority is not overwritten by a later re-score."""
    if cases is None:
        cases = db.query(CaseMaster).all()
    if not cases:
        return 0
    scored = scorer.score_frame(case_feature_frame(db, cases))
    version = scorer.model_version()
    rows = []
    for case in cases:
        entry = scored.loc[case.CaseMasterID]
        unset_priority = case.InvestigationPriority is None or case.AIRiskModelVersion is None
        rows.append({
            "CaseMasterID": case.CaseMasterID,
            "AIRiskScore": round(float(entry["score"]), 4),
            "AIRiskLevel": entry["level"],
            "AIRiskModelVersion": version,
            "InvestigationPriority": scorer.PRIORITY_BY_LEVEL[entry["level"]] if unset_priority else case.InvestigationPriority,
        })
    bulk_update(db, CaseMaster, "CaseMasterID", "bigint", {
        "AIRiskScore": "float8", "AIRiskLevel": "text", "AIRiskModelVersion": "text", "InvestigationPriority": "text",
    }, rows)
    db.expire_all()
    cache.clear()
    return len(rows)


def ensure_scores_current(db: Session) -> int:
    """Re-score every case whose stored score is missing or came from a different model version."""
    version = scorer.model_version()
    stale = db.query(CaseMaster).filter(
        or_(CaseMaster.AIRiskModelVersion.is_(None), CaseMaster.AIRiskModelVersion != version)
    ).count()
    if not stale:
        return 0
    logger.info("Re-scoring cases with %s (%d stale)", version, stale)
    return score_cases(db)
