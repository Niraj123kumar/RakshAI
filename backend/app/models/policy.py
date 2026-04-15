from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    weekly_premium_inr = Column(Float, nullable=False)
    payout_amount_inr = Column(Float, nullable=False)
    event_types = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

class WorkerPolicy(Base):
    __tablename__ = "worker_policies"
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    subscribed_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
