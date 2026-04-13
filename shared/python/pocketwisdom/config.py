from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PW_", case_sensitive=False)

    service_name: str = "pocketwisdom"
    environment: str = "local"
    log_level: str = "INFO"

    jwt_secret_key: str = "change-me-local"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60
    cors_origins: str = "http://localhost:5173"
    internal_api_token: str = "pocketwisdom-internal-token"

    mqtt_host: str = "mosquitto"
    mqtt_port: int = 1883
    mqtt_topic: str = "tenants/+/clients/+/machines/+/sensors/+"

    kafka_bootstrap_servers: str = "redpanda:9092"
    kafka_topic: str = "sensor-data"
    kafka_group_id: str = "pocketwisdom"
    kafka_client_id: str = "pocketwisdom"
    kafka_security_protocol: str = "PLAINTEXT"
    kafka_auto_offset_reset: str = "latest"

    influx_url: str = "http://influxdb:8086"
    influx_token: str = "pocketwisdom-token"
    influx_org: str = "pocketwisdom"
    influx_bucket_prefix: str = "tenant_"
    influx_raw_suffix: str = "_raw"
    influx_agg_suffix: str = "_agg"
    influx_write_precision: str = "ns"

    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_region: str = "us-east-1"
    s3_use_ssl: bool = False
    lake_bucket_prefix: str = "tenant-"
    lake_bucket_mode: str = "bucket"
    lake_partition_date_format: str = "%Y/%m/%d"
    lake_target_file_mb: int = 200

    admin_api_url: str = "http://admin:8002"

    alerts_refresh_seconds: int = 30
    alerts_webhook_timeout_seconds: int = 5

    prometheus_port: int = 8000

    database_url: str = "sqlite:///./admin.db"
    database_echo: bool = False

    def raw_bucket(self, tenant_id: str) -> str:
        return f"{self.influx_bucket_prefix}{tenant_id}{self.influx_raw_suffix}"

    def agg_bucket(self, tenant_id: str) -> str:
        return f"{self.influx_bucket_prefix}{tenant_id}{self.influx_agg_suffix}"

    def lake_bucket(self, tenant_id: str) -> str:
        if self.lake_bucket_mode == "bucket":
            return f"{self.lake_bucket_prefix}{tenant_id}"
        return self.lake_bucket_prefix.rstrip("-")

    def lake_prefix(self, tenant_id: str) -> str:
        if self.lake_bucket_mode == "bucket":
            return ""
        return f"tenant_id={tenant_id}/"
