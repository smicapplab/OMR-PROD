from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, String
from app.core.config import settings
from app.core.database import get_db, engine, Base
from fastapi.staticfiles import StaticFiles
from app.api.v1 import auth
from app.core.security import decode_token

# Initialize database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="OMR Edge API. Restricted input pipeline for security.",
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    from app.models.user import User
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def format_scan(scan):
    """Maps SQLAlchemy snake_case to Contract camelCase"""
    image_base = "/images/success" if scan.process_status != "error" else "/images/error"
    return {
        "id": scan.id,
        "fileName": scan.file_name,
        "originalSha": scan.original_sha,
        "syncStatus": scan.sync_status,
        "processStatus": scan.process_status,
        "confidence": scan.confidence,
        "reviewRequired": scan.review_required,
        "isManuallyEdited": scan.is_manually_edited,
        "rawData": scan.raw_data,
        "machineId": scan.machine_id,
        "createdAt": scan.created_at.isoformat() if scan.created_at else None,
        "updatedAt": scan.updated_at.isoformat() if scan.updated_at else None,
        "imageUrl": f"{image_base}/{scan.file_name}"
    }

app.mount("/images/success", StaticFiles(directory="success"), name="success_images")
app.mount("/images/error", StaticFiles(directory="error"), name="error_images")
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])

@app.get("/")
async def root():
    return {"message": "OMR Edge API running", "machine_id": settings.MACHINE_ID}

@app.get(f"{settings.API_V1_STR}/scans")
async def list_scans(skip: int = 0, limit: int = 50, search: str = None, db: Session = Depends(get_db)):
    from app.models.scan import Scan
    query = db.query(Scan)
    if search:
        st = f"%{search}%"
        query = query.filter(or_(Scan.file_name.ilike(st), Scan.raw_data.cast(String).ilike(st)))
    total = query.count()
    items = query.order_by(Scan.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "items": [format_scan(i) for i in items],
        "total": total, "skip": skip, "limit": limit
    }

@app.get(f"{settings.API_V1_STR}/scans/{{scan_id}}")
async def get_scan(scan_id: int, db: Session = Depends(get_db)):
    from app.models.scan import Scan
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return format_scan(scan)

@app.patch(f"{settings.API_V1_STR}/scans/{{scan_id}}")
async def update_scan(scan_id: int, payload: dict, db: Session = Depends(get_db), user = Depends(get_current_user)):
    print(f"📥 Received correction for scan {scan_id}")
    from app.models.scan import Scan
    from app.models.user import ActivityLog
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    old_data = scan.raw_data
    if "raw_data" in payload:
        scan.raw_data = payload["raw_data"]
        scan.is_manually_edited = True
        scan.process_status = "pending_approval"
        scan.sync_status = "pending"
    log = ActivityLog(
        user_id=user.id, scan_id=scan_id, action="SCAN_CORRECTION",
        status_after="pending_approval",
        details={
            "old_data": old_data, 
            "new_data": payload.get("raw_data"),
            "sha": scan.original_sha
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
    if user.user_type not in ["SUPER_ADMIN", "SCHOOL_ADMIN"]:
        raise HTTPException(status_code=403, detail="Only supervisors can approve corrections")
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
async def get_scan_logs(scan_id: int, db: Session = Depends(get_db)):
    from app.models.user import ActivityLog, User
    logs = db.query(ActivityLog, User).join(User, ActivityLog.user_id == User.id)\
             .filter(ActivityLog.scan_id == scan_id)\
             .order_by(ActivityLog.created_at.desc()).all()
    return [
        {
            "id": log.ActivityLog.id,
            "action": log.ActivityLog.action,
            "status_after": log.ActivityLog.status_after,
            "created_at": log.ActivityLog.created_at.isoformat(),
            "operator": f"{log.User.first_name} {log.User.last_name}",
            "details": log.ActivityLog.details
        } for log in logs
    ]

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
