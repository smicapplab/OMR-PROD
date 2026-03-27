import multiprocessing
import uvicorn
import time
import sys
import os
from app.main import app
from app.services.watcher import start_watcher
from app.services.sync_agent import start_sync_thread
from app.core.config import settings

# Ensure we're in the right directory context
sys.path.append(os.getcwd())

def run_server():
    # Use reload=True so dev changes are picked up automatically
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

def run_watcher():
    start_watcher(settings.RAW_SCANS_DIR)

if __name__ == "__main__":
    print("\n--- Starting OMR Edge Hub (V2 - RELOAD ENABLED) ---")
    print("🚀 API: http://localhost:8000")
    print(f"👀 Watcher: Monitoring '{settings.RAW_SCANS_DIR}/' folder")
    print("🔄 Sync: Auto-sync agent is active\n")
    
    try:
        # Background services (Sync & Watcher) are now managed via FastAPI lifespan in app.main
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
    except KeyboardInterrupt:
        print("\nShutdown complete.")
