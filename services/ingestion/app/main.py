import asyncio
import json
import logging
from datetime import datetime
from typing import Any

import paho.mqtt.client as mqtt
from fastapi import FastAPI
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from pocketwisdom.config import Settings
from pocketwisdom.influx import InfluxWriter
from pocketwisdom.kafka import create_producer
from pocketwisdom.logging import configure_logging
from pocketwisdom.metrics import ServiceMetrics
from pocketwisdom.models import SensorPayload, SensorReading, SensorEnvelope
from pocketwisdom.utils import parse_mqtt_topic, deterministic_event_id


settings = Settings(service_name="ingestion")
configure_logging(settings.log_level)
logger = logging.getLogger("ingestion")
metrics = ServiceMetrics(settings.service_name)

app = FastAPI(title="PocketWisdom Ingestion")


class IngestionRuntime:
    def __init__(self) -> None:
        self.loop: asyncio.AbstractEventLoop | None = None
        self.mqtt_client: mqtt.Client | None = None
        self.kafka_producer = create_producer(settings)
        self.influx = InfluxWriter(settings)

    async def start(self) -> None:
        await self.kafka_producer.start()
        self.loop = asyncio.get_running_loop()
        self.mqtt_client = mqtt.Client(client_id="pw-ingestion")
        self.mqtt_client.on_connect = self.on_connect
        self.mqtt_client.on_message = self.on_message
        self.mqtt_client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=30)
        self.mqtt_client.loop_start()
        logger.info("MQTT client started", extra={"topic": settings.mqtt_topic})

    async def stop(self) -> None:
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        await self.kafka_producer.stop()
        self.influx.close()

    def on_connect(self, client: mqtt.Client, userdata: Any, flags: dict, rc: int) -> None:
        if rc == 0:
            client.subscribe(settings.mqtt_topic)
            logger.info("Subscribed to MQTT topic", extra={"topic": settings.mqtt_topic})
        else:
            logger.error("MQTT connection failed", extra={"code": rc})

    def on_message(self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage) -> None:
        if not self.loop:
            return
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            parsed = SensorPayload.model_validate(payload)
            tenant_id, client_id, machine_id, sensor_id = parse_mqtt_topic(msg.topic)
            reading = SensorReading(
                tenant_id=parsed.tenant_id or tenant_id,
                client_id=parsed.client_id or client_id,
                machine_id=parsed.machine_id or machine_id,
                sensor_id=parsed.sensor_id or sensor_id,
                ts=parsed.ts,
                metrics=parsed.metrics,
                status=parsed.status,
                event_id=parsed.event_id
                or deterministic_event_id(tenant_id, client_id, machine_id, sensor_id, parsed.ts),
            )
            envelope = SensorEnvelope(data=reading)
            asyncio.run_coroutine_threadsafe(self.process_message(envelope), self.loop)
        except Exception as exc:
            metrics.mark_message("error")
            logger.exception("Failed to process MQTT message", extra={"error": str(exc)})

    async def process_message(self, envelope: SensorEnvelope) -> None:
        payload = envelope.data.model_dump(mode="json")
        metrics.mark_message("ok")
        start = datetime.utcnow()
        try:
            await self.kafka_producer.send_and_wait(
                settings.kafka_topic,
                value={"data": payload, "received_at": envelope.received_at.isoformat()},
                key=payload["tenant_id"],
            )
            metrics.mark_kafka("ok")
        except Exception as exc:
            metrics.mark_kafka("error")
            logger.exception("Kafka publish failed", extra={"error": str(exc)})

        try:
            bucket = settings.raw_bucket(payload["tenant_id"])
            self.influx.ensure_bucket(bucket)
            await asyncio.get_running_loop().run_in_executor(
                None, self.influx.write_sensor, bucket, payload
            )
            metrics.mark_influx("ok")
        except Exception as exc:
            metrics.mark_influx("error")
            logger.exception("Influx write failed", extra={"error": str(exc)})

        elapsed = (datetime.utcnow() - start).total_seconds()
        metrics.processing_latency_seconds.labels(settings.service_name).observe(elapsed)


runtime = IngestionRuntime()


@app.on_event("startup")
async def on_startup() -> None:
    await runtime.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await runtime.stop()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": settings.service_name}


@app.get("/metrics")
async def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
