import argparse
import json
import random
import threading
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


def build_payload(tenant_id: str, client_id: str, machine_id: str, sensor_id: str) -> dict:
    return {
        "tenant_id": tenant_id,
        "client_id": client_id,
        "machine_id": machine_id,
        "sensor_id": sensor_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "temperature": round(random.uniform(60, 90), 2),
            "vibration": round(random.uniform(0.05, 0.6), 4),
            "pressure": round(random.uniform(98, 104), 2),
        },
        "status": "ok",
    }


def worker(host: str, port: int, tenant_id: str, client_id: str, idx: int, rate: float, duration: int) -> None:
    client = mqtt.Client(client_id=f"load-{idx}")
    client.connect(host, port, keepalive=30)
    end_time = time.time() + duration
    count = 0
    while time.time() < end_time:
        machine_id = f"machine-{idx:03d}"
        sensor_id = f"sensor-{count % 50:03d}"
        topic = f"tenants/{tenant_id}/clients/{client_id}/machines/{machine_id}/sensors/{sensor_id}"
        payload = build_payload(tenant_id, client_id, machine_id, sensor_id)
        client.publish(topic, json.dumps(payload))
        count += 1
        time.sleep(max(0, 1.0 / rate))
    client.disconnect()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=1883)
    parser.add_argument("--tenant", default="demo")
    parser.add_argument("--client", default="loadtest")
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--rate", type=float, default=50.0)
    parser.add_argument("--duration", type=int, default=60)
    args = parser.parse_args()

    threads = []
    for idx in range(args.workers):
        thread = threading.Thread(
            target=worker,
            args=(args.host, args.port, args.tenant, args.client, idx, args.rate, args.duration),
            daemon=True,
        )
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()


if __name__ == "__main__":
    main()
