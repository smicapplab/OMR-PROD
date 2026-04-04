#!/usr/bin/env bash
# OMR-PROD — Demo (PM2)
# Builds and runs all four services on a single machine via PM2.
# Safe to re-run; stops previous processes, migrates schema, then relaunches.
set -e
cd "$(dirname "$0")/.."

echo "--- 🎬 OMR-PROD Demo ---"
echo ""

# ── Helpers ───────────────────────────────────────────────────────────────
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

# ── Preflight ─────────────────────────────────────────────────────────────
if ! command -v pm2 &> /dev/null; then
  echo "❌ PM2 not found. Install it with: npm install -g pm2"
  exit 1
fi

if [ ! -d "apps/api-edge/.venv" ]; then
  echo "❌ Python venv not found. Run scripts/init.sh first."
  exit 1
fi

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

# ── PostgreSQL ────────────────────────────────────────────────────────────
PG_PASSWORD=$(echo "$DATABASE_URL" | sed -E 's|^[^:]+://[^:]+:([^@]+)@.*|\1|' | tr -d '"' | tr -d "'")
PG_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
PG_DB=$(echo "$DATABASE_URL"   | sed -E 's|.*/([^?]+).*|\1|')

# Prefer native PostgreSQL if it is already listening on the configured port.
# On Linux servers docker-proxy introduces a bridge-network hop that causes
# intermittent SCRAM/md5 auth failures on connection recycling; a native install
# avoids that entirely. On Mac/dev Docker Desktop handles this transparently.
if pg_isready -h 127.0.0.1 -p "${PG_PORT}" -U postgres > /dev/null 2>&1 && \
   ! docker ps --filter "name=omr-prod-db" --filter "status=running" | grep -q "omr-prod-db"; then
  echo "✅ Using native PostgreSQL on port ${PG_PORT}"
else
  # Fall back to Docker
  docker ps --filter "name=omr-prod-db" --filter "status=running" | grep -q "omr-prod-db" \
    || { echo "🐳 Starting PostgreSQL..."; docker compose up -d db > /dev/null 2>&1; }
  echo "⏳ Waiting for PostgreSQL..."
  until docker exec omr-prod-db pg_isready -U postgres > /dev/null 2>&1; do sleep 0.5; done
  # Sync password via peer auth (avoids docker-proxy auth issues)
  if [ -n "$PG_PASSWORD" ] && [ "$PG_PASSWORD" != "$DATABASE_URL" ]; then
    docker exec --user postgres omr-prod-db psql -c "ALTER USER postgres PASSWORD '${PG_PASSWORD}';" > /dev/null 2>&1 \
      || true
  fi
fi

# Verify connectivity using the same postgres-js library and path the app uses.
if node -e "
  const postgres = require('$(pwd)/node_modules/postgres');
  const sql = postgres('postgres://postgres:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}', { connect_timeout: 5 });
  sql\`SELECT 1\`.then(() => { sql.end(); process.exit(0); }).catch(() => { sql.end(); process.exit(1); });
" 2>/dev/null; then
  echo "  ✅ PostgreSQL connection verified"
else
  echo ""
  echo "❌ PostgreSQL connection FAILED on 127.0.0.1:${PG_PORT}."
  echo "   Native:  sudo systemctl start postgresql"
  echo "   Docker:  docker compose down -v && docker compose up -d db"
  exit 1
fi
echo "✅ PostgreSQL ready"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────
echo "🔨 Building..."
npm run build
echo ""

# ── Schema migrations ─────────────────────────────────────────────────────
echo "☁️  Syncing Cloud schema..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL not set and not found in .env"
  exit 1
fi

node packages/database/migrate-cloud.mjs

echo "📟 Syncing Edge schema..."
npm run db:edge:generate -w @omr-prod/database
npm run db:edge:migrate  -w @omr-prod/database
echo ""

# ── Launch ────────────────────────────────────────────────────────────────
echo "🛑 Stopping any previous demo processes..."
pm2 delete api-cloud web-cloud api-edge web-edge 2>/dev/null || true

echo "☁️  Starting Cloud Hub..."
(set -a; [ -f apps/api-cloud/.env ] && source apps/api-cloud/.env; set +a; pm2 start apps/api-cloud/dist/apps/api-cloud/src/main.js --name api-cloud)

pm2 start "npm --prefix apps/web-cloud run start -- -p 3001" \
  --name web-cloud

echo "📟 Starting Edge Appliance..."
# Run in a subshell so apps/api-edge/.env vars take full precedence over
# anything exported from the root .env or the ambient shell environment.
(set -a; source apps/api-edge/.env; set +a; cd apps/api-edge && pm2 start .venv/bin/python --name api-edge -- run_edge.py)

pm2 start "npm --prefix apps/web-edge run start -- -p 3000" \
  --name web-edge

echo ""
echo "--- ✅ Demo running ---"
echo "  Cloud UI  → http://localhost:3001"
echo "  Cloud API → http://localhost:4000/api/v1"
echo "  Edge UI   → http://localhost:3000"
echo "  Edge API  → http://localhost:8000"
echo ""
echo "  pm2 status   → monitor processes"
echo "  pm2 logs     → view output"
echo "  pm2 stop all → shut down"
