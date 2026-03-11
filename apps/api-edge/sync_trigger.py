from app.services.sync import sync_service
from app.core.database import SessionLocal, engine, Base
import sys

def run_sync():
    print("--- 📡 Manual Sync Trigger: PULL OPERATORS ---")
    
    # Ensure all tables exist locally
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("1. Pulling operators...")
        sync_service.pull_operators(db)
        
        print("2. Pushing pending scans...")
        sync_service.push_scans(db)
        
        print("✅ Sync cycle complete.")
    except Exception as e:
        print(f"❌ Sync failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_sync()
