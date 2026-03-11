from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON
from app.core.database import Base
import datetime

class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, index=True)
    file_path = Column(String)
    original_sha = Column(String, index=True)
    
    # Sync Status: pending | synced | error
    sync_status = Column(String, default="pending", index=True)
    
    # Process Status: success | error | pending_approval
    process_status = Column(String, default="pending", index=True)
    
    confidence = Column(Float)
    review_required = Column(Boolean, default=False)
    is_manually_edited = Column(Boolean, default=False)
    
    # Raw OMR data (Subject scores, Student Info)
    raw_data = Column(JSON)
    
    school_id = Column(String, index=True)
    machine_id = Column(String, index=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
