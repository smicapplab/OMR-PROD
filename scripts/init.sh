#!/usr/bin/env bash
# OMR-PROD — New Machine Setup
# Run once on a fresh clone. Creates .env files, installs all dependencies,
# sets up the Python venv, then does a full DB reset.
set -e
cd "$(dirname "$0")/.."

echo "--- 🚀 OMR-PROD Init ---"
echo ""

# ── .env files ────────────────────────────────────────────────────────────
echo "📝 Bootstrapping .env files..."

# Root .env
if [ ! -f ".env" ]; then
  cat > .env <<'EOF'
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/omr_prod"
JWT_TTL="1h"
JWT_REFRESH_TTL="7d"
JWT_SECRET="change-me"
JWT_REFRESH_SECRET="change-me"
ENROLLMENT_SECRET="change-me"
EOF
  echo "  Created .env"
fi

# api-cloud .env
if [ ! -f "apps/api-cloud/.env" ]; then
  cp apps/api-cloud/.env.example apps/api-cloud/.env
  echo "  Created apps/api-cloud/.env"
fi

# api-edge .env
if [ ! -f "apps/api-edge/.env" ]; then
  cat > apps/api-edge/.env <<'EOF'
MACHINE_ID=MACHINE-00001
MACHINE_SECRET=dev-machine-secret-123
CLOUD_API_URL=http://localhost:4000
DATABASE_URL=sqlite:///./omr_edge.db
DEFAULT_SCHOOL_ID=305312
SECRET_KEY="change-me"
EOF
  echo "  Created apps/api-edge/.env"
fi

# web-cloud .env.local
if [ ! -f "apps/web-cloud/.env.local" ]; then
  cp apps/web-cloud/.env.local.example apps/web-cloud/.env.local
  echo "  Created apps/web-cloud/.env.local"
fi

# web-edge .env.local
if [ ! -f "apps/web-edge/.env.local" ]; then
  cp apps/web-edge/.env.local.example apps/web-edge/.env.local
  echo "  Created apps/web-edge/.env.local"
fi

# Auto-generate any missing secrets
_ensure_secret() {
  local env_file="$1" var_name="$2"
  [ ! -f "$env_file" ] && touch "$env_file"
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

echo ""
echo "🔐 Generating secrets..."
_ensure_secret ".env"                "JWT_SECRET"
_ensure_secret ".env"                "JWT_REFRESH_SECRET"
_ensure_secret ".env"                "ENROLLMENT_SECRET"
_ensure_secret "apps/api-cloud/.env" "JWT_SECRET"
_ensure_secret "apps/api-edge/.env"  "SECRET_KEY"

# ── JS dependencies ───────────────────────────────────────────────────────
echo ""
echo "📦 Installing Node dependencies..."
npm install

# ── Python venv ───────────────────────────────────────────────────────────
echo ""
echo "🐍 Setting up Python venv..."
mkdir -p raw_scans uploads success error

if [ ! -d "apps/api-edge/.venv" ]; then
  python3 -m venv apps/api-edge/.venv
  echo "  Virtual environment created"
fi

source apps/api-edge/.venv/bin/activate
pip install --upgrade pip --quiet
pip install -r apps/api-edge/requirements.txt --quiet
echo "  Python dependencies installed"

# ── Build ─────────────────────────────────────────────────────────────────
echo ""
echo "🔨 Building workspaces..."
npm run build

# ── Database ──────────────────────────────────────────────────────────────
echo ""
echo "🗄  Running full DB reset..."
./scripts/reset-db.sh

echo ""
echo "--- ✅ Init complete ---"
echo "Run  scripts/dev.sh  to start developing."
