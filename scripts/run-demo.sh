#!/bin/bash

# --- OMR-PROD Demo Runner (PM2) ---
# This script starts both Cloud and Edge components on a single machine for demonstration.

echo "--- 🚀 Preparing OMR-PROD Demo ---"

# ── Secret Auto-Generation ──────────────────────────────────────────────────
_ensure_secret() {
  local env_file="$1"
  local var_name="$2"
  if [ ! -f "$env_file" ]; then touch "$env_file"; fi
  local current
  current=$(grep -E "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  local is_placeholder=false
  case "$current" in
    ""|*"change-me"*|*"your-"*|*"GENERATE_"*|*"secret-key"*|*"dev-"*|*"change-this"*)
      is_placeholder=true ;;
  esac
  if $is_placeholder; then
    local new_val; new_val=$(openssl rand -hex 32)
    local tmp; tmp=$(mktemp)
    grep -vE "^${var_name}=" "$env_file" > "$tmp" 2>/dev/null || true
    mv "$tmp" "$env_file"
    echo "${var_name}=\"${new_val}\"" >> "$env_file"
    echo "  🔑 Generated ${var_name} in ${env_file}"
  fi
}

echo ""
echo "🔐 Checking / generating secrets..."
_ensure_secret ".env"                    "JWT_SECRET"
_ensure_secret ".env"                    "JWT_REFRESH_SECRET"
_ensure_secret ".env"                    "ENROLLMENT_SECRET"
_ensure_secret "apps/api-cloud/.env"     "JWT_SECRET"
_ensure_secret "apps/api-edge/.env"      "SECRET_KEY"
echo "✅ Secrets OK"
echo ""
# ─────────────────────────────────────────────────────────────────────────────

# 1. Build all components
echo "📦 Building project..."
npm run build

# 2. Check PM2 installation
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Please install it with: npm install -g pm2"
    exit 1
fi

# 3. Stop existing demo processes
echo "🛑 Cleaning up previous demo processes..."
pm2 delete api-cloud web-cloud api-edge web-edge 2>/dev/null

# 4. Start Cloud Components
echo "☁️ Starting National Hub (Cloud)..."
pm2 start apps/api-cloud/dist/main.js --name api-cloud --env PORT=4000
pm2 start "npm --prefix apps/web-cloud run start -- -p 3000" --name web-cloud

# 5. Start Edge Components
echo "📟 Starting Edge Appliance..."

# api-edge (Python)
if [ ! -d "apps/api-edge/.venv" ]; then
    echo "❌ api-edge virtual environment not found. Running setup..."
    ./scripts/setup-edge.sh
fi

cd apps/api-edge
pm2 start .venv/bin/python --name api-edge -- run_edge.py
cd ../..

# web-edge (Next.js)
pm2 start "npm --prefix apps/web-edge run start -- -p 3001" --name web-edge

echo ""
echo "--- ✅ Demo is running! ---"
echo "🌐 National Hub (Cloud UI): http://localhost:3000"
echo "🌐 Edge Appliance (Local UI): http://localhost:3001"
echo "🛰 Cloud API: http://localhost:4000"
echo "🛰 Edge API: http://localhost:8000"
echo ""
echo "Use 'pm2 status' to monitor and 'pm2 logs' for output."
echo "Use 'pm2 stop all' to stop the demo."
