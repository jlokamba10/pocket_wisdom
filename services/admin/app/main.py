import logging

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from sqlalchemy.orm import Session
from starlette.responses import Response

from pocketwisdom.config import Settings
from pocketwisdom.logging import configure_logging

from .deps import get_db
from .models import AlertRule, Equipment, Sensor, Tenant, User
from .routers import alerts, auth, client_admin, system_admin, users

settings = Settings(service_name="admin")
configure_logging(settings.log_level)
logger = logging.getLogger("admin")

app = FastAPI(title="PocketWisdom Admin API")

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(alerts.router)
app.include_router(system_admin.router)
app.include_router(client_admin.router)
app.include_router(client_admin.summary_router)


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Admin API ready")


@app.get("/metrics")
async def metrics_summary(db: Session = Depends(get_db)) -> dict:
    return {
        "tenants": db.query(Tenant).count(),
        "users": db.query(User).count(),
        "equipment": db.query(Equipment).count(),
        "sensors": db.query(Sensor).count(),
        "alert_rules": db.query(AlertRule).count(),
    }


@app.get("/metrics/prometheus")
async def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": settings.service_name}
