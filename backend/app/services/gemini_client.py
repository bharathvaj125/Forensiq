"""Thin client for Google's Gemini API: text generation, tool calling and embeddings.

Free-tier quotas are per model per day (gemini-3.6-flash allows only 20 requests/day), so generation walks a
chain of configured models: when one is out of quota or overloaded it is put on cooldown and the next is tried."""

import re
import threading
import time

import httpx

from app.core.config import settings

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_RETRYABLE_STATUS = {500, 502, 503, 504}
DEFAULT_THINKING_LEVEL = "low"  # thinking models take 15+ s on trivial prompts by default
MAX_COOLDOWN_SECONDS = 6 * 3600
UNAVAILABLE_COOLDOWN_SECONDS = 60

_cooldowns: dict[str, float] = {}
_no_thinking_config: set[str] = set()
_lock = threading.Lock()


class GeminiError(RuntimeError):
    """The model could not be reached or returned nothing usable."""


class GeminiQuotaError(GeminiError):
    def __init__(self, message: str, retry_after: float = 0.0):
        super().__init__(message)
        self.retry_after = retry_after


def model_chain() -> list[str]:
    configured = [name.strip() for name in settings.LLM_MODELS.split(",") if name.strip()]
    return configured or [settings.LLM_MODEL]


def available_models() -> list[str]:
    now = time.time()
    with _lock:
        return [model for model in model_chain() if _cooldowns.get(model, 0.0) <= now]


def put_on_cooldown(model: str, seconds: float) -> None:
    with _lock:
        _cooldowns[model] = time.time() + min(max(seconds, 1.0), MAX_COOLDOWN_SECONDS)


def soonest_available_in() -> float:
    with _lock:
        waits = [_cooldowns.get(model, 0.0) - time.time() for model in model_chain()]
    return max(min(waits), 0.0) if waits else 0.0


def _retry_delay_seconds(response: httpx.Response) -> float:
    try:
        for detail in response.json().get("error", {}).get("details", []):
            if "retryDelay" in detail:
                return float(re.sub(r"[^\d.]", "", detail["retryDelay"]) or 0)
    except ValueError:
        pass
    return 60.0


def _post(client: httpx.Client, url: str, payload: dict, attempts: int = 3) -> httpx.Response:
    # Key goes in a header, not the URL, so it never shows up in httpx request logs.
    headers = {"x-goog-api-key": settings.LLM_API_KEY}
    for attempt in range(attempts):
        response = client.post(url, json=payload, headers=headers)
        if response.status_code == 429:
            raise GeminiQuotaError(f"Quota exhausted ({url.split('/')[-1].split(':')[0]})", _retry_delay_seconds(response))
        if response.status_code in _RETRYABLE_STATUS and attempt < attempts - 1:
            time.sleep(2 ** attempt)
            continue
        response.raise_for_status()
        return response


def _generate_with_model(model: str, body: dict, timeout: float) -> dict:
    url = f"{BASE_URL}/{model}:generateContent"
    try:
        with httpx.Client(timeout=timeout) as client:
            return _post(client, url, body).json()
    except httpx.HTTPStatusError as exc:
        raise GeminiError(f"{model}: HTTP {exc.response.status_code} {exc.response.text[:200]}") from exc
    except httpx.HTTPError as exc:
        raise GeminiError(f"{model}: request failed ({type(exc).__name__})") from exc


def generate_raw(contents: list[dict], *, tools: list[dict] | None = None, system_instruction: str | None = None,
                 model: str | None = None, thinking_level: str = DEFAULT_THINKING_LEVEL, json_output: bool = False,
                 timeout: float = 60.0) -> dict:
    """One generateContent call on `model` (default: first available in the chain, falling through the chain on
    quota/availability errors). Returns the model's content object ({role, parts}) exactly as received so it can be
    appended to `contents` unchanged (tool calling needs its thought signatures)."""
    candidates_models = [model] if model else available_models()
    if not candidates_models:
        raise GeminiQuotaError("Every configured model is rate-limited.", soonest_available_in())

    last_error: GeminiError | None = None
    for name in candidates_models:
        body: dict = {"contents": contents}
        generation_config: dict = {}
        if name not in _no_thinking_config:
            generation_config["thinkingConfig"] = {"thinkingLevel": thinking_level}
        if json_output:
            generation_config["responseMimeType"] = "application/json"
        if generation_config:
            body["generationConfig"] = generation_config
        if system_instruction:
            body["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        if tools:
            body["tools"] = [{"functionDeclarations": tools}]
        try:
            try:
                data = _generate_with_model(name, body, timeout)
            except GeminiError as exc:
                if "HTTP 400" in str(exc) and "thinking" in str(exc).lower() and "thinkingConfig" in body.get("generationConfig", {}):
                    _no_thinking_config.add(name)
                    body["generationConfig"].pop("thinkingConfig")
                    if not body["generationConfig"]:
                        body.pop("generationConfig")
                    data = _generate_with_model(name, body, timeout)
                else:
                    raise
        except GeminiQuotaError as exc:
            put_on_cooldown(name, exc.retry_after)
            last_error = exc
            continue
        except GeminiError as exc:
            put_on_cooldown(name, UNAVAILABLE_COOLDOWN_SECONDS)
            last_error = exc
            continue
        candidates = data.get("candidates") or []
        if not candidates or not candidates[0].get("content", {}).get("parts"):
            reason = (candidates[0].get("finishReason") if candidates else None) or data.get("promptFeedback", {}).get("blockReason")
            last_error = GeminiError(f"{name}: no content ({reason or 'unknown reason'})")
            continue
        result = candidates[0]["content"]
        result["_model"] = name  # which model produced this turn (stripped before it is sent back)
        return result
    raise last_error or GeminiError("No model produced an answer.")


def strip_internal(content: dict) -> dict:
    return {key: value for key, value in content.items() if not key.startswith("_")}


def generate_content(prompt: str, timeout: float = 60.0) -> str:
    """Sends a single-turn prompt and returns the text reply."""
    content = generate_raw([{"role": "user", "parts": [{"text": prompt}]}], timeout=timeout)
    text = "".join(part.get("text", "") for part in content["parts"]).strip()
    if not text:
        raise GeminiError("Gemini returned an empty response")
    return text


def embed_texts(texts: list[str], dimensions: int = 768, timeout: float = 60.0) -> list[list[float]]:
    """Embeds texts with batchEmbedContents (up to 100 per request) at a fixed output dimension."""
    url = f"{BASE_URL}/{settings.EMBEDDING_MODEL_NAME}:batchEmbedContents"
    vectors: list[list[float]] = []
    try:
        with httpx.Client(timeout=timeout) as client:
            for start in range(0, len(texts), 100):
                chunk = texts[start:start + 100]
                payload = {"requests": [{
                    "model": f"models/{settings.EMBEDDING_MODEL_NAME}",
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": dimensions,
                } for text in chunk]}
                embeddings = _post(client, url, payload).json().get("embeddings", [])
                if len(embeddings) != len(chunk):
                    raise GeminiError(f"Expected {len(chunk)} embeddings, got {len(embeddings)}")
                for item in embeddings:
                    values = item.get("values", [])
                    if len(values) != dimensions:
                        raise GeminiError(f"Expected {dimensions}-dim embedding, got {len(values)}")
                    vectors.append(values)
    except httpx.HTTPError as exc:
        raise GeminiError(f"Embedding request failed: {exc}") from exc
    return vectors
