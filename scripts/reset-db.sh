#!/usr/bin/env bash

set -e

read -p "This will DESTROY the local database. Continue? (y/n): " confirm
if [[ "$confirm" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

echo "========================================"
echo "Resetting Hybrid HRIS Database"
echo "========================================"

echo "1. Removing generated migrations..."
rm -rf packages/db/drizzle

echo "2. Stopping containers and removing volumes..."
docker compose down -v

echo "3. Starting fresh Postgres..."
docker compose up -d

echo "4. Waiting for Postgres to be ready..."
until docker exec hris-postgres pg_isready -U hris -d hris_db > /dev/null 2>&1; do
  sleep 1
  echo "Waiting for Postgres..."
done

echo "Postgres is ready."

echo "5. Enabling required extensions..."
docker exec -i hris-postgres psql -U hris -d hris_db <<EOF
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
EOF

echo "6. Generating migrations..."
pnpm --filter @hybrid-hris/db db:generate

echo "7. Applying migrations..."
pnpm --filter @hybrid-hris/db db:migrate

echo "8. Seeding data..."
pnpm --filter @hybrid-hris/db seed

echo "========================================"
echo "Database reset complete."
echo "========================================"