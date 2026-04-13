from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    severity: str
    metric_name: str
    operator: str
    threshold_value: float
    time_window_minutes: Optional[int]
    webhook_url: Optional[str]
    email: Optional[str]
