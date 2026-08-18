FROM python:3.12-slim

# Prevent Python from creating .pyc files
ENV PYTHONDONTWRITEBYTECODE=1

# Flush Python output immediately
ENV PYTHONUNBUFFERED=1

# uv configuration
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    build-essential \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# ------------------------------------------------------------
# Copy dependency files first
# This makes Docker cache dependencies.
# ------------------------------------------------------------
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN if [ -f uv.lock ]; then \
        uv sync --frozen --no-dev; \
    else \
        uv sync --no-dev; \
    fi

# Copy application
COPY . .

# Make sure environment uses .venv
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8010

# Start FastAPI
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]