#!/usr/bin/env bash
# OMR-PROD — UTM Image Init
# Setup for Sales UTM VM using native PostgreSQL
set -e
cd "$(dirname "$0")/.."

export PGPASSWORD="password"

echo "--- 🚀 OMR-PROD UTM Init ---"
echo ""

echo "📝 Writing fixed .env files..."
cat > .env <<'EOF'
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/omr_prod"
JWT_TTL="1h"
JWT_REFRESH_TTL="7d"
JWT_SECRET="utm-secret-key-123"
JWT_REFRESH_SECRET="utm-refresh-secret-123"
ENROLLMENT_SECRET="utm-enrollment-secret-123"
EOF

cp apps/api-cloud/.env.example apps/api-cloud/.env 2>/dev/null || true
cp apps/web-cloud/.env.local.example apps/web-cloud/.env.local 2>/dev/null || true
cp apps/web-edge/.env.local.example apps/web-edge/.env.local 2>/dev/null || true

cat > apps/api-edge/.env <<'EOF'
MACHINE_ID=MACHINE-00001
MACHINE_SECRET=dev-machine-secret-123
CLOUD_API_URL=http://localhost:4000
DATABASE_URL=sqlite:///./omr_edge.db
DEFAULT_SCHOOL_ID=305312
SECRET_KEY="utm-secret-key-123"
EOF

echo "📦 Installing Node dependencies..."
npm install

echo "🐍 Setting up Python venv..."
mkdir -p raw_scans uploads success error
if [ ! -d "apps/api-edge/.venv" ]; then
  python3 -m venv apps/api-edge/.venv
fi
source apps/api-edge/.venv/bin/activate
pip install --upgrade pip --quiet
pip install -r apps/api-edge/requirements.txt --quiet

echo "🔨 Building workspaces..."
npm run build

echo "⏳ Waiting for Native PostgreSQL to start..."
until pg_isready -h 127.0.0.1 -p 5432 -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "🗄  Ensuring 'omr_prod' database exists..."
psql -h 127.0.0.1 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'omr_prod'" | grep -q 1 || psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE omr_prod;"

echo "🔄 Running DB Reset..."
./utm/reset-db.sh

echo "✅ UTM Init complete. Run ./utm/dev.sh to start!"
