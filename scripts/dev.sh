#!/bin/bash

# --- OMR-PROD Local Dev Orchestrator (Optimized & Robust) ---
# Parallelizes Docker startup and npm install, and ensures .env is loaded.

# --- Argument Parsing ---
SYNC_DB=false
for arg in "$@"; do
  if [[ "$arg" == "--sync" ]]; then
    SYNC_DB=true
  fi
done

echo "--- 🛠 Bootstrapping Local Dev Environment ---"

# 0. Load Environment Variables from Root
if [ -f .env ]; then
  echo "Loading root .env..."
  # Exporting variables for sub-processes
  set -a
  source .env
  set +a
else
  echo "No root .env found! Database commands may fail."
fi

# 1. Start Docker in background early
(
    if ! docker ps --filter "name=omr-prod-db" --filter "status=running" | grep -q "omr-prod-db"; then
        echo "Starting PostgreSQL container in background..."
        docker-compose up -d db > /dev/null 2>&1
    fi
) &
DOCKER_BOOT_PID=$!

# 2. Run npm install (Must be before build)
echo "Syncing workspaces (npm install)..."
npm install --quiet &
INSTALL_PID=$!

# 3. Wait for install to complete before building
wait $INSTALL_PID
echo "npm install complete."

# 4. Build workspaces (Sequential to install, parallel to Docker wait if still booting)
echo "Building workspaces (turbo build)..."
npm run build &
BUILD_PID=$!

# 5. Wait for Docker and check readiness while build runs
wait $DOCKER_BOOT_PID
echo "Ensuring PostgreSQL is ready..."
until docker exec omr-prod-db pg_isready -U postgres > /dev/null 2>&1; do
    sleep 0.5
done
echo "PostgreSQL is ready."

# 6. Wait for Build to finish
wait $BUILD_PID
echo "Build complete."

# 7. Cloud Database (Drizzle)
if [ "$SYNC_DB" = true ]; then
    echo "Syncing Cloud Schema (Requested via --sync)..."
    # Explicitly passing DATABASE_URL if needed, but 'set -a' should have exported it
    npm run db:cloud:push --workspace=@omr-prod/database
    npm run db:cloud:seed --workspace=@omr-prod/database
else
    echo "Skipping Cloud Schema Sync (Use --sync to enable)."
fi

# 8. Edge Database (SQLite)
EDGE_DB="apps/api-edge/omr_edge.db"
echo "Checking Edge Appliance Database..."
if [ ! -f "$EDGE_DB" ]; then
    echo "Initializing Edge Schema & Seed..."
    npm run db:edge:push --workspace=@omr-prod/database
    
    if [ -d "apps/api-edge/.venv" ]; then
        echo "Seeding Edge users via python..."
        cd apps/api-edge
        .venv/bin/python seed_dev.py
        cd ../..
    else
        echo "api-edge virtual environment not found. Skip python seed."
    fi
else
    if [ "$SYNC_DB" = true ]; then
        echo "Syncing Edge Schema (Requested via --sync)..."
        npm run db:edge:push --workspace=@omr-prod/database
    else
        echo "Edge database exists (Skipping Edge sync)."
    fi
fi


echo ""
echo "Starting all services in dev mode (Hot Reload)..."
echo "---------------------------------------------------"
npm run dev
