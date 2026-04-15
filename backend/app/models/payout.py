from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class PayoutEvent(Base):
    __tablename__ = "payout_events"
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    event_type = Column(String, nullable=False)
    zone = Column(String, nullable=False)
    amount_inr = Column(Float, nullable=False)
    razorpay_payout_id = Column(String)
    status = Column(String, default="initiated")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FraudFlag(Base):
    __tablename__ = "fraud_flags"
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    reason = Column(String, nullable=False)
    severity = Column(String, default="medium")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
