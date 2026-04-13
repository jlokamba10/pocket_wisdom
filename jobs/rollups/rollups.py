import asyncio
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

import polars as pl
import pyarrow.dataset as ds

from pocketwisdom.config import Settings
from pocketwisdom.influx import InfluxWriter
from pocketwisdom.kafka import create_consumer
from pocketwisdom.logging import configure_logging
from pocketwisdom.metrics import ServiceMetrics
from pocketwisdom.s3 import get_s3_filesystem, ensure_bucket

settings = Settings(service_name="rollups")
configure_logging(settings.log_level)
logger = logging.getLogger("rollups")
metrics = ServiceMetrics(settings.service_name)

INTERVALS = [item.strip() for item in ("1m,5m,1h,1d").split(",")]
BATCH_SECONDS = 30


class RollupJob:
    def __init__(self) -> None:
        self.consumer = create_consumer(settings, [settings.kafka_topic], group_id="rollups")
        self.influx = InfluxWriter(settings)
        self.fs = get_s3_filesystem(settings)
        self.buffer: list[dict[str, Any]] = []

    async def start(self) -> None:
        await self.consumer.start()
        logger.info("Rollup consumer started")
        asyncio.create_task(self.flush_loop())
        async for message in self.consumer:
            reading = message.value.get("data")
            if reading:
                self.buffer.append(reading)

    async def flush_loop(self) -> None:
        while True:
            await asyncio.sleep(BATCH_SECONDS)
            if not self.buffer:
                continue
            batch = self.buffer
            self.buffer = []
            try:
                await asyncio.get_running_loop().run_in_executor(None, self.process_batch, batch)
                metrics.mark_message("ok")
            except Exception as exc:
                metrics.mark_message("error")
                logger.exception("Rollup batch failed", extra={"error": str(exc)})

    def process_batch(self, batch: list[dict[str, Any]]) -> None:
        rows = []
        for reading in batch:
            for metric, value in reading.get("metrics", {}).items():
                rows.append(
                    {
                        "tenant_id": reading["tenant_id"],
                        "client_id": reading["client_id"],
                        "machine_id": reading["machine_id"],
                        "sensor_id": reading["sensor_id"],
                        "ts": reading["ts"],
                        "metric": metric,
                        "value": float(value),
                    }
                )
        if not rows:
            return
        df = pl.DataFrame(rows)
        df = df.with_columns(pl.col("ts").str.strptime(pl.Datetime, strict=False))
        for interval in INTERVALS:
            rollup = (
                df.with_columns(window_start=pl.col("ts").dt.truncate(interval))
                .group_by(
                    [
                        "tenant_id",
                        "client_id",
                        "machine_id",
                        "sensor_id",
                        "metric",
                        "window_start",
                    ]
                )
                .agg(
                    [
                        pl.col("value").mean().alias("avg"),
                        pl.col("value").min().alias("min"),
                        pl.col("value").max().alias("max"),
                        pl.col("value").std().alias("stddev"),
                        pl.col("value").count().alias("count"),
                    ]
                )
            )
            self.write_influx(rollup, interval)
            self.write_parquet(rollup, interval)

    def write_influx(self, df: pl.DataFrame, interval: str) -> None:
        for row in df.to_dicts():
            payload = {
                "tenant_id": row["tenant_id"],
                "client_id": row["client_id"],
                "machine_id": row["machine_id"],
                "sensor_id": row["sensor_id"],
                "ts": row["window_start"],
                "metrics": {
                    "avg": row["avg"],
                    "min": row["min"],
                    "max": row["max"],
                    "stddev": row["stddev"],
                    "count": row["count"],
                },
                "status": interval,
                "event_id": f"{row['sensor_id']}:{interval}:{row['window_start']}",
            }
            bucket = settings.agg_bucket(row["tenant_id"])
            self.influx.ensure_bucket(bucket)
            self.influx.write_sensor(bucket, payload)

    def write_parquet(self, df: pl.DataFrame, interval: str) -> None:
        df = df.with_columns(
            pl.col("window_start").dt.strftime(settings.lake_partition_date_format).alias("date")
        )
        for tenant_id in df.select("tenant_id").unique().to_series():
            tenant_df = df.filter(pl.col("tenant_id") == tenant_id)
            bucket = settings.lake_bucket(str(tenant_id))
            prefix = settings.lake_prefix(str(tenant_id))
            ensure_bucket(settings, bucket)
            base_path = f"{bucket}/{prefix}rollups/interval={interval}"
            dataset = tenant_df.to_arrow()
            ds.write_dataset(
                dataset,
                base_path,
                filesystem=self.fs,
                format="parquet",
                partitioning=["client_id", "date"],
                existing_data_behavior="overwrite_or_ignore",
            )


async def main() -> None:
    job = RollupJob()
    await job.start()


if __name__ == "__main__":
    asyncio.run(main())
