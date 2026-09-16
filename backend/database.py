import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

raw_db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or os.getenv("SQLALCHEMY_DATABASE_URL")

if raw_db_url and raw_db_url.strip():
    clean_url = raw_db_url.strip()
    # Fix Render's legacy postgres:// scheme for SQLAlchemy >= 1.4
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URL = clean_url
else:
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres:password@localhost/risk_db"

db_scheme = SQLALCHEMY_DATABASE_URL.split("://")[0] if "://" in SQLALCHEMY_DATABASE_URL else "unknown"
print(f"[Database Config] Configured database connection using scheme '{db_scheme}'")

try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
except Exception as e:
    print(f"[Database Warning] Engine creation failed for {SQLALCHEMY_DATABASE_URL}: {e}")
    # Fallback to SQLite in-memory engine to keep SQLAlchemy Base valid in standalone mode
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

