"""
GigShield Auth Router
======================
POST /auth/login    — Validate phone, return JWT
POST /auth/register — Register new worker, return JWT
GET  /auth/me       — Return current worker info (requires auth)
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import Optional
from sqlalchemy.orm import Session
from db import get_db
from auth_utils import create_access_token, get_current_worker

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request/Response Models ───────────────────────────────────────────────────

class LoginRequest(BaseModel):
    phone: str

    @validator("phone")
    def validate_phone(cls, v):
        clean = v.strip().replace(" ", "").replace("+91", "").replace("-", "")
        if len(clean) != 10 or not clean.isdigit():
            raise ValueError("Phone must be exactly 10 digits")
        return clean


class RegisterRequest(BaseModel):
    phone: str
    name: str
    city: str
    platform: str
    zone: Optional[str] = None
    shift_start: int
    shift_end: int
    weekly_income_estimate: float
    upi_id: Optional[str] = None

    @validator("phone")
    def validate_phone(cls, v):
        clean = v.strip().replace(" ", "").replace("+91", "").replace("-", "")
        if len(clean) != 10 or not clean.isdigit():
            raise ValueError("Phone must be exactly 10 digits")
        return clean

    @validator("shift_start", "shift_end")
    def validate_shift_hours(cls, v):
        if not (0 <= v <= 23):
            raise ValueError("Shift hours must be between 0 and 23")
        return v

    @validator("weekly_income_estimate")
    def validate_income(cls, v):
        if v <= 0 or v > 100000:
            raise ValueError("Weekly income estimate must be between 1 and 100000")
        return v

    @validator("name")
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate by phone number.
    Returns JWT token + worker profile on success.
    """
    from models import Worker, Policy

    try:
        worker = db.query(Worker).filter(Worker.phone == request.phone).first()
    except Exception as e:
        logger.error(f"DB error during login for phone {request.phone}: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable. Please try again.")

    if not worker:
        return {
            "status": "not_registered",
            "message": "Phone number not registered. Please sign up.",
            "phone": request.phone,
        }

    if not worker.is_active:
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")

    try:
        policy = (
            db.query(Policy)
            .filter(Policy.worker_id == worker.id, Policy.status == "active")
            .order_by(Policy.id.desc())
            .first()
        )
    except Exception as e:
        logger.error(f"DB error fetching policy for worker {worker.id}: {e}")
        policy = None

    token = create_access_token(worker.id, worker.phone)

    return {
        "status": "found",
        "token": token,
        "worker": {
            "id": str(worker.id),
            "name": worker.name,
            "phone": worker.phone,
            "city": worker.city,
            "platform": worker.platform,
            "zone": worker.zone_geojson,
            "shift_start": worker.shift_start,
            "shift_end": worker.shift_end,
            "weekly_income_estimate": worker.weekly_income_estimate,
            "upi_id": worker.upi_id,
        },
        "policy": {
            "plan_type": policy.plan_type,
            "status": policy.status,
            "weekly_premium": policy.weekly_premium,
            "max_payout": policy.max_payout,
            "risk_score": policy.risk_score,
        } if policy else None,
    }


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new worker. Returns JWT on success."""
    from models import Worker

    try:
        existing = db.query(Worker).filter(Worker.phone == request.phone).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Phone number already registered. Please log in.",
            )

        worker = Worker(
            phone=request.phone,
            name=request.name,
            city=request.city,
            platform=request.platform,
            zone_geojson=request.zone,
            shift_start=request.shift_start,
            shift_end=request.shift_end,
            weekly_income_estimate=request.weekly_income_estimate,
            upi_id=request.upi_id,   # FIX: persist upi_id
            is_active=True,
        )
        db.add(worker)
        db.commit()
        db.refresh(worker)

        token = create_access_token(worker.id, worker.phone)
        return {
            "status": "registered",
            "worker_id": str(worker.id),
            "token": token,
            "message": "Registration successful. Please complete onboarding.",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Registration failed for phone {request.phone}: {e}")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(worker=Depends(get_current_worker), db: Session = Depends(get_db)):
    """Return the currently authenticated worker's profile."""
    from models import Policy

    policy = (
        db.query(Policy)
        .filter(Policy.worker_id == worker.id, Policy.status == "active")
        .order_by(Policy.id.desc())
        .first()
    )

    return {
        "id": str(worker.id),
        "name": worker.name,
        "phone": worker.phone,
        "city": worker.city,
        "platform": worker.platform,
        "zone": worker.zone_geojson,
        "shift_start": worker.shift_start,
        "shift_end": worker.shift_end,
        "weekly_income_estimate": worker.weekly_income_estimate,
        "upi_id": worker.upi_id,
        "policy": {
            "plan_type": policy.plan_type,
            "status": policy.status,
            "weekly_premium": policy.weekly_premium,
            "max_payout": policy.max_payout,
            "risk_score": policy.risk_score,
        } if policy else None,
    }
