# PocketWisdom

PocketWisdom is a production-grade, multi-tenant IIoT condition monitoring platform for high-volume time-series sensor data. It supports local development with Docker Compose, on-prem deployments (Kubernetes/OpenShift ready), and cloud migration (AWS).

## Architecture

```mermaid
flowchart LR
  subgraph Edge[Edge Devices]
    A[MQTT Sensors]
  end

  subgraph Ingestion[Ingestion Layer]
    B[MQTT Broker]
    C[Ingestion Service]
  end

  subgraph Stream[Event Streaming]
    D[Kafka / Redpanda]
  end

  subgraph Storage[Storage]
    E[InfluxDB Raw]
    F[Data Lake (MinIO or S3)]
  end

  subgraph Processing[Processing Jobs]
    G[Rollups + Enrichment]
    H[InfluxDB Aggregates]
    I[Parquet Analytics]
  end

  subgraph Alerts[Alerting]
    J[Alert Engine]
    K[Webhook / Email]
  end

  subgraph Admin[Admin + UI]
    L[Admin API]
    M[React UI]
    N[Grafana]
  end

  A --> B --> C --> D
  C --> E
  D --> F
  D --> G --> H
  G --> I
  D --> J --> K
  L --> J
  L --> M
  E --> N
  H --> N
  D --> N
```

## Project Structure

- `C:\Users\jylok\source\repos\pocket_wisdom\services\ingestion`
- `C:\Users\jylok\source\repos\pocket_wisdom\services\alerts`
- `C:\Users\jylok\source\repos\pocket_wisdom\services\admin`
- `C:\Users\jylok\source\repos\pocket_wisdom\jobs\rollups`
- `C:\Users\jylok\source\repos\pocket_wisdom\frontend`
- `C:\Users\jylok\source\repos\pocket_wisdom\infra\docker`
- `C:\Users\jylok\source\repos\pocket_wisdom\scripts`
- `C:\Users\jylok\source\repos\pocket_wisdom\samples`

## Local Development (Docker Compose)

```bash
cd C:\Users\jylok\source\repos\pocket_wisdom\infra\docker

docker compose up --build
```

Services:
- MQTT: `localhost:1883`
- Redpanda (Kafka): `localhost:9092`
- InfluxDB: `localhost:8086`
- MinIO: `localhost:9000`
- Grafana: `localhost:3000`
- PostgreSQL: `localhost:5432`
- Admin API: `localhost:8002`
- React UI: `localhost:5173`

Run migrations + seed data (Docker):

```bash
docker compose exec admin alembic -c /app/alembic.ini upgrade head
docker compose exec admin python -m app.seed
```

## Ingestion Service

- Subscribes to `tenants/+/clients/+/machines/+/sensors/+`
- Validates payloads via Pydantic
- Enriches with tenant, client, machine, sensor metadata
- Publishes to Kafka topic `sensor-data`
- Writes raw readings to InfluxDB bucket per tenant

## Data Lake Layout

- Raw data stored as Parquet
- Partitioned by `client_id` and date (`YYYY/MM/DD`)
- Bucket isolation per tenant (configurable with prefixes)
- Target file size: 100MB to 300MB (configurable)

## Rollups

- Computes `avg`, `min`, `max`, `stddev`, `count`
- Intervals: 1m, 5m, 1h, 1d
- Writes to InfluxDB aggregates and Parquet analytics layer

## Alert Engine

- Rule types: `threshold`, `window`
- Triggers via webhook or mock email
- Dedupe window prevents alert storms

## Admin API

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/change-password`
- `GET /users/me`
- `PATCH /users/me`
- `GET /alerts` (internal service token)
- `GET /summary/system-admin`
- `GET /summary/client-admin`
- `GET /clients`
- `POST /clients`
- `GET /clients/:id`
- `PUT /clients/:id`
- `POST /clients/:id/activate`
- `POST /clients/:id/inactivate`
- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PUT /users/:id`
- `POST /users/:id/activate`
- `POST /users/:id/inactivate`
- `POST /users/:id/reset-password`
- `GET /dashboard-templates`
- `POST /dashboard-templates`
- `PUT /dashboard-templates/:id`
- `GET /audit`
- `GET /client/users`
- `POST /client/users`
- `PUT /client/users/:id`
- `POST /client/users/:id/activate`
- `POST /client/users/:id/inactivate`
- `GET /client/sites`
- `POST /client/sites`
- `PUT /client/sites/:id`
- `POST /client/sites/:id/activate`
- `POST /client/sites/:id/inactivate`
- `GET /client/equipment`
- `POST /client/equipment`
- `PUT /client/equipment/:id`
- `POST /client/equipment/:id/activate`
- `POST /client/equipment/:id/inactivate`
- `GET /client/sensors`
- `POST /client/sensors`
- `PUT /client/sensors/:id`
- `POST /client/sensors/:id/activate`
- `POST /client/sensors/:id/inactivate`
- `GET /client/alerts`
- `GET /client/dashboards`
- `GET /metrics`
- `GET /health`

## Authentication + RBAC

- JWT bearer authentication with bcrypt password hashing.
- Role-based access control enforced via centralized dependencies.
- Internal service-to-service access uses `PW_INTERNAL_API_TOKEN` (sent as `X-Internal-Token`).

## Database, Migrations, Seeding

Local (without Docker) example:

```bash
cd C:\Users\jylok\source\repos\pocket_wisdom\services\admin

python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

set PW_DATABASE_URL=postgresql+psycopg://pw_admin:pw_admin@localhost:5432/pocketwisdom
set PYTHONPATH=C:\Users\jylok\source\repos\pocket_wisdom\shared\python

alembic -c alembic.ini upgrade head
python -m app.seed
```

Seeded demo users (all use `Admin123!`):

- SYSTEM_ADMIN: `sysadmin@pocketwisdom.local`
- CLIENT_ADMIN: `clientadmin@demo.local`
- SUPERVISOR: `supervisor@demo.local`
- ENGINEER: `engineer@demo.local`
- TECHNICIAN: `technician@demo.local`

## Observability

- Prometheus metrics for ingestion, admin, and alerts
- Loki + Promtail for centralized logs
- Grafana pre-configured datasources for Prometheus, InfluxDB, Loki

## Testing and Simulation

Install simulator dependencies:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r C:\Users\jylok\source\repos\pocket_wisdom\scripts\requirements.txt
```

Run sensor simulator:

```bash
python C:\Users\jylok\source\repos\pocket_wisdom\scripts\simulate_sensors.py --host localhost --tenant demo --client client-001
```

Run load test:

```bash
python C:\Users\jylok\source\repos\pocket_wisdom\scripts\load_test.py --host localhost --workers 20 --rate 100 --duration 120
```

Sample payloads are in `C:\Users\jylok\source\repos\pocket_wisdom\samples\sensor_payload.json`.

## Cloud Migration Guide (Local to AWS)

All components use environment variables so you can swap local services for managed cloud services:

- MQTT: set `PW_MQTT_HOST` to AWS IoT Core endpoint and configure TLS in the ingestion service container.
- Kafka: set `PW_KAFKA_BOOTSTRAP_SERVERS` to AWS MSK brokers and update security protocol.
- Data Lake: set `PW_S3_ENDPOINT_URL` to the AWS S3 endpoint and provide IAM credentials.
- InfluxDB: point `PW_INFLUX_URL` to InfluxDB Cloud or a managed timeseries store.

Recommended migration flow:

1. Deploy admin, ingestion, alerts, rollups to Kubernetes/OpenShift with the same environment variables.
2. Switch MinIO endpoint to S3 by updating `PW_S3_ENDPOINT_URL` and IAM credentials.
3. Point Kafka clients to AWS MSK brokers and enable TLS/SASL.
4. Replace Mosquitto with AWS IoT Core by updating MQTT host and certificate config.
5. Validate rollups and alerts using Grafana dashboards.

## Data Engineering Best Practices

- Idempotency: deterministic `event_id` for each reading to avoid duplicates.
- Replayability: Kafka topic supports `auto_offset_reset` for reprocessing.
- Partitioning: Parquet datasets partitioned by `client_id` and date.
- Observability: metrics and logs exported to Prometheus and Loki.

## Environment Variables (Common)

- `PW_MQTT_HOST`, `PW_MQTT_PORT`, `PW_MQTT_TOPIC`
- `PW_KAFKA_BOOTSTRAP_SERVERS`, `PW_KAFKA_TOPIC`
- `PW_INFLUX_URL`, `PW_INFLUX_TOKEN`, `PW_INFLUX_ORG`
- `PW_S3_ENDPOINT_URL`, `PW_S3_ACCESS_KEY`, `PW_S3_SECRET_KEY`
- `PW_LAKE_BUCKET_MODE`, `PW_LAKE_BUCKET_PREFIX`
- `PW_DATABASE_URL`
- `PW_JWT_SECRET_KEY`, `PW_JWT_ACCESS_TOKEN_MINUTES`
- `PW_INTERNAL_API_TOKEN`
- `PW_CORS_ORIGINS`

## Notes

- InfluxDB buckets are created per tenant (`tenant_<id>_raw` and `tenant_<id>_agg`).
- Data lake buckets are created per tenant by default (`tenant-<id>`).
- For Kubernetes, containerize each service and reuse the same env config used in Docker Compose.
