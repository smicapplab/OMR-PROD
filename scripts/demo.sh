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
docker ps --filter "name=omr-prod-db" --filter "status=running" | grep -q "omr-prod-db" \
  || { echo "🐳 Starting PostgreSQL..."; docker compose up -d db > /dev/null 2>&1; }
echo "⏳ Waiting for PostgreSQL..."
until docker exec omr-prod-db pg_isready -U postgres > /dev/null 2>&1; do sleep 0.5; done
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

npm run db:cloud:migrate  -w @omr-prod/database

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
