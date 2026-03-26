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
 
# --- Port Cleanup (Prevention of "Address already in use") ---
_kill_port() {
  local port=$1
  local pid
  pid=$(lsof -t -i :"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "  🔥 Killing stale process on port $port (PID: $pid)..."
    kill -9 $pid 2>/dev/null || true
  fi
}
 
echo "🧹 Clearing stale processes on ports 3000, 3001, 4000, 8000..."
_kill_port 3000
_kill_port 3001
_kill_port 4000
_kill_port 8000
echo "✅ Cleanup complete"
echo ""

# ── Secret Auto-Generation ──────────────────────────────────────────────────
# List of (env_file, var_name, placeholder_patterns) tuples.
# If the var is missing or matches any placeholder pattern, a new value is
# generated with `openssl rand -hex 32` and written into the file.

_ensure_secret() {
  local env_file="$1"
  local var_name="$2"

  # Create the file if it doesn't exist yet
  if [ ! -f "$env_file" ]; then
    touch "$env_file"
  fi

  # Read the current value (strip surrounding quotes and whitespace)
  local current
  current=$(grep -E "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)

  # Placeholder patterns that indicate the value has not been customised
  local is_placeholder=false
  case "$current" in
    ""|*"change-me"*|*"your-"*|*"GENERATE_"*|*"secret-key"*|*"dev-"*|*"change-this"*)
      is_placeholder=true ;;
  esac

  if $is_placeholder; then
    local new_val
    new_val=$(openssl rand -hex 32)
    # Remove the old line (if any) then append the new one
    if grep -qE "^${var_name}=" "$env_file" 2>/dev/null; then
      # Use a temp file for portability (sed -i differs between macOS and Linux)
      local tmp
      tmp=$(mktemp)
      grep -vE "^${var_name}=" "$env_file" > "$tmp"
      mv "$tmp" "$env_file"
    fi
    echo "${var_name}=\"${new_val}\"" >> "$env_file"
    echo "  🔑 Generated ${var_name} in ${env_file}"
  fi
}

echo ""
echo "🔐 Checking / generating secrets..."
_ensure_secret ".env"                    "JWT_SECRET"
_ensure_secret ".env"                    "JWT_REFRESH_SECRET"
_ensure_secret ".env"                    "ENROLLMENT_SECRET"
_ensure_secret "apps/api-cloud/.env"     "JWT_SECRET"
_ensure_secret "apps/api-edge/.env"      "SECRET_KEY"
echo "✅ Secrets OK"
echo ""
# ─────────────────────────────────────────────────────────────────────────────

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
