import asyncio
import json
import logging
from datetime import datetime
from typing import Any

import polars as pl
import pyarrow.dataset as ds

from pocketwisdom.config import Settings
from pocketwisdom.kafka import create_consumer
from pocketwisdom.logging import configure_logging
from pocketwisdom.metrics import ServiceMetrics
from pocketwisdom.s3 import get_s3_filesystem, ensure_bucket

settings = Settings(service_name="lake-writer")
configure_logging(settings.log_level)
logger = logging.getLogger("lake_writer")
metrics = ServiceMetrics(settings.service_name)

TARGET_BYTES = settings.lake_target_file_mb * 1024 * 1024
FLUSH_INTERVAL = 30


class LakeWriter:
    def __init__(self) -> None:
        self.consumer = create_consumer(settings, [settings.kafka_topic], group_id="lake-writer")
        self.fs = get_s3_filesystem(settings)
        self.buffer: list[dict[str, Any]] = []
        self.buffer_bytes = 0

    async def start(self) -> None:
        await self.consumer.start()
        logger.info("Lake writer started")
        asyncio.create_task(self.flush_loop())
        async for message in self.consumer:
            reading = message.value.get("data")
            if reading:
                self.add_record(reading)

    def add_record(self, reading: dict[str, Any]) -> None:
        record_size = len(json.dumps(reading).encode("utf-8"))
        self.buffer.append(reading)
        self.buffer_bytes += record_size
        if self.buffer_bytes >= TARGET_BYTES:
            self.flush()

    def flush(self) -> None:
        if not self.buffer:
            return
        df = pl.DataFrame(self.buffer)
        df = df.with_columns(
            pl.col("ts").str.strptime(pl.Datetime, strict=False),
            pl.col("ts").dt.strftime(settings.lake_partition_date_format).alias("date"),
        )
        for tenant_id in df.select("tenant_id").unique().to_series():
            tenant_df = df.filter(pl.col("tenant_id") == tenant_id)
            bucket = settings.lake_bucket(str(tenant_id))
            prefix = settings.lake_prefix(str(tenant_id))
            ensure_bucket(settings, bucket)
            base_path = f"{bucket}/{prefix}raw"
            dataset = tenant_df.to_arrow()
            ds.write_dataset(
                dataset,
                base_path,
                filesystem=self.fs,
                format="parquet",
                partitioning=["client_id", "date"],
                existing_data_behavior="overwrite_or_ignore",
            )
        logger.info("Flushed data lake batch", extra={"records": len(self.buffer)})
        self.buffer = []
        self.buffer_bytes = 0

    async def flush_loop(self) -> None:
        while True:
            await asyncio.sleep(FLUSH_INTERVAL)
            if self.buffer:
                self.flush()


async def main() -> None:
    writer = LakeWriter()
    await writer.start()


if __name__ == "__main__":
    asyncio.run(main())
