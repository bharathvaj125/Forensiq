"""Thin client for Google's Gemini API - chat generation and text embeddings."""

import httpx

from app.core.config import settings

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def generate_content(prompt: str, timeout: float = 20.0) -> str:
    """Sends a single-turn prompt to the configured Gemini model and returns its text reply."""
    url = f"{BASE_URL}/{settings.LLM_MODEL}:generateContent?key={settings.LLM_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise ValueError("Gemini returned an empty response")
    return text


def embed_texts(texts: list[str], dimensions: int = 768, timeout: float = 20.0) -> list[list[float]]:
    """Embeds each text independently via Gemini's embedContent endpoint at a fixed output dimension."""
    url = f"{BASE_URL}/{settings.EMBEDDING_MODEL_NAME}:embedContent?key={settings.LLM_API_KEY}"
    vectors = []
    with httpx.Client(timeout=timeout) as client:
        for text in texts:
            payload = {
                "content": {"parts": [{"text": text}]},
                "outputDimensionality": dimensions,
            }
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            values = data.get("embedding", {}).get("values", [])
            if len(values) != dimensions:
                raise ValueError(f"Expected {dimensions}-dim embedding, got {len(values)}")
            vectors.append(values)
    return vectors
