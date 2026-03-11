#!/bin/bash

echo "--- 🚀 Starting OMR Edge Hub ---"

# Check if .venv exists
if [ ! -d "apps/api-edge/.venv" ]; then
    echo "❌ Virtual environment not found. Please run ./scripts/setup-edge.sh first."
    exit 1
fi

# Run the unified server/watcher process
cd apps/api-edge
.venv/bin/python run_edge.py
