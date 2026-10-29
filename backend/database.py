import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# one sqlite file for the whole demo; DATABASE_PATH lets a host point it at a mounted disk
DB_PATH = os.environ.get("DATABASE_PATH", "businessx.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
