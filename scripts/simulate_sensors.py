import argparse
import json
import random
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=1883)
    parser.add_argument("--tenant", default="demo")
    parser.add_argument("--client", default="client-001")
    parser.add_argument("--machines", type=int, default=3)
    parser.add_argument("--sensors", type=int, default=5)
    parser.add_argument("--interval", type=float, default=1.0)
    args = parser.parse_args()

    client = mqtt.Client()
    client.connect(args.host, args.port, keepalive=30)

    machine_ids = [f"machine-{i:03d}" for i in range(1, args.machines + 1)]
    sensor_ids = [f"sensor-{i:03d}" for i in range(1, args.sensors + 1)]

    try:
        while True:
            for machine_id in machine_ids:
                for sensor_id in sensor_ids:
                    topic = (
                        f"tenants/{args.tenant}/clients/{args.client}/"
                        f"machines/{machine_id}/sensors/{sensor_id}"
                    )
                    payload = build_payload(args.tenant, args.client, machine_id, sensor_id)
                    client.publish(topic, json.dumps(payload))
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
