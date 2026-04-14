#!/usr/bin/env bash
# OMR-PROD — UTM Reset DB
# Wipes and re-seeds Cloud (Native Postgres) and Edge (SQLite)
set -e
cd "$(dirname "$0")/.."

export PGPASSWORD="password"

echo "--- 🔄 Resetting Cloud + Edge databases (UTM) ---"
echo ""

echo "☁️  Cloud: wiping Postgres Database..."
until pg_isready -h 127.0.0.1 -p 5432 -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "🗄  Ensuring 'omr_prod' database exists..."
psql -h 127.0.0.1 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'omr_prod'" | grep -q 1 || psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE omr_prod;"

# Drop all tables by recreating the public schema and clearing drizzle migrations
psql -h 127.0.0.1 -U postgres -d omr_prod -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;"

[ -f .env ] && { set -a; source .env; set +a; }

echo "📦 Applying Cloud schema..."
npm run db:cloud:generate -w @omr-prod/database
npm run db:cloud:migrate  -w @omr-prod/database

echo "🧪 Seeding Cloud data..."
npm run seed:regions   -w @omr-prod/database
npm run seed:essential -w @omr-prod/database
npm run db:cloud:seed  -w @omr-prod/database

echo "✅ Cloud reset complete"
echo ""

echo "📟 Edge: wiping SQLite..."
rm -f apps/api-edge/omr_edge.db
rm -rf success/* error/* raw_scans/* uploads/*

echo "📦 Applying Edge schema..."
npm run db:edge:generate -w @omr-prod/database
npm run db:edge:migrate  -w @omr-prod/database

if [ -d "apps/api-edge/.venv" ]; then
  echo "🌱 Seeding dev credentials..."
  cd apps/api-edge
  DATABASE_URL=sqlite:///./omr_edge.db .venv/bin/python seed_dev.py
  cd ../..
fi

echo "✅ Edge reset complete"
echo ""
echo "--- ✅ Full UTM reset done ---"
