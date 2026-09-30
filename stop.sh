#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

echo "Stopping Quest Generator services..."

for service in backend frontend ollama; do
    PID_FILE="$PID_DIR/$service.pid"

    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")

        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
            echo "✓ Stopped $service (PID: $PID)"
        else
            echo "➜ $service is not running"
        fi

        rm -f "$PID_FILE"
    fi
done

echo "Done."
