from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.payout import PayoutEvent, FraudFlag
from app.models.worker import Worker
from app.ml.fraud_detection import assess_fraud_risk

router = APIRouter(prefix="/api/payouts", tags=["payouts"])

class PayoutRequest(BaseModel):
    worker_id: int
    policy_id: int
    event_type: str
    zone: str
    amount_inr: float

@router.post("/trigger")
def trigger_payout(req: PayoutRequest, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == req.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    recent_claims = db.query(PayoutEvent).filter(
        PayoutEvent.worker_id == req.worker_id
    ).count()

    fraud = assess_fraud_risk(
        worker_id=req.worker_id,
        claims_last_24h=recent_claims,
        unique_cities_last_24h=1,
        account_age_days=30,
        claim_amount=req.amount_inr,
        avg_claim_amount=200.0
    )

    if fraud["is_suspicious"]:
        flag = FraudFlag(
            worker_id=req.worker_id,
            reason=", ".join(fraud["flags"]),
            severity=fraud["severity"]
        )
        db.add(flag)
        db.commit()
        raise HTTPException(status_code=403, detail="Payout blocked: fraud risk detected")

    payout = PayoutEvent(
        worker_id=req.worker_id,
        policy_id=req.policy_id,
        event_type=req.event_type,
        zone=req.zone,
        amount_inr=req.amount_inr,
        status="success"
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return {"message": "Payout triggered", "payout_id": payout.id, "amount_inr": payout.amount_inr}

@router.get("/history/{worker_id}")
def payout_history(worker_id: int, db: Session = Depends(get_db)):
    return db.query(PayoutEvent).filter(PayoutEvent.worker_id == worker_id).all()
