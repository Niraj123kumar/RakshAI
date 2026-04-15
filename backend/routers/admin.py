"""
GigShield Admin Router
=======================
All endpoints require admin JWT (role=admin).

Fixes applied:
  - All endpoints protected by require_admin dependency
  - /admin/metrics uses SQL SUM aggregate (not Python sum of all records)
  - /admin/fraud-queue uses JOIN (not N+1 per-claim query)
  - zone_geojson accessed as string, not dict (fixes AttributeError)
  - /admin/claims/{id}/review validates decision to 'approve'|'reject' only
  - /admin/demo/trigger-event restricted to admin role
  - total_payouts_this_week is filtered to current ISO week
"""
import logging
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, validator
from typing import List, Optional
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session
from db import get_db
from auth_utils import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class MetricsResponse(BaseModel):
    total_active_policies: int
    weekly_premium_collected: float
    total_payouts_this_week: float
    loss_ratio: float
    fraud_flags_count: int


class FraudQueueItem(BaseModel):
    claim_id: str
    worker_name: str
    zone: str
    event_type: str
    drop_pct: float
    anomaly_score: float


class ReviewRequest(BaseModel):
    decision: str
    reason: Optional[str] = None

    @validator("decision")
    def validate_decision(cls, v):
        if v not in {"approve", "reject"}:
            raise ValueError("decision must be 'approve' or 'reject'")
        return v


class DemoTriggerRequest(BaseModel):
    event_type: str
    zone: str
    severity: Optional[str] = "moderate"
    event_value: Optional[float] = 45.0
    worker_id: Optional[str] = "DEMO_001"
    worker_name: Optional[str] = "Demo Worker"
    baseline_deliveries: Optional[float] = 10.0
    actual_deliveries: Optional[float] = 5.0


ZONE_COORDS = {
    "HSR_LAYOUT_BLR":  (12.9116, 77.6389),
    "KORAMANGALA_BLR": (12.9352, 77.6245),
    "BANDRA_MUM":      (19.0596, 72.8295),
    "ANDHERI_MUM":     (19.1136, 72.8697),
    "ADYAR_CHN":       (13.0012, 80.2565),
    "T_NAGAR_CHN":     (13.0418, 80.2341),
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/metrics", response_model=MetricsResponse, dependencies=[Depends(require_admin)])
async def get_metrics(db: Session = Depends(get_db)):
    """System-wide metrics. Uses SQL aggregates — does not load all records into memory."""
    from models import Policy, Payout, Claim

    active_policies = db.query(Policy).filter(Policy.status == "active").count()

    # SQL aggregate for premiums
    weekly_premium = (
        db.query(sqlfunc.sum(Policy.weekly_premium))
        .filter(Policy.status == "active")
        .scalar()
    ) or 0.0

    # FIX: filter to current ISO week only
    week_start = datetime.utcnow()
    week_start = week_start - timedelta(days=week_start.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    total_payouts = (
        db.query(sqlfunc.sum(Payout.amount))
        .filter(Payout.status == "COMPLETED", Payout.initiated_at >= week_start)
        .scalar()
    ) or 0.0

    loss_ratio = (total_payouts / weekly_premium) if weekly_premium > 0 else 0.0
    fraud_flags = db.query(Claim).filter(Claim.status == "MANUAL_REVIEW").count()

    return MetricsResponse(
        total_active_policies=active_policies,
        weekly_premium_collected=round(weekly_premium, 2),
        total_payouts_this_week=round(total_payouts, 2),
        loss_ratio=round(loss_ratio, 3),
        fraud_flags_count=fraud_flags,
    )


@router.get("/fraud-queue", response_model=List[FraudQueueItem], dependencies=[Depends(require_admin)])
async def get_fraud_queue(db: Session = Depends(get_db)):
    """Fraud review queue. Uses a JOIN to avoid N+1 queries."""
    from models import Claim, Worker

    # FIX: single JOIN query instead of N+1
    rows = (
        db.query(Claim, Worker)
        .join(Worker, Claim.worker_id == Worker.id)
        .filter(Claim.status == "MANUAL_REVIEW")
        .all()
    )

    result = []
    for claim, w in rows:
        # FIX: zone_geojson is a plain string, not a dict
        zone_name = w.zone_geojson if isinstance(w.zone_geojson, str) else str(w.zone_geojson or "Unknown")
        drop_pct = 0.0
        if w.weekly_income_estimate and w.weekly_income_estimate > 0 and claim.estimated_loss:
            drop_pct = round((claim.estimated_loss / w.weekly_income_estimate) * 100, 1)

        result.append(FraudQueueItem(
            claim_id=str(claim.id),
            worker_name=w.name,
            zone=zone_name,
            event_type=claim.fraud_check_results.get("trigger_type", "disruption") if claim.fraud_check_results else "disruption",
            drop_pct=drop_pct,
            anomaly_score=float(claim.fraud_check_results.get("anomaly_score", 0)) if claim.fraud_check_results else 0.0,
        ))

    return result


@router.post("/claims/{claim_id}/review", dependencies=[Depends(require_admin)])
async def review_claim(claim_id: int, request: ReviewRequest, db: Session = Depends(get_db)):
    """Approve or reject a claim. decision must be 'approve' or 'reject'."""
    from models import Claim

    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.status = "COMPLETED" if request.decision == "approve" else "REJECTED"
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update claim {claim_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update claim status")

    return {"message": f"Claim {claim_id} {request.decision}d successfully", "new_status": claim.status}


@router.get("/workers", dependencies=[Depends(require_admin)])
async def list_workers(limit: int = 50, db: Session = Depends(get_db)):
    """List workers for admin oversight."""
    from models import Worker
    workers = db.query(Worker).filter(Worker.is_active == True).limit(limit).all()
    return [
        {
            "id": w.id,
            "name": w.name,
            "phone": w.phone,
            "city": w.city,
            "platform": w.platform,
            "zone": w.zone_geojson,
            "has_upi": bool(w.upi_id),
        }
        for w in workers
    ]


@router.post("/demo/trigger-event", dependencies=[Depends(require_admin)])
async def trigger_demo_event(request: DemoTriggerRequest):
    """
    Admin-only demo endpoint: simulate a payout engine run.
    Requires admin JWT. Never initiates a real payment.
    """
    from payout_engine import (
        ParametricPayoutEngine, WorkerContext,
        DisruptionEvent as DE, ActivityBaseline,
    )

    now = datetime.utcnow()
    lat, lng = ZONE_COORDS.get(request.zone, (12.9116, 77.6389))

    worker = WorkerContext(
        worker_id=request.worker_id,
        name=request.worker_name,
        zone_id=request.zone,
        zone_lat=lat, zone_lng=lng,
        city="Bengaluru", platform="Zepto",
        shift_start=f"{now.hour - 1:02d}:00",
        shift_end=f"{now.hour + 3:02d}:00",
        weekly_income_estimate=5000,
        registered_upi="demo@upi",
        plan_type="Standard",
        checkin_lat=lat, checkin_lng=lng,
        checkin_timestamp=now, gps_accuracy_m=25.0,
        claims_last_30d=1, avg_payout=600.0,
        device_fingerprint="demo_device_001",
    )

    event = DE(
        event_id=str(uuid.uuid4())[:8].upper(),
        trigger_type=request.event_type,
        zone_id=request.zone, city="Bengaluru",
        severity=request.severity,
        api_source="demo_api",
        started_at=now, value=request.event_value,
        metadata={"description": request.event_type, "source": "demo"},
    )

    baseline = max(request.baseline_deliveries, 0.01)
    actual = max(request.actual_deliveries, 0)
    activity = ActivityBaseline(
        worker_id=request.worker_id, hour=now.hour, day_of_week=now.weekday(),
        baseline_deliveries=baseline, actual_deliveries=actual,
        drop_pct=(baseline - actual) / baseline,
    )

    engine = ParametricPayoutEngine()
    result = engine.process_automatic_payout(event, worker, activity)

    return {
        "demo": True,
        "payout_id": result.payout_id,
        "status": result.status.value,
        "amount_inr": result.amount_inr,
        "message": result.message,
        "defense_decision": result.defense_decision,
        "drop_pct": result.drop_pct,
        "note": "DEMO MODE — no real payment initiated",
    }
