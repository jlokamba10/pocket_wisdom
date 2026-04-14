from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..audit import log_audit
from ..deps import get_db, require_roles
from ..models import (
    AlertEvent,
    AlertRule,
    AlertStatus,
    DashboardAssignment,
    DashboardTemplate,
    Equipment,
    ResourceStatus,
    Sensor,
    Site,
    User,
    UserRole,
)
from ..schemas import (
    AlertClearRequest,
    AlertEventOut,
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    DashboardAssignmentCreate,
    DashboardAssignmentOut,
    EquipmentCreate,
    EquipmentOut,
    EquipmentUpdate,
    MessageOut,
    PaginatedAlertEvents,
    PaginatedAlertRules,
    PaginatedDashboardAssignments,
    PaginatedEquipment,
    PaginatedSensors,
    SensorCreate,
    SensorOut,
    SensorUpdate,
)

router = APIRouter(tags=["operations"])

OPS_ROLES = {
    UserRole.SUPERVISOR.value,
    UserRole.ENGINEER.value,
    UserRole.TECHNICIAN.value,
}


def _paginate(query, limit: int, offset: int):
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return total, items


def _require_tenant(user: User) -> int:
    if user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access required")
    return user.tenant_id


def _resolve_supervisor_scope(user: User) -> int:
    if user.role == UserRole.SUPERVISOR.value:
        return user.id
    if user.role in {UserRole.ENGINEER.value, UserRole.TECHNICIAN.value}:
        if not user.supervisor_user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor assignment required")
        return user.supervisor_user_id
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operations access required")


@router.get("/summary/supervisor")
def supervisor_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> dict[str, Any]:
    tenant_id = _require_tenant(current_user)
    supervisor_id = current_user.id

    equipment_query = db.query(Equipment).filter(
        Equipment.tenant_id == tenant_id,
        Equipment.supervisor_user_id == supervisor_id,
    )
    equipment_count = equipment_query.count()

    active_sensors = (
        db.query(Sensor)
        .join(Equipment, Sensor.equipment_id == Equipment.id)
        .filter(
            Sensor.tenant_id == tenant_id,
            Sensor.status == ResourceStatus.ACTIVE.value,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    open_alerts = (
        db.query(AlertEvent)
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.status == AlertStatus.OPEN.value,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    now = datetime.now(timezone.utc)
    yesterday_date = (now - timedelta(days=1)).date()
    start_yesterday = datetime.combine(yesterday_date, datetime.min.time(), tzinfo=timezone.utc)
    end_yesterday = start_yesterday + timedelta(days=1)

    cleared_yesterday = (
        db.query(AlertEvent)
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.cleared_at.is_not(None),
            AlertEvent.cleared_at >= start_yesterday,
            AlertEvent.cleared_at < end_yesterday,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    start_range = (now - timedelta(days=6)).date()
    start_series = datetime.combine(start_range, datetime.min.time(), tzinfo=timezone.utc)
    date_counts = dict(
        db.query(func.date(AlertEvent.cleared_at), func.count(AlertEvent.id))
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.cleared_at.is_not(None),
            AlertEvent.cleared_at >= start_series,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .group_by(func.date(AlertEvent.cleared_at))
        .all()
    )
    cleared_series = []
    for i in range(7):
        day = start_range + timedelta(days=i)
        cleared_series.append({"date": day.isoformat(), "count": date_counts.get(day, 0)})

    team_members = (
        db.query(User)
        .filter(
            User.tenant_id == tenant_id,
            User.supervisor_user_id == supervisor_id,
            User.role.in_([UserRole.ENGINEER.value, UserRole.TECHNICIAN.value]),
        )
        .order_by(User.full_name.asc())
        .all()
    )

    dashboard_assignments = (
        db.query(DashboardAssignment)
        .outerjoin(Equipment, DashboardAssignment.equipment_id == Equipment.id)
        .filter(
            DashboardAssignment.tenant_id == tenant_id,
            or_(
                DashboardAssignment.supervisor_user_id == supervisor_id,
                DashboardAssignment.supervisor_user_id.is_(None),
                Equipment.supervisor_user_id == supervisor_id,
            ),
        )
        .count()
    )

    return {
        "counts": {
            "equipment": equipment_count,
            "active_sensors": active_sensors,
            "open_alerts": open_alerts,
            "team_members": len(team_members),
            "dashboard_assignments": dashboard_assignments,
        },
        "alerts_cleared_yesterday": cleared_yesterday,
        "alerts_cleared_last_7_days": cleared_series,
        "team": [
            {"id": member.id, "name": member.full_name, "role": member.role, "status": member.status}
            for member in team_members
        ],
    }


@router.get("/summary/engineer")
def engineer_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ENGINEER.value)),
) -> dict[str, Any]:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)

    equipment_count = (
        db.query(Equipment)
        .filter(
            Equipment.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    active_sensors = (
        db.query(Sensor)
        .join(Equipment, Sensor.equipment_id == Equipment.id)
        .filter(
            Sensor.tenant_id == tenant_id,
            Sensor.status == ResourceStatus.ACTIVE.value,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    open_alerts = (
        db.query(AlertEvent)
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.status == AlertStatus.OPEN.value,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    now = datetime.now(timezone.utc)
    yesterday_date = (now - timedelta(days=1)).date()
    start_yesterday = datetime.combine(yesterday_date, datetime.min.time(), tzinfo=timezone.utc)
    end_yesterday = start_yesterday + timedelta(days=1)
    cleared_yesterday = (
        db.query(AlertEvent)
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.cleared_at.is_not(None),
            AlertEvent.cleared_at >= start_yesterday,
            AlertEvent.cleared_at < end_yesterday,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    dashboard_assignments = (
        db.query(DashboardAssignment)
        .outerjoin(Equipment, DashboardAssignment.equipment_id == Equipment.id)
        .filter(
            DashboardAssignment.tenant_id == tenant_id,
            or_(
                DashboardAssignment.supervisor_user_id == supervisor_id,
                DashboardAssignment.supervisor_user_id.is_(None),
                Equipment.supervisor_user_id == supervisor_id,
            ),
        )
        .count()
    )

    return {
        "counts": {
            "equipment": equipment_count,
            "active_sensors": active_sensors,
            "open_alerts": open_alerts,
            "dashboard_assignments": dashboard_assignments,
        },
        "alerts_cleared_yesterday": cleared_yesterday,
    }


@router.get("/summary/technician")
def technician_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TECHNICIAN.value)),
) -> dict[str, Any]:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)

    equipment_count = (
        db.query(Equipment)
        .filter(
            Equipment.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    open_alerts = (
        db.query(AlertEvent)
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.status == AlertStatus.OPEN.value,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .count()
    )

    return {
        "counts": {
            "equipment": equipment_count,
            "open_alerts": open_alerts,
        }
    }


@router.get("/equipment", response_model=PaginatedEquipment)
def list_equipment(
    q: str | None = None,
    site_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*OPS_ROLES)),
) -> PaginatedEquipment:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    query = (
        db.query(Equipment)
        .options(joinedload(Equipment.site), joinedload(Equipment.supervisor))
        .filter(
            Equipment.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Equipment.name.ilike(like), Equipment.equipment_type.ilike(like)))
    if site_id is not None:
        query = query.filter(Equipment.site_id == site_id)
    if status_filter:
        query = query.filter(Equipment.status == status_filter)
    query = query.order_by(Equipment.name.asc())
    total, items = _paginate(query, limit, offset)
    return PaginatedEquipment(
        items=[EquipmentOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/equipment", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> EquipmentOut:
    tenant_id = _require_tenant(current_user)
    site = db.get(Site, payload.site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid site")

    if payload.supervisor_user_id and payload.supervisor_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor assignment invalid")

    equipment = Equipment(
        tenant_id=tenant_id,
        site_id=payload.site_id,
        supervisor_user_id=current_user.id,
        name=payload.name.strip(),
        equipment_type=payload.equipment_type.strip().upper(),
        serial_number=payload.serial_number.strip() if payload.serial_number else None,
        status=payload.status or ResourceStatus.ACTIVE.value,
        criticality=payload.criticality,
        metadata_json=payload.metadata_json,
    )
    db.add(equipment)
    db.flush()
    log_audit(
        db,
        action="equipment_created",
        entity_type="equipment",
        entity_id=equipment.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"name": equipment.name, "equipment_type": equipment.equipment_type},
    )
    db.commit()
    db.refresh(equipment)
    return EquipmentOut.model_validate(equipment)


@router.get("/equipment/{equipment_id}", response_model=EquipmentOut)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*OPS_ROLES)),
) -> EquipmentOut:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    equipment = (
        db.query(Equipment)
        .options(joinedload(Equipment.site), joinedload(Equipment.supervisor))
        .filter(
            Equipment.id == equipment_id,
            Equipment.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .first()
    )
    if not equipment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    return EquipmentOut.model_validate(equipment)


@router.put("/equipment/{equipment_id}", response_model=EquipmentOut)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> EquipmentOut:
    tenant_id = _require_tenant(current_user)
    equipment = db.get(Equipment, equipment_id)
    if not equipment or equipment.tenant_id != tenant_id or equipment.supervisor_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")

    site = db.get(Site, payload.site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid site")

    if payload.supervisor_user_id and payload.supervisor_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor assignment invalid")

    equipment.site_id = payload.site_id
    equipment.supervisor_user_id = current_user.id
    equipment.name = payload.name.strip()
    equipment.equipment_type = payload.equipment_type.strip().upper()
    equipment.serial_number = payload.serial_number.strip() if payload.serial_number else None
    equipment.status = payload.status or equipment.status
    equipment.criticality = payload.criticality
    equipment.metadata_json = payload.metadata_json
    log_audit(
        db,
        action="equipment_updated",
        entity_type="equipment",
        entity_id=equipment.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"name": equipment.name, "equipment_type": equipment.equipment_type},
    )
    db.commit()
    db.refresh(equipment)
    return EquipmentOut.model_validate(equipment)


@router.get("/sensors", response_model=PaginatedSensors)
def list_sensors(
    q: str | None = None,
    equipment_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*OPS_ROLES)),
) -> PaginatedSensors:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    query = (
        db.query(Sensor)
        .options(joinedload(Sensor.equipment))
        .join(Equipment, Sensor.equipment_id == Equipment.id)
        .filter(
            Sensor.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Sensor.name.ilike(like), Sensor.sensor_type.ilike(like)))
    if equipment_id is not None:
        query = query.filter(Sensor.equipment_id == equipment_id)
    if status_filter:
        query = query.filter(Sensor.status == status_filter)
    query = query.order_by(Sensor.name.asc())
    total, items = _paginate(query, limit, offset)
    return PaginatedSensors(
        items=[SensorOut.model_validate(sensor) for sensor in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/sensors", response_model=SensorOut, status_code=status.HTTP_201_CREATED)
def create_sensor(
    payload: SensorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> SensorOut:
    tenant_id = _require_tenant(current_user)
    equipment = db.get(Equipment, payload.equipment_id)
    if (
        not equipment
        or equipment.tenant_id != tenant_id
        or equipment.supervisor_user_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid equipment")

    sensor = Sensor(
        tenant_id=tenant_id,
        equipment_id=payload.equipment_id,
        sensor_type=payload.sensor_type.strip().upper(),
        name=payload.name.strip(),
        external_sensor_id=payload.external_sensor_id.strip() if payload.external_sensor_id else None,
        status=payload.status or ResourceStatus.ACTIVE.value,
        unit=payload.unit.strip(),
        metadata_json=payload.metadata_json,
    )
    db.add(sensor)
    db.flush()
    log_audit(
        db,
        action="sensor_created",
        entity_type="sensor",
        entity_id=sensor.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"name": sensor.name, "sensor_type": sensor.sensor_type},
    )
    db.commit()
    db.refresh(sensor)
    return SensorOut.model_validate(sensor)


@router.get("/sensors/{sensor_id}", response_model=SensorOut)
def get_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*OPS_ROLES)),
) -> SensorOut:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    sensor = (
        db.query(Sensor)
        .options(joinedload(Sensor.equipment))
        .join(Equipment, Sensor.equipment_id == Equipment.id)
        .filter(
            Sensor.id == sensor_id,
            Sensor.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .first()
    )
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    return SensorOut.model_validate(sensor)


@router.put("/sensors/{sensor_id}", response_model=SensorOut)
def update_sensor(
    sensor_id: int,
    payload: SensorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> SensorOut:
    tenant_id = _require_tenant(current_user)
    sensor = db.get(Sensor, sensor_id)
    if not sensor or sensor.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    equipment = db.get(Equipment, payload.equipment_id)
    if (
        not equipment
        or equipment.tenant_id != tenant_id
        or equipment.supervisor_user_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid equipment")
    if sensor.equipment_id != payload.equipment_id:
        sensor.equipment_id = payload.equipment_id

    sensor.sensor_type = payload.sensor_type.strip().upper()
    sensor.name = payload.name.strip()
    sensor.external_sensor_id = payload.external_sensor_id.strip() if payload.external_sensor_id else None
    sensor.status = payload.status or sensor.status
    sensor.unit = payload.unit.strip()
    sensor.metadata_json = payload.metadata_json
    log_audit(
        db,
        action="sensor_updated",
        entity_type="sensor",
        entity_id=sensor.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"name": sensor.name, "sensor_type": sensor.sensor_type},
    )
    db.commit()
    db.refresh(sensor)
    return SensorOut.model_validate(sensor)


@router.get("/alert-rules", response_model=PaginatedAlertRules)
def list_alert_rules(
    q: str | None = None,
    equipment_id: int | None = None,
    sensor_id: int | None = None,
    severity: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value, UserRole.ENGINEER.value)),
) -> PaginatedAlertRules:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    query = (
        db.query(AlertRule)
        .options(joinedload(AlertRule.equipment), joinedload(AlertRule.sensor))
        .join(Equipment, AlertRule.equipment_id == Equipment.id)
        .filter(
            AlertRule.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(AlertRule.metric_name.ilike(like), AlertRule.severity.ilike(like), AlertRule.operator.ilike(like))
        )
    if equipment_id is not None:
        query = query.filter(AlertRule.equipment_id == equipment_id)
    if sensor_id is not None:
        query = query.filter(AlertRule.sensor_id == sensor_id)
    if severity:
        query = query.filter(AlertRule.severity == severity)
    if status_filter:
        query = query.filter(AlertRule.status == status_filter)
    query = query.order_by(AlertRule.id.desc())
    total, items = _paginate(query, limit, offset)
    return PaginatedAlertRules(
        items=[AlertRuleOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/alert-rules", response_model=AlertRuleOut, status_code=status.HTTP_201_CREATED)
def create_alert_rule(
    payload: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value, UserRole.ENGINEER.value)),
) -> AlertRuleOut:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    equipment = db.get(Equipment, payload.equipment_id)
    if (
        not equipment
        or equipment.tenant_id != tenant_id
        or equipment.supervisor_user_id != supervisor_id
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid equipment")
    if payload.sensor_id is not None:
        sensor = db.get(Sensor, payload.sensor_id)
        if not sensor or sensor.tenant_id != tenant_id or sensor.equipment_id != equipment.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sensor")
    status_value = payload.status or ResourceStatus.ACTIVE.value

    rule = AlertRule(
        tenant_id=tenant_id,
        equipment_id=payload.equipment_id,
        sensor_id=payload.sensor_id,
        created_by_user_id=current_user.id,
        severity=payload.severity.strip().upper(),
        metric_name=payload.metric_name.strip(),
        operator=payload.operator.strip(),
        threshold_value=payload.threshold_value,
        time_window_minutes=payload.time_window_minutes,
        status=status_value,
        webhook_url=payload.webhook_url,
        email=payload.email,
    )
    db.add(rule)
    db.flush()
    log_audit(
        db,
        action="alert_rule_created",
        entity_type="alert_rule",
        entity_id=rule.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"equipment_id": rule.equipment_id, "severity": rule.severity, "metric": rule.metric_name},
    )
    db.commit()
    db.refresh(rule)
    return AlertRuleOut.model_validate(rule)


@router.put("/alert-rules/{rule_id}", response_model=AlertRuleOut)
def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value, UserRole.ENGINEER.value)),
) -> AlertRuleOut:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    rule = db.get(AlertRule, rule_id)
    if not rule or rule.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    equipment = db.get(Equipment, payload.equipment_id)
    if (
        not equipment
        or equipment.tenant_id != tenant_id
        or equipment.supervisor_user_id != supervisor_id
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid equipment")
    if payload.sensor_id is not None:
        sensor = db.get(Sensor, payload.sensor_id)
        if not sensor or sensor.tenant_id != tenant_id or sensor.equipment_id != equipment.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sensor")

    rule.equipment_id = payload.equipment_id
    rule.sensor_id = payload.sensor_id
    rule.severity = payload.severity.strip().upper()
    rule.metric_name = payload.metric_name.strip()
    rule.operator = payload.operator.strip()
    rule.threshold_value = payload.threshold_value
    rule.time_window_minutes = payload.time_window_minutes
    rule.status = payload.status or rule.status
    rule.webhook_url = payload.webhook_url
    rule.email = payload.email
    log_audit(
        db,
        action="alert_rule_updated",
        entity_type="alert_rule",
        entity_id=rule.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"equipment_id": rule.equipment_id, "severity": rule.severity, "metric": rule.metric_name},
    )
    db.commit()
    db.refresh(rule)
    return AlertRuleOut.model_validate(rule)


@router.get("/alerts", response_model=PaginatedAlertEvents)
def list_alerts(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = None,
    equipment_id: int | None = None,
    sensor_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*[role.value for role in UserRole])),
) -> PaginatedAlertEvents:
    query = (
        db.query(AlertEvent)
        .options(joinedload(AlertEvent.equipment), joinedload(AlertEvent.sensor), joinedload(AlertEvent.cleared_by))
    )

    if current_user.role == UserRole.SYSTEM_ADMIN.value:
        if tenant_id is not None:
            query = query.filter(AlertEvent.tenant_id == tenant_id)
    elif current_user.role == UserRole.CLIENT_ADMIN.value:
        if current_user.tenant_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access required")
        if tenant_id is not None and tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")
        query = query.filter(AlertEvent.tenant_id == current_user.tenant_id)
    else:
        tenant_value = _require_tenant(current_user)
        supervisor_id = _resolve_supervisor_scope(current_user)
        query = (
            query.join(Equipment, AlertEvent.equipment_id == Equipment.id)
            .filter(
                AlertEvent.tenant_id == tenant_value,
                Equipment.supervisor_user_id == supervisor_id,
            )
        )

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(AlertEvent.severity.ilike(like), AlertEvent.status.ilike(like)))
    if status_filter:
        query = query.filter(AlertEvent.status == status_filter)
    if severity:
        query = query.filter(AlertEvent.severity == severity)
    if equipment_id is not None:
        query = query.filter(AlertEvent.equipment_id == equipment_id)
    if sensor_id is not None:
        query = query.filter(AlertEvent.sensor_id == sensor_id)
    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        query = query.filter(AlertEvent.triggered_at >= start_dt)
    if end_date:
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        query = query.filter(AlertEvent.triggered_at < end_dt)

    query = query.order_by(AlertEvent.triggered_at.desc())
    total, items = _paginate(query, limit, offset)
    return PaginatedAlertEvents(
        items=[AlertEventOut.model_validate(alert) for alert in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/alerts/{alert_id}", response_model=AlertEventOut)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*[role.value for role in UserRole])),
) -> AlertEventOut:
    query = (
        db.query(AlertEvent)
        .options(joinedload(AlertEvent.equipment), joinedload(AlertEvent.sensor), joinedload(AlertEvent.cleared_by))
        .filter(AlertEvent.id == alert_id)
    )
    if current_user.role == UserRole.SYSTEM_ADMIN.value:
        alert = query.first()
    elif current_user.role == UserRole.CLIENT_ADMIN.value:
        if current_user.tenant_id is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access required")
        alert = query.filter(AlertEvent.tenant_id == current_user.tenant_id).first()
    else:
        tenant_value = _require_tenant(current_user)
        supervisor_id = _resolve_supervisor_scope(current_user)
        alert = (
            query.join(Equipment, AlertEvent.equipment_id == Equipment.id)
            .filter(
                AlertEvent.tenant_id == tenant_value,
                Equipment.supervisor_user_id == supervisor_id,
            )
            .first()
        )
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return AlertEventOut.model_validate(alert)


@router.post("/alerts/{alert_id}/clear", response_model=AlertEventOut)
def clear_alert(
    alert_id: int,
    payload: AlertClearRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.SUPERVISOR.value, UserRole.ENGINEER.value, UserRole.TECHNICIAN.value)
    ),
) -> AlertEventOut:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    alert = (
        db.query(AlertEvent)
        .options(joinedload(AlertEvent.equipment), joinedload(AlertEvent.sensor), joinedload(AlertEvent.cleared_by))
        .join(Equipment, AlertEvent.equipment_id == Equipment.id)
        .filter(
            AlertEvent.id == alert_id,
            AlertEvent.tenant_id == tenant_id,
            Equipment.supervisor_user_id == supervisor_id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    if alert.status == AlertStatus.CLEARED.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alert already cleared")

    alert.status = AlertStatus.CLEARED.value
    alert.cleared_at = datetime.now(timezone.utc)
    alert.cleared_by_user_id = current_user.id
    alert.clear_comment = payload.clear_comment
    log_audit(
        db,
        action="alert_cleared",
        entity_type="alert_event",
        entity_id=alert.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": alert.status, "comment": payload.clear_comment},
    )
    db.commit()
    db.refresh(alert)
    return AlertEventOut.model_validate(alert)


@router.get("/dashboard-assignments", response_model=PaginatedDashboardAssignments)
def list_dashboard_assignments(
    q: str | None = None,
    equipment_type: str | None = None,
    scope: str | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*OPS_ROLES)),
) -> PaginatedDashboardAssignments:
    tenant_id = _require_tenant(current_user)
    supervisor_id = _resolve_supervisor_scope(current_user)
    query = (
        db.query(DashboardAssignment)
        .options(
            joinedload(DashboardAssignment.template),
            joinedload(DashboardAssignment.equipment).joinedload(Equipment.site),
            joinedload(DashboardAssignment.supervisor),
            joinedload(DashboardAssignment.created_by),
            joinedload(DashboardAssignment.tenant),
        )
        .outerjoin(Equipment, DashboardAssignment.equipment_id == Equipment.id)
        .filter(
            DashboardAssignment.tenant_id == tenant_id,
            or_(
                DashboardAssignment.supervisor_user_id == supervisor_id,
                DashboardAssignment.supervisor_user_id.is_(None),
                Equipment.supervisor_user_id == supervisor_id,
            ),
        )
        .order_by(DashboardAssignment.id.desc())
    )
    if q or equipment_type:
        query = query.join(DashboardAssignment.template)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                DashboardTemplate.name.ilike(like),
                DashboardTemplate.code.ilike(like),
                Equipment.name.ilike(like),
            )
        )
    if equipment_type:
        normalized_type = equipment_type.strip().upper()
        query = query.filter(DashboardTemplate.equipment_type == normalized_type)
    if scope:
        normalized = scope.strip().upper()
        if normalized == "FLEET":
            query = query.filter(DashboardAssignment.equipment_id.is_(None))
        elif normalized == "EQUIPMENT":
            query = query.filter(DashboardAssignment.equipment_id.is_not(None))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid scope filter")
    total, items = _paginate(query, limit, offset)
    return PaginatedDashboardAssignments(
        items=[DashboardAssignmentOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/dashboard-assignments", response_model=DashboardAssignmentOut, status_code=status.HTTP_201_CREATED)
def create_dashboard_assignment(
    payload: DashboardAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> DashboardAssignment:
    tenant_id = _require_tenant(current_user)
    template = db.get(DashboardTemplate, payload.dashboard_template_id)
    if not template or not template.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid dashboard template")

    equipment_id = payload.equipment_id
    if equipment_id is not None:
        equipment = db.get(Equipment, equipment_id)
        if (
            not equipment
            or equipment.tenant_id != tenant_id
            or equipment.supervisor_user_id != current_user.id
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid equipment")

    assignment = DashboardAssignment(
        tenant_id=tenant_id,
        supervisor_user_id=current_user.id,
        equipment_id=equipment_id,
        dashboard_template_id=payload.dashboard_template_id,
        created_by_user_id=current_user.id,
    )
    db.add(assignment)
    db.flush()
    log_audit(
        db,
        action="dashboard_assigned",
        entity_type="dashboard_assignment",
        entity_id=assignment.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"template_id": assignment.dashboard_template_id, "equipment_id": assignment.equipment_id},
    )
    db.commit()
    db.refresh(assignment)
    return DashboardAssignmentOut.model_validate(assignment)


@router.delete("/dashboard-assignments/{assignment_id}", response_model=MessageOut)
def delete_dashboard_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR.value)),
) -> MessageOut:
    tenant_id = _require_tenant(current_user)
    assignment = (
        db.query(DashboardAssignment)
        .options(joinedload(DashboardAssignment.template))
        .filter(DashboardAssignment.id == assignment_id, DashboardAssignment.tenant_id == tenant_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard assignment not found")
    if assignment.supervisor_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to remove this assignment")

    db.delete(assignment)
    log_audit(
        db,
        action="dashboard_unassigned",
        entity_type="dashboard_assignment",
        entity_id=assignment.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"template_id": assignment.dashboard_template_id, "equipment_id": assignment.equipment_id},
    )
    db.commit()
    return MessageOut(status="ok", message="Dashboard assignment removed.")
