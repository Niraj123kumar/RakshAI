"""
GigShield — Database Session Factory (single source of truth)
All routers must import get_db from here. Never create ad-hoc sessions.
"""
import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fail loudly so the missing config is caught at startup, not silently
    logger.critical("DATABASE_URL is not set. Set it in your .env file.")
    DATABASE_URL = "sqlite:///./gigshield_dev.db"   # safe local fallback for dev only
    logger.warning("Falling back to local SQLite database for development.")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency — always yield a session and always close it."""
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
