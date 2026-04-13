from prometheus_client import Counter, Histogram, Gauge


class ServiceMetrics:
    def __init__(self, service_name: str) -> None:
        self.messages_total = Counter(
            "pw_messages_total",
            "Total messages processed",
            ["service", "status"],
        )
        self.kafka_published_total = Counter(
            "pw_kafka_published_total",
            "Total Kafka publish attempts",
            ["service", "status"],
        )
        self.influx_writes_total = Counter(
            "pw_influx_writes_total",
            "Total InfluxDB writes",
            ["service", "status"],
        )
        self.processing_latency_seconds = Histogram(
            "pw_processing_latency_seconds",
            "Processing latency in seconds",
            ["service"],
        )
        self.active_rules = Gauge(
            "pw_active_alert_rules",
            "Active alert rules",
            ["service"],
        )
        self.service_name = service_name

    def mark_message(self, status: str) -> None:
        self.messages_total.labels(self.service_name, status).inc()

    def mark_kafka(self, status: str) -> None:
        self.kafka_published_total.labels(self.service_name, status).inc()

    def mark_influx(self, status: str) -> None:
        self.influx_writes_total.labels(self.service_name, status).inc()
