from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import os, requests, logging
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

ZONE_COORDS = {
    "HSR_LAYOUT_BLR":  {"lat": 12.9116, "lng": 77.6389, "city": "Bengaluru"},
    "KORAMANGALA_BLR": {"lat": 12.9352, "lng": 77.6245, "city": "Bengaluru"},
    "BANDRA_MUM":      {"lat": 19.0596, "lng": 72.8295, "city": "Mumbai"},
    "ANDHERI_MUM":     {"lat": 19.1136, "lng": 72.8697, "city": "Mumbai"},
    "ADYAR_CHN":       {"lat": 13.0012, "lng": 80.2565, "city": "Chennai"},
    "T_NAGAR_CHN":     {"lat": 13.0418, "lng": 80.2341, "city": "Chennai"},
}
RAIN_THRESHOLDS = {"mild": 20, "moderate": 35, "severe": 60}

class ZoneWeatherResponse(BaseModel):
    zone_id: str; city: str; lat: float; lng: float
    current_rain_mm: float; severity: str; triggered: bool
    trigger_type: str; temperature_c: float; description: str
    checked_at: str; api_source: str

class PollAllZonesResponse(BaseModel):
    zones_checked: int; triggered_zones: List[ZoneWeatherResponse]
    triggered_count: int; checked_at: str

def compute_severity(rain_mm):
    if rain_mm >= RAIN_THRESHOLDS["severe"]: return "severe"
    elif rain_mm >= RAIN_THRESHOLDS["moderate"]: return "moderate"
    elif rain_mm >= RAIN_THRESHOLDS["mild"]: return "mild"
    return "none"

def fetch_owm(lat, lng, api_key):
    try:
        cur = requests.get("https://api.openweathermap.org/data/2.5/weather",
            params={"lat": lat, "lon": lng, "appid": api_key, "units": "metric"}, timeout=8).json()
        rain_mm = cur.get("rain", {}).get("1h", 0)
        return {"rain_mm": rain_mm, "temp": cur.get("main", {}).get("temp", 30),
                "desc": cur.get("weather", [{}])[0].get("description", "clear"), "source": "openweathermap"}
    except Exception as e:
        return {"rain_mm": 0, "temp": 30, "desc": "API unavailable", "source": "mock"}

@router.get("/zone/{zone_id}", response_model=ZoneWeatherResponse)
async def get_zone_weather(zone_id: str):
    zone = ZONE_COORDS.get(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Unknown zone. Valid: {list(ZONE_COORDS.keys())}")
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        return ZoneWeatherResponse(zone_id=zone_id, city=zone["city"], lat=zone["lat"], lng=zone["lng"],
            current_rain_mm=42.5, severity="moderate", triggered=True, trigger_type="heavy_rain",
            temperature_c=27.3, description="Mock: no API key set",
            checked_at=datetime.utcnow().isoformat(), api_source="mock")
    data = fetch_owm(zone["lat"], zone["lng"], api_key)
    sev = compute_severity(data["rain_mm"])
    return ZoneWeatherResponse(zone_id=zone_id, city=zone["city"], lat=zone["lat"], lng=zone["lng"],
        current_rain_mm=round(data["rain_mm"], 2), severity=sev, triggered=sev != "none",
        trigger_type="heavy_rain" if sev != "none" else "none",
        temperature_c=round(data["temp"], 1), description=data["desc"],
        checked_at=datetime.utcnow().isoformat(), api_source=data["source"])

@router.post("/poll-and-trigger", response_model=PollAllZonesResponse)
async def poll_all_zones():
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")
    triggered = []
    checked_at = datetime.utcnow().isoformat()
    for zone_id, zone in ZONE_COORDS.items():
        if api_key and api_key != "your_key_here":
            data = fetch_owm(zone["lat"], zone["lng"], api_key)
        else:
            data = {"rain_mm": 42.5 if zone_id == "HSR_LAYOUT_BLR" else (38.0 if zone_id == "KORAMANGALA_BLR" else 4.0),
                    "temp": 27.0, "desc": "mock", "source": "mock"}
        sev = compute_severity(data["rain_mm"])
        if sev != "none":
            triggered.append(ZoneWeatherResponse(
                zone_id=zone_id, city=zone["city"], lat=zone["lat"], lng=zone["lng"],
                current_rain_mm=round(data["rain_mm"], 2), severity=sev, triggered=True,
                trigger_type="heavy_rain", temperature_c=round(data["temp"], 1),
                description=data["desc"], checked_at=checked_at, api_source=data["source"]))
            try:
                from celery_tasks import check_payout_eligibility
                check_payout_eligibility.delay()
            except Exception as e:
                logger.warning(f"Celery unavailable: {e}")
    return PollAllZonesResponse(zones_checked=len(ZONE_COORDS),
        triggered_zones=triggered, triggered_count=len(triggered), checked_at=checked_at)

@router.get("/zones")
async def list_zones():
    return {"zones": list(ZONE_COORDS.keys()), "count": len(ZONE_COORDS)}
