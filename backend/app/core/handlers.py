import logging
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import KSPException

logger = logging.getLogger("ksp_backend")

def ksp_exception_handler(request: Request, exc: KSPException) -> JSONResponse:
    """Handles KSP custom business rule exceptions."""
    logger.warning(
        f"KSP Exception | Path: {request.url.path} | Exception: {exc.__class__.__name__} | Detail: {exc.message}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "code": exc.__class__.__name__,
            "message": exc.message
        }
    )

def db_integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    """Handles database integrity violations (e.g. unique constraint errors)."""
    error_msg = str(exc.orig) if exc.orig else str(exc)
    logger.error(f"Database Integrity Error | Path: {request.url.path} | Detail: {error_msg}")
    
    message = "Resource conflict: a record with these unique details already exists."
    if "duplicate key value violates unique constraint" in error_msg:
        if "ix_case_master_CrimeNo" in error_msg or "case_master_pkey" in error_msg:
            message = "A case with this crime or case number already exists."
        elif "users_Username_key" in error_msg or "users_pkey" in error_msg:
            message = "A user account with this username already exists."
            
        return JSONResponse(
            status_code=409,
            content={
                "status": "error",
                "code": "UniqueConstraintViolation",
                "message": message
            }
        )
        
    return JSONResponse(
        status_code=400,
        content={
            "status": "error",
            "code": "DatabaseIntegrityViolation",
            "message": "A database validation or foreign key check failed."
        }
    )

from fastapi.encoders import jsonable_encoder

def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handles Pydantic validation errors on incoming payloads."""
    err_list = jsonable_encoder(exc.errors())
    logger.warning(
        f"Request Validation Failure | Path: {request.url.path} | Errors: {err_list}"
    )
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "code": "ValidationError",
            "message": "The input data failed structural or business validation.",
            "details": err_list
        }
    )

def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions, logging traceback cleanly."""
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    logger.error(
        f"Unhandled Exception | Path: {request.url.path} | Error: {str(exc)}\nTraceback:\n{tb}"
    )
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "code": "InternalServerError",
            "message": "An unexpected server error occurred."
        }
    )
