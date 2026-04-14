from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..audit import log_audit
from ..auth import hash_password
from ..deps import get_db, require_client_admin
from ..models import (
    AlertEvent,
    DashboardAssignment,
    DashboardTemplate,
    Equipment,
    ResourceStatus,
    Sensor,
    Site,
    User,
    UserRole,
    UserStatus,
)
from ..schemas import (
    AlertEventOut,
    EquipmentCreate,
    EquipmentOut,
    EquipmentUpdate,
    PaginatedAlertEvents,
    PaginatedDashboardAssignments,
    PaginatedEquipment,
    PaginatedSensors,
    PaginatedSites,
    PaginatedUsers,
    SensorCreate,
    SensorOut,
    SensorUpdate,
    SiteCreate,
    SiteOut,
    SiteUpdate,
    UserClientUpdate,
    UserCreate,
    UserCreateResponse,
    UserOut,
)
from ..utils import generate_temp_password

router = APIRouter(prefix="/client", tags=["client-admin"])
summary_router = APIRouter(tags=["client-admin"])

CLIENT_MANAGED_ROLES = {UserRole.SUPERVISOR.value, UserRole.ENGINEER.value, UserRole.TECHNICIAN.value}


def resolve_tenant_id(current_user: User, tenant_id: int | None) -> int:
    if current_user.role == UserRole.SYSTEM_ADMIN.value:
        if tenant_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tenant_id is required")
        return tenant_id
    if current_user.tenant_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access required")
    if tenant_id is not None and tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant mismatch")
    return current_user.tenant_id


def _paginate(query, limit: int, offset: int):
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return total, items


@router.get("/users", response_model=PaginatedUsers)
def list_client_users(
    q: str | None = None,
    role: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> PaginatedUsers:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    query = db.query(User).options(joinedload(User.tenant)).filter(User.tenant_id == tenant_id)
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))
    if role:
        query = query.filter(User.role == role)
    if status_filter:
        query = query.filter(User.status == status_filter)
    query = query.order_by(User.full_name.asc())
    total, items = _paginate(query, limit, offset)
    return PaginatedUsers(
        items=[UserOut.model_validate(user) for user in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_client_user(
    payload: UserCreate,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> UserCreateResponse:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    role = payload.role
    if role not in CLIENT_MANAGED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not allowed")

    if role in {UserRole.ENGINEER.value, UserRole.TECHNICIAN.value} and payload.supervisor_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor is required")
    if role == UserRole.SUPERVISOR.value and payload.supervisor_user_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisors cannot have supervisors")
    if payload.supervisor_user_id is not None:
        supervisor = db.get(User, payload.supervisor_user_id)
        if not supervisor or supervisor.tenant_id != tenant_id or supervisor.role != UserRole.SUPERVISOR.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor assignment invalid")

    temp_password = payload.temporary_password or generate_temp_password()
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        role=role,
        status=UserStatus.ACTIVE.value,
        tenant_id=tenant_id,
        supervisor_user_id=payload.supervisor_user_id,
        password_hash=hash_password(temp_password),
    )
    db.add(user)
    try:
        db.flush()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    log_audit(
        db,
        action="user_created",
        entity_type="user",
        entity_id=user.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"email": user.email, "role": user.role},
    )
    db.commit()
    db.refresh(user)
    return UserCreateResponse(user=UserOut.model_validate(user), temporary_password=temp_password)


@router.put("/users/{user_id}", response_model=UserOut)
def update_client_user(
    user_id: int,
    payload: UserClientUpdate,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> UserOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    user = db.get(User, user_id)
    if not user or user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.role not in CLIENT_MANAGED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not allowed")

    if payload.role in {UserRole.ENGINEER.value, UserRole.TECHNICIAN.value} and payload.supervisor_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor is required")
    if payload.role == UserRole.SUPERVISOR.value and payload.supervisor_user_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisors cannot have supervisors")
    if payload.supervisor_user_id is not None:
        supervisor = db.get(User, payload.supervisor_user_id)
        if not supervisor or supervisor.tenant_id != tenant_id or supervisor.role != UserRole.SUPERVISOR.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor assignment invalid")

    role_changed = payload.role != user.role
    user.full_name = payload.full_name.strip()
    user.role = payload.role
    user.supervisor_user_id = payload.supervisor_user_id if payload.role in {
        UserRole.ENGINEER.value,
        UserRole.TECHNICIAN.value,
    } else None

    if role_changed:
        log_audit(
            db,
            action="user_role_changed",
            entity_type="user",
            entity_id=user.id,
            tenant_id=tenant_id,
            user_id=current_user.id,
            details={"role": user.role},
        )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/users/{user_id}/activate", response_model=UserOut)
def activate_client_user(
    user_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> UserOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    user = db.get(User, user_id)
    if not user or user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = UserStatus.ACTIVE.value
    log_audit(
        db,
        action="user_activated",
        entity_type="user",
        entity_id=user.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": user.status},
    )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/users/{user_id}/inactivate", response_model=UserOut)
def inactivate_client_user(
    user_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> UserOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    user = db.get(User, user_id)
    if not user or user.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = UserStatus.INACTIVE.value
    log_audit(
        db,
        action="user_inactivated",
        entity_type="user",
        entity_id=user.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": user.status},
    )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/sites", response_model=PaginatedSites)
def list_sites(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> PaginatedSites:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    query = db.query(Site).filter(Site.tenant_id == tenant_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Site.name.ilike(like), Site.location.ilike(like)))
    if status_filter:
        query = query.filter(Site.status == status_filter)
    query = query.order_by(Site.name.asc())
    total, items = _paginate(query, limit, offset)
    return PaginatedSites(
        items=[SiteOut.model_validate(site) for site in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/sites", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SiteOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    site = Site(
        tenant_id=tenant_id,
        name=payload.name.strip(),
        location=payload.location.strip() if payload.location else None,
        status=ResourceStatus.ACTIVE.value,
    )
    db.add(site)
    db.flush()
    log_audit(
        db,
        action="site_created",
        entity_type="site",
        entity_id=site.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"name": site.name},
    )
    db.commit()
    db.refresh(site)
    return SiteOut.model_validate(site)


@router.put("/sites/{site_id}", response_model=SiteOut)
def update_site(
    site_id: int,
    payload: SiteUpdate,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SiteOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    site = db.get(Site, site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    site.name = payload.name.strip()
    site.location = payload.location.strip() if payload.location else None
    log_audit(
        db,
        action="site_updated",
        entity_type="site",
        entity_id=site.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"name": site.name},
    )
    db.commit()
    db.refresh(site)
    return SiteOut.model_validate(site)


@router.post("/sites/{site_id}/activate", response_model=SiteOut)
def activate_site(
    site_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SiteOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    site = db.get(Site, site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    site.status = ResourceStatus.ACTIVE.value
    log_audit(
        db,
        action="site_activated",
        entity_type="site",
        entity_id=site.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": site.status},
    )
    db.commit()
    db.refresh(site)
    return SiteOut.model_validate(site)


@router.post("/sites/{site_id}/inactivate", response_model=SiteOut)
def inactivate_site(
    site_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SiteOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    site = db.get(Site, site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")
    site.status = ResourceStatus.INACTIVE.value
    log_audit(
        db,
        action="site_inactivated",
        entity_type="site",
        entity_id=site.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": site.status},
    )
    db.commit()
    db.refresh(site)
    return SiteOut.model_validate(site)


@router.get("/equipment", response_model=PaginatedEquipment)
def list_equipment(
    q: str | None = None,
    site_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> PaginatedEquipment:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    query = (
        db.query(Equipment)
        .options(joinedload(Equipment.site), joinedload(Equipment.supervisor))
        .filter(Equipment.tenant_id == tenant_id)
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
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> EquipmentOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    site = db.get(Site, payload.site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid site")

    if payload.supervisor_user_id is not None:
        supervisor = db.get(User, payload.supervisor_user_id)
        if not supervisor or supervisor.tenant_id != tenant_id or supervisor.role != UserRole.SUPERVISOR.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor assignment invalid")

    equipment = Equipment(
        tenant_id=tenant_id,
        site_id=payload.site_id,
        supervisor_user_id=payload.supervisor_user_id,
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


@router.put("/equipment/{equipment_id}", response_model=EquipmentOut)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> EquipmentOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    equipment = db.get(Equipment, equipment_id)
    if not equipment or equipment.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    site = db.get(Site, payload.site_id)
    if not site or site.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid site")
    if payload.supervisor_user_id is not None:
        supervisor = db.get(User, payload.supervisor_user_id)
        if not supervisor or supervisor.tenant_id != tenant_id or supervisor.role != UserRole.SUPERVISOR.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supervisor assignment invalid")

    equipment.site_id = payload.site_id
    equipment.supervisor_user_id = payload.supervisor_user_id
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


@router.post("/equipment/{equipment_id}/activate", response_model=EquipmentOut)
def activate_equipment(
    equipment_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> EquipmentOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    equipment = db.get(Equipment, equipment_id)
    if not equipment or equipment.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    equipment.status = ResourceStatus.ACTIVE.value
    log_audit(
        db,
        action="equipment_activated",
        entity_type="equipment",
        entity_id=equipment.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": equipment.status},
    )
    db.commit()
    db.refresh(equipment)
    return EquipmentOut.model_validate(equipment)


@router.post("/equipment/{equipment_id}/inactivate", response_model=EquipmentOut)
def inactivate_equipment(
    equipment_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> EquipmentOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    equipment = db.get(Equipment, equipment_id)
    if not equipment or equipment.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipment not found")
    equipment.status = ResourceStatus.INACTIVE.value
    log_audit(
        db,
        action="equipment_inactivated",
        entity_type="equipment",
        entity_id=equipment.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": equipment.status},
    )
    db.commit()
    db.refresh(equipment)
    return EquipmentOut.model_validate(equipment)


@router.get("/sensors", response_model=PaginatedSensors)
def list_sensors(
    q: str | None = None,
    equipment_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> PaginatedSensors:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    query = (
        db.query(Sensor)
        .options(joinedload(Sensor.equipment))
        .filter(Sensor.tenant_id == tenant_id)
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
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SensorOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    equipment = db.get(Equipment, payload.equipment_id)
    if not equipment or equipment.tenant_id != tenant_id:
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


@router.put("/sensors/{sensor_id}", response_model=SensorOut)
def update_sensor(
    sensor_id: int,
    payload: SensorUpdate,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SensorOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    sensor = db.get(Sensor, sensor_id)
    if not sensor or sensor.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    equipment = db.get(Equipment, payload.equipment_id)
    if not equipment or equipment.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid equipment")

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


@router.post("/sensors/{sensor_id}/activate", response_model=SensorOut)
def activate_sensor(
    sensor_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SensorOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    sensor = db.get(Sensor, sensor_id)
    if not sensor or sensor.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    sensor.status = ResourceStatus.ACTIVE.value
    log_audit(
        db,
        action="sensor_activated",
        entity_type="sensor",
        entity_id=sensor.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": sensor.status},
    )
    db.commit()
    db.refresh(sensor)
    return SensorOut.model_validate(sensor)


@router.post("/sensors/{sensor_id}/inactivate", response_model=SensorOut)
def inactivate_sensor(
    sensor_id: int,
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> SensorOut:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    sensor = db.get(Sensor, sensor_id)
    if not sensor or sensor.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    sensor.status = ResourceStatus.INACTIVE.value
    log_audit(
        db,
        action="sensor_inactivated",
        entity_type="sensor",
        entity_id=sensor.id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        details={"status": sensor.status},
    )
    db.commit()
    db.refresh(sensor)
    return SensorOut.model_validate(sensor)


@router.get("/alerts", response_model=PaginatedAlertEvents)
def list_alerts(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = None,
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> PaginatedAlertEvents:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    query = (
        db.query(AlertEvent)
        .options(joinedload(AlertEvent.equipment), joinedload(AlertEvent.sensor), joinedload(AlertEvent.cleared_by))
        .filter(AlertEvent.tenant_id == tenant_id)
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(AlertEvent.severity.ilike(like), AlertEvent.status.ilike(like)))
    if status_filter:
        query = query.filter(AlertEvent.status == status_filter)
    if severity:
        query = query.filter(AlertEvent.severity == severity)
    query = query.order_by(AlertEvent.triggered_at.desc())
    total, items = _paginate(query, limit, offset)
    return PaginatedAlertEvents(
        items=[AlertEventOut.model_validate(alert) for alert in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/dashboards", response_model=PaginatedDashboardAssignments)
def list_dashboard_assignments(
    q: str | None = None,
    equipment_type: str | None = None,
    scope: str | None = None,
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> PaginatedDashboardAssignments:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    query = (
        db.query(DashboardAssignment)
        .options(
            joinedload(DashboardAssignment.template),
            joinedload(DashboardAssignment.equipment).joinedload(Equipment.site),
            joinedload(DashboardAssignment.supervisor),
            joinedload(DashboardAssignment.created_by),
            joinedload(DashboardAssignment.tenant),
        )
        .filter(DashboardAssignment.tenant_id == tenant_id)
        .order_by(DashboardAssignment.id.desc())
    )
    if q or equipment_type:
        query = query.join(DashboardAssignment.template)
    if q:
        like = f"%{q.strip()}%"
        query = query.outerjoin(DashboardAssignment.equipment).filter(
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
        items=[item for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@summary_router.get("/summary/client-admin", response_model=None)
@router.get("/summary", response_model=None)
def client_admin_summary(
    tenant_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client_admin),
) -> dict[str, Any]:
    tenant_id = resolve_tenant_id(current_user, tenant_id)
    active_sensors = (
        db.query(Sensor).filter(Sensor.tenant_id == tenant_id, Sensor.status == ResourceStatus.ACTIVE.value).count()
    )
    active_equipment = (
        db.query(Equipment)
        .filter(Equipment.tenant_id == tenant_id, Equipment.status == ResourceStatus.ACTIVE.value)
        .count()
    )

    equipment_by_site = (
        db.query(Site.id, Site.name, func.count(Equipment.id))
        .outerjoin(Equipment, Equipment.site_id == Site.id)
        .filter(Site.tenant_id == tenant_id)
        .group_by(Site.id)
        .order_by(Site.name.asc())
        .all()
    )

    sensors_by_equipment = (
        db.query(Equipment.id, Equipment.name, func.count(Sensor.id))
        .outerjoin(Sensor, Sensor.equipment_id == Equipment.id)
        .filter(Equipment.tenant_id == tenant_id)
        .group_by(Equipment.id)
        .order_by(Equipment.name.asc())
        .all()
    )

    now = datetime.now(timezone.utc)
    yesterday_date = (now - timedelta(days=1)).date()
    start_yesterday = datetime.combine(yesterday_date, datetime.min.time(), tzinfo=timezone.utc)
    end_yesterday = start_yesterday + timedelta(days=1)
    alerts_yesterday = (
        db.query(AlertEvent)
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.triggered_at >= start_yesterday,
            AlertEvent.triggered_at < end_yesterday,
        )
        .all()
    )
    cleared_counts = (
        db.query(AlertEvent.cleared_by_user_id, func.count(AlertEvent.id))
        .filter(
            AlertEvent.tenant_id == tenant_id,
            AlertEvent.triggered_at >= start_yesterday,
            AlertEvent.triggered_at < end_yesterday,
            AlertEvent.cleared_by_user_id.is_not(None),
        )
        .group_by(AlertEvent.cleared_by_user_id)
        .all()
    )
    cleared_by = []
    if cleared_counts:
        user_lookup = {
            user.id: user.full_name
            for user in db.query(User).filter(User.id.in_([row[0] for row in cleared_counts])).all()
        }
        for user_id, count in cleared_counts:
            cleared_by.append({"user_id": user_id, "name": user_lookup.get(user_id), "count": count})

    start_range = (now - timedelta(days=6)).date()
    start_series = datetime.combine(start_range, datetime.min.time(), tzinfo=timezone.utc)
    date_counts = dict(
        db.query(func.date(AlertEvent.triggered_at), func.count(AlertEvent.id))
        .filter(AlertEvent.tenant_id == tenant_id, AlertEvent.triggered_at >= start_series)
        .group_by(func.date(AlertEvent.triggered_at))
        .all()
    )
    series = []
    for i in range(7):
        day = start_range + timedelta(days=i)
        series.append({"date": day.isoformat(), "count": date_counts.get(day, 0)})

    from ..models import AuditLog

    recent_user_activity = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .filter(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(6)
        .all()
    )

    recent_equipment = (
        db.query(AuditLog)
        .filter(AuditLog.tenant_id == tenant_id, AuditLog.action == "equipment_created")
        .order_by(AuditLog.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "counts": {
            "active_sensors": active_sensors,
            "active_equipment": active_equipment,
            "alerts_triggered_yesterday": len(alerts_yesterday),
        },
        "equipment_by_site": [
            {"site_id": site_id, "site": name, "count": count}
            for site_id, name, count in equipment_by_site
        ],
        "sensor_distribution": [
            {"equipment_id": eq_id, "equipment": name, "count": count}
            for eq_id, name, count in sensors_by_equipment
        ],
        "alerts_yesterday": {
            "total": len(alerts_yesterday),
            "cleared_by": cleared_by,
        },
        "alerts_last_7_days": series,
        "recent_user_activity": [
            {
                "id": entry.id,
                "action": entry.action,
                "entity_type": entry.entity_type,
                "entity_id": entry.entity_id,
                "user": entry.user.full_name if entry.user else None,
                "created_at": entry.created_at,
            }
            for entry in recent_user_activity
        ],
        "recent_equipment_additions": [
            {
                "id": entry.id,
                "details": entry.details,
                "created_at": entry.created_at,
            }
            for entry in recent_equipment
        ],
    }
