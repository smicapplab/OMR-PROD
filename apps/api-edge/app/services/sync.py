import httpx
import logging
import shutil
import cv2
import os
import gzip
import json
from pathlib import Path
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User, ActivityLog
from app.models.scan import Scan
from app.models.school import School

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SyncAgent")

class SyncService:
    """
    Handles communication between Edge and Cloud Hub.
    - Captures result push
    - Operator list pull
    - Activity Log sync
    - Local storage sync (Simulated Cloud Storage)
    """
    
    @property
    def client(self):
        base_url = f"{settings.CLOUD_API_URL}/api/v1" if settings.CLOUD_API_URL else "http://localhost:4000/api/v1"
        secret = settings.MACHINE_SECRET or ""
        logger.info(f"📡 Machine: {settings.MACHINE_ID}, Secret: {secret[:4]}***")
        return httpx.Client(
            base_url=base_url,
            timeout=30.0,
            headers={"X-Machine-Secret": secret}
        )

    def _post_compressed(self, endpoint: str, data: dict):
        """Compresses JSON payload using gzip before sending to Cloud Hub."""
        payload = json.dumps(data).encode("utf-8")
        compressed = gzip.compress(payload)
        # We must set both Content-Encoding and Content-Type for Nest/Express to parse correctly
        headers = {
            "Content-Encoding": "gzip",
            "Content-Type": "application/json"
        }
        return self.client.post(endpoint, content=compressed, headers=headers)

    def pull_operators(self, db: Session):
        try:
            logger.info(f"Pulling operators for Machine: {settings.MACHINE_ID}")
            response = self.client.get(f"/sync/machines/{settings.MACHINE_ID}/operators")
            
            if response.status_code == 401:
                logger.error(f"❌ Machine {settings.MACHINE_ID} is NOT enrolled in Cloud Hub.")
                return

            response.raise_for_status()
            
            operators_data = response.json()
            for op in operators_data:
                user = db.query(User).filter(User.email == op["email"]).first()
                if not user:
                    user = User(id=op["id"], email=op["email"])
                    db.add(user)
                # user.password_hash = op["password_hash"] # REMOVED (C-2)
                user.first_name = op.get("first_name")
                user.last_name = op.get("last_name")
                user.user_type = op.get("user_type", "SCHOOL_OPERATOR")
            db.commit()
            logger.info(f"✅ Synced {len(operators_data)} operators.")
        except Exception as e:
            logger.error(f"❌ Failed to pull operators: {e}")

    def pull_schools(self, db: Session):
        try:
            logger.info(f"Pulling schools for Machine: {settings.MACHINE_ID}")
            response = self.client.get(f"/sync/machines/{settings.MACHINE_ID}/schools")
            if response.status_code == 401:
                return

            response.raise_for_status()
            schools_data = response.json()
            
            for s_data in schools_data:
                school = db.query(School).filter(School.id == s_data["id"]).first()
                if not school:
                    school = School(id=s_data["id"])
                    db.add(school)
                school.name = s_data["name"]
                school.code = s_data["code"]
                school.region_id = s_data.get("regionId")
                school.division = s_data.get("division")
            db.commit()
            logger.info(f"✅ Synced {len(schools_data)} schools.")
        except Exception as e:
            logger.error(f"❌ Failed to pull schools: {e}")

    def push_logs(self, db: Session):
        try:
            logs = db.query(ActivityLog).filter(ActivityLog.is_synced == False).all()
            if not logs: return

            logger.info(f"📤 Pushing {len(logs)} activity logs...")
            
            payload = {
                "machine_id": settings.MACHINE_ID,
                "logs": [
                    {
                        "id": l.id,
                        "action": l.action,
                        "details": l.details,
                        "created_at": l.created_at.isoformat()
                    } for l in logs
                ]
            }

            response = self._post_compressed("/sync/logs", data=payload)
            response.raise_for_status()

            for l in logs: l.is_synced = True
            db.commit()
            logger.info(f"✅ Synced {len(logs)} logs.")
        except Exception as e:
            logger.error(f"❌ Failed to push logs: {e}")

    def pull_resolutions(self, db: Session):
        try:
            logger.info(f"Pulling resolutions for Machine: {settings.MACHINE_ID}")
            response = self.client.get(f"/sync/machines/{settings.MACHINE_ID}/resolutions")
            response.raise_for_status()
            
            resolutions = response.json()
            if not resolutions: return

            updated_count = 0
            for res in resolutions:
                sha = res["sha"]
                # Find local scan with this SHA
                scan = db.query(Scan).filter(Scan.original_sha == sha).first()
                if scan:
                    old_status = scan.process_status
                    
                    if res["status"] == "success":
                        scan.process_status = "success"
                    elif res["status"] == "errored" and scan.process_status == "errored_corrected":
                        # If it was returned to errored, it means HQ rejected the correction
                        scan.process_status = "errored"

                    # For standard field corrections
                    if scan.process_status == "pending_approval" and res["status"] == "success":
                        scan.process_status = "hq_resolved"
                        
                    scan.review_required = False
                    scan.is_manually_edited = False
                    
                    if res.get("errorReviewAction"):
                        scan.cloud_review_action = res["errorReviewAction"]
                        
                    if old_status != scan.process_status or scan.cloud_review_action != res.get("errorReviewAction"):
                        updated_count += 1
            
            if updated_count > 0:
                db.commit()
                logger.info(f"✅ Applied {updated_count} HQ resolutions to local records.")
        except Exception as e:
            logger.error(f"❌ Failed to pull resolutions: {e}")

    def push_scans(self, db: Session):
        pending_scans = db.query(Scan).filter(Scan.sync_status == "pending").all()
        if not pending_scans: return

        # 1. SETUP STORAGE DISCOVERY
        storage_base = os.getenv("SIMULATED_CLOUD_STORAGE")
        if not storage_base:
            storage_base = Path(__file__).resolve().parent.parent.parent.parent.parent / "apps" / "api-cloud" / "cloud_storage"
        else:
            storage_base = Path(storage_base)

        masters_dir = storage_base / "masters"
        proxies_dir = storage_base / "proxies"

        masters_dir.mkdir(parents=True, exist_ok=True)
        proxies_dir.mkdir(parents=True, exist_ok=True)

        for scan in pending_scans:
            try:
                local_img_path = Path(scan.file_path)
                if not local_img_path.exists():
                    logger.error(f"File not found for sync: {scan.file_path}")
                    continue

                proxy_filename = f"{scan.original_sha}_proxy.webp"
                master_filename = f"{scan.original_sha}_master.png"
                
                # 2. GENERATE ASSETS
                img = cv2.imread(str(local_img_path))
                if img is not None:
                    # Low-res proxy
                    small = cv2.resize(img, (0,0), fx=0.25, fy=0.25)
                    cv2.imwrite(str(proxies_dir / proxy_filename), small, [cv2.IMWRITE_WEBP_QUALITY, 80])
                    # Copy high-res master
                    shutil.copy(str(local_img_path), str(masters_dir / master_filename))
                else:
                    logger.error(f"Failed to read image for asset generation: {scan.file_path}")
                    continue

                # 3. PUSH DATA
                payload = {
                    "machine_id": settings.MACHINE_ID,
                    "school_id": scan.school_id,
                    "original_sha": scan.original_sha,
                    "confidence": scan.confidence,
                    "review_required": scan.review_required,
                    "is_manually_edited": scan.is_manually_edited,
                    "raw_data": scan.raw_data,
                    "file_name": scan.file_name,
                    "file_url": f"/cloud-assets/masters/{master_filename}",
                    "proxy_url": f"/cloud-assets/proxies/{proxy_filename}",
                    "process_status": scan.process_status,
                    "recognized_ratio": scan.recognized_ratio,
                    "error_reason": scan.error_reason,
                    "error_detected_at": scan.error_detected_at.isoformat() if scan.error_detected_at else None
                }

                # Gap-5: If manually edited, try to find the original data in logs 
                # so the Hub can show a proper diff on first sync.
                if scan.is_manually_edited:
                    first_log = db.query(ActivityLog).filter(
                        ActivityLog.scan_id == scan.id, 
                        ActivityLog.action == "SCAN_CORRECTION"
                    ).order_by(ActivityLog.created_at.asc()).first()
                    if first_log and isinstance(first_log.details, dict) and "old_data" in first_log.details:
                        payload["original_raw_data"] = first_log.details["old_data"]
                
                response = self._post_compressed("/sync/scans", data=payload)
                response.raise_for_status()
                
                scan.sync_status = "synced"
                db.commit()
                logger.info(f"✅ Synced scan: {scan.file_name} with official images")
            except Exception as e:
                logger.error(f"❌ Failed to sync scan {scan.file_name}: {e}")

sync_service = SyncService()
