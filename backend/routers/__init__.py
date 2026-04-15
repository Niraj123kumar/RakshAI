# __init__.py file for FastAPI routers package

from fastapi import APIRouter

from .auth import router as auth_router
from .onboarding import router as onboarding_router
from .policy import router as policy_router
from .risk import router as risk_router
from .claims import router as claims_router
from .dashboard import router as dashboard_router
from .admin import router as admin_router
from .weather import router as weather_router

__all__ = [
    "auth_router",
    "onboarding_router",
    "policy_router",
    "risk_router",
    "claims_router",
    "dashboard_router",
    "admin_router",
    "weather_router",
]
