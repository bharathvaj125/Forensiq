import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("ksp_backend")

class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Centralized HTTP access logging and exception handling middleware.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        client_host = request.client.host if request.client else "unknown"
        method = request.method
        url_path = request.url.path
        
        if method == "OPTIONS":
            return await call_next(request)
        
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            
            logger.info(
                f"HTTP ACCESS | Client: {client_host} | Method: {method} | Path: {url_path} "
                f"| Status: {response.status_code} | Duration: {process_time:.2f}ms"
            )
            return response
            
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            logger.error(
                f"HTTP ERROR | Client: {client_host} | Method: {method} | Path: {url_path} "
                f"| Exception: {str(e)} | Duration: {process_time:.2f}ms",
                exc_info=True
            )
            return Response(
                content="Internal Server Error",
                status_code=500
            )
