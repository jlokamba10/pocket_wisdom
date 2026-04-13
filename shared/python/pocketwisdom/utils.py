from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Tuple


def parse_mqtt_topic(topic: str) -> Tuple[str, str, str, str]:
    parts = topic.split("/")
    if len(parts) < 8:
        raise ValueError("Invalid topic format")
    tenant_id = parts[1]
    client_id = parts[3]
    machine_id = parts[5]
    sensor_id = parts[7]
    return tenant_id, client_id, machine_id, sensor_id


def deterministic_event_id(
    tenant_id: str, client_id: str, machine_id: str, sensor_id: str, ts: datetime
) -> str:
    payload = f"{tenant_id}:{client_id}:{machine_id}:{sensor_id}:{ts.isoformat()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
