# Production Dockerfile for KSP Crime Intelligence Platform (FastAPI + AI Engine)
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies required for C extensions and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements manifest first to optimize Docker layer caching
COPY requirements.txt .

# Install Python dependencies inside container
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose AppSail HTTP listening port
EXPOSE 8000

# Entrypoint: Execute main.py
CMD ["python", "main.py"]
