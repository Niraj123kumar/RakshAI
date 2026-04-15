"""
GigShield — JWT Authentication Utilities
Implements token creation, validation, and FastAPI dependency for protected routes.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from db import get_db

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-use-32-chars-min")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

bearer_scheme = HTTPBearer()


def create_access_token(worker_id: int, phone: str) -> str:
    """Create a signed JWT token embedding the worker's identity."""
    payload = {
        "sub": str(worker_id),
        "phone": phone,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        worker_id = payload.get("sub")
        if worker_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        return {"worker_id": int(worker_id), "phone": payload.get("phone", "")}
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_worker(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> "Worker":  # type: ignore
    """
    FastAPI dependency: validates Bearer token and returns the Worker ORM object.
    Use as: worker = Depends(get_current_worker)
    The worker_id is derived from the token — never from a query parameter.
    """
    from models import Worker
    token_data = decode_token(credentials.credentials)
    worker = db.query(Worker).filter(Worker.id == token_data["worker_id"]).first()
    if not worker or not worker.is_active:
        raise HTTPException(status_code=401, detail="Worker account not found or inactive")
    return worker


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Admin-only dependency. Admin tokens carry role='admin' in the JWT payload.
    In production, issue admin tokens separately from the worker login flow.
    """
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid admin token: {e}")
