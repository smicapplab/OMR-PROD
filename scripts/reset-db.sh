#!/usr/bin/env bash
# OMR-PROD — Reset Both Databases
# Wipes and re-seeds Cloud (Postgres) and Edge (SQLite). No prompts.
set -e
cd "$(dirname "$0")/.."

echo "--- 🔄 Resetting Cloud + Edge databases ---"
echo ""

# ── Cloud (Postgres) ──────────────────────────────────────────────────────
echo "☁️  Cloud: wiping Postgres..."
docker compose down -v
docker compose up -d db

echo "⏳ Waiting for Postgres..."
until docker exec omr-prod-db pg_isready -U postgres -d omr_prod > /dev/null 2>&1; do
  sleep 1; echo -n "."
done
echo " Ready!"

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omr_prod"

echo "📦 Applying Cloud schema..."
npm run db:cloud:generate -w @omr-prod/database
npm run db:cloud:migrate  -w @omr-prod/database

echo "🧪 Seeding Cloud data..."
npm run seed:regions   -w @omr-prod/database
npm run seed:essential -w @omr-prod/database
npm run db:cloud:seed  -w @omr-prod/database

echo "✅ Cloud reset complete"
echo ""

# ── Edge (SQLite) ─────────────────────────────────────────────────────────
echo "📟 Edge: wiping SQLite..."
rm -f apps/api-edge/omr_edge.db
rm -rf success/* error/* raw_scans/* uploads/*

if [ ! -f "apps/api-edge/.env" ]; then
  echo "📝 Writing Edge .env (MACHINE-00001)..."
  cat > apps/api-edge/.env <<'EOF'
MACHINE_ID=MACHINE-00001
MACHINE_SECRET=dev-machine-secret-123
CLOUD_API_URL=http://localhost:4000
DATABASE_URL=sqlite:///./omr_edge.db
DEFAULT_SCHOOL_ID=305312
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
EOF
else
  echo "⏩ Skipping Edge .env (already exists)"
fi

echo "📦 Applying Edge schema..."
npm run db:edge:generate -w @omr-prod/database
npm run db:edge:migrate  -w @omr-prod/database

if [ -d "apps/api-edge/.venv" ]; then
  source apps/api-edge/.venv/bin/activate
  cd apps/api-edge
  echo "🌱 Seeding dev credentials..."
  DATABASE_URL=sqlite:///./omr_edge.db python seed_dev.py
  cd ../..
else
  echo "⚠️  Python venv not found — run scripts/init.sh first"
fi

echo "✅ Edge reset complete"
echo ""
echo "--- ✅ Full reset done ---"
echo "  Cloud API → http://localhost:4000/api/v1"
echo "  Cloud UI  → http://localhost:3001"
echo "  Edge API  → http://localhost:8000"
echo "  Edge UI   → http://localhost:3000"
