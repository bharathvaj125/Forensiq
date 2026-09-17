import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_DIR = os.path.dirname(APP_DIR)
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

def get_discovered_db_url() -> str:
    """
    Safely discovers and sanitizes DATABASE_URL from environment variables.
    Checks DATABASE_URL, POSTGRES_URL, SQLALCHEMY_DATABASE_URI, and CATALYST_DATABASE_URL.
    """
    candidate_keys = ["DATABASE_URL", "POSTGRES_URL", "SQLALCHEMY_DATABASE_URI", "CATALYST_DATABASE_URL"]
    raw_url = ""
    for key in candidate_keys:
        val = os.getenv(key, "").strip()
        if val:
            raw_url = val
            break

    if raw_url:
        # Strip key name prefix if accidentally included in environment value
        if raw_url.startswith("DATABASE_URL="):
            raw_url = raw_url.replace("DATABASE_URL=", "", 1).strip()
        if raw_url.startswith("postgres://"):
            raw_url = raw_url.replace("postgres://", "postgresql://", 1)
        # Strip surrounding quotes if present
        raw_url = raw_url.strip("'\"")
        os.environ["DATABASE_URL"] = raw_url
        return raw_url

    # No DATABASE_URL configured: fall back to the local SQLite file for dev only.
    # Production deployments MUST set DATABASE_URL as a real environment variable.
    default_url = f"sqlite:///{os.path.join(BASE_DIR, 'ksp_crime_intel.db')}"
    os.environ["DATABASE_URL"] = default_url
    return default_url

class Settings(BaseSettings):
    # --- PostgreSQL / Database ---
    POSTGRES_USER: str = "ksp_admin"
    POSTGRES_PASSWORD: str = "change_me"
    POSTGRES_DB: str = "ksp_crime_intel"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = get_discovered_db_url()

    # --- Redis (Optional) ---
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", None)

    # --- JWT Auth ---
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "dev-only-insecure-secret-set-a-real-one-in-env")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_HOURS: int = 8

    # --- Backend settings ---
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    CORS_ALLOWED_ORIGINS: str = "*"

    # --- AI Engine ---
    AI_ENGINE_HOST: str = "0.0.0.0"
    AI_ENGINE_PORT: int = 8100
    AI_ENGINE_BASE_URL: str = os.getenv("AI_ENGINE_BASE_URL", "http://ai-engine:8100")

    # --- LLM settings ---
    LLM_PROVIDER: str = "anthropic"
    LLM_API_KEY: str = os.getenv("LLM_API_KEY", "change_me")
    LLM_MODEL: str = "claude-sonnet-4-6"

    # --- Embeddings ---
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/LaBSE"
    EMBEDDING_MODEL_VERSION: str = "phase4-labse-v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
