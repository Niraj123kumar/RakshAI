from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict
import datetime
router = APIRouter()


class RiskCalculateRequest(BaseModel):
    zone_geojson: Dict
    platform: str
    shift_start: str
    shift_end: str
    city: str


class RiskCalculateResponse(BaseModel):
    risk_score: int
    recommended_plan: str
    weekly_premium: int
    breakdown: Dict[str, float]


zone_risk_map = {
    "HSR Layout/Koramangala": 80,
    "Lajpat Nagar/GK": 75,
    "default": 60
}
platform_risk_map = {
    "zepto": 75,
    "blinkit": 70,
    "default": 50
}
shift_risk_map = {
    ("afternoon", 6, 9): 15,
    "evening": 8,
    "default": 50
}


@router.post("/calculate")
async def calculate_risk(request: RiskCalculateRequest) -> RiskCalculateResponse:
    zone_risk = zone_risk_map.get(
        request.zone_geojson.get("city", "default"), 60)
    platform_risk = platform_risk_map.get(request.platform, 50)
    shift_start_hour = int(request.shift_start.split(":")[0])
    shift_end_hour = int(request.shift_end.split(":")[0])
    current_month = datetime.datetime.now().month
    if (shift_start_hour >= 12 and shift_start_hour < 18) and 6 <= current_month <= 9:
        shift_risk = 15
    elif shift_start_hour >= 18 and shift_end_hour <= 22:
        shift_risk = 8
    else:
        shift_risk = 50
    risk_score = int(
        (zone_risk * 4 + platform_risk * 3 + shift_risk * 3) / 10
    )
    breakdown = {
        "zone_risk": zone_risk,
        "platform_risk": platform_risk,
        "shift_risk": shift_risk
    }
    if risk_score < 40:
        recommended_plan = "Basic"
        weekly_premium = 50
    elif 40 <= risk_score <= 70:
        recommended_plan = "Standard"
        weekly_premium = 75
    else:
        recommended_plan = "Pro"
        weekly_premium = 100
    return RiskCalculateResponse(
        risk_score=risk_score,
        recommended_plan=recommended_plan,
        weekly_premium=weekly_premium,
        breakdown=breakdown
    )
