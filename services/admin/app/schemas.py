from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClientCreate(BaseModel):
    tenant_id: str
    name: str


class ClientOut(BaseModel):
    id: int
    tenant_id: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class MachineCreate(BaseModel):
    tenant_id: str
    client_id: int
    name: str
    location: Optional[str] = None


class MachineOut(BaseModel):
    id: int
    tenant_id: str
    client_id: int
    name: str
    location: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AlertRuleCreate(BaseModel):
    tenant_id: str
    name: str
    rule_type: str
    metric: str
    threshold: Optional[str] = None
    window_seconds: Optional[int] = None
    webhook_url: Optional[str] = None
    email: Optional[str] = None
    enabled: bool = True


class AlertRuleOut(BaseModel):
    id: int
    tenant_id: str
    name: str
    rule_type: str
    metric: str
    threshold: Optional[str]
    window_seconds: Optional[int]
    webhook_url: Optional[str]
    email: Optional[str]
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True
