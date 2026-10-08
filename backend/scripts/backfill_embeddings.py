"""Embed every case that has no embedding yet (resumable: re-run to continue).

    python scripts/backfill_embeddings.py [--max-batches N]

Uses Gemini batch embedding (100 narratives per request). Stops cleanly when the free-tier quota is hit and
reports how long until it resets."""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.migrations import ensure_columns  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.case_embedding import CaseEmbedding  # noqa: E402
from app.models.case_master import CaseMaster  # noqa: E402
from app.services.gemini_client import GeminiError, GeminiQuotaError, embed_texts  # noqa: E402

BATCH = 100

if __name__ == "__main__":
    max_batches = int(sys.argv[sys.argv.index("--max-batches") + 1]) if "--max-batches" in sys.argv else 10**9
    ensure_columns(engine)
    db = SessionLocal()
    try:
        done = select(CaseEmbedding.CaseMasterID).where(
            CaseEmbedding.EmbeddingModel == settings.EMBEDDING_MODEL_NAME, CaseEmbedding.Version == settings.EMBEDDING_MODEL_VERSION)
        pending = db.query(CaseMaster.CaseMasterID, CaseMaster.BriefFacts).filter(
            CaseMaster.BriefFacts.isnot(None), CaseMaster.BriefFacts != "", CaseMaster.CaseMasterID.notin_(done)
        ).order_by(CaseMaster.CaseMasterID).all()
        print(f"{len(pending)} cases still need embeddings")
        batches = 0
        for start in range(0, len(pending), BATCH):
            if batches >= max_batches:
                break
            chunk = pending[start:start + BATCH]
            vectors = None
            for attempt in range(8):
                try:
                    vectors = embed_texts([facts for _, facts in chunk], dimensions=768)
                    break
                except GeminiQuotaError as exc:
                    if exc.retry_after > 300:  # a daily limit, not a per-minute one
                        print(f"Daily quota reached after {batches} batches; retry in about {exc.retry_after / 3600:.1f} hours. Re-run to resume.")
                        break
                    print(f"  per-minute limit; waiting {exc.retry_after + 2:.0f}s")
                    time.sleep(exc.retry_after + 2)
                except GeminiError as exc:
                    print(f"Stopped: {exc}")
                    break
            if vectors is None:
                break
            db.add_all([CaseEmbedding(CaseMasterID=case_id, EmbeddingVector=vector, EmbeddingModel=settings.EMBEDDING_MODEL_NAME,
                                      Version=settings.EMBEDDING_MODEL_VERSION) for (case_id, _), vector in zip(chunk, vectors)])
            db.commit()
            batches += 1
            print(f"batch {batches}: embedded {start + len(chunk)}/{len(pending)}")
            time.sleep(1)
        total = db.query(CaseEmbedding).count()
        print(f"case_embedding rows now: {total}")
    finally:
        db.close()
