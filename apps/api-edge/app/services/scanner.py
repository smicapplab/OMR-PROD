import shutil
import time
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.scan import Scan
from app.services.omr import omr_service
from app.core.config import settings
import logging

logger = logging.getLogger("ScannerService")

class ScannerService:
    """
    Handles file ingestion and database persistence.
    """

    def __init__(self, upload_dir: str = None, success_dir: str = None, error_dir: str = None):
        self.upload_dir = Path(upload_dir or settings.UPLOADS_DIR)
        self.success_dir = Path(success_dir or settings.SUCCESS_DIR)
        self.error_dir = Path(error_dir or settings.ERROR_DIR)
        
        # Ensure directories exist
        for d in [self.upload_dir, self.success_dir, self.error_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def process_new_file(self, file_path: Path, db: Session, machine_id: str, school_id: str = None):
        """
        Process a single image file, save to DB, and move to success/error folder.
        Validates extracted school ID against expected context to catch student typos.
        """
        try:
            # 1. Run OMR
            result = omr_service.process_scan(file_path)
            sha = result["original_sha"]
            extracted_data = result["data"]
            
            # 2. VALIDATE SCHOOL IDENTIFICATION
            # Trust the paper first (extracted_school_id). 
            # Fallback to the context school_id (DEFAULT_SCHOOL_ID) only if the paper is blank.
            extracted_school_id = extracted_data.get("student_info", {}).get("current_school", {}).get("school_id", {}).get("answer")
            
            # Determine the authoritative ID for this record
            final_school_id = extracted_school_id if extracted_school_id else school_id
            
            review_required = result["review_required"]
            
            # If the paper differs from the machine context, flag it for auditor review
            # but still use the paper's ID as the record's primary attribution.
            if school_id and extracted_school_id and str(school_id) != str(extracted_school_id):
                logger.warning(f"⚠️ School Mismatch Detected! Context: {school_id}, Paper: {extracted_school_id}")
                review_required = True 

            # Use SHA as the filename to match cloud naming and prevent collisions
            unique_filename = f"{sha}{file_path.suffix}"
            target_path = self.success_dir / unique_filename

            # 3. Persist to DB
            db_scan = Scan(
                file_name=unique_filename,
                file_path=str(target_path),
                original_sha=sha,
                confidence=result["confidence"],
                review_required=review_required,
                raw_data=extracted_data,
                process_status="success",
                school_id=final_school_id,
                machine_id=machine_id
            )
            db.add(db_scan)
            db.commit()
            db.refresh(db_scan)
            
            # 4. Move file
            shutil.move(str(file_path), str(target_path))
            
            return db_scan

        except Exception as e:
            db.rollback()
            logger.error(f"Error processing {file_path}: {e}")
            
            # For errors, we might not have a SHA, so use timestamp
            timestamp = int(time.time())
            error_filename = f"err_{timestamp}_{file_path.name}"
            error_path = self.error_dir / error_filename

            # Move to error folder
            shutil.move(str(file_path), str(error_path))
            
            # Log error scan in DB
            error_scan = Scan(
                file_name=error_filename,
                file_path=str(error_path),
                process_status="error",
                machine_id=machine_id
            )
            db.add(error_scan)
            db.commit()
            raise e

scanner_service = ScannerService()
