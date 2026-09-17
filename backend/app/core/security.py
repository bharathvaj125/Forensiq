import re
import bcrypt
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
from jose import jwt, JWTError
from app.core.config import settings

logger = logging.getLogger("ksp_backend")

# Initialize Redis client safely and gracefully make it optional
redis_client = None
if settings.REDIS_URL and settings.REDIS_URL.strip():
    try:
        import redis
        client = redis.from_url(settings.REDIS_URL.strip(), decode_responses=True, socket_timeout=1.0)
        client.ping()
        redis_client = client
        logger.info("Connected to Redis successfully.")
    except Exception as e:
        logger.info(f"Redis is disabled or unreachable ({e}). Operating in non-Redis mode.")
        redis_client = None
else:
    logger.info("REDIS_URL not configured. Operating in non-Redis mode.")

def hash_password(password: str) -> str:
    """Hashes a plain password using native bcrypt."""
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password using native bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Creates a JWT access token for the subject."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Creates a JWT refresh token for the subject."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_REFRESH_TOKEN_EXPIRE_HOURS)

    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decodes a JWT token and returns its claims. Returns an empty dict on failure."""
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return {}

def validate_password_strength(password: str) -> Optional[str]:
    """Validates password strength."""
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return "Password must contain at least one digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return "Password must contain at least one special character."
    return None

def check_rate_limit(ip: str, limit: int = 100, window: int = 60) -> bool:
    """
    Evaluates rate limiting in Redis if available.
    If Redis is unavailable or disabled, rate limiting is bypassed gracefully.
    """
    if not redis_client:
        return True

    key = f"rate_limit:{ip}"
    try:
        current = redis_client.get(key)
        if current and int(current) >= limit:
            return False

        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window, nx=True)
        pipe.execute()
        return True
    except Exception:
        return True  # Fallback gracefully without throwing errors

def record_failed_login(username: str) -> int:
    """Records failed login attempts in Redis if available."""
    if not redis_client:
        return 0

    attempts_key = f"login_attempts:{username}"
    lockout_key = f"lockout:{username}"
    try:
        attempts = redis_client.incr(attempts_key)
        redis_client.expire(attempts_key, 900)

        if attempts >= 5:
            redis_client.setex(lockout_key, 900, "1")
            logger.warning(f"Account locked out due to failed logins | Username: {username}")

        return attempts
    except Exception:
        return 0

def is_account_locked(username: str) -> bool:
    """Checks if a username is locked in Redis if available."""
    if not redis_client:
        return False

    try:
        return redis_client.exists(f"lockout:{username}") > 0
    except Exception:
        return False

def reset_failed_logins(username: str):
    """Resets failed login attempts in Redis if available."""
    if not redis_client:
        return

    try:
        redis_client.delete(f"login_attempts:{username}", f"lockout:{username}")
    except Exception:
        pass

def revoke_refresh_token(token: str, expires_in_seconds: int = 28800):
    """Revokes a refresh token in Redis if available."""
    if not redis_client:
        return

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    try:
        redis_client.setex(f"revoked_token:{token_hash}", expires_in_seconds, "1")
    except Exception:
        pass

def is_token_revoked(token: str) -> bool:
    """Checks if a refresh token is revoked in Redis if available."""
    if not redis_client:
        return False

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    try:
        return redis_client.exists(f"revoked_token:{token_hash}") > 0
    except Exception:
        return False
