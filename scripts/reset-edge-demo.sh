#!/usr/bin/env bash

# OMR-PROD Edge Reset Script
# This script will wipe the local edge database and re-initialize it for DEV-MACHINE-001.

set -e

# Change to project root if script is run from scripts/
cd "$(dirname "$0")/.."

echo "⚠️  This will WIPE the local Edge database and scan history. Continue? (y/N)"
read -p "> " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "🛑 Cleaning up local assets..."
rm -f apps/api-edge/omr_edge.db
rm -rf apps/api-edge/success/*
rm -rf apps/api-edge/error/*
rm -rf apps/api-edge/raw_scans/*
rm -rf apps/api-edge/uploads/*

echo "📝 Configuring .env for MACHINE-00001..."
cat <<EOF > apps/api-edge/.env
MACHINE_ID=MACHINE-00001
MACHINE_SECRET=dev-machine-secret-123
CLOUD_API_URL=http://localhost:4000
DATABASE_URL=sqlite:///./omr_edge.db
DEFAULT_SCHOOL_ID=305312
EOF

echo "📦 Initializing Edge SQLite Schema..."
npm run db:edge:push -w @omr-prod/database

echo "📡 Triggering Initial Sync (Pulling Operators)..."
# Check if venv exists
if [ -d "apps/api-edge/.venv" ]; then
    source apps/api-edge/.venv/bin/activate
    # Move into the app directory so .env is discovered correctly
    cd apps/api-edge
    DATABASE_URL=sqlite:///./omr_edge.db python sync_trigger.py
    cd ../..
else
    echo "⚠️  Python virtual environment not found. Please run 'scripts/setup-edge.sh' first."
fi

echo "✅ Edge reset complete for MACHINE-00001!"
echo "----------------------------------------"
echo "Edge API: http://localhost:8000"
echo "Edge UI:  http://localhost:3000"
echo "----------------------------------------"
