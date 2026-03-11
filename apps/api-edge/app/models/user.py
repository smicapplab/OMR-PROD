from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table, JSON, Integer
from app.core.database import Base
import datetime
import uuid as uuid_pkg

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid_pkg.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    is_active = Column(Boolean, default=True)
    user_type = Column(String, default="SCHOOL_OPERATOR")
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid_pkg.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    
    # New: Explicit scan link
    scan_id = Column(Integer, index=True)
    
    action = Column(String, nullable=False) # LOGIN, SCAN_CORRECTION, SCAN_APPROVAL
    status_after = Column(String) # success, pending_approval, etc.
    
    details = Column(JSON) 
    
    machine_id = Column(String, index=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
