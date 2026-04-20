from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class TenantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    status: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: Optional[int]
    email: str
    full_name: str
    role: str
    status: str
    supervisor_user_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    tenant: Optional[TenantSummary] = None


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Invalid email address")
        return normalized


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class MessageOut(BaseModel):
    status: str
    message: str


class AlertRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    equipment_id: int
    sensor_id: Optional[int]
    status: str
    severity: str
    metric_name: str
    operator: str
    threshold_value: float
    time_window_minutes: Optional[int]
    webhook_url: Optional[str]
    email: Optional[str]


class AlertRuleCreate(BaseModel):
    equipment_id: int
    sensor_id: Optional[int] = None
    severity: str = Field(min_length=2, max_length=16)
    metric_name: str = Field(min_length=2, max_length=64)
    operator: str = Field(min_length=1, max_length=8)
    threshold_value: float
    time_window_minutes: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = None
    webhook_url: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=128)


class AlertRuleUpdate(BaseModel):
    equipment_id: int
    sensor_id: Optional[int] = None
    severity: str = Field(min_length=2, max_length=16)
    metric_name: str = Field(min_length=2, max_length=64)
    operator: str = Field(min_length=1, max_length=8)
    threshold_value: float
    time_window_minutes: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = None
    webhook_url: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=128)


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    status: str
    created_at: datetime
    updated_at: datetime


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    code: str = Field(min_length=2, max_length=64)
    status: Optional[str] = None


class TenantUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    code: str = Field(min_length=2, max_length=64)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: str
    status: str


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=128)
    role: str
    tenant_id: Optional[int] = None
    supervisor_user_id: Optional[int] = None
    temporary_password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class UserAdminUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=128)
    role: str
    tenant_id: Optional[int] = None
    supervisor_user_id: Optional[int] = None


class UserClientUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=128)
    role: str
    supervisor_user_id: Optional[int] = None


class UserCreateResponse(BaseModel):
    user: UserOut
    temporary_password: str


class ResetPasswordResponse(BaseModel):
    status: str
    temporary_password: str


class PaginatedTenants(BaseModel):
    items: list[TenantOut]
    total: int
    limit: int
    offset: int


class PaginatedUsers(BaseModel):
    items: list[UserOut]
    total: int
    limit: int
    offset: int


class DashboardTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    description: Optional[str]
    grafana_uid: Optional[str]
    equipment_type: Optional[str]
    is_active: bool


class DashboardTemplateCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    code: str = Field(min_length=2, max_length=64)
    description: Optional[str] = None
    grafana_uid: Optional[str] = None
    equipment_type: Optional[str] = None
    is_active: bool = True


class DashboardTemplateUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    code: str = Field(min_length=2, max_length=64)
    description: Optional[str] = None
    grafana_uid: Optional[str] = None
    equipment_type: Optional[str] = None
    is_active: bool = True


class PaginatedDashboardTemplates(BaseModel):
    items: list[DashboardTemplateOut]
    total: int
    limit: int
    offset: int


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: Optional[int]
    user_id: Optional[int]
    action: str
    entity_type: str
    entity_id: Optional[str]
    details: Optional[dict]
    created_at: datetime
    tenant: Optional[TenantSummary] = None
    user: Optional[UserSummary] = None


class PaginatedAuditLogs(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    name: str
    location: Optional[str]
    status: str


class SiteCreate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    location: Optional[str] = Field(default=None, max_length=256)


class SiteUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    location: Optional[str] = Field(default=None, max_length=256)


class PaginatedSites(BaseModel):
    items: list[SiteOut]
    total: int
    limit: int
    offset: int


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    site_id: int
    supervisor_user_id: Optional[int]
    name: str
    equipment_type: str
    serial_number: Optional[str]
    status: str
    criticality: Optional[str]
    metadata_json: Optional[dict] = None
    site: Optional[SiteOut] = None
    supervisor: Optional[UserSummary] = None


class EquipmentCreate(BaseModel):
    site_id: int
    supervisor_user_id: Optional[int] = None
    name: str = Field(min_length=2, max_length=128)
    equipment_type: str = Field(min_length=2, max_length=64)
    serial_number: Optional[str] = Field(default=None, max_length=64)
    status: Optional[str] = None
    criticality: Optional[str] = Field(default=None, max_length=32)
    metadata_json: Optional[dict] = None


class EquipmentUpdate(BaseModel):
    site_id: int
    supervisor_user_id: Optional[int] = None
    name: str = Field(min_length=2, max_length=128)
    equipment_type: str = Field(min_length=2, max_length=64)
    serial_number: Optional[str] = Field(default=None, max_length=64)
    status: Optional[str] = None
    criticality: Optional[str] = Field(default=None, max_length=32)
    metadata_json: Optional[dict] = None


class PaginatedEquipment(BaseModel):
    items: list[EquipmentOut]
    total: int
    limit: int
    offset: int


class SensorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    equipment_id: int
    sensor_type: str
    name: str
    external_sensor_id: Optional[str]
    status: str
    unit: str
    metadata_json: Optional[dict]
    equipment: Optional[EquipmentOut] = None


class SensorCreate(BaseModel):
    equipment_id: int
    sensor_type: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=128)
    external_sensor_id: Optional[str] = Field(default=None, max_length=128)
    status: Optional[str] = None
    unit: str = Field(min_length=1, max_length=32)
    metadata_json: Optional[dict] = None


class SensorUpdate(BaseModel):
    equipment_id: int
    sensor_type: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=128)
    external_sensor_id: Optional[str] = Field(default=None, max_length=128)
    status: Optional[str] = None
    unit: str = Field(min_length=1, max_length=32)
    metadata_json: Optional[dict] = None


class PaginatedSensors(BaseModel):
    items: list[SensorOut]
    total: int
    limit: int
    offset: int


class DashboardAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    supervisor_user_id: Optional[int]
    equipment_id: Optional[int]
    dashboard_template_id: int
    created_by_user_id: int
    created_at: datetime
    template: DashboardTemplateOut
    equipment: Optional[EquipmentOut] = None
    supervisor: Optional[UserSummary] = None
    created_by: Optional[UserSummary] = None
    tenant: Optional[TenantSummary] = None


class PaginatedDashboardAssignments(BaseModel):
    items: list[DashboardAssignmentOut]
    total: int
    limit: int
    offset: int


class DashboardAssignmentCreate(BaseModel):
    dashboard_template_id: int
    equipment_id: Optional[int] = None


class AlertEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    equipment_id: int
    sensor_id: Optional[int]
    alert_rule_id: Optional[int]
    severity: str
    status: str
    triggered_at: datetime
    cleared_at: Optional[datetime]
    cleared_by_user_id: Optional[int]
    clear_comment: Optional[str]
    equipment: Optional[EquipmentOut] = None
    sensor: Optional[SensorOut] = None
    cleared_by: Optional[UserSummary] = None


class AlertClearRequest(BaseModel):
    clear_comment: Optional[str] = Field(default=None, max_length=512)


class AlertBulkClearRequest(BaseModel):
    alert_ids: list[int] = Field(min_length=1, max_length=100)
    clear_comment: Optional[str] = Field(default=None, max_length=512)


class PaginatedAlertEvents(BaseModel):
    items: list[AlertEventOut]
    total: int
    limit: int
    offset: int


class PaginatedAlertRules(BaseModel):
    items: list[AlertRuleOut]
    total: int
    limit: int
    offset: int


class TenantDetail(BaseModel):
    tenant: TenantOut
    active_users: int
    inactive_users: int
    equipment_count: int
    sensor_count: int
    open_alerts: int
    client_admins: list[UserSummary]
    recent_activity: list[AuditLogOut]
