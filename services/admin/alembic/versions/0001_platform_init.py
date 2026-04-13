"""Platform foundation tables.

Revision ID: 0001_platform_init
Revises:
Create Date: 2026-04-13 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_platform_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_tenants_code"),
    )
    op.create_index("ix_tenants_id", "tenants", ["id"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("email", sa.String(length=256), nullable=False),
        sa.Column("full_name", sa.String(length=128), nullable=False),
        sa.Column("password_hash", sa.String(length=256), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("supervisor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"])
    op.create_index("ix_users_supervisor_user_id", "users", ["supervisor_user_id"])

    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("location", sa.String(length=256), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
    )
    op.create_index("ix_sites_id", "sites", ["id"])
    op.create_index("ix_sites_tenant_id", "sites", ["tenant_id"])

    op.create_table(
        "equipment",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("supervisor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("equipment_type", sa.String(length=64), nullable=False),
        sa.Column("serial_number", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("criticality", sa.String(length=32), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
    )
    op.create_index("ix_equipment_id", "equipment", ["id"])
    op.create_index("ix_equipment_tenant_id", "equipment", ["tenant_id"])
    op.create_index("ix_equipment_site_id", "equipment", ["site_id"])
    op.create_index("ix_equipment_supervisor_user_id", "equipment", ["supervisor_user_id"])
    op.create_index("ix_equipment_tenant_site", "equipment", ["tenant_id", "site_id"])

    op.create_table(
        "sensors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id"), nullable=False),
        sa.Column("sensor_type", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("external_sensor_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
    )
    op.create_index("ix_sensors_id", "sensors", ["id"])
    op.create_index("ix_sensors_tenant_id", "sensors", ["tenant_id"])
    op.create_index("ix_sensors_equipment_id", "sensors", ["equipment_id"])
    op.create_index("ix_sensors_external_sensor_id", "sensors", ["external_sensor_id"])
    op.create_index("ix_sensor_tenant_equipment", "sensors", ["tenant_id", "equipment_id"])

    op.create_table(
        "dashboard_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("grafana_uid", sa.String(length=128), nullable=True),
        sa.Column("equipment_type", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("code", name="uq_dashboard_templates_code"),
    )
    op.create_index("ix_dashboard_templates_id", "dashboard_templates", ["id"])

    op.create_table(
        "dashboard_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("supervisor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id"), nullable=True),
        sa.Column("dashboard_template_id", sa.Integer(), sa.ForeignKey("dashboard_templates.id"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_dashboard_assignments_id", "dashboard_assignments", ["id"])
    op.create_index("ix_dashboard_assignments_tenant_id", "dashboard_assignments", ["tenant_id"])
    op.create_index("ix_dashboard_assignments_supervisor_user_id", "dashboard_assignments", ["supervisor_user_id"])
    op.create_index("ix_dashboard_assignments_equipment_id", "dashboard_assignments", ["equipment_id"])
    op.create_index("ix_dashboard_assignments_dashboard_template_id", "dashboard_assignments", ["dashboard_template_id"])
    op.create_index("ix_dashboard_assignments_created_by_user_id", "dashboard_assignments", ["created_by_user_id"])

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id"), nullable=False),
        sa.Column("sensor_id", sa.Integer(), sa.ForeignKey("sensors.id"), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("metric_name", sa.String(length=64), nullable=False),
        sa.Column("operator", sa.String(length=8), nullable=False),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("time_window_minutes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("webhook_url", sa.Text(), nullable=True),
        sa.Column("email", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_alert_rules_id", "alert_rules", ["id"])
    op.create_index("ix_alert_rules_tenant_id", "alert_rules", ["tenant_id"])
    op.create_index("ix_alert_rules_equipment_id", "alert_rules", ["equipment_id"])
    op.create_index("ix_alert_rules_sensor_id", "alert_rules", ["sensor_id"])
    op.create_index("ix_alert_rules_created_by_user_id", "alert_rules", ["created_by_user_id"])
    op.create_index("ix_alert_rules_tenant_metric", "alert_rules", ["tenant_id", "metric_name"])

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("equipment_id", sa.Integer(), sa.ForeignKey("equipment.id"), nullable=False),
        sa.Column("sensor_id", sa.Integer(), sa.ForeignKey("sensors.id"), nullable=True),
        sa.Column("alert_rule_id", sa.Integer(), sa.ForeignKey("alert_rules.id"), nullable=True),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cleared_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("clear_comment", sa.Text(), nullable=True),
    )
    op.create_index("ix_alert_events_id", "alert_events", ["id"])
    op.create_index("ix_alert_events_tenant_id", "alert_events", ["tenant_id"])
    op.create_index("ix_alert_events_equipment_id", "alert_events", ["equipment_id"])
    op.create_index("ix_alert_events_sensor_id", "alert_events", ["sensor_id"])
    op.create_index("ix_alert_events_alert_rule_id", "alert_events", ["alert_rule_id"])
    op.create_index("ix_alert_events_cleared_by_user_id", "alert_events", ["cleared_by_user_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_tenant_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_alert_events_cleared_by_user_id", table_name="alert_events")
    op.drop_index("ix_alert_events_alert_rule_id", table_name="alert_events")
    op.drop_index("ix_alert_events_sensor_id", table_name="alert_events")
    op.drop_index("ix_alert_events_equipment_id", table_name="alert_events")
    op.drop_index("ix_alert_events_tenant_id", table_name="alert_events")
    op.drop_index("ix_alert_events_id", table_name="alert_events")
    op.drop_table("alert_events")

    op.drop_index("ix_alert_rules_tenant_metric", table_name="alert_rules")
    op.drop_index("ix_alert_rules_created_by_user_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_sensor_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_equipment_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_tenant_id", table_name="alert_rules")
    op.drop_index("ix_alert_rules_id", table_name="alert_rules")
    op.drop_table("alert_rules")

    op.drop_index("ix_dashboard_assignments_created_by_user_id", table_name="dashboard_assignments")
    op.drop_index("ix_dashboard_assignments_dashboard_template_id", table_name="dashboard_assignments")
    op.drop_index("ix_dashboard_assignments_equipment_id", table_name="dashboard_assignments")
    op.drop_index("ix_dashboard_assignments_supervisor_user_id", table_name="dashboard_assignments")
    op.drop_index("ix_dashboard_assignments_tenant_id", table_name="dashboard_assignments")
    op.drop_index("ix_dashboard_assignments_id", table_name="dashboard_assignments")
    op.drop_table("dashboard_assignments")

    op.drop_index("ix_dashboard_templates_id", table_name="dashboard_templates")
    op.drop_table("dashboard_templates")

    op.drop_index("ix_sensor_tenant_equipment", table_name="sensors")
    op.drop_index("ix_sensors_external_sensor_id", table_name="sensors")
    op.drop_index("ix_sensors_equipment_id", table_name="sensors")
    op.drop_index("ix_sensors_tenant_id", table_name="sensors")
    op.drop_index("ix_sensors_id", table_name="sensors")
    op.drop_table("sensors")

    op.drop_index("ix_equipment_tenant_site", table_name="equipment")
    op.drop_index("ix_equipment_supervisor_user_id", table_name="equipment")
    op.drop_index("ix_equipment_site_id", table_name="equipment")
    op.drop_index("ix_equipment_tenant_id", table_name="equipment")
    op.drop_index("ix_equipment_id", table_name="equipment")
    op.drop_table("equipment")

    op.drop_index("ix_sites_tenant_id", table_name="sites")
    op.drop_index("ix_sites_id", table_name="sites")
    op.drop_table("sites")

    op.drop_index("ix_users_supervisor_user_id", table_name="users")
    op.drop_index("ix_users_tenant_id", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_tenants_id", table_name="tenants")
    op.drop_table("tenants")
