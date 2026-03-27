#!/usr/bin/env bash
# OMR-PROD — Local Dev
# Starts all services with hot reload. Automatically generates and applies
# schema migrations on every run — no manual drizzle commands needed.
# First time on a new machine? Run scripts/init.sh first.
set -e
cd "$(dirname "$0")/.."

echo "--- 🛠  OMR-PROD Dev ---"
echo ""

# ── Helpers ────────────────────────────────────────────────────────────────
_kill_port() {
  local pid
  pid=$(lsof -t -i :"$1" 2>/dev/null) || true
  [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
}

_ensure_secret() {
  local env_file="$1" var_name="$2"
  if [ ! -f "$env_file" ]; then touch "$env_file"; fi
  local current
  current=$(grep -E "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  case "$current" in
    ""|*"change-me"*|*"your-"*|*"GENERATE_"*|*"secret-key"*|*"dev-"*|*"change-this"*)
      local new_val; new_val=$(openssl rand -hex 32)
      local tmp; tmp=$(mktemp)
      grep -vE "^${var_name}=" "$env_file" > "$tmp" 2>/dev/null || true
      mv "$tmp" "$env_file"
      echo "${var_name}=\"${new_val}\"" >> "$env_file"
      echo "  🔑 Generated ${var_name} in ${env_file}"
      ;;
  esac
}
# ───────────────────────────────────────────────────────────────────────────

echo "🧹 Clearing stale processes on ports 3000 3001 4000 8000..."
for port in 3000 3001 4000 8000; do _kill_port "$port"; done
echo ""

echo "🔐 Checking secrets..."
_ensure_secret ".env"                "JWT_SECRET"
_ensure_secret ".env"                "JWT_REFRESH_SECRET"
_ensure_secret ".env"                "ENROLLMENT_SECRET"
_ensure_secret "apps/api-cloud/.env" "JWT_SECRET"
_ensure_secret "apps/api-edge/.env"  "SECRET_KEY"
echo ""

if [ -f .env ]; then
  set -a; source .env; set +a
else
  echo "⚠️  No root .env found — run scripts/init.sh"
fi

# Start Docker early while install/build run
docker ps --filter "name=omr-prod-db" --filter "status=running" | grep -q "omr-prod-db" \
  || { echo "🐳 Starting PostgreSQL..."; docker compose up -d db > /dev/null 2>&1; } &
DOCKER_PID=$!

echo "📦 Installing dependencies..."
npm install --quiet

echo "🔨 Building workspaces..."
npm run build &
BUILD_PID=$!

# Wait for Postgres while build runs
wait $DOCKER_PID
echo "⏳ Waiting for PostgreSQL..."
until docker exec omr-prod-db pg_isready -U postgres > /dev/null 2>&1; do sleep 0.5; done
echo "✅ PostgreSQL ready"

wait $BUILD_PID
echo "✅ Build complete"
echo ""

# ── Cloud schema ─────────────────────────────────────────────────────────────
# generate: creates a new migration file if the schema changed (no-op if not)
# migrate:  applies any pending migrations — never drops without an explicit migration
echo "☁️  Syncing Cloud schema..."
npm run db:cloud:generate -w @omr-prod/database
npm run db:cloud:migrate  -w @omr-prod/database

# ── Edge schema ──────────────────────────────────────────────────────────────
echo "📟 Syncing Edge schema..."
EDGE_DB="apps/api-edge/omr_edge.db"
EDGE_IS_NEW=false
[ ! -f "$EDGE_DB" ] && EDGE_IS_NEW=true

npm run db:edge:generate -w @omr-prod/database
npm run db:edge:migrate  -w @omr-prod/database

if $EDGE_IS_NEW; then
  if [ -d "apps/api-edge/.venv" ]; then
    echo "🌱 Seeding new Edge DB..."
    cd apps/api-edge
    DATABASE_URL=sqlite:///./omr_edge.db .venv/bin/python seed_dev.py
    cd ../..
  else
    echo "⚠️  Edge venv missing — run scripts/init.sh"
  fi
fi

echo ""
echo "🚀 Starting dev servers (hot reload)..."
echo "  Cloud API → http://localhost:4000/api/v1"
echo "  Cloud UI  → http://localhost:3001"
echo "  Edge API  → http://localhost:8000"
echo "  Edge UI   → http://localhost:3000"
echo ""
npm run dev
