from app.core.database import SessionLocal, engine, Base
from app.models.user import User
from passlib.context import CryptContext
import sys

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed():
    print("--- 🛠 Seeding Local Edge Database ---")
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if user already exists
        user_email = "admin@omr.local"
        existing_user = db.query(User).filter(User.email == user_email).first()
        
        if not existing_user:
            new_user = User(
                email=user_email,
                password_hash=pwd_context.hash("password123"),
                first_name="Local",
                last_name="Operator",
                user_type="SCHOOL_OPERATOR"
            )
            db.add(new_user)
            db.commit()
            print(f"✅ Created local operator: {user_email}")
        else:
            print(f"ℹ️ Local operator {user_email} already exists.")

        # Add operator1@mshs.edu.ph for parity with cloud demo
        op_email = "operator1@mshs.edu.ph"
        if not db.query(User).filter(User.email == op_email).first():
            db.add(User(
                email=op_email,
                password_hash=pwd_context.hash("password123"),
                first_name="MSHS",
                last_name="Operator 1",
                user_type="SCHOOL_OPERATOR"
            ))
            db.commit()
            print(f"✅ Created MSHS operator: {op_email}")

    except Exception as e:
        print(f"❌ Seeding failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
