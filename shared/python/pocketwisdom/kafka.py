import json
from typing import Iterable

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from .config import Settings


def create_producer(settings: Settings) -> AIOKafkaProducer:
    return AIOKafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap_servers,
        client_id=settings.kafka_client_id,
        security_protocol=settings.kafka_security_protocol,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda v: v.encode("utf-8") if v else None,
    )


def create_consumer(
    settings: Settings,
    topics: Iterable[str],
    group_id: str,
    auto_offset_reset: str | None = None,
) -> AIOKafkaConsumer:
    return AIOKafkaConsumer(
        *topics,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=group_id,
        client_id=settings.kafka_client_id,
        security_protocol=settings.kafka_security_protocol,
        auto_offset_reset=auto_offset_reset or settings.kafka_auto_offset_reset,
        enable_auto_commit=True,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        key_deserializer=lambda v: v.decode("utf-8") if v else None,
    )
