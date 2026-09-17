import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ksp_backend_init")

# Ensure backend root directory is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
import uvicorn

if __name__ == "__main__":
    port_str = os.getenv("X_ZOHO_CATALYST_LISTEN_PORT") or os.getenv("PORT") or "8000"
    try:
        port = int(port_str)
    except ValueError:
        port = 8000

    logger.info(f"Starting KSP Crime Intelligence Platform on 0.0.0.0:{port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
