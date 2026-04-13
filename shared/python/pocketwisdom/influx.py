from __future__ import annotations

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

from .config import Settings


class InfluxWriter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = InfluxDBClient(
            url=settings.influx_url,
            token=settings.influx_token,
            org=settings.influx_org,
        )
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.buckets_api = self.client.buckets_api()
        self._known_buckets: set[str] = set()

    def ensure_bucket(self, bucket_name: str) -> None:
        if bucket_name in self._known_buckets:
            return
        existing = self.buckets_api.find_bucket_by_name(bucket_name)
        if existing is None:
            self.buckets_api.create_bucket(bucket_name=bucket_name, org=self.settings.influx_org)
        self._known_buckets.add(bucket_name)

    def write_sensor(self, bucket_name: str, payload: dict) -> None:
        point = (
            Point("sensor_reading")
            .tag("tenant_id", payload["tenant_id"])
            .tag("client_id", payload["client_id"])
            .tag("machine_id", payload["machine_id"])
            .tag("sensor_id", payload["sensor_id"])
            .tag("event_id", payload.get("event_id", ""))
            .time(payload["ts"], WritePrecision.NS)
        )
        for key, value in payload["metrics"].items():
            point.field(key, float(value))
        if payload.get("status"):
            point.field("status", payload["status"])
        self.write_api.write(bucket=bucket_name, org=self.settings.influx_org, record=point)

    def close(self) -> None:
        self.client.close()
