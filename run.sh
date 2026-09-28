#!/bin/bash

# Quest Generator - Production Run Script
# Builds frontend for production and starts all services (no dev features).

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"
PID_DIR="$ROOT_DIR/.pids"

# ---------------------------------------------
# Production configuration (override via env)
# ---------------------------------------------
BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8010}"
BACKEND_WORKERS="${BACKEND_WORKERS:-4}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"

# Force rebuild with: ./run_prod.sh --build
FORCE_BUILD=0
for arg in "$@"; do
    case $arg in
        --build) FORCE_BUILD=1 ;;
    esac
done

echo "=========================================="
echo "Quest Generator - Starting (PRODUCTION)"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

print_service() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Check setup
if [ ! -d "$BACKEND_DIR/.venv" ] || [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    print_error "Project not set up. Please run ./setup.sh first"
    exit 1
fi

mkdir -p "$LOG_DIR"
mkdir -p "$PID_DIR"

# -----------------------------
# Ollama
# -----------------------------
print_service "Starting Ollama service..."

if pgrep -f "ollama serve" > /dev/null; then
    print_success "Ollama is already running"
else
    nohup ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
    OLLAMA_PID=$!
    echo "$OLLAMA_PID" > "$PID_DIR/ollama.pid"
    print_success "Ollama started (PID: $OLLAMA_PID)"
fi

# -----------------------------
# Frontend Build (production)
# -----------------------------
print_service "Building Frontend for production..."

if [ "$FORCE_BUILD" -eq 1 ] || [ ! -d "$FRONTEND_DIR/dist" ]; then
    cd "$FRONTEND_DIR"
    NODE_ENV=production npm run build > "$LOG_DIR/build.log" 2>&1
    cd "$ROOT_DIR"
    print_success "Frontend built successfully"
else
    print_info "Using existing build (run './run_prod.sh --build' to rebuild)"
fi

# -----------------------------
# Backend
# -----------------------------
print_service "Starting Backend (FastAPI - production)..."

cd "$BACKEND_DIR"

nohup uv run uvicorn main:app \
    --host "$BACKEND_HOST" \
    --port "$BACKEND_PORT" \
    --workers "$BACKEND_WORKERS" \
    > "$LOG_DIR/backend.log" 2>&1 &

BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

cd "$ROOT_DIR"

sleep 3

if ps -p "$BACKEND_PID" > /dev/null; then
    print_success "Backend started (PID: $BACKEND_PID, workers: $BACKEND_WORKERS)"
else
    print_error "Backend failed to start. Check logs/backend.log"
    exit 1
fi

# -----------------------------
# Frontend Serve (production)
# -----------------------------
print_service "Serving Frontend (production build)..."

cd "$FRONTEND_DIR"

nohup npx vite preview \
    --host 0.0.0.0 \
    --port "$FRONTEND_PORT" \
    --strictPort \
    > "$LOG_DIR/frontend.log" 2>&1 &

FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

cd "$ROOT_DIR"

sleep 3

if ps -p "$FRONTEND_PID" > /dev/null; then
    print_success "Frontend started (PID: $FRONTEND_PID)"
else
    print_error "Frontend failed to start. Check logs/frontend.log"
    exit 1
fi

echo ""
echo "=========================================="
print_success "All services started (PRODUCTION MODE)!"
echo "=========================================="
echo ""
echo "Service URLs:"
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo "  Backend:   http://$BACKEND_HOST:$BACKEND_PORT"
echo "  API Docs:  http://localhost:$BACKEND_PORT/docs"
echo "  Ollama:    http://localhost:11434"
echo ""
echo "Logs:"
echo "  Backend:   logs/backend.log"
echo "  Frontend:  logs/frontend.log"
echo "  Build:     logs/build.log"
echo "  Ollama:    logs/ollama.log"
echo ""
echo "PIDs:"
echo "  Backend:   $BACKEND_PID"
echo "  Frontend:  $FRONTEND_PID"
echo "  Ollama:    ${OLLAMA_PID:-already running}"
echo ""
print_info "Production services running in background."
print_info "Use ./stop.sh to stop them."