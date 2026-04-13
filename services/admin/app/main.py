import logging

from fastapi import FastAPI, Depends
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
from sqlalchemy.orm import Session

from pocketwisdom.config import Settings
from pocketwisdom.logging import configure_logging
from pocketwisdom.metrics import ServiceMetrics

from .database import SessionLocal, engine
from .models import Base, Client, Machine, AlertRule
from .schemas import (
    ClientCreate,
    ClientOut,
    MachineCreate,
    MachineOut,
    AlertRuleCreate,
    AlertRuleOut,
)

settings = Settings(service_name="admin")
configure_logging(settings.log_level)
logger = logging.getLogger("admin")
metrics = ServiceMetrics(settings.service_name)

app = FastAPI(title="PocketWisdom Admin API")


@app.on_event("startup")
async def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    logger.info("Admin DB ready")


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/clients", response_model=ClientOut)
async def create_client(payload: ClientCreate, db: Session = Depends(get_db)) -> Client:
    client = Client(tenant_id=payload.tenant_id, name=payload.name)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@app.post("/machines", response_model=MachineOut)
async def create_machine(payload: MachineCreate, db: Session = Depends(get_db)) -> Machine:
    machine = Machine(
        tenant_id=payload.tenant_id,
        client_id=payload.client_id,
        name=payload.name,
        location=payload.location,
    )
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@app.post("/alerts", response_model=AlertRuleOut)
async def create_alert(payload: AlertRuleCreate, db: Session = Depends(get_db)) -> AlertRule:
    rule = AlertRule(
        tenant_id=payload.tenant_id,
        name=payload.name,
        rule_type=payload.rule_type,
        metric=payload.metric,
        threshold=payload.threshold,
        window_seconds=payload.window_seconds,
        webhook_url=payload.webhook_url,
        email=payload.email,
        enabled=payload.enabled,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@app.get("/metrics")
async def metrics_summary(db: Session = Depends(get_db)) -> dict:
    return {
        "clients": db.query(Client).count(),
        "machines": db.query(Machine).count(),
        "alerts": db.query(AlertRule).count(),
    }


@app.get("/metrics/prometheus")
async def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": settings.service_name}


@app.get("/alerts")
async def list_alerts(db: Session = Depends(get_db)) -> list[AlertRuleOut]:
    return db.query(AlertRule).filter(AlertRule.enabled.is_(True)).all()
