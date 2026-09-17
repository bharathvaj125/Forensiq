from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from contextlib import asynccontextmanager
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.dependencies import get_db
from app.db.session import SessionLocal, engine
from app.db.init_db import seed_database
from app.db.base import Base
import logging

# Configure logging with a structured format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [%(name)s] - [%(filename)s:%(lineno)d] - %(message)s"
)
logger = logging.getLogger("ksp_backend")

import traceback

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager that handles startup database migrations
    and seeds initial datasets safely with explicit step logging and traceback capture.
    """
    logger.info("START: Lifespan initialization")
    try:
        logger.info("START: Register audit listeners")
        try:
            from app.middleware.audit_listeners import register_audit_listeners
            register_audit_listeners()
            logger.info("✓ Audit listeners registered")
        except Exception as exc:
            logger.error(f"EXCEPTION in Register audit listeners:\n{traceback.format_exc()}")

        logger.info("START: PostgreSQL connection")
        logger.info(f"Connecting to database (Dialect: {engine.dialect.name})...")

        if engine.dialect.name == "postgresql":
            with engine.begin() as conn:
                logger.info("START: CREATE EXTENSION vector")
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    logger.info("✓ CREATE EXTENSION vector success")
                except Exception as ext_err:
                    logger.error(f"EXCEPTION in CREATE EXTENSION vector:\n{traceback.format_exc()}")

                logger.info("START: CREATE EXTENSION postgis")
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                    logger.info("✓ CREATE EXTENSION postgis success")
                except Exception as ext_err:
                    logger.error(f"EXCEPTION in CREATE EXTENSION postgis:\n{traceback.format_exc()}")

                logger.info("START: ALTER TABLE report_jobs")
                try:
                    conn.execute(text('ALTER TABLE report_jobs ADD COLUMN IF NOT EXISTS "CreatedBy" INTEGER;'))
                    conn.execute(text('ALTER TABLE evidence ADD COLUMN IF NOT EXISTS "FileName" VARCHAR;'))
                    conn.execute(text('ALTER TABLE evidence ADD COLUMN IF NOT EXISTS "FilePath" VARCHAR;'))
                    conn.execute(text('ALTER TABLE evidence ADD COLUMN IF NOT EXISTS "FileUrl" VARCHAR;'))
                    conn.execute(text('ALTER TABLE evidence ADD COLUMN IF NOT EXISTS "FileSize" BIGINT;'))
                    conn.execute(text('ALTER TABLE evidence ADD COLUMN IF NOT EXISTS "UploadedBy" INTEGER;'))
                    logger.info("✓ ALTER TABLE report_jobs & evidence success")
                except Exception as alter_err:
                    logger.error(f"EXCEPTION in ALTER TABLE:\n{traceback.format_exc()}")

            logger.info("✓ PostgreSQL Connected")
        else:
            logger.info("✓ SQLite Engine Active")

        logger.info("START: Base.metadata.create_all")
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("✓ Schema Ready")
        except Exception as schema_err:
            logger.error(f"EXCEPTION in Base.metadata.create_all:\n{traceback.format_exc()}")
            raise schema_err

        logger.info("START: Remaining initialization")
        import threading
        def run_background_seed():
            try:
                db = SessionLocal()
                try:
                    seed_database(db)
                    logger.info("✓ Seed Complete")
                    try:
                        from backfill_risk_scores import backfill_all_risk_scores
                        backfill_all_risk_scores()
                        logger.info("✓ AI Risk Scores Backfill Complete")
                    except Exception as bf_err:
                        logger.error(f"Backfill notice: {bf_err}")
                    logger.info("✓ AI Ready")
                    logger.info("✓ Backend Ready")
                finally:
                    db.close()
            except Exception as seed_err:
                logger.error(f"EXCEPTION in background seed:\n{traceback.format_exc()}")

        threading.Thread(target=run_background_seed, daemon=True).start()

    except Exception as e:
        logger.critical(f"CRITICAL LIFESPAN FAILURE: {type(e).__name__}: {e}\n{traceback.format_exc()}")
        raise e

    yield

from fastapi import Depends
from fastapi.staticfiles import StaticFiles
import os
from app.core.dependencies import rate_limit_dependency

app = FastAPI(
    title="KSP Crime Intelligence & Investigation Platform",
    description="Core Backend API handling cases, network graph analytics, hotspots, and user RBAC.",
    version="1.0.0",
    dependencies=[Depends(rate_limit_dependency)],
    lifespan=lifespan
)

# CORSMiddleware registered first immediately after app instantiation
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.onslate\.in|https://.*\.catalystappsail\.in|http://localhost:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Audit & security HTTP headers middleware
from app.middleware.audit_hook import AuditLoggingMiddleware
app.add_middleware(AuditLoggingMiddleware)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Static uploads directory for evidence files (CCTV, images, docs)
from app.core.config import UPLOADS_DIR
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "evidence"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# Centralized exception handling
from app.core.exceptions import KSPException
from sqlalchemy.exc import IntegrityError
from fastapi.exceptions import RequestValidationError
from app.core.handlers import (
    ksp_exception_handler, db_integrity_error_handler,
    validation_exception_handler, unhandled_exception_handler
)

app.add_exception_handler(KSPException, ksp_exception_handler)
app.add_exception_handler(IntegrityError, db_integrity_error_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Include v1 router prefix AFTER CORS middleware setup
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    """
    Root endpoint for cloud platform (Catalyst AppSail) health checks.
    """
    return {
        "status": "online",
        "service": "KSP Crime Intelligence Platform API Backend",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint to verify database connectivity.
    Executes a simple 'SELECT 1' query.
    """
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        logger.warning(f"Database health check warning: {e}")
        db_status = "degraded"

    return {
        "status": "online",
        "database": db_status
    }
