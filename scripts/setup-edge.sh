#!/bin/bash
set -e

echo "--- 🛠 Setting up OMR Edge Hub ---"

# Root project folders
mkdir -p apps/api-edge/raw_scans apps/api-edge/uploads apps/api-edge/success apps/api-edge/error

# Setup Python Sandbox
cd apps/api-edge
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Return to root
cd ../..

echo "✅ Setup complete. Please run npm install at root for JS packages."
