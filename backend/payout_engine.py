"""
GigShield AI — Automatic Parametric Payout Engine
Fixes applied:
  - _event_overlaps_shift: handles midnight-crossing shifts, checks shift_end, no silent True on parse fail
  - event_duration_hours derived from actual event data (not always 3.0)
  - device_fingerprint: defense_context carries DISTINCT current vs registered fingerprints
  - check_payout_eligibility_for_worker: evaluates ALL events (not just first COMPLETED)
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum

from fraud_defense import defense_engine, check_coverage_exclusions, ExclusionResult


# ============================================================
# DATA CLASSES
# ============================================================

class PayoutStatus(Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    SUSPENDED = "SUSPENDED"


@dataclass
class DisruptionEvent:
    event_id: str
    trigger_type: str
    zone_id: str
    city: str
    severity: str
    api_source: str
    started_at: datetime
    value: float
    metadata: dict = field(default_factory=dict)
    official_government_notice: bool = False
    ended_at: Optional[datetime] = None   # used for actual event_duration_hours


@dataclass
class WorkerContext:
    worker_id: str
    name: str
    zone_id: str
    zone_lat: float
    zone_lng: float
    city: str
    platform: str
    shift_start: str
    shift_end: str
    weekly_income_estimate: float
    registered_upi: str
    plan_type: str
    checkin_lat: Optional[float] = None
    checkin_lng: Optional[float] = None
    checkin_timestamp: Optional[datetime] = None
    gps_accuracy_m: float = 30.0
    claims_last_30d: int = 0
    avg_payout: float = 0.0
    device_fingerprint: Optional[str] = None       # fingerprint from CURRENT request
    registered_device_fingerprint: Optional[str] = None  # fingerprint stored at registration


@dataclass
class ActivityBaseline:
    worker_id: str
    hour: int
    day_of_week: int
    baseline_deliveries: float
    actual_deliveries: float
    drop_pct: float


@dataclass
class PayoutResult:
    payout_id: str
    worker_id: str
    claim_id: str
    status: PayoutStatus
    amount_inr: float
    upi_id: str
    trigger_type: str
    drop_pct: float
    defense_decision: str
    rejection_code: Optional[str]
    message: str
    created_at: datetime
    razorpay_mock_id: Optional[str] = None


# ============================================================
# PLAN CONFIGURATION
# ============================================================

PLAN_CONFIG = {
    "Basic":    {"weekly_premium": 50,  "max_weekly_payout": 500},
    "Standard": {"weekly_premium": 75,  "max_weekly_payout": 900},
    "Pro":      {"weekly_premium": 100, "max_weekly_payout": 1500},
}

TRIGGER_THRESHOLDS = {
    "heavy_rain":   {"field": "rainfall_mm_3hr", "threshold": 35, "severity_map": [(60, "severe"), (45, "moderate"), (35, "mild")]},
    "aqi_spike":    {"field": "aqi_value",        "threshold": 300, "severity_map": [(400, "severe"), (350, "moderate"), (300, "mild")]},
    "extreme_heat": {"field": "temp_celsius",     "threshold": 42, "severity_map": [(46, "severe"), (44, "moderate"), (42, "mild")]},
    "flood":        {"field": "flood_level",      "threshold": 1,  "severity_map": [(3, "severe"), (2, "moderate"), (1, "mild")]},
    "bandh":        {"field": "coverage_pct",     "threshold": 50, "severity_map": [(90, "severe"), (70, "moderate"), (50, "mild")]},
}

# Default event durations by severity (used when ended_at is not available)
DEFAULT_EVENT_DURATION_HOURS = {"mild": 2.0, "moderate": 3.5, "severe": 5.0}


def get_event_severity(trigger_type: str, value: float) -> str:
    cfg = TRIGGER_THRESHOLDS.get(trigger_type, {})
    for threshold, label in cfg.get("severity_map", []):
        if value >= threshold:
            return label
    return "mild"


# ============================================================
# PARAMETRIC PAYOUT ENGINE
# ============================================================

class ParametricPayoutEngine:

    def evaluate_condition_a(self, event: DisruptionEvent, worker: WorkerContext) -> dict:
        """Condition A: Verified external disruption trigger active in worker's zone."""

        excl = check_coverage_exclusions(
            event.trigger_type,
            {**event.metadata, "official_government_notice": event.official_government_notice},
        )
        if excl.result == ExclusionResult.EXCLUDED:
            return {"condition_a": False, "reason": f"EXCLUDED: {excl.message}", "rejection_code": excl.rejection_code}
        if excl.result == ExclusionResult.NEEDS_REVIEW:
            return {"condition_a": False, "reason": "NEEDS_REVIEW: Manual verification required", "rejection_code": "MANUAL_REVIEW_REQUIRED"}

        if event.zone_id != worker.zone_id:
            return {"condition_a": False, "reason": f"Zone mismatch: event in '{event.zone_id}', worker in '{worker.zone_id}'", "rejection_code": "ZONE_MISMATCH"}

        cfg = TRIGGER_THRESHOLDS.get(event.trigger_type, {})
        threshold = cfg.get("threshold", 0)
        if event.value < threshold:
            return {"condition_a": False, "reason": f"Event value {event.value} below threshold {threshold}", "rejection_code": "THRESHOLD_NOT_MET"}

        if not self._event_overlaps_shift(event, worker):
            return {"condition_a": False, "reason": "Event does not overlap with worker's registered shift", "rejection_code": "NO_SHIFT_OVERLAP"}

        return {
            "condition_a": True,
            "trigger_type": event.trigger_type,
            "severity": event.severity,
            "event_value": event.value,
            "zone_id": event.zone_id,
            "reason": f"Condition A satisfied: {event.trigger_type} ({event.severity}) in {event.zone_id}",
        }

    def evaluate_condition_b(self, activity: ActivityBaseline, threshold: float = 0.30) -> dict:
        """Condition B: Income proxy drop >30% vs 4-week baseline."""
        if activity.baseline_deliveries <= 0:
            return {"condition_b": False, "reason": "Insufficient baseline data", "rejection_code": "INSUFFICIENT_BASELINE"}

        drop = (activity.baseline_deliveries - activity.actual_deliveries) / activity.baseline_deliveries

        if drop < threshold:
            return {
                "condition_b": False,
                "drop_pct": round(drop, 3),
                "reason": f"Income drop {drop*100:.1f}% below {threshold*100:.0f}% threshold",
                "rejection_code": "DROP_BELOW_THRESHOLD",
            }

        return {
            "condition_b": True,
            "drop_pct": round(drop, 3),
            "baseline": activity.baseline_deliveries,
            "actual": activity.actual_deliveries,
            "reason": f"Condition B satisfied: {drop*100:.1f}% income drop (threshold: {threshold*100:.0f}%)",
        }

    def calculate_payout(self, worker: WorkerContext, drop_pct: float, event_duration_hours: float = 3.0) -> float:
        """
        Payout = min(estimated_loss, plan_max_payout)
        estimated_loss = (weekly_income / 7 / shift_hours) × drop_pct × event_duration
        Minimum meaningful payout: ₹10 (Razorpay floor).
        """
        plan = PLAN_CONFIG.get(worker.plan_type, PLAN_CONFIG["Basic"])
        daily_income = worker.weekly_income_estimate / 7
        hourly_income = daily_income / 8
        estimated_loss = hourly_income * event_duration_hours * drop_pct
        payout = min(estimated_loss, plan["max_weekly_payout"])
        result = round(max(payout, 0), 2)
        return result if result >= 10.0 else 0.0  # enforce minimum floor

    def _get_event_duration_hours(self, event: DisruptionEvent) -> float:
        """
        Derive actual event duration from event data.
        Uses ended_at if available; falls back to severity-based default.
        """
        if event.ended_at and event.ended_at > event.started_at:
            delta = (event.ended_at - event.started_at).total_seconds() / 3600
            return round(min(delta, 12.0), 2)   # cap at 12 hours
        return DEFAULT_EVENT_DURATION_HOURS.get(event.severity, 3.0)

    def process_automatic_payout(
        self,
        event: DisruptionEvent,
        worker: WorkerContext,
        activity: ActivityBaseline,
        payout_upi: Optional[str] = None,
    ) -> PayoutResult:
        """
        Main entry point: evaluate both conditions, run 4-layer defense, trigger payout.
        Called by Celery every 15 minutes per active worker.
        """
        claim_id = str(uuid.uuid4())[:8].upper()
        payout_id = str(uuid.uuid4())[:8].upper()
        now = datetime.utcnow()
        upi_id = payout_upi or worker.registered_upi

        # STEP 1: Condition A
        cond_a = self.evaluate_condition_a(event, worker)
        if not cond_a["condition_a"]:
            return PayoutResult(
                payout_id=payout_id, worker_id=worker.worker_id, claim_id=claim_id,
                status=PayoutStatus.REJECTED, amount_inr=0, upi_id=upi_id,
                trigger_type=event.trigger_type, drop_pct=0,
                defense_decision="CONDITION_A_FAILED", rejection_code=cond_a.get("rejection_code"),
                message=cond_a["reason"], created_at=now,
            )

        # STEP 2: Condition B
        cond_b = self.evaluate_condition_b(activity)
        if not cond_b["condition_b"]:
            return PayoutResult(
                payout_id=payout_id, worker_id=worker.worker_id, claim_id=claim_id,
                status=PayoutStatus.REJECTED, amount_inr=0, upi_id=upi_id,
                trigger_type=event.trigger_type, drop_pct=cond_b.get("drop_pct", 0),
                defense_decision="CONDITION_B_FAILED", rejection_code=cond_b.get("rejection_code"),
                message=cond_b["reason"], created_at=now,
            )

        drop_pct = cond_b["drop_pct"]

        # STEP 3: Derive actual event duration (FIX: not always hardcoded 3.0)
        event_duration_hours = self._get_event_duration_hours(event)

        # STEP 4: Adversarial defense (all 4 layers)
        checkin_ts = worker.checkin_timestamp or now
        defense_context = {
            "trigger_type": event.trigger_type,
            "event_metadata": event.metadata,
            "zone_lat": worker.zone_lat,
            "zone_lng": worker.zone_lng,
            "checkin_lat": worker.checkin_lat or worker.zone_lat,
            "checkin_lng": worker.checkin_lng or worker.zone_lng,
            "gps_accuracy_m": worker.gps_accuracy_m,
            "checkin_timestamp": checkin_ts,
            "shift_start": worker.shift_start,
            "event_id": event.event_id,
            "event_zone_id": event.zone_id,
            "event_timestamp": event.started_at,
            "worker_zone_id": worker.zone_id,
            "claim_timestamp": now,
            "worker_id": worker.worker_id,
            "drop_pct": drop_pct,
            "event_severity": event.severity,
            "baseline_drop_for_event": 0.3,
            "claims_last_30d": worker.claims_last_30d,
            "zone_avg_claims_30d": 1.5,
            "payout_upi": upi_id,
            "registered_upi": worker.registered_upi,
            # FIX: current device fingerprint (from request) vs registered (from DB)
            "device_fingerprint": worker.device_fingerprint,
            "registered_device_fingerprint": worker.registered_device_fingerprint,
            "payout_amount": self.calculate_payout(worker, drop_pct, event_duration_hours),
            "avg_payout": worker.avg_payout,
        }

        defense_result = defense_engine.run_full_defense(defense_context)
        final_decision = defense_result["final_decision"]

        # STEP 5: Calculate payout
        amount = self.calculate_payout(worker, drop_pct, event_duration_hours)

        if final_decision == "SUSPEND":
            return PayoutResult(
                payout_id=payout_id, worker_id=worker.worker_id, claim_id=claim_id,
                status=PayoutStatus.SUSPENDED, amount_inr=0, upi_id=upi_id,
                trigger_type=event.trigger_type, drop_pct=drop_pct,
                defense_decision="SUSPENDED", rejection_code="ACCOUNT_SUSPENDED",
                message="Account suspended due to repeated fraudulent claim patterns.",
                created_at=now,
            )

        if final_decision == "REJECT":
            return PayoutResult(
                payout_id=payout_id, worker_id=worker.worker_id, claim_id=claim_id,
                status=PayoutStatus.REJECTED, amount_inr=0, upi_id=upi_id,
                trigger_type=event.trigger_type, drop_pct=drop_pct,
                defense_decision="FRAUD_DETECTED", rejection_code=defense_result.get("rejection_code"),
                message=f"Payout rejected: {len(defense_result['all_flags'])} fraud flag(s) detected.",
                created_at=now,
            )

        if final_decision == "MANUAL_REVIEW":
            return PayoutResult(
                payout_id=payout_id, worker_id=worker.worker_id, claim_id=claim_id,
                status=PayoutStatus.MANUAL_REVIEW, amount_inr=amount, upi_id=upi_id,
                trigger_type=event.trigger_type, drop_pct=drop_pct,
                defense_decision="MANUAL_REVIEW", rejection_code=None,
                message=f"Claim queued for manual review (anomaly score: {defense_result['anomaly_score']:.2f})",
                created_at=now,
            )

        # APPROVE
        razorpay_id = self._mock_razorpay_payout(upi_id, amount)
        return PayoutResult(
            payout_id=payout_id, worker_id=worker.worker_id, claim_id=claim_id,
            status=PayoutStatus.COMPLETED, amount_inr=amount, upi_id=upi_id,
            trigger_type=event.trigger_type, drop_pct=drop_pct,
            defense_decision="APPROVED", rejection_code=None,
            message=f"✅ Automatic payout of ₹{amount:.0f} initiated to {upi_id}. Both parametric conditions met. All 4 defense layers passed.",
            created_at=now,
            razorpay_mock_id=razorpay_id,
        )

    def _event_overlaps_shift(self, event: DisruptionEvent, worker: WorkerContext) -> bool:
        """
        Check if the disruption event overlaps with the worker's shift.

        FIX: properly handles midnight-crossing shifts (e.g. 22:00–06:00),
        checks both shift_start AND shift_end, does NOT silently return True on parse error.
        """
        try:
            shift_start_h = int(str(worker.shift_start).split(":")[0])
            shift_end_h = int(str(worker.shift_end).split(":")[0])
            event_h = event.started_at.hour

            if shift_start_h <= shift_end_h:
                # Normal shift (e.g. 08:00–20:00)
                return shift_start_h <= event_h <= shift_end_h
            else:
                # Midnight-crossing shift (e.g. 22:00–06:00)
                return event_h >= shift_start_h or event_h <= shift_end_h
        except (ValueError, AttributeError, IndexError):
            # FIX: log the parse error rather than silently returning True
            import logging
            logging.getLogger(__name__).warning(
                f"Could not parse shift times for worker {worker.worker_id}: "
                f"shift_start={worker.shift_start}, shift_end={worker.shift_end}"
            )
            return False  # FIX: default DENY, not allow

    def _mock_razorpay_payout(self, upi_id: str, amount: float) -> str:
        """
        Sandboxed mock payout. No real Razorpay API call is made.
        In production: replace this with a real Razorpay API call with idempotency key.
        """
        mock_id = f"mock_rp_{uuid.uuid4().hex[:12]}"
        # Production code (replace mock_id with real call):
        # import requests, os
        # idempotency_key = f"gs_{uuid.uuid4().hex}"
        # response = requests.post(
        #     "https://api.razorpay.com/v1/payouts",
        #     auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET")),
        #     headers={"X-Idempotency-Key": idempotency_key},
        #     json={
        #         "account_number": os.getenv("RAZORPAY_ACCOUNT"),
        #         "amount": int(amount * 100),  # paise
        #         "currency": "INR",
        #         "mode": "UPI",
        #         "purpose": "insurance",
        #         "fund_account": {"vpa": upi_id, "account_type": "vpa"},
        #         "queue_if_low_balance": True,
        #         "narration": "GigShield Income Protection Payout",
        #     },
        #     timeout=15,
        # )
        # response.raise_for_status()
        # return response.json()["id"]
        return mock_id


# ============================================================
# CELERY TASK WRAPPER
# ============================================================

def check_payout_eligibility_for_worker(
    worker_dict: dict,
    active_events: list,
    activity_baseline: dict,
) -> list:
    """
    Called by Celery every 15 minutes.
    FIX: evaluates ALL events (not just the first COMPLETED one).
    Returns list of payout result dicts that fired.
    """
    engine = ParametricPayoutEngine()
    worker = WorkerContext(**worker_dict)
    results = []

    for event_dict in active_events:
        event = DisruptionEvent(**event_dict)
        activity = ActivityBaseline(
            worker_id=worker.worker_id,
            hour=datetime.utcnow().hour,
            day_of_week=datetime.utcnow().weekday(),
            baseline_deliveries=activity_baseline.get("baseline", 8.0),
            actual_deliveries=activity_baseline.get("actual", 5.0),
            drop_pct=0,
        )
        if activity.baseline_deliveries > 0:
            activity.drop_pct = (
                (activity.baseline_deliveries - activity.actual_deliveries) / activity.baseline_deliveries
            )

        result = engine.process_automatic_payout(event, worker, activity)

        if result.status in (PayoutStatus.COMPLETED, PayoutStatus.MANUAL_REVIEW):
            results.append({
                "payout_id": result.payout_id,
                "claim_id": result.claim_id,
                "worker_id": result.worker_id,
                "status": result.status.value,
                "amount_inr": result.amount_inr,
                "upi_id": result.upi_id,
                "trigger_type": result.trigger_type,
                "drop_pct": result.drop_pct,
                "defense_decision": result.defense_decision,
                "message": result.message,
                "razorpay_mock_id": result.razorpay_mock_id,
                "created_at": result.created_at.isoformat(),
            })

    return results
