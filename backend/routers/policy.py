"""
GigShield Policy Router
========================
GET  /policy/current        — Active policy for authenticated worker
POST /policy/upgrade        — Upgrade plan
POST /policy/pause          — Pause coverage
POST /policy/resume         — Resume coverage

Fixes applied:
  - worker_id from JWT, never from query param
  - All write operations committed to DB
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, validator
from typing import Optional
from sqlalchemy.orm import Session
from db import get_db
from auth_utils import get_current_worker

logger = logging.getLogger(__name__)
router = APIRouter()

PLAN_CONFIG = {
    "Basic":    {"weekly_premium": 50,  "max_payout": 500},
    "Standard": {"weekly_premium": 75,  "max_payout": 900},
    "Pro":      {"weekly_premium": 100, "max_payout": 1500},
}


class UpgradeRequest(BaseModel):
    new_plan: str

    @validator("new_plan")
    def validate_plan(cls, v):
        if v not in PLAN_CONFIG:
            raise ValueError(f"Plan must be one of: {list(PLAN_CONFIG.keys())}")
        return v


@router.get("/current")
async def get_current_policy(
    worker=Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    from models import Policy
    policy = (
        db.query(Policy)
        .filter(Policy.worker_id == worker.id, Policy.status.in_(["active", "paused"]))
        .order_by(Policy.id.desc())
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found")
    return {
        "plan_type": policy.plan_type,
        "status": policy.status,
        "weekly_premium": policy.weekly_premium,
        "max_payout": policy.max_payout,
        "risk_score": policy.risk_score,
        "start_date": str(policy.start_date),
        "updated_at": str(policy.updated_at),
    }


@router.post("/upgrade")
async def upgrade_policy(
    request: UpgradeRequest,
    worker=Depends(get_current_worker),
    db: Session = Depends(get_db),
):
    from models import Policy
    policy = db.query(Policy).filter(
        Policy.worker_id == worker.id, Policy.status == "active"
    ).order_by(Policy.id.desc()).first()

    if not policy:
        raise HTTPException(status_code=404, detail="No active policy to upgrade")
    if policy.plan_type == request.new_plan:
        raise HTTPException(status_code=400, detail="Already on this plan")

    cfg = PLAN_CONFIG[request.new_plan]
    policy.plan_type = request.new_plan
    policy.weekly_premium = cfg["weekly_premium"]
    policy.max_payout = cfg["max_payout"]
    policy.updated_at = datetime.utcnow()

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Policy upgrade failed for worker {worker.id}: {e}")
        raise HTTPException(status_code=500, detail="Policy upgrade failed")

    return {"message": f"Plan upgraded to {request.new_plan}", "new_plan": request.new_plan, "max_payout": cfg["max_payout"]}


@router.post("/pause")
async def pause_policy(worker=Depends(get_current_worker), db: Session = Depends(get_db)):
    from models import Policy
    policy = db.query(Policy).filter(
        Policy.worker_id == worker.id, Policy.status == "active"
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy to pause")
    policy.status = "paused"
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to pause policy")
    return {"message": "Policy paused. No payouts will fire while paused.", "status": "paused"}


@router.post("/resume")
async def resume_policy(worker=Depends(get_current_worker), db: Session = Depends(get_db)):
    from models import Policy
    policy = db.query(Policy).filter(
        Policy.worker_id == worker.id, Policy.status == "paused"
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="No paused policy found")
    policy.status = "active"
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to resume policy")
    return {"message": "Policy resumed. Monitoring is active again.", "status": "active"}
