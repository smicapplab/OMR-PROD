from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, String
from app.core.config import settings
from app.core.database import get_db, engine, Base
from fastapi.staticfiles import StaticFiles
from app.api.v1 import auth
from app.core.security import decode_token
from pydantic import BaseModel
from typing import Optional, Dict

from contextlib import asynccontextmanager
from app.services.sync_agent import start_sync_thread
from app.services.watcher import start_watcher
import logging
import threading
from pathlib import Path

# Initialize database
from app.models.school import School  # Ensure table is created
Base.metadata.create_all(bind=engine)

logger = logging.getLogger("api-edge")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    logger.info("🚀 Starting Background Services...")
    
    # Start Sync Agent (Separate Thread)
    start_sync_thread()
    
    # Start Watcher (Separate Thread)
    # This thread will handle BOTH the initial sweep and real-time monitoring
    watcher_thread = threading.Thread(
        target=start_watcher,
        args=(settings.RAW_SCANS_DIR,),
        daemon=True
    )
    watcher_thread.start()
    
    yield
    # SHUTDOWN
    logger.info("🛑 Stopping Background Services...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="OMR Edge API. Restricted input pipeline for security.",
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    # M-1: Reject non-access tokens
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")
    from app.models.user import User
    user = db.query(User).filter(User.id == payload.get("sub"), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or deactivated")
    return user

def format_scan(scan):
    """Maps SQLAlchemy snake_case to Contract camelCase"""
    if scan.process_status == "errored" or scan.process_status == "errored_corrected":
        image_base = "/images/errored"
    elif scan.process_status == "error":
        image_base = "/images/error"
    else:
        image_base = "/images/success"
        
    return {
        "id": scan.id,
        "fileName": scan.file_name,
        "originalSha": scan.original_sha,
        "syncStatus": scan.sync_status,
        "processStatus": scan.process_status,
        "confidence": scan.confidence,
        "recognizedRatio": scan.recognized_ratio,
        "reviewRequired": scan.review_required,
        "isManuallyEdited": scan.is_manually_edited,
        "rawData": scan.raw_data,
        "machineId": scan.machine_id,
        "errorDetectedAt": scan.error_detected_at.isoformat() if scan.error_detected_at else None,
        "errorReason": scan.error_reason,
        "operatorCorrectionSubmittedAt": scan.operator_correction_submitted_at.isoformat() if scan.operator_correction_submitted_at else None,
        "operatorCorrectionBy": scan.operator_correction_by,
        "cloudReviewStatus": scan.cloud_review_status,
        "cloudReviewAction": scan.cloud_review_action,
        "cloudReviewSyncedAt": scan.cloud_review_synced_at.isoformat() if scan.cloud_review_synced_at else None,
        "createdAt": scan.created_at.isoformat() if scan.created_at else None,
        "updatedAt": scan.updated_at.isoformat() if scan.updated_at else None,
        "imageUrl": f"{image_base}/{scan.file_name}",
        "studentName": get_student_name(scan.raw_data)
    }

# Ensure static directories exist before mounting
import os
os.makedirs(settings.SUCCESS_DIR, exist_ok=True)
os.makedirs(settings.ERROR_DIR, exist_ok=True)
os.makedirs(settings.ERRORED_DIR, exist_ok=True)

app.mount("/images/success", StaticFiles(directory=settings.SUCCESS_DIR), name="success_images")
app.mount("/images/error", StaticFiles(directory=settings.ERROR_DIR), name="error_images")
app.mount("/images/errored", StaticFiles(directory=settings.ERRORED_DIR), name="errored_images")
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])

@app.get("/")
async def root():
    return {"message": "OMR Edge API running", "machine_id": settings.MACHINE_ID}

def get_student_name(data):
    if not data or not isinstance(data, dict):
        return "UNIDENTIFIED STUDENT"
    info = data.get("student_info", {})
    first = info.get("first_name", {}).get("answer") or info.get("firstName", {}).get("answer") or ""
    last = info.get("last_name", {}).get("answer") or info.get("lastName", {}).get("answer") or ""
    name = f"{first} {last}".strip()
    return name if name else "UNIDENTIFIED STUDENT"
 
class ScanUpdatePayload(BaseModel):
    raw_data: Optional[Dict] = None
    reason: Optional[str] = "Manual correction via Edge Console"


@app.get(f"{settings.API_V1_STR}/scans")
async def list_scans(skip: int = 0, limit: int = 50, search: str = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.models.scan import Scan
    from sqlalchemy import or_, and_, not_
    
    # Optimization: Only select necessary fields. Include raw_data to calculate name but exclude from final payload.
    query = db.query(
        Scan.id, Scan.file_name, Scan.original_sha, Scan.sync_status, 
        Scan.process_status, Scan.confidence, Scan.review_required, 
        Scan.is_manually_edited, Scan.machine_id, Scan.created_at, Scan.updated_at,
        Scan.raw_data
    ).filter(
        or_(
            not_(Scan.process_status.in_(['errored', 'errored_corrected'])),
            and_(
                Scan.process_status.in_(['errored', 'errored_corrected']),
                Scan.cloud_review_action.in_(['bubble_corrected', 'operator_corrected'])
            )
        )
    )
    
    if search:
        st = f"%{search}%"
        query = query.filter(or_(Scan.file_name.ilike(st), Scan.raw_data.cast(String).ilike(st)))
    
    # H-8: Cap limit to prevent full-table dumps
    limit = max(1, min(limit, 100))
    total = query.count()
    items = query.order_by(Scan.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": [
            {
                "id": i.id,
                "fileName": i.file_name,
                "originalSha": i.original_sha,
                "syncStatus": i.sync_status,
                "processStatus": i.process_status,
                "confidence": i.confidence,
                "reviewRequired": i.review_required,
                "isManuallyEdited": i.is_manually_edited,
                "machineId": i.machine_id,
                "createdAt": i.created_at.isoformat() if i.created_at else None,
                "updatedAt": i.updated_at.isoformat() if i.updated_at else None,
                "imageUrl": f"{'/images/success' if i.process_status != 'error' else '/images/error'}/{i.file_name}",
                "studentName": get_student_name(i.raw_data)
            } for i in items
        ],
        "total": total, "skip": skip, "limit": limit
    }

@app.get(f"{settings.API_V1_STR}/scans/{{scan_id}}")
async def get_scan(scan_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.models.scan import Scan
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return format_scan(scan)

@app.get(f"{settings.API_V1_STR}/schools")
async def get_schools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.models.school import School
    limit = max(1, min(limit, 500))
    schools = db.query(School).offset(skip).limit(limit).all()
    return [{

        "id": s.id,
        "name": s.name,
        "code": s.code,
        "region_id": s.region_id,
        "division": s.division
    } for s in schools]

@app.get(f"{settings.API_V1_STR}/schools/{{school_id}}")
async def get_school(school_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.models.school import School
    from sqlalchemy import or_
    school = db.query(School).filter(or_(School.id == school_id, School.code == school_id)).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return {
        "id": school.id,
        "name": school.name,
        "code": school.code,
        "region_id": school.region_id,
        "division": school.division
    }

@app.patch(f"{settings.API_V1_STR}/scans/{{scan_id}}")
async def update_scan(scan_id: int, payload: ScanUpdatePayload, db: Session = Depends(get_db), user = Depends(get_current_user)):
    print(f"📥 Received correction for scan {scan_id}")
    from app.models.scan import Scan
    from app.models.user import ActivityLog
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    old_data = scan.raw_data
    if payload.raw_data is not None:
        scan.raw_data = payload.raw_data
        scan.is_manually_edited = True
        scan.process_status = "pending_approval"
        scan.sync_status = "pending"
    
    log = ActivityLog(
        user_id=user.id, scan_id=scan_id, action="SCAN_CORRECTION",
        status_after="pending_approval",
        details={
            "old_data": old_data, 
            "new_data": payload.raw_data,
            "sha": scan.original_sha,
            "reason": payload.reason
        },
        machine_id=settings.MACHINE_ID,
        is_synced=False
    )

    db.add(log)
    db.commit()
    return {"ok": True}

@app.post(f"{settings.API_V1_STR}/scans/{{scan_id}}/approve")
async def approve_scan(scan_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    from app.models.scan import Scan
    from app.models.user import ActivityLog
    # H-6: Four-eyes principle — only SUPER_ADMIN can approve at the edge level.
    # SCHOOL_ADMIN can submit corrections but cannot approve their own (that goes to Cloud QA).
    if user.user_type != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only Super Admins can approve corrections at the edge. School-level corrections are reviewed by the Cloud Hub.")
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    scan.process_status = "success"
    scan.review_required = False
    log = ActivityLog(
        user_id=user.id, scan_id=scan_id, action="SCAN_APPROVAL",
        status_after="success", details={"scan_id": scan_id},
        machine_id=settings.MACHINE_ID
    )
    db.add(log)
    db.commit()
    return {"ok": True}

@app.get(f"{settings.API_V1_STR}/scans/{{scan_id}}/logs")
async def get_scan_logs(scan_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    from app.models.user import ActivityLog, User
    logs = db.query(ActivityLog, User).join(User, ActivityLog.user_id == User.id)\
             .filter(ActivityLog.scan_id == scan_id)\
             .order_by(ActivityLog.created_at.desc()).all()
    return [
        {
            "id": log.ActivityLog.id,
            "action": log.ActivityLog.action,
            "status_after": log.ActivityLog.status_after,
            "createdAt": log.ActivityLog.created_at.isoformat(),
            "operator": f"{log.User.first_name} {log.User.last_name}",
            "details": log.ActivityLog.details
        } for log in logs
    ]

@app.get(f"{settings.API_V1_STR}/errored-sheets")
async def list_errored_sheets(skip: int = 0, limit: int = 50, status: str = "pending", search: str = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user.user_type != "EDGE_OPERATOR" and user.user_type != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    from app.models.scan import Scan
    from sqlalchemy import func
    query = db.query(Scan)
    
    if status == "pending":
        query = query.filter(Scan.cloud_review_status == "pending", Scan.process_status.in_(["errored", "errored_corrected"]))
    elif status == "reviewed":
        query = query.filter(Scan.cloud_review_status == "reviewed")
    else:
        query = query.filter(Scan.process_status.in_(["errored", "errored_corrected"]))

    if search:
        st = f"%{search.lower()}%"
        first_name = func.json_extract(Scan.raw_data, '$.student_info.first_name.answer')
        last_name = func.json_extract(Scan.raw_data, '$.student_info.last_name.answer')
        query = query.filter(or_(
            Scan.file_name.ilike(st), 
            func.lower(first_name).like(st),
            func.lower(last_name).like(st)
        ))
    
    limit = max(1, min(limit, 100))
    total = query.count()
    items = query.order_by(Scan.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "items": [format_scan(i) for i in items],
        "total": total, "skip": skip, "limit": limit
    }

@app.post(f"{settings.API_V1_STR}/errored-sheets/{{scan_id}}/operator-correction")
async def operator_correction(scan_id: int, payload: ScanUpdatePayload, db: Session = Depends(get_db), user = Depends(get_current_user)):
    if user.user_type != "EDGE_OPERATOR":
        raise HTTPException(status_code=403, detail="Only operators can submit corrections")
    from app.models.scan import Scan
    from app.models.user import ActivityLog
    import datetime
    
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    old_data = scan.raw_data
    scan.raw_data = payload.raw_data
    scan.process_status = "errored_corrected"
    scan.sync_status = "pending"
    scan.operator_correction_submitted_at = datetime.datetime.utcnow()
    scan.operator_correction_by = f"{user.first_name} {user.last_name}"
    
    log = ActivityLog(
        user_id=user.id, scan_id=scan_id, action="ERRORED_SHEET_CORRECTION",
        status_after="errored_corrected",
        details={
            "old_data": old_data, 
            "new_data": payload.raw_data,
            "sha": scan.original_sha,
            "reason": payload.reason
        },
        machine_id=settings.MACHINE_ID,
        is_synced=False
    )

    db.add(log)
    db.commit()
    return {"ok": True}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
