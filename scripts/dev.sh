#!/bin/bash

# --- OMR-PROD Local Dev Orchestrator ---
# This script ensures both Cloud and Edge databases are initialized and then starts dev mode.

echo "--- 🛠 Bootstrapping Local Dev Environment ---"

# 0. Ensure workspace is up to date (detects new package.json in apps/api-edge)
echo "📦 Syncing workspaces..."
npm install --quiet
npm run build
echo "📡 Checking National Hub (Cloud) Database..."
if ! docker ps --filter "name=omr-prod-db" --filter "status=running" | grep -q "omr-prod-db"; then
    echo "🐳 Starting PostgreSQL container..."
    docker-compose up -d db
    echo "⏳ Waiting for PostgreSQL to be ready..."
    until docker exec omr-prod-db pg_isready -U postgres > /dev/null 2>&1; do
        sleep 1
    done
    echo "✅ PostgreSQL is ready."
    
    echo "✨ Initializing Cloud Schema & Seed..."
    # Using --filter for turbo or --workspace for npm depending on project setup
    npm run db:cloud:push --workspace=@omr-prod/database
    npm run db:cloud:seed --workspace=@omr-prod/database
else
    echo "✅ Cloud database is already running."
fi

# 2. Handle Edge Database (SQLite)
EDGE_DB="apps/api-edge/omr_edge.db"
echo "📟 Checking Edge Appliance Database..."
if [ ! -f "$EDGE_DB" ]; then
    echo "✨ Initializing Edge Schema & Seed..."
    npm run db:edge:push --workspace=@omr-prod/database
    
    # Run python seed
    if [ -d "apps/api-edge/.venv" ]; then
        echo "🐍 Seeding Edge users via python..."
        cd apps/api-edge
        .venv/bin/python seed_dev.py
        cd ../..
    else
        echo "⚠️  api-edge virtual environment not found. Skip python seed."
    fi
else
    echo "✅ Edge database exists."
fi

echo ""
echo "🚀 Starting all services in dev mode (Hot Reload)..."
echo "---------------------------------------------------"
npm run dev
