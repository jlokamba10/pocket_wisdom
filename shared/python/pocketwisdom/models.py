from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field, field_validator


class SensorPayload(BaseModel):
    tenant_id: Optional[str] = None
    client_id: Optional[str] = None
    machine_id: Optional[str] = None
    sensor_id: Optional[str] = None
    ts: datetime
    metrics: Dict[str, float]
    status: Optional[str] = None
    event_id: Optional[str] = None

    @field_validator("metrics")
    @classmethod
    def ensure_metrics(cls, value: Dict[str, float]) -> Dict[str, float]:
        if not value:
            raise ValueError("metrics cannot be empty")
        return value


class SensorReading(BaseModel):
    tenant_id: str
    client_id: str
    machine_id: str
    sensor_id: str
    ts: datetime
    metrics: Dict[str, float]
    status: Optional[str] = None
    event_id: str


class SensorEnvelope(BaseModel):
    data: SensorReading
    received_at: datetime = Field(default_factory=datetime.utcnow)
    source: str = "mqtt"
