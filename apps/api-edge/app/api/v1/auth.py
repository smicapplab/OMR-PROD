from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token, verify_password, decode_token
from app.core.config import settings
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == body.email).filter(User.is_active == True).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Set refresh token in HttpOnly cookie
    response.set_cookie(
        key="omr_edge_refresh",
        value=refresh_token,
        httponly=True,
        secure=settings.SECURE_COOKIES,
        samesite="lax",
        path="/api/v1/auth/refresh"
    )

    return {
        "accessToken": access_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "userType": user.user_type,
            "isActive": user.is_active,
            "visibilityScope": "SCHOOL",
            "scopeValue": getattr(user, 'school_id', None)
        }
    }

@router.post("/refresh")
async def refresh(
    request: Request,
    db: Session = Depends(get_db)
):
    refresh_token = request.cookies.get("omr_edge_refresh")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    # H-1: Also check isActive on refresh so deactivated users lose their session
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    access_token = create_access_token(user.id)
    return {"accessToken": access_token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(
        key="omr_edge_refresh",
        path="/api/v1/auth/refresh",
        httponly=True,
        secure=settings.SECURE_COOKIES,
        samesite="lax"
    )
    return {"message": "Logged out successfully"}

@router.get("/me")
async def get_me(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    # M-1: Reject non-access tokens (e.g. a refresh token mistakenly sent here)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    return {
        "id": user.id,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "userType": user.user_type,
        "isActive": user.is_active,
        "visibilityScope": "SCHOOL",
        "scopeValue": getattr(user, 'school_id', None)
    }
