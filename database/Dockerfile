# Start from the official PostGIS image configured in docker-compose.yml
FROM postgis/postgis:15-3.4

# Install build tools, compile pgvector from source with LLVM disabled, and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    postgresql-server-dev-15 \
    git \
    && git clone https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make with_llvm=no \
    && make with_llvm=no install \
    && apt-get purge -y build-essential postgresql-server-dev-15 git \
    && apt-get autoremove -y \
    && rm -rf /tmp/pgvector /var/lib/apt/lists/*
