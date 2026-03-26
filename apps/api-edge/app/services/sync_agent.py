import time
import logging
import threading
from app.services.sync import sync_service
from app.core.database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SyncAgent")

def run_sync_loop(interval_seconds: int = 30):
    """
    Background loop that continuously tries to sync pending data to the cloud.
    """
    logger.info(f"🔄 Auto-Sync Agent started (Interval: {interval_seconds}s)")
    
    while True:
        db = SessionLocal()
        try:
            # 1. Pull latest operators/config from cloud
            sync_service.pull_operators(db)
            
            # 2. Pull synchronized school lists
            sync_service.pull_schools(db)
            
            # 3. Pull HQ resolutions (Finalized decisions)
            sync_service.pull_resolutions(db)
            
            # 3. Push audit logs
            sync_service.push_logs(db)
            
            # 4. Push pending scan results
            sync_service.push_scans(db)
            
        except Exception as e:
            logger.error(f"⚠️ Sync cycle encountered an error: {e}")
        finally:
            db.close()
            
        time.sleep(interval_seconds)

def start_sync_thread():
    sync_thread = threading.Thread(target=run_sync_loop, daemon=True)
    sync_thread.start()
    return sync_thread
