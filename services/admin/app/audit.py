from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLog


def log_audit(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str | int | None,
    tenant_id: int | None,
    user_id: int | None,
    details: dict[str, Any] | None = None,
) -> None:
    audit = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        details=details,
    )
    db.add(audit)
