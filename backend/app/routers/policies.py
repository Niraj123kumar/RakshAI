from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.policy import Policy, WorkerPolicy
from app.ml.premium_calculator import calculate_premium

router = APIRouter(prefix="/api/policies", tags=["policies"])

@router.get("/")
def list_policies(db: Session = Depends(get_db)):
    policies = db.query(Policy).filter(Policy.is_active == True).all()
    return policies

class SubscribeRequest(BaseModel):
    worker_id: int
    policy_id: int

@router.post("/subscribe")
def subscribe(req: SubscribeRequest, db: Session = Depends(get_db)):
    existing = db.query(WorkerPolicy).filter(
        WorkerPolicy.worker_id == req.worker_id,
        WorkerPolicy.policy_id == req.policy_id,
        WorkerPolicy.is_active == True
    ).first()
    if existing:
        return {"message": "Already subscribed"}
    wp = WorkerPolicy(worker_id=req.worker_id, policy_id=req.policy_id)
    db.add(wp)
    db.commit()
    return {"message": "Subscribed successfully"}

class PremiumRequest(BaseModel):
    platform: str
    city: str
    avg_daily_hours: float
    disruption_freq: float = 0.2
    income_volatility: float = 0.3

@router.post("/calculate-premium")
def get_premium(req: PremiumRequest):
    premium = calculate_premium(
        req.platform, req.city, req.avg_daily_hours,
        req.disruption_freq, req.income_volatility
    )
    return {"weekly_premium_inr": premium}
