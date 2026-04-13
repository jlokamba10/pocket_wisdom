from __future__ import annotations

from datetime import datetime, timezone

from .auth import hash_password
from .database import SessionLocal
from .models import (
    AlertEvent,
    AlertRule,
    AlertStatus,
    AuditLog,
    DashboardAssignment,
    DashboardTemplate,
    Equipment,
    ResourceStatus,
    Sensor,
    Site,
    Tenant,
    TenantStatus,
    User,
    UserRole,
    UserStatus,
)

def get_or_create(db, model, defaults=None, **kwargs):
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        return instance
    params = dict(defaults or {})
    params.update(kwargs)
    instance = model(**params)
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return instance


def seed() -> None:
    db = SessionLocal()
    try:
        tenant = get_or_create(
            db,
            Tenant,
            code="DEMO",
            defaults={"name": "Demo Industrial Client", "status": TenantStatus.ACTIVE.value},
        )

        sysadmin = get_or_create(
            db,
            User,
            email="sysadmin@pocketwisdom.local",
            defaults={
                "full_name": "System Admin",
                "password_hash": hash_password("Admin123!"),
                "role": UserRole.SYSTEM_ADMIN.value,
                "status": UserStatus.ACTIVE.value,
                "tenant_id": None,
            },
        )

        client_admin = get_or_create(
            db,
            User,
            email="clientadmin@demo.local",
            defaults={
                "full_name": "Client Admin",
                "password_hash": hash_password("Admin123!"),
                "role": UserRole.CLIENT_ADMIN.value,
                "status": UserStatus.ACTIVE.value,
                "tenant_id": tenant.id,
            },
        )

        supervisor = get_or_create(
            db,
            User,
            email="supervisor@demo.local",
            defaults={
                "full_name": "Supervisor",
                "password_hash": hash_password("Admin123!"),
                "role": UserRole.SUPERVISOR.value,
                "status": UserStatus.ACTIVE.value,
                "tenant_id": tenant.id,
            },
        )

        engineer = get_or_create(
            db,
            User,
            email="engineer@demo.local",
            defaults={
                "full_name": "Reliability Engineer",
                "password_hash": hash_password("Admin123!"),
                "role": UserRole.ENGINEER.value,
                "status": UserStatus.ACTIVE.value,
                "tenant_id": tenant.id,
                "supervisor_user_id": supervisor.id,
            },
        )

        technician = get_or_create(
            db,
            User,
            email="technician@demo.local",
            defaults={
                "full_name": "Field Technician",
                "password_hash": hash_password("Admin123!"),
                "role": UserRole.TECHNICIAN.value,
                "status": UserStatus.ACTIVE.value,
                "tenant_id": tenant.id,
                "supervisor_user_id": supervisor.id,
            },
        )

        site_alpha = get_or_create(
            db,
            Site,
            tenant_id=tenant.id,
            name="Demo Plant Alpha",
            defaults={"location": "Johannesburg, ZA", "status": ResourceStatus.ACTIVE.value},
        )
        site_beta = get_or_create(
            db,
            Site,
            tenant_id=tenant.id,
            name="Demo Plant Beta",
            defaults={"location": "Cape Town, ZA", "status": ResourceStatus.ACTIVE.value},
        )
        site_gamma = get_or_create(
            db,
            Site,
            tenant_id=tenant.id,
            name="Demo Logistics Hub",
            defaults={"location": "Durban, ZA", "status": ResourceStatus.ACTIVE.value},
        )

        compressor = get_or_create(
            db,
            Equipment,
            tenant_id=tenant.id,
            name="Compressor Line 1",
            defaults={
                "site_id": site_alpha.id,
                "supervisor_user_id": supervisor.id,
                "equipment_type": "COMPRESSOR",
                "serial_number": "CMP-ALPHA-001",
                "status": ResourceStatus.ACTIVE.value,
                "criticality": "HIGH",
                "metadata_json": {"oem": "AtlasCo", "install_year": 2021},
            },
        )

        pump = get_or_create(
            db,
            Equipment,
            tenant_id=tenant.id,
            name="Booster Pump B2",
            defaults={
                "site_id": site_beta.id,
                "supervisor_user_id": supervisor.id,
                "equipment_type": "PUMP",
                "serial_number": "PUMP-BETA-204",
                "status": ResourceStatus.ACTIVE.value,
                "criticality": "MEDIUM",
                "metadata_json": {"oem": "FlowWorks", "install_year": 2019},
            },
        )

        conveyor = get_or_create(
            db,
            Equipment,
            tenant_id=tenant.id,
            name="Conveyor West",
            defaults={
                "site_id": site_gamma.id,
                "supervisor_user_id": supervisor.id,
                "equipment_type": "CONVEYOR",
                "serial_number": "CNV-GAMMA-77",
                "status": ResourceStatus.ACTIVE.value,
                "criticality": "CRITICAL",
                "metadata_json": {"oem": "MotionPro", "install_year": 2020},
            },
        )

        sensor_vib = get_or_create(
            db,
            Sensor,
            tenant_id=tenant.id,
            name="Compressor Vibration RMS",
            defaults={
                "equipment_id": compressor.id,
                "sensor_type": "VIBRATION",
                "external_sensor_id": "SENS-ALPHA-001",
                "status": ResourceStatus.ACTIVE.value,
                "unit": "mm/s",
                "metadata_json": {"axis": "X"},
            },
        )

        sensor_temp = get_or_create(
            db,
            Sensor,
            tenant_id=tenant.id,
            name="Pump Motor Temp",
            defaults={
                "equipment_id": pump.id,
                "sensor_type": "TEMPERATURE",
                "external_sensor_id": "SENS-BETA-002",
                "status": ResourceStatus.ACTIVE.value,
                "unit": "C",
                "metadata_json": {"location": "motor"},
            },
        )

        sensor_pressure = get_or_create(
            db,
            Sensor,
            tenant_id=tenant.id,
            name="Pump Discharge Pressure",
            defaults={
                "equipment_id": pump.id,
                "sensor_type": "PRESSURE",
                "external_sensor_id": "SENS-BETA-009",
                "status": ResourceStatus.ACTIVE.value,
                "unit": "bar",
                "metadata_json": {"range": "0-16"},
            },
        )

        sensor_speed = get_or_create(
            db,
            Sensor,
            tenant_id=tenant.id,
            name="Conveyor Speed",
            defaults={
                "equipment_id": conveyor.id,
                "sensor_type": "SPEED",
                "external_sensor_id": "SENS-GAMMA-004",
                "status": ResourceStatus.ACTIVE.value,
                "unit": "m/s",
                "metadata_json": {"belt": "west"},
            },
        )

        template_overview = get_or_create(
            db,
            DashboardTemplate,
            code="FLEET_OVERVIEW",
            defaults={
                "name": "Fleet Overview",
                "description": "Fleet health KPIs and alert posture.",
                "grafana_uid": "fleet-overview",
                "equipment_type": None,
                "is_active": True,
            },
        )
        template_compressor = get_or_create(
            db,
            DashboardTemplate,
            code="COMPRESSOR_HEALTH",
            defaults={
                "name": "Compressor Health",
                "description": "Compressor vibration and temperature trends.",
                "grafana_uid": "compressor-health",
                "equipment_type": "COMPRESSOR",
                "is_active": True,
            },
        )

        get_or_create(
            db,
            DashboardAssignment,
            tenant_id=tenant.id,
            dashboard_template_id=template_overview.id,
            created_by_user_id=client_admin.id,
            defaults={"equipment_id": None, "supervisor_user_id": None},
        )
        get_or_create(
            db,
            DashboardAssignment,
            tenant_id=tenant.id,
            dashboard_template_id=template_compressor.id,
            equipment_id=compressor.id,
            created_by_user_id=supervisor.id,
            defaults={"supervisor_user_id": supervisor.id},
        )

        rule_vibration = get_or_create(
            db,
            AlertRule,
            tenant_id=tenant.id,
            equipment_id=compressor.id,
            sensor_id=sensor_vib.id,
            created_by_user_id=supervisor.id,
            defaults={
                "severity": "HIGH",
                "metric_name": "vibration_rms",
                "operator": ">",
                "threshold_value": 8.5,
                "time_window_minutes": 5,
                "status": ResourceStatus.ACTIVE.value,
                "webhook_url": None,
                "email": "alerts@demo.local",
            },
        )

        rule_temp = get_or_create(
            db,
            AlertRule,
            tenant_id=tenant.id,
            equipment_id=pump.id,
            sensor_id=sensor_temp.id,
            created_by_user_id=engineer.id,
            defaults={
                "severity": "MEDIUM",
                "metric_name": "motor_temp",
                "operator": ">",
                "threshold_value": 82.0,
                "time_window_minutes": None,
                "status": ResourceStatus.ACTIVE.value,
                "webhook_url": None,
                "email": "alerts@demo.local",
            },
        )

        get_or_create(
            db,
            AlertEvent,
            tenant_id=tenant.id,
            equipment_id=compressor.id,
            sensor_id=sensor_vib.id,
            alert_rule_id=rule_vibration.id,
            defaults={
                "severity": "HIGH",
                "status": AlertStatus.OPEN.value,
                "triggered_at": datetime.now(timezone.utc),
                "cleared_at": None,
                "cleared_by_user_id": None,
                "clear_comment": None,
            },
        )

        get_or_create(
            db,
            AlertEvent,
            tenant_id=tenant.id,
            equipment_id=pump.id,
            sensor_id=sensor_temp.id,
            alert_rule_id=rule_temp.id,
            defaults={
                "severity": "MEDIUM",
                "status": AlertStatus.ACKNOWLEDGED.value,
                "triggered_at": datetime.now(timezone.utc),
                "cleared_at": None,
                "cleared_by_user_id": supervisor.id,
                "clear_comment": "Investigating elevated motor temp.",
            },
        )

        get_or_create(
            db,
            AuditLog,
            tenant_id=tenant.id,
            user_id=sysadmin.id,
            action="seed",
            entity_type="system",
            entity_id="bootstrap",
            defaults={"details": {"note": "Initial seed data created"}},
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
