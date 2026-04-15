from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.worker import Worker
from app.services.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    name: str
    phone: str
    email: str
    password: str
    platform: str
    city: str
    pincode: str
    upi_id: str
    avg_daily_hours: float = 8.0

class LoginRequest(BaseModel):
    phone: str
    password: str

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(Worker).filter(Worker.phone == req.phone).first():
        raise HTTPException(status_code=400, detail="Phone already registered")
    worker = Worker(
        name=req.name, phone=req.phone, email=req.email,
        hashed_password=hash_password(req.password),
        platform=req.platform, city=req.city, pincode=req.pincode,
        upi_id=req.upi_id, avg_daily_hours=req.avg_daily_hours
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return {"message": "Registered successfully", "worker_id": worker.id}

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.phone == req.phone).first()
    if not worker or not verify_password(req.password, worker.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(worker.id)})
    return {"access_token": token, "token_type": "bearer"}
