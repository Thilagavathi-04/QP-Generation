#!/bin/bash

# Quest Generator - Run Script
# This script starts all services: Backend, Frontend, and Ollama

set -e  # Exit on any error

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"

echo "=========================================="
echo "Quest Generator - Starting Services"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
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

# Function to cleanup on exit
cleanup() {
    echo ""
    print_info "Stopping all services..."
    
    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null
    
    # Kill specific processes
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "ollama serve" 2>/dev/null || true
    
    print_success "All services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if setup has been run
if [ ! -d "$BACKEND_DIR/.venv" ] || [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    print_error "Project not set up. Please run ./setup.sh first"
    exit 1
fi

# # Check if sqlite3 is running
# if ! systemctl is-active --quiet sqlite3 2>/dev/null; then
#     print_info "Starting sqlite3 service..."
#     sudo systemctl start sqlite3
#     print_success "sqlite3 started"
# else
#     print_success "sqlite3 is already running"
# fi

# Create log directory
mkdir -p "$LOG_DIR"

# 1. Start Ollama in background
print_service "Starting Ollama service..."
ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
OLLAMA_PID=$!
sleep 3

if ps -p $OLLAMA_PID > /dev/null; then
    print_success "Ollama started (PID: $OLLAMA_PID)"
else
    print_info "Ollama may already be running or started by system"
fi

# 2. Start Backend in background
print_service "Starting Backend (FastAPI)..."

cd "$BACKEND_DIR"
uv run uvicorn main:app --reload --port 8010 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
cd "$ROOT_DIR"

sleep 3

if ps -p $BACKEND_PID > /dev/null; then
    print_success "Backend started (PID: $BACKEND_PID) - http://127.0.0.1:8010"
else
    print_error "Backend failed to start. Check logs/backend.log"
    pwd
    exit 1
fi

# 3. Start Frontend in background
print_service "Starting Frontend (Vite)..."
cd "$FRONTEND_DIR"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"
sleep 5

if ps -p $FRONTEND_PID > /dev/null; then
    print_success "Frontend started (PID: $FRONTEND_PID)"
else
    print_error "Frontend failed to start. Check logs/frontend.log"
    exit 1
fi

# Extract frontend URL from log
sleep 2
FRONTEND_URL=$(grep -oP 'Local:\s+\Khttp://[^\s]+' logs/frontend.log | tail -1)

echo ""
echo "=========================================="
print_success "All services started successfully!"
echo "=========================================="
echo ""
echo "Service URLs:"
echo "  Frontend:  ${FRONTEND_URL:-http://localhost:5173}"
echo "  Backend:   http://127.0.0.1:8010"
echo "  API Docs:  http://127.0.0.1:8010/docs"
echo "  Ollama:    http://localhost:11434"
echo ""
echo "Logs:"
echo "  Backend:   logs/backend.log"
echo "  Frontend:  logs/frontend.log"
echo "  Ollama:    logs/ollama.log"
echo ""
print_info "Press Ctrl+C to stop all services"
echo ""

# Keep script running and show logs
tail -f logs/backend.log logs/frontend.log logs/ollama.log 2>/dev/null || {
    # If tail fails, just wait
    while true; do
        sleep 1
    done
}
