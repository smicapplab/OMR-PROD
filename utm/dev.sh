#!/usr/bin/env bash
# OMR-PROD — UTM Local Dev
# Starts services connecting directly to local Native Postgres. No Docker steps.
set -e
cd "$(dirname "$0")/.."

export PGPASSWORD="password"

echo "--- 🎬 OMR-PROD Dev (UTM) ---"
echo ""

echo "🧹 Clearing stale processes on ports 3000 3001 4000 8000..."
for port in 3000 3001 4000 8000; do
  for pid in $(lsof -t -i :"$port" 2>/dev/null); do
    kill -9 "$pid" 2>/dev/null || true
  done
done

[ -f .env ] && { set -a; source .env; set +a; }

echo "⏳ Waiting for local PostgreSQL..."
until pg_isready -h 127.0.0.1 -p 5432 -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL ready"

# Cloud schema syncing
echo "☁️  Syncing Cloud schema..."
npm run db:cloud:generate -w @omr-prod/database
npm run db:cloud:migrate  -w @omr-prod/database

# Edge schema syncing
echo "📟 Syncing Edge schema..."
EDGE_DB="apps/api-edge/omr_edge.db"
[ ! -f "$EDGE_DB" ] && EDGE_IS_NEW=true || EDGE_IS_NEW=false
npm run db:edge:generate -w @omr-prod/database
npm run db:edge:migrate  -w @omr-prod/database

if $EDGE_IS_NEW; then
  if [ -d "apps/api-edge/.venv" ]; then
    echo "🌱 Seeding new Edge DB..."
    cd apps/api-edge
    DATABASE_URL=sqlite:///./omr_edge.db .venv/bin/python seed_dev.py
    cd ../..
  fi
fi

echo ""
echo "☁️  Starting Cloud dev servers..."
trap 'trap - EXIT INT TERM; kill 0' EXIT INT TERM

npm run dev -- --filter=api-cloud --filter=web-cloud &

echo "⏳ Waiting for Cloud Hub API (port 4000)..."
until (echo > /dev/tcp/127.0.0.1/4000) 2>/dev/null; do
  sleep 1
done
sleep 2

echo "📟 Starting Edge dev servers..."
npm run dev -- --filter=api-edge --filter=web-edge &

echo ""
echo "🚀 UTM servers running!"
echo "  Cloud API → http://localhost:4000/api/v1"
echo "  Cloud UI  → http://localhost:3001"
echo "  Edge API  → http://localhost:8000"
echo "  Edge UI   → http://localhost:3000"
echo ""

wait
