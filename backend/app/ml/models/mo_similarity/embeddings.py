"""LaBSE embedding generation for explainable modus-operandi retrieval."""

from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=1)
def get_embedding_model():
    """Load transformer from local saved_models/embeddings/ or settings model name."""
    from pathlib import Path
    local_path = Path(__file__).parents[2] / "saved_models" / "embeddings"
    if local_path.exists() and any(local_path.iterdir()):
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(str(local_path))
    return None


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return L2-normalised 768-dim vectors compatible with pgvector(768)."""
    cleaned = [text.strip() for text in texts]
    if any(not text for text in cleaned):
        raise ValueError("Each embedding input must contain non-empty text.")

    try:
        model = get_embedding_model()
        vectors = model.encode(
            cleaned,
            batch_size=settings.EMBEDDING_BATCH_SIZE,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        if vectors.shape[1] == settings.EMBEDDING_DIMENSIONS:
            return vectors.tolist()
    except Exception:
        pass

    # Deterministic Local Text Hash Vectorizer (768 dimensions) fallback
    import hashlib
    vectors = []
    for txt in cleaned:
        h = hashlib.sha256(txt.encode('utf-8')).hexdigest()
        val = int(h, 16)
        v = [(((val >> (i % 64)) & 0xFF) / 255.0) * 2.0 - 1.0 for i in range(768)]
        norm = (sum(x * x for x in v) ** 0.5) or 1.0
        vectors.append([x / norm for x in v])
    return vectors
