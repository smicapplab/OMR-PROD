#!/bin/bash
set -e

echo "--- 🗄 Initializing Database (Drizzle) ---"

# Note: Requires npm install to be run first at root
cd packages/database

# Generate migrations
npx drizzle-kit generate:sqlite --config=drizzle.edge.config.ts

# Note: Python API also automatically creates the tables via SQLAlchemy on first run
# This Drizzle command is for JS apps sharing the same database.

cd ../..
echo "✅ Database schema generation complete."
