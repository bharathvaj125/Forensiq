print("========== SESSION.PY VERSION e1b3c73 ==========")
import os
import sys
import socket
import logging
import traceback
from urllib.parse import urlparse, parse_qs
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings, BASE_DIR

logger = logging.getLogger("ksp_backend")
logger.warning("========== SESSION.PY VERSION e1b3c73 ==========")

def get_masked_url(url: str) -> str:
    """Masks password in connection URL for safe logging."""
    try:
        parsed = urlparse(url)
        if parsed.password:
            return url.replace(f":{parsed.password}@", ":****@")
        return url
    except Exception:
        return "postgresql://****"

db_url = settings.DATABASE_URL
masked_url = get_masked_url(db_url)

# Extract connection parameters for explicit logging
try:
    parsed = urlparse(db_url)
    query_params = parse_qs(parsed.query)
    sslmode = query_params.get("sslmode", ["not specified"])[0]
    host = parsed.hostname or ""
    port = parsed.port or 5432
    database = parsed.path.lstrip("/")
    username = parsed.username or ""
except Exception:
    host, port, database, username, sslmode = "unknown", 5432, "unknown", "unknown", "unknown"

logger.info("==========================================================")
logger.info("       POSTGRESQL CONNECTION ATTEMPT METRICS             ")
logger.info("==========================================================")
logger.info(f"DATABASE_URL : {masked_url}")
logger.info(f"Host         : {host}")
logger.info(f"Port         : {port}")
logger.info(f"Database     : {database}")
logger.info(f"Username     : {username}")
logger.info(f"SSL Mode     : {sslmode}")

# Raw Socket & DNS Pre-Check
try:
    logger.info(f"Executing DNS getaddrinfo check for '{host}':{port}...")
    addr_info = socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
    resolved_ips = list(set([item[4][0] for item in addr_info if item[4]]))
    logger.info(f"DNS RESOLVED '{host}' -> {resolved_ips}")
except Exception as dns_err:
    logger.error("DNS RESOLUTION FAILURE:")
    logger.error("Exception type: %s", type(dns_err))
    logger.error("Exception repr: %r", dns_err)

def create_resilient_db_engine():
    if db_url.startswith("sqlite"):
        logger.info(f"Initializing SQLite Database Engine: {db_url}")
        return create_engine(db_url, connect_args={"check_same_thread": False})

    logger.info("Initializing SQLAlchemy Engine for PostgreSQL...")
    try:
        eng = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=300
        )
        logger.info(f"SQLAlchemy Dialect: {eng.dialect.name}")
        with eng.connect() as conn:
            ver_result = conn.execute(text("SELECT version();")).scalar()
            logger.info(f"SUCCESS! PostgreSQL Version: {ver_result}")
        return eng
    except Exception as e:
        logger.error("==========================================================")
        logger.error("       FULL POSTGRESQL CONNECTION FAILURE DETAILS         ")
        logger.error("==========================================================")
        logger.error("Exception type: %s", type(e))
        logger.error("Exception repr: %r", e)
        if hasattr(e, "orig"):
            logger.error("Original psycopg2 exception: %r", e.orig)
            logger.error("Original psycopg2 pgcode: %s", getattr(e.orig, "pgcode", None))
            logger.error("Original psycopg2 pgerror: %s", getattr(e.orig, "pgerror", None))
        logger.error(traceback.format_exc())
        
        logger.warning("Falling back to local SQLite engine to guarantee container stability, live logging, and login functionality.")
        fallback_path = os.path.join(BASE_DIR, "ksp_crime_intel.db")
        return create_engine(f"sqlite:///{fallback_path}", connect_args={"check_same_thread": False})

engine = create_resilient_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
