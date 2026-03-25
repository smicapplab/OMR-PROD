import multiprocessing
import uvicorn
import time
import sys
import os
from app.main import app
from app.services.watcher import start_watcher
from app.services.sync_agent import start_sync_thread

# Ensure we're in the right directory context
sys.path.append(os.getcwd())

def run_server():
    # Use reload=True so dev changes are picked up automatically
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

def run_watcher():
    start_watcher("raw_scans")

if __name__ == "__main__":
    # Start background sync thread
    start_sync_thread()
    
    # Start the Watcher as a separate process
    p2 = multiprocessing.Process(target=run_watcher)
    p2.start()
    
    print("\n--- Starting OMR Edge Hub (V2 - RELOAD ENABLED) ---")
    print("🚀 API: http://localhost:8000")
    print("👀 Watcher: Monitoring 'raw_scans/' folder")
    print("🔄 Sync: Auto-sync agent is active\n")
    
    try:
        # Run the server in the main process with reload enabled
        # This is the most reliable way to get auto-reload working
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
    except KeyboardInterrupt:
        print("\nStopping services...")
        p2.terminate()
        p2.join()
        print("Shutdown complete.")
