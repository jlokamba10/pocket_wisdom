import asyncio
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any

import httpx
from fastapi import FastAPI
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from pocketwisdom.config import Settings
from pocketwisdom.kafka import create_consumer
from pocketwisdom.logging import configure_logging
from pocketwisdom.metrics import ServiceMetrics

settings = Settings(service_name="alerts")
configure_logging(settings.log_level)
logger = logging.getLogger("alerts")
metrics = ServiceMetrics(settings.service_name)

app = FastAPI(title="PocketWisdom Alert Engine")


class AlertRule:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.id = payload["id"]
        self.tenant_id = payload["tenant_id"]
        self.metric_name = payload["metric_name"]
        self.operator = payload["operator"]
        self.threshold_value = payload["threshold_value"]
        self.time_window_minutes = payload.get("time_window_minutes") or 0
        self.webhook_url = payload.get("webhook_url")
        self.email = payload.get("email")

    def matches(self, reading: dict) -> bool:
        return reading.get("tenant_id") == self.tenant_id and self.metric_name in reading.get("metrics", {})


class AlertEngine:
    def __init__(self) -> None:
        self.rules: list[AlertRule] = []
        self.client = httpx.AsyncClient(timeout=settings.alerts_webhook_timeout_seconds)
        self.window_cache: dict[str, deque] = defaultdict(deque)
        self.last_triggered: dict[str, datetime] = {}
        self.dedupe_seconds = 60

    async def refresh_rules(self) -> None:
        while True:
            try:
                response = await self.client.get(
                    f"{settings.admin_api_url}/internal/alert-rules",
                    headers={"X-Internal-Token": settings.internal_api_token},
                )
                response.raise_for_status()
                self.rules = [AlertRule(item) for item in response.json()]
                metrics.active_rules.labels(settings.service_name).set(len(self.rules))
                logger.info("Loaded alert rules", extra={"count": len(self.rules)})
            except Exception as exc:
                logger.error("Failed to refresh rules", extra={"error": str(exc)})
            await asyncio.sleep(settings.alerts_refresh_seconds)

    async def handle_reading(self, reading: dict) -> None:
        for rule in self.rules:
            if not rule.matches(reading):
                continue
            metric_value = reading["metrics"].get(rule.metric_name)
            if metric_value is None:
                continue
            if rule.time_window_minutes:
                await self.evaluate_window(rule, reading, metric_value)
            else:
                await self.evaluate_threshold(rule, reading, metric_value)

    async def evaluate_threshold(self, rule: AlertRule, reading: dict, value: float) -> None:
        if self._compare(value, rule.operator, rule.threshold_value):
            await self.trigger(rule, reading, value)

    async def evaluate_window(self, rule: AlertRule, reading: dict, value: float) -> None:
        key = f"{rule.id}:{reading.get('sensor_id')}"
        now = datetime.utcnow()
        window = self.window_cache[key]
        window.append((now, value))
        cutoff = now - timedelta(minutes=rule.time_window_minutes)
        while window and window[0][0] < cutoff:
            window.popleft()
        if not window:
            return
        avg = sum(item[1] for item in window) / len(window)
        if self._compare(avg, rule.operator, rule.threshold_value):
            await self.trigger(rule, reading, avg)

    def _compare(self, value: float, operator: str, threshold: float) -> bool:
        op = operator.strip()
        if op == ">=":
            return value >= threshold
        if op == "<=":
            return value <= threshold
        if op == ">":
            return value > threshold
        if op == "<":
            return value < threshold
        if op in ("=", "=="):
            return value == threshold
        return value > threshold

    async def trigger(self, rule: AlertRule, reading: dict, value: float) -> None:
        dedupe_key = f"{rule.id}:{reading.get('sensor_id')}"
        last = self.last_triggered.get(dedupe_key)
        now = datetime.utcnow()
        if last and (now - last).total_seconds() < self.dedupe_seconds:
            return
        self.last_triggered[dedupe_key] = now
        payload = {
            "rule_id": rule.id,
            "tenant_id": rule.tenant_id,
            "sensor_id": reading.get("sensor_id"),
            "metric": rule.metric_name,
            "value": value,
            "timestamp": now.isoformat(),
        }
        logger.warning("Alert triggered", extra=payload)
        if rule.webhook_url:
            try:
                await self.client.post(rule.webhook_url, json=payload)
            except Exception as exc:
                logger.error("Webhook failed", extra={"error": str(exc)})
        if rule.email:
            logger.info("Mock email alert", extra={"email": rule.email, "payload": payload})


engine = AlertEngine()
consumer = create_consumer(settings, [settings.kafka_topic], group_id="alerts")


@app.on_event("startup")
async def on_startup() -> None:
    await consumer.start()
    asyncio.create_task(engine.refresh_rules())
    asyncio.create_task(consume_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await consumer.stop()
    await engine.client.aclose()


async def consume_loop() -> None:
    async for message in consumer:
        try:
            reading = message.value.get("data")
            if not reading:
                continue
            metrics.mark_message("ok")
            await engine.handle_reading(reading)
        except Exception as exc:
            metrics.mark_message("error")
            logger.exception("Failed to process alert", extra={"error": str(exc)})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": settings.service_name}


@app.get("/metrics")
async def metrics_endpoint() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
