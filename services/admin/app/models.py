from __future__ import annotations

from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class TenantStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class UserRole(str, Enum):
    SYSTEM_ADMIN = "SYSTEM_ADMIN"
    CLIENT_ADMIN = "CLIENT_ADMIN"
    SUPERVISOR = "SUPERVISOR"
    ENGINEER = "ENGINEER"
    TECHNICIAN = "TECHNICIAN"


class ResourceStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class AlertStatus(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    CLEARED = "CLEARED"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False, default=TenantStatus.ACTIVE.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="tenant")
    sites = relationship("Site", back_populates="tenant")
    equipment = relationship("Equipment", back_populates="tenant")
    sensors = relationship("Sensor", back_populates="tenant")
    dashboards = relationship("DashboardAssignment", back_populates="tenant")
    alert_rules = relationship("AlertRule", back_populates="tenant")
    alert_events = relationship("AlertEvent", back_populates="tenant")

    __table_args__ = (UniqueConstraint("code", name="uq_tenants_code"),)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    email = Column(String(256), nullable=False)
    full_name = Column(String(128), nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(32), nullable=False)
    status = Column(String(16), nullable=False, default=UserStatus.ACTIVE.value)
    supervisor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="users")
    supervisor = relationship("User", remote_side=[id])
    created_alert_rules = relationship("AlertRule", back_populates="created_by")
    created_alert_events = relationship("AlertEvent", back_populates="cleared_by")

    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    location = Column(String(256), nullable=True)
    status = Column(String(16), nullable=False, default=ResourceStatus.ACTIVE.value)

    tenant = relationship("Tenant", back_populates="sites")
    equipment = relationship("Equipment", back_populates="site")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    supervisor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False)
    equipment_type = Column(String(64), nullable=False)
    serial_number = Column(String(64), nullable=True)
    status = Column(String(16), nullable=False, default=ResourceStatus.ACTIVE.value)
    criticality = Column(String(32), nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)

    tenant = relationship("Tenant", back_populates="equipment")
    site = relationship("Site", back_populates="equipment")
    supervisor = relationship("User")
    sensors = relationship("Sensor", back_populates="equipment")
    dashboards = relationship("DashboardAssignment", back_populates="equipment")
    alert_rules = relationship("AlertRule", back_populates="equipment")
    alert_events = relationship("AlertEvent", back_populates="equipment")


class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    sensor_type = Column(String(64), nullable=False)
    name = Column(String(128), nullable=False)
    external_sensor_id = Column(String(128), nullable=True, index=True)
    status = Column(String(16), nullable=False, default=ResourceStatus.ACTIVE.value)
    unit = Column(String(32), nullable=False)
    metadata_json = Column("metadata", JSON, nullable=True)

    tenant = relationship("Tenant", back_populates="sensors")
    equipment = relationship("Equipment", back_populates="sensors")
    alert_rules = relationship("AlertRule", back_populates="sensor")
    alert_events = relationship("AlertEvent", back_populates="sensor")


class DashboardTemplate(Base):
    __tablename__ = "dashboard_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    grafana_uid = Column(String(128), nullable=True)
    equipment_type = Column(String(64), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    assignments = relationship("DashboardAssignment", back_populates="template")

    __table_args__ = (UniqueConstraint("code", name="uq_dashboard_templates_code"),)


class DashboardAssignment(Base):
    __tablename__ = "dashboard_assignments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    supervisor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True, index=True)
    dashboard_template_id = Column(Integer, ForeignKey("dashboard_templates.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant", back_populates="dashboards")
    equipment = relationship("Equipment", back_populates="dashboards")
    template = relationship("DashboardTemplate", back_populates="assignments")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    supervisor = relationship("User", foreign_keys=[supervisor_user_id])


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=True, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    severity = Column(String(16), nullable=False)
    metric_name = Column(String(64), nullable=False)
    operator = Column(String(8), nullable=False)
    threshold_value = Column(Float, nullable=False)
    time_window_minutes = Column(Integer, nullable=True)
    status = Column(String(16), nullable=False, default=ResourceStatus.ACTIVE.value)
    webhook_url = Column(Text, nullable=True)
    email = Column(String(128), nullable=True)

    tenant = relationship("Tenant", back_populates="alert_rules")
    equipment = relationship("Equipment", back_populates="alert_rules")
    sensor = relationship("Sensor", back_populates="alert_rules")
    created_by = relationship("User", back_populates="created_alert_rules")


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=True, index=True)
    alert_rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=True, index=True)
    severity = Column(String(16), nullable=False)
    status = Column(String(16), nullable=False, default=AlertStatus.OPEN.value)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    cleared_at = Column(DateTime(timezone=True), nullable=True)
    cleared_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    clear_comment = Column(Text, nullable=True)

    tenant = relationship("Tenant", back_populates="alert_events")
    equipment = relationship("Equipment", back_populates="alert_events")
    sensor = relationship("Sensor", back_populates="alert_events")
    rule = relationship("AlertRule")
    cleared_by = relationship("User", back_populates="created_alert_events")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(64), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")
    user = relationship("User")


Index("ix_alert_rules_tenant_metric", AlertRule.tenant_id, AlertRule.metric_name)
Index("ix_equipment_tenant_site", Equipment.tenant_id, Equipment.site_id)
Index("ix_sensor_tenant_equipment", Sensor.tenant_id, Sensor.equipment_id)
