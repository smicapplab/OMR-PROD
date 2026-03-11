import time
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from app.services.scanner import scanner_service
from app.core.database import SessionLocal
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Watcher")

class ScanHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        if file_path.suffix.lower() not in [".png", ".jpg", ".jpeg"]:
            return

        logger.info(f"New scan detected: {file_path.name}")
        
        # Wait for file to be fully written
        time.sleep(1) 
        
        db = SessionLocal()
        try:
            db_scan = scanner_service.process_new_file(
                file_path,
                db,
                machine_id=settings.MACHINE_ID,
                school_id=settings.DEFAULT_SCHOOL_ID
            )
            logger.info(f"✅ Processed {file_path.name} (ID: {db_scan.id})")
        except Exception as e:
            logger.error(f"❌ Failed to process {file_path.name}: {e}")
        finally:
            db.close()

def start_watcher(path_to_watch: str):
    path = Path(path_to_watch)
    path.mkdir(exist_ok=True)
    
    event_handler = ScanHandler()
    observer = Observer()
    observer.schedule(event_handler, str(path), recursive=False)
    observer.start()
    
    logger.info(f"👀 Watching folder: {path.absolute()}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
