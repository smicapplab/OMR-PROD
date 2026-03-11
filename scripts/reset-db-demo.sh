#!/usr/bin/env bash

# OMR-PROD Database Reset & Demo Seed Script
# This script will wipe the cloud database, push the latest schema, and load demo data.

set -e

# Change to project root if script is run from scripts/
cd "$(dirname "$0")/.."

echo "⚠️  This will DESTROY the local 'omr-prod-db' container and volume. Continue? (y/N)"
read -p "> " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "🛑 Stopping containers and removing volumes..."
docker compose down -v

echo "🚀 Starting fresh Postgres container..."
docker compose up -d db

echo "⏳ Waiting for Postgres to be ready..."
# Use docker exec to check readiness
until docker exec omr-prod-db pg_isready -U postgres -d omr_prod > /dev/null 2>&1; do
  sleep 1
  echo -n "."
done
echo " Ready!"

echo "📦 Pushing schema to Cloud Hub..."
# Explicitly set DATABASE_URL for the local container
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omr_prod"

npm run db:cloud:push -w @omr-prod/database

echo "🧪 Seeding realistic demo data..."
npm run seed:regions -w @omr-prod/database
npm run seed:essential -w @omr-prod/database
npm run db:cloud:seed -w @omr-prod/database

echo "✅ Database reset and demo seed complete!"
echo "----------------------------------------"
echo "Cloud API: http://localhost:4000/api/v1"
echo "Cloud UI:  http://localhost:3001"
echo "----------------------------------------"
