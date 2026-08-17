#!/bin/bash

# Exit on any error
set -e

echo "Starting Quest Generator API in Production Mode..."

# The UvicornWorker class is used with gunicorn to manage uvicorn workers
# -w 4 means 4 worker processes. You can adjust this based on your CPU cores.
# --bind 0.0.0.0:8010 binds to port 8010 on all network interfaces
# --timeout 120 gives workers 120 seconds to respond before being killed (useful for AI tasks)

uv run gunicorn main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8010 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
