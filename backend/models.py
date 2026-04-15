"""
GigShield — SQLAlchemy Models
Fixed: shift_start/shift_end are Integer (hour), upi_id nullable during registration,
       zone_geojson stored as String consistently.
"""
from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey, Boolean, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Zone(Base):
    __tablename__ = "zone"
    id = Column(Integer, primary_key=True)
    city = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    disruption_matrix = Column(JSON, nullable=True)
    income_impact_matrix = Column(JSON, nullable=True)
    last_updated = Column(DateTime, default=func.now())


class Worker(Base):
    __tablename__ = "worker"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(15), nullable=False, unique=True, index=True)
    upi_id = Column(String(255), nullable=True)           # nullable: set during onboarding
    city = Column(String(255), nullable=False)
    zone_geojson = Column(String(255), nullable=True)     # stored as plain string zone name
    platform = Column(String(50), nullable=False)
    shift_start = Column(Integer, nullable=False)          # hour 0-23
    shift_end = Column(Integer, nullable=False)            # hour 0-23
    weekly_income_estimate = Column(Float, nullable=False)
    device_fingerprint = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    policies = relationship("Policy", back_populates="worker")
    payouts = relationship("Payout", back_populates="worker")


class Policy(Base):
    __tablename__ = "policy"
    id = Column(Integer, primary_key=True)
    worker_id = Column(Integer, ForeignKey("worker.id"), nullable=False, index=True)
    plan_type = Column(String(50), nullable=False)          # Basic / Standard / Pro
    status = Column(String(50), nullable=False)             # active / paused / superseded
    weekly_premium = Column(Float, nullable=False)
    max_payout = Column(Float, nullable=False)
    start_date = Column(DateTime, nullable=False)
    risk_score = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    worker = relationship("Worker", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")


class DisruptionEvent(Base):
    __tablename__ = "disruption_event"
    id = Column(Integer, primary_key=True)
    trigger_type = Column(String(50), nullable=False)
    zone_id = Column(String(100), nullable=False)           # string zone id, not FK
    city = Column(String(255), nullable=False)
    severity = Column(String(50), nullable=False)
    api_source = Column(String(255), nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    value = Column(Float, nullable=True)
    workers_affected_count = Column(Integer, default=0)
    claims = relationship("Claim", back_populates="disruption_event")


class Claim(Base):
    __tablename__ = "claim"
    id = Column(Integer, primary_key=True)
    worker_id = Column(Integer, ForeignKey("worker.id"), nullable=False, index=True)
    policy_id = Column(Integer, ForeignKey("policy.id"), nullable=True)
    disruption_event_id = Column(Integer, ForeignKey("disruption_event.id"), nullable=True)
    estimated_loss = Column(Float, nullable=False)
    payout_amount = Column(Float, nullable=True)
    status = Column(String(50), nullable=False)
    fraud_check_results = Column(JSON, nullable=True)
    payout_id_ref = Column(String(50), nullable=True)      # payout_engine payout_id
    created_at = Column(DateTime, default=func.now())
    worker = relationship("Worker")
    policy = relationship("Policy", back_populates="claims")
    disruption_event = relationship("DisruptionEvent", back_populates="claims")
    payout = relationship("Payout", back_populates="claim", uselist=False)


class Payout(Base):
    __tablename__ = "payout"
    id = Column(Integer, primary_key=True)
    claim_id = Column(Integer, ForeignKey("claim.id"), nullable=False, unique=True)  # enforce 1:1
    worker_id = Column(Integer, ForeignKey("worker.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    upi_id = Column(String(255), nullable=False)
    razorpay_payout_id = Column(String(255), nullable=True)  # mock_rp_xxx in test mode
    idempotency_key = Column(String(100), nullable=True, unique=True)  # prevent duplicate payouts
    status = Column(String(50), nullable=False)
    initiated_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    worker = relationship("Worker", back_populates="payouts")
    claim = relationship("Claim", back_populates="payout")
