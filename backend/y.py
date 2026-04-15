from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic_settings import BaseSettings
from starlette.requests import Request
import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import uvicorn
from routers import auth_router, onboarding_router, policy_router, risk_router, claims_router, dashboard_router, admin_router

class Settings(BaseSettings):
    model_config = {"env_file": ".env"}
    DATABASE_URL: str
    REDIS_URL: str
    OPENWEATHERMAP_API_KEY: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_KEY_SECRET: str
    SUPABASE_URL: str
    SENTRY_DSN: str
    SECRET_KEY: str

settings = Settings()
engine = sa.create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(onboarding_router, prefix="/onboarding", tags=["Onboarding"])
app.include_router(policy_router, prefix="/policy", tags=["Policy"])
app.include_router(risk_router, prefix="/risk", tags=["Risk"])
app.include_router(claims_router, prefix="/claims", tags=["Claims"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(admin_router, prefix="/admin", tags=["Admin"])

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
