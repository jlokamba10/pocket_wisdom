from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from pocketwisdom.config import Settings

settings = Settings(service_name="admin")

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.database_url, echo=settings.database_echo, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
