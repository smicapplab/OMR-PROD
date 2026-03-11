import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.scan import Scan
from app.services.omr import omr_service
import logging

logger = logging.getLogger("ScannerService")

class ScannerService:
    """
    Handles file ingestion and database persistence.
    """
    
    def __init__(self, upload_dir: str = "uploads", success_dir: str = "success", error_dir: str = "error"):
        self.upload_dir = Path(upload_dir)
        self.success_dir = Path(success_dir)
        self.error_dir = Path(error_dir)
        
        # Ensure directories exist
        for d in [self.upload_dir, self.success_dir, self.error_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def process_new_file(self, file_path: Path, db: Session, school_id: str, machine_id: str):
        """
        Process a single image file, save to DB, and move to success/error folder.
        """
        try:
            # 1. Run OMR
            result = omr_service.process_scan(file_path)
            
            # 2. Persist to DB
            db_scan = Scan(
                file_name=file_path.name,
                file_path=str(self.success_dir / file_path.name),
                original_sha=result["original_sha"],
                confidence=result["confidence"],
                review_required=result["review_required"],
                raw_data=result["data"],
                process_status="success",
                school_id=school_id,
                machine_id=machine_id
            )
            db.add(db_scan)
            db.commit()
            db.refresh(db_scan)
            
            # 3. Move file
            shutil.move(str(file_path), str(self.success_dir / file_path.name))
            
            return db_scan

        except Exception as e:
            db.rollback()
            logger.error(f"Error processing {file_path}: {e}")
            # Move to error folder
            shutil.move(str(file_path), str(self.error_dir / file_path.name))
            
            # Log error scan in DB
            error_scan = Scan(
                file_name=file_path.name,
                file_path=str(self.error_dir / file_path.name),
                process_status="error",
                school_id=school_id,
                machine_id=machine_id
            )
            db.add(error_scan)
            db.commit()
            raise e

scanner_service = ScannerService()
