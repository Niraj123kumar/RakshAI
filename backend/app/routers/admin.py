from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.worker import Worker
from app.models.policy import WorkerPolicy
from app.models.payout import PayoutEvent, FraudFlag

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_workers = db.query(Worker).count()
    active_policies = db.query(WorkerPolicy).filter(WorkerPolicy.is_active == True).count()
    total_payouts = db.query(PayoutEvent).filter(PayoutEvent.status == "success").count()
    fraud_flags = db.query(FraudFlag).count()
    total_paid = db.query(func.sum(PayoutEvent.amount_inr)).filter(PayoutEvent.status == "success").scalar() or 0
    return {
        "total_workers": total_workers,
        "active_policies": active_policies,
        "total_payouts": total_payouts,
        "fraud_flags": fraud_flags,
        "total_paid_inr": total_paid
    }

@router.get("/unit-economics")
def unit_economics(db: Session = Depends(get_db)):
    total_paid = db.query(func.sum(PayoutEvent.amount_inr)).filter(PayoutEvent.status == "success").scalar() or 0
    active_policies = db.query(WorkerPolicy).filter(WorkerPolicy.is_active == True).count()
    weekly_premium_collected = active_policies * 50
    loss_ratio = round(total_paid / weekly_premium_collected, 2) if weekly_premium_collected > 0 else 0
    return {
        "total_claims_paid_inr": total_paid,
        "estimated_weekly_premiums_inr": weekly_premium_collected,
        "loss_ratio": loss_ratio,
        "premium_adequate": loss_ratio < 0.7
    }
