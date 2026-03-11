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
    uvicorn.run(app, host="0.0.0.0", port=8000)

def run_watcher():
    start_watcher("raw_scans")

if __name__ == "__main__":
    # Start background sync thread (runs within the main control process)
    # This thread will handle auto-syncing every 30 seconds
    start_sync_thread()
    
    # Start the Server and Watcher as separate processes
    p1 = multiprocessing.Process(target=run_server)
    p2 = multiprocessing.Process(target=run_watcher)
    
    print("\n--- Starting OMR Edge Hub ---")
    print("🚀 API: http://localhost:8000")
    print("👀 Watcher: Monitoring 'raw_scans/' folder")
    print("🔄 Sync: Auto-sync agent is active\n")
    
    p1.start()
    p2.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping services...")
        p1.terminate()
        p2.terminate()
        p1.join()
        p2.join()
        print("Shutdown complete.")
