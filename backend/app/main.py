from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, policies, payouts, admin

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RakshAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(policies.router)
app.include_router(payouts.router)
app.include_router(admin.router)

@app.get("/")
def root():
    return {"message": "RakshAI API is running"}
