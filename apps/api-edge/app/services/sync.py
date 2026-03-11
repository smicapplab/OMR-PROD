import httpx
import logging
import shutil
import cv2
import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User
from app.models.scan import Scan

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SyncAgent")

class SyncService:
    """
    Handles communication between Edge and Cloud Hub.
    - Captures result push
    - Operator list pull
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
                user.password_hash = op["password_hash"]
                user.first_name = op.get("first_name")
                user.last_name = op.get("last_name")
                user.user_type = op.get("user_type", "SCHOOL_OPERATOR")
            db.commit()
            logger.info(f"✅ Synced {len(operators_data)} operators.")
        except Exception as e:
            logger.error(f"❌ Failed to pull operators: {e}")

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
                    "raw_data": scan.raw_data,
                    "file_name": scan.file_name,
                    "file_url": f"/cloud-assets/masters/{master_filename}",
                    "proxy_url": f"/cloud-assets/proxies/{proxy_filename}"
                }
                
                response = self.client.post("/sync/scans", json=payload)
                response.raise_for_status()
                
                scan.sync_status = "synced"
                db.commit()
                logger.info(f"✅ Synced scan: {scan.file_name} with forensic images")
            except Exception as e:
                logger.error(f"❌ Failed to sync scan {scan.file_name}: {e}")

sync_service = SyncService()
