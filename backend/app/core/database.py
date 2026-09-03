from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Read-only engine for Gemini Agent
readonly_engine = create_engine(
    settings.READONLY_DATABASE_URL,
    pool_pre_ping=True,
)
ReadOnlySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=readonly_engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_readonly_db():
    db = ReadOnlySessionLocal()
    try:
        yield db
    finally:
        db.close()
