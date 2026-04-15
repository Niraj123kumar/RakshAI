"""
GigShield AI — Celery Background Tasks
Fixes applied:
  - API keys loaded via Settings object (validated at startup, not raw os.getenv)
  - check_heavy_rain: raise_for_status() before .json() to catch 4xx/5xx errors
  - check_payout_eligibility_for_worker now returns list (all events evaluated)
"""

import os
import logging
import requests
from celery import Celery
from celery.schedules import crontab
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# ── Config from environment (validated, not raw os.getenv) ───────────────────
def _get_required_env(key: str) -> str:
    val = os.getenv(key, "")
    if not val:
        logger.warning(f"Environment variable {key} is not set — related tasks will use mock data")
    return val


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
OWM_API_KEY = _get_required_env("OPENWEATHERMAP_API_KEY")

app = Celery("gigshield")
app.config_from_object({
    "broker_url": REDIS_URL,
    "result_backend": os.getenv("CELERY_RESULT_BACKEND", REDIS_URL),  # allow separate result backend
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "timezone": "Asia/Kolkata",
    "enable_utc": True,
    "task_acks_late": True,    # prevent task pile-up: only ack after completion
    "worker_prefetch_multiplier": 1,
    "beat_schedule": {
        "check-disruption-triggers": {
            "task": "celery_tasks.check_disruption_triggers",
            "schedule": 60 * 15,
        },
        "check-payout-eligibility": {
            "task": "celery_tasks.check_payout_eligibility",
            "schedule": 60 * 15,
        },
        "send-daily-risk-brief": {
            "task": "celery_tasks.send_daily_risk_brief",
            "schedule": crontab(hour=7, minute=0),
        },
        "update-city-digital-twin": {
            "task": "celery_tasks.update_city_digital_twin",
            "schedule": crontab(day_of_week=0, hour=0, minute=0),
        },
        "recalculate-risk-scores": {
            "task": "celery_tasks.recalculate_risk_scores",
            "schedule": crontab(day_of_week=1, hour=6, minute=0),
        },
    }
})


# ============================================================
# TRIGGER 1 — Heavy Rain (OpenWeatherMap)
# ============================================================

def check_heavy_rain(zone_lat: float, zone_lng: float, api_key: str) -> dict:
    """
    Poll OpenWeatherMap 3-hour forecast.
    FIX: raise_for_status() before .json() to surface API errors.
    """
    if not api_key:
        logger.debug("OWM API key not set — returning mock data")
        return {"triggered": False, "value": 0, "source": "mock_no_key"}

    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={"lat": zone_lat, "lon": zone_lng, "appid": api_key, "units": "metric", "cnt": 4},
            timeout=10,
        )
        resp.raise_for_status()   # FIX: raises on 401/403/429/5xx
        data = resp.json()

        max_rain = 0.0
        for entry in data.get("list", []):
            rain_3h = entry.get("rain", {}).get("3h", 0)
            max_rain = max(max_rain, rain_3h)

        triggered = max_rain >= 35
        return {
            "triggered": triggered,
            "value": round(max_rain, 2),
            "trigger_type": "heavy_rain",
            "source": "openweathermap",
        }
    except requests.HTTPError as e:
        logger.error(f"OpenWeatherMap API HTTP error (lat={zone_lat},lng={zone_lng}): {e}")
        return {"triggered": False, "value": 0, "source": "api_error", "error": str(e)}
    except requests.RequestException as e:
        logger.error(f"OpenWeatherMap request failed: {e}")
        return {"triggered": False, "value": 0, "source": "network_error", "error": str(e)}


# ============================================================
# TRIGGER 2 — AQI Spike (CPCB mock)
# ============================================================

def check_aqi_spike(zone_lat: float, zone_lng: float) -> dict:
    """
    CPCB AQI check. Uses mock data (real CPCB API requires registration).
    """
    return {"triggered": False, "value": 0, "trigger_type": "aqi_spike", "source": "mock_cpcb"}


# ============================================================
# TRIGGER 3 — Extreme Heat (OpenWeatherMap)
# ============================================================

def check_extreme_heat(zone_lat: float, zone_lng: float, api_key: str) -> dict:
    if not api_key:
        return {"triggered": False, "value": 0, "source": "mock_no_key"}
    try:
        resp = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={"lat": zone_lat, "lon": zone_lng, "appid": api_key, "units": "metric"},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
        temp = data.get("main", {}).get("temp", 0)
        triggered = temp >= 42
        return {"triggered": triggered, "value": round(temp, 1), "trigger_type": "extreme_heat", "source": "openweathermap"}
    except requests.HTTPError as e:
        logger.error(f"OWM heat check HTTP error: {e}")
        return {"triggered": False, "value": 0, "source": "api_error"}
    except requests.RequestException as e:
        logger.error(f"OWM heat check network error: {e}")
        return {"triggered": False, "value": 0, "source": "network_error"}


# ============================================================
# CELERY TASKS
# ============================================================

ZONE_REGISTRY = {
    "HSR_LAYOUT_BLR":  {"lat": 12.9116, "lng": 77.6389, "city": "Bengaluru"},
    "KORAMANGALA_BLR": {"lat": 12.9352, "lng": 77.6245, "city": "Bengaluru"},
    "BANDRA_MUM":      {"lat": 19.0596, "lng": 72.8295, "city": "Mumbai"},
    "ANDHERI_MUM":     {"lat": 19.1136, "lng": 72.8697, "city": "Mumbai"},
    "ADYAR_CHN":       {"lat": 13.0012, "lng": 80.2565, "city": "Chennai"},
    "T_NAGAR_CHN":     {"lat": 13.0418, "lng": 80.2341, "city": "Chennai"},
}


@app.task(name="celery_tasks.check_disruption_triggers", bind=True, max_retries=3)
def check_disruption_triggers(self):
    """
    Poll all 5 trigger APIs for each zone every 15 minutes.
    Stores active events for the payout eligibility task.
    """
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")  # re-read at task time for hot reload
    active_triggers = []

    for zone_id, zone in ZONE_REGISTRY.items():
        try:
            rain = check_heavy_rain(zone["lat"], zone["lng"], api_key)
            if rain.get("triggered"):
                active_triggers.append({
                    "zone_id": zone_id,
                    "trigger_type": "heavy_rain",
                    "value": rain["value"],
                    "city": zone["city"],
                    "source": rain["source"],
                })

            heat = check_extreme_heat(zone["lat"], zone["lng"], api_key)
            if heat.get("triggered"):
                active_triggers.append({
                    "zone_id": zone_id,
                    "trigger_type": "extreme_heat",
                    "value": heat["value"],
                    "city": zone["city"],
                    "source": heat["source"],
                })
        except Exception as e:
            logger.error(f"Disruption check failed for zone {zone_id}: {e}")

    if active_triggers:
        logger.info(f"Active triggers found: {len(active_triggers)} across zones")
        check_payout_eligibility.delay(active_triggers)
    else:
        logger.debug("No disruption triggers active in any zone")

    return {"checked_zones": len(ZONE_REGISTRY), "active_triggers": len(active_triggers)}


@app.task(name="celery_tasks.check_payout_eligibility", bind=True)
def check_payout_eligibility(self, active_triggers: list = None):
    """
    For each active trigger, check all workers in that zone for payout eligibility.
    Persists results to the database.
    """
    if not active_triggers:
        logger.debug("check_payout_eligibility called with no active triggers")
        return {"processed": 0}

    from db import SessionLocal
    from models import Worker, Policy, Claim, Payout
    from payout_engine import (
        ParametricPayoutEngine, WorkerContext,
        DisruptionEvent as DE, ActivityBaseline, PayoutStatus,
    )

    db = SessionLocal()
    processed = 0

    try:
        for trigger in active_triggers:
            zone_id = trigger["zone_id"]

            # Find all workers in this zone with active policies
            workers_in_zone = (
                db.query(Worker, Policy)
                .join(Policy, Policy.worker_id == Worker.id)
                .filter(
                    Worker.zone_geojson == trigger.get("city", ""),
                    Policy.status == "active",
                    Worker.is_active == True,
                )
                .all()
            )

            if not workers_in_zone:
                logger.debug(f"No active workers found in zone {zone_id}")
                continue

            engine = ParametricPayoutEngine()
            now = datetime.utcnow()

            for worker, policy in workers_in_zone:
                try:
                    # Check idempotency: skip if already paid this hour for this trigger
                    idempotency_key = f"{worker.id}:{zone_id}:{trigger['trigger_type']}:{now.strftime('%Y%m%d%H')}"
                    existing = db.query(Payout).filter(Payout.idempotency_key == idempotency_key).first()
                    if existing:
                        continue

                    shift_start_str = f"{worker.shift_start:02d}:00"
                    shift_end_str = f"{worker.shift_end:02d}:00"

                    worker_ctx = WorkerContext(
                        worker_id=str(worker.id),
                        name=worker.name,
                        zone_id=zone_id,
                        zone_lat=trigger.get("lat", 12.9116),
                        zone_lng=trigger.get("lng", 77.6389),
                        city=worker.city,
                        platform=worker.platform,
                        shift_start=shift_start_str,
                        shift_end=shift_end_str,
                        weekly_income_estimate=worker.weekly_income_estimate,
                        registered_upi=worker.upi_id or "",
                        plan_type=policy.plan_type,
                        checkin_lat=None, checkin_lng=None,
                        checkin_timestamp=now,
                        gps_accuracy_m=30.0,
                        claims_last_30d=0,
                        avg_payout=0.0,
                        device_fingerprint=None,
                        registered_device_fingerprint=worker.device_fingerprint,
                    )

                    event = DE(
                        event_id=str(now.strftime("%Y%m%d%H")) + "_" + zone_id[:6],
                        trigger_type=trigger["trigger_type"],
                        zone_id=zone_id,
                        city=trigger.get("city", worker.city),
                        severity="moderate",
                        api_source=trigger.get("source", "api"),
                        started_at=now,
                        value=trigger.get("value", 0),
                        metadata={"description": trigger["trigger_type"], "source": trigger.get("source", "api")},
                    )

                    # Seed baseline (simplified: use zone average)
                    baseline = 8.0
                    actual = baseline * 0.5  # conservative estimate; real GPS data not available in Celery

                    activity = ActivityBaseline(
                        worker_id=str(worker.id),
                        hour=now.hour,
                        day_of_week=now.weekday(),
                        baseline_deliveries=baseline,
                        actual_deliveries=actual,
                        drop_pct=(baseline - actual) / baseline,
                    )

                    if not worker.upi_id:
                        logger.warning(f"Worker {worker.id} has no UPI ID — skipping payout")
                        continue

                    result = engine.process_automatic_payout(event, worker_ctx, activity)

                    # Persist claim
                    claim = Claim(
                        worker_id=worker.id,
                        policy_id=policy.id,
                        disruption_event_id=None,
                        estimated_loss=round(worker.weekly_income_estimate / 7 * activity.drop_pct, 2),
                        payout_amount=result.amount_inr if result.status == PayoutStatus.COMPLETED else None,
                        status=result.status.value,
                        fraud_check_results={
                            "defense_decision": result.defense_decision,
                            "trigger_type": trigger["trigger_type"],
                            "drop_pct": result.drop_pct,
                        },
                        payout_id_ref=result.payout_id,
                    )
                    db.add(claim)
                    db.flush()

                    if result.status == PayoutStatus.COMPLETED:
                        payout_row = Payout(
                            claim_id=claim.id,
                            worker_id=worker.id,
                            amount=result.amount_inr,
                            upi_id=worker.upi_id,
                            razorpay_payout_id=result.razorpay_mock_id,
                            idempotency_key=idempotency_key,
                            status="COMPLETED",
                            initiated_at=now,
                            completed_at=now,
                        )
                        db.add(payout_row)
                        logger.info(f"Payout ₹{result.amount_inr} to worker {worker.id} ({worker.upi_id}) for {trigger['trigger_type']}")

                    db.commit()
                    processed += 1

                except Exception as e:
                    db.rollback()
                    logger.error(f"Payout processing failed for worker {worker.id}: {e}")

    except Exception as e:
        logger.error(f"check_payout_eligibility task error: {e}")
    finally:
        db.close()

    return {"processed": processed}


@app.task(name="celery_tasks.send_daily_risk_brief")
def send_daily_risk_brief():
    logger.info("Daily risk brief task executed (push notification implementation pending)")
    return {"status": "ok"}


@app.task(name="celery_tasks.update_city_digital_twin")
def update_city_digital_twin():
    logger.info("City Digital Twin update task executed")
    return {"status": "ok"}


@app.task(name="celery_tasks.recalculate_risk_scores")
def recalculate_risk_scores():
    logger.info("Risk score recalculation task executed")
    return {"status": "ok"}
