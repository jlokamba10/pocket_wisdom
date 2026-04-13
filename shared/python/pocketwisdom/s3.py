from __future__ import annotations

import boto3
import pyarrow.fs as pafs

from .config import Settings


def get_s3_filesystem(settings: Settings) -> pafs.S3FileSystem:
    return pafs.S3FileSystem(
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        region=settings.s3_region,
        endpoint_override=settings.s3_endpoint_url,
        scheme="https" if settings.s3_use_ssl else "http",
    )


def ensure_bucket(settings: Settings, bucket_name: str) -> None:
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
    )
    existing = [bucket["Name"] for bucket in client.list_buckets().get("Buckets", [])]
    if bucket_name not in existing:
        client.create_bucket(Bucket=bucket_name)
