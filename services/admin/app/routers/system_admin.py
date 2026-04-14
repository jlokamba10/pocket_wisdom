from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..audit import log_audit
from ..auth import hash_password
from ..deps import get_db, require_system_admin
from ..models import (
    AlertEvent,
    AlertStatus,
    DashboardTemplate,
    Equipment,
    ResourceStatus,
    Sensor,
    Tenant,
    TenantStatus,
    User,
    UserRole,
    UserStatus,
)
from ..schemas import (
    AuditLogOut,
    DashboardTemplateCreate,
    DashboardTemplateOut,
    DashboardTemplateUpdate,
    PaginatedAuditLogs,
    PaginatedDashboardTemplates,
    PaginatedTenants,
    PaginatedUsers,
    ResetPasswordResponse,
    TenantCreate,
    TenantDetail,
    TenantOut,
    TenantUpdate,
    UserAdminUpdate,
    UserCreate,
    UserCreateResponse,
    UserOut,
    UserSummary,
)
from ..utils import generate_temp_password

router = APIRouter(tags=["system-admin"])

ALLOWED_ROLES = {role.value for role in UserRole}


def _paginate(query, limit: int, offset: int):
    total = query.count()
    items = query.offset(offset).limit(limit).all()
    return total, items


@router.get("/clients", response_model=PaginatedTenants)
def list_clients(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> PaginatedTenants:
    query = db.query(Tenant)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Tenant.name.ilike(like), Tenant.code.ilike(like)))
    if status_filter:
        query = query.filter(Tenant.status == status_filter)
    query = query.order_by(Tenant.name.asc())
    total, items = _paginate(query, limit, offset)
    return PaginatedTenants(
        items=[TenantOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/clients", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> TenantOut:
    status_value = payload.status or TenantStatus.ACTIVE.value
    tenant = Tenant(name=payload.name.strip(), code=payload.code.strip().upper(), status=status_value)
    db.add(tenant)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client code already exists")
    log_audit(
        db,
        action="client_created",
        entity_type="tenant",
        entity_id=tenant.id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        details={"name": tenant.name, "code": tenant.code, "status": tenant.status},
    )
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@router.get("/clients/{tenant_id}", response_model=TenantDetail)
def get_client(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> TenantDetail:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    active_users = (
        db.query(User).filter(User.tenant_id == tenant_id, User.status == UserStatus.ACTIVE.value).count()
    )
    inactive_users = (
        db.query(User).filter(User.tenant_id == tenant_id, User.status == UserStatus.INACTIVE.value).count()
    )
    equipment_count = db.query(Equipment).filter(Equipment.tenant_id == tenant_id).count()
    sensor_count = db.query(Sensor).filter(Sensor.tenant_id == tenant_id).count()
    open_alerts = (
        db.query(AlertEvent)
        .filter(AlertEvent.tenant_id == tenant_id, AlertEvent.status == AlertStatus.OPEN.value)
        .count()
    )
    client_admins = (
        db.query(User)
        .filter(User.tenant_id == tenant_id, User.role == UserRole.CLIENT_ADMIN.value)
        .order_by(User.full_name.asc())
        .all()
    )
    from ..models import AuditLog  # local import to avoid circular
    audit_rows = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user), joinedload(AuditLog.tenant))
        .filter(AuditLog.tenant_id == tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(8)
        .all()
    )

    return TenantDetail(
        tenant=TenantOut.model_validate(tenant),
        active_users=active_users,
        inactive_users=inactive_users,
        equipment_count=equipment_count,
        sensor_count=sensor_count,
        open_alerts=open_alerts,
        client_admins=[UserSummary.model_validate(user) for user in client_admins],
        recent_activity=[AuditLogOut.model_validate(entry) for entry in audit_rows],
    )


@router.put("/clients/{tenant_id}", response_model=TenantOut)
def update_client(
    tenant_id: int,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> TenantOut:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    tenant.name = payload.name.strip()
    tenant.code = payload.code.strip().upper()
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client code already exists")
    log_audit(
        db,
        action="client_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        details={"name": tenant.name, "code": tenant.code},
    )
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@router.post("/clients/{tenant_id}/activate", response_model=TenantOut)
def activate_client(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> TenantOut:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    tenant.status = TenantStatus.ACTIVE.value
    log_audit(
        db,
        action="client_activated",
        entity_type="tenant",
        entity_id=tenant.id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        details={"status": tenant.status},
    )
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@router.post("/clients/{tenant_id}/inactivate", response_model=TenantOut)
def inactivate_client(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> TenantOut:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    tenant.status = TenantStatus.INACTIVE.value
    log_audit(
        db,
        action="client_inactivated",
        entity_type="tenant",
        entity_id=tenant.id,
        tenant_id=tenant.id,
        user_id=current_user.id,
        details={"status": tenant.status},
    )
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@router.get("/users", response_model=PaginatedUsers)
def list_users(
    q: str | None = None,
    role: str | None = None,
    tenant_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> PaginatedUsers:
    query = db.query(User).options(joinedload(User.tenant))
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.filter(or_(User.email.ilike(like), User.full_name.ilike(like)))
    if role:
        query = query.filter(User.role == role)
    if tenant_id is not None:
        query = query.filter(User.tenant_id == tenant_id)
    if status_filter:
        query = query.filter(User.status == status_filter)
    query = query.order_by(User.created_at.desc())
    total, items = _paginate(query, limit, offset)
    return PaginatedUsers(
        items=[UserOut.model_validate(user) for user in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/users", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> UserCreateResponse:
    role = payload.role
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    tenant_id = payload.tenant_id
    if role == UserRole.SYSTEM_ADMIN.value:
        tenant_id = None
    else:
        if tenant_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant is required")
        tenant = db.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

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
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    log_audit(
        db,
        action="user_created",
        entity_type="user",
        entity_id=user.id,
        tenant_id=user.tenant_id,
        user_id=current_user.id,
        details={"email": user.email, "role": user.role},
    )
    db.commit()
    db.refresh(user)
    return UserCreateResponse(user=UserOut.model_validate(user), temporary_password=temp_password)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> UserOut:
    user = db.query(User).options(joinedload(User.tenant)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    tenant_id = payload.tenant_id
    if payload.role == UserRole.SYSTEM_ADMIN.value:
        tenant_id = None
    else:
        if tenant_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant is required")
        tenant = db.get(Tenant, tenant_id)
        if not tenant:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

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
    user.tenant_id = tenant_id
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
            tenant_id=user.tenant_id,
            user_id=current_user.id,
            details={"role": user.role},
        )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/users/{user_id}/activate", response_model=UserOut)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = UserStatus.ACTIVE.value
    log_audit(
        db,
        action="user_activated",
        entity_type="user",
        entity_id=user.id,
        tenant_id=user.tenant_id,
        user_id=current_user.id,
        details={"status": user.status},
    )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/users/{user_id}/inactivate", response_model=UserOut)
def inactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = UserStatus.INACTIVE.value
    log_audit(
        db,
        action="user_inactivated",
        entity_type="user",
        entity_id=user.id,
        tenant_id=user.tenant_id,
        user_id=current_user.id,
        details={"status": user.status},
    )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/users/{user_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> ResetPasswordResponse:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    temp_password = generate_temp_password()
    user.password_hash = hash_password(temp_password)
    log_audit(
        db,
        action="password_reset",
        entity_type="user",
        entity_id=user.id,
        tenant_id=user.tenant_id,
        user_id=current_user.id,
        details={"email": user.email},
    )
    db.commit()
    return ResetPasswordResponse(status="ok", temporary_password=temp_password)


@router.get("/dashboard-templates", response_model=PaginatedDashboardTemplates)
def list_dashboard_templates(
    q: str | None = None,
    equipment_type: str | None = None,
    active: bool | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> PaginatedDashboardTemplates:
    query = db.query(DashboardTemplate)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(DashboardTemplate.name.ilike(like), DashboardTemplate.code.ilike(like)))
    if equipment_type:
        query = query.filter(DashboardTemplate.equipment_type == equipment_type)
    if active is not None:
        query = query.filter(DashboardTemplate.is_active.is_(active))
    query = query.order_by(DashboardTemplate.name.asc())
    total, items = _paginate(query, limit, offset)
    return PaginatedDashboardTemplates(
        items=[DashboardTemplateOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/dashboard-templates", response_model=DashboardTemplateOut, status_code=status.HTTP_201_CREATED)
def create_dashboard_template(
    payload: DashboardTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> DashboardTemplateOut:
    template = DashboardTemplate(
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        description=payload.description,
        grafana_uid=payload.grafana_uid,
        equipment_type=payload.equipment_type,
        is_active=payload.is_active,
    )
    db.add(template)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template code already exists")
    log_audit(
        db,
        action="dashboard_template_created",
        entity_type="dashboard_template",
        entity_id=template.id,
        tenant_id=None,
        user_id=current_user.id,
        details={"code": template.code, "equipment_type": template.equipment_type, "is_active": template.is_active},
    )
    db.commit()
    db.refresh(template)
    return DashboardTemplateOut.model_validate(template)


@router.put("/dashboard-templates/{template_id}", response_model=DashboardTemplateOut)
def update_dashboard_template(
    template_id: int,
    payload: DashboardTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> DashboardTemplateOut:
    template = db.get(DashboardTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    template.name = payload.name.strip()
    template.code = payload.code.strip().upper()
    template.description = payload.description
    template.grafana_uid = payload.grafana_uid
    template.equipment_type = payload.equipment_type
    template.is_active = payload.is_active
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template code already exists")
    log_audit(
        db,
        action="dashboard_template_updated",
        entity_type="dashboard_template",
        entity_id=template.id,
        tenant_id=None,
        user_id=current_user.id,
        details={"code": template.code, "equipment_type": template.equipment_type, "is_active": template.is_active},
    )
    db.commit()
    db.refresh(template)
    return DashboardTemplateOut.model_validate(template)


@router.post("/dashboard-templates/{template_id}/activate", response_model=DashboardTemplateOut)
def activate_dashboard_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> DashboardTemplateOut:
    template = db.get(DashboardTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    template.is_active = True
    log_audit(
        db,
        action="dashboard_template_activated",
        entity_type="dashboard_template",
        entity_id=template.id,
        tenant_id=None,
        user_id=current_user.id,
        details={"is_active": template.is_active},
    )
    db.commit()
    db.refresh(template)
    return DashboardTemplateOut.model_validate(template)


@router.post("/dashboard-templates/{template_id}/inactivate", response_model=DashboardTemplateOut)
def inactivate_dashboard_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_system_admin),
) -> DashboardTemplateOut:
    template = db.get(DashboardTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    template.is_active = False
    log_audit(
        db,
        action="dashboard_template_inactivated",
        entity_type="dashboard_template",
        entity_id=template.id,
        tenant_id=None,
        user_id=current_user.id,
        details={"is_active": template.is_active},
    )
    db.commit()
    db.refresh(template)
    return DashboardTemplateOut.model_validate(template)


@router.get("/audit", response_model=PaginatedAuditLogs)
def list_audit_logs(
    q: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    tenant_id: int | None = None,
    limit: int = Query(default=20, ge=5, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> PaginatedAuditLogs:
    from ..models import AuditLog

    query = db.query(AuditLog).options(joinedload(AuditLog.tenant), joinedload(AuditLog.user))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(AuditLog.action.ilike(like), AuditLog.entity_type.ilike(like)))
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if tenant_id is not None:
        query = query.filter(AuditLog.tenant_id == tenant_id)
    query = query.order_by(AuditLog.created_at.desc())
    total, items = _paginate(query, limit, offset)
    return PaginatedAuditLogs(
        items=[AuditLogOut.model_validate(entry) for entry in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/summary/system-admin")
def system_admin_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_system_admin),
) -> dict[str, Any]:
    active_clients = db.query(Tenant).filter(Tenant.status == TenantStatus.ACTIVE.value).count()
    inactive_clients = db.query(Tenant).filter(Tenant.status == TenantStatus.INACTIVE.value).count()
    total_online_sensors = db.query(Sensor).filter(Sensor.status == ResourceStatus.ACTIVE.value).count()
    total_equipment = db.query(Equipment).count()
    total_open_alerts = db.query(AlertEvent).filter(AlertEvent.status == AlertStatus.OPEN.value).count()

    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.status == UserStatus.ACTIVE.value).count()
    role_counts = dict(db.query(User.role, func.count(User.id)).group_by(User.role).all())

    tenants = db.query(Tenant).order_by(Tenant.name.asc()).all()
    equipment_counts = dict(
        db.query(Equipment.tenant_id, func.count(Equipment.id)).group_by(Equipment.tenant_id).all()
    )
    sensor_counts = dict(
        db.query(Sensor.tenant_id, func.count(Sensor.id)).group_by(Sensor.tenant_id).all()
    )
    open_alert_counts = dict(
        db.query(AlertEvent.tenant_id, func.count(AlertEvent.id))
        .filter(AlertEvent.status == AlertStatus.OPEN.value)
        .group_by(AlertEvent.tenant_id)
        .all()
    )
    active_user_counts = dict(
        db.query(User.tenant_id, func.count(User.id))
        .filter(User.status == UserStatus.ACTIVE.value)
        .group_by(User.tenant_id)
        .all()
    )

    breakdown = [
        {
            "tenant_id": tenant.id,
            "name": tenant.name,
            "code": tenant.code,
            "status": tenant.status,
            "active_users": active_user_counts.get(tenant.id, 0),
            "equipment": equipment_counts.get(tenant.id, 0),
            "sensors": sensor_counts.get(tenant.id, 0),
            "open_alerts": open_alert_counts.get(tenant.id, 0),
        }
        for tenant in tenants
    ]

    recent_tenants = (
        db.query(Tenant).order_by(Tenant.created_at.desc()).limit(5).all()
    )
    recent_users = (
        db.query(User).options(joinedload(User.tenant)).order_by(User.created_at.desc()).limit(5).all()
    )
    recent_alerts = (
        db.query(AlertEvent)
        .options(joinedload(AlertEvent.tenant), joinedload(AlertEvent.equipment), joinedload(AlertEvent.sensor))
        .order_by(AlertEvent.triggered_at.desc())
        .limit(6)
        .all()
    )

    return {
        "counts": {
            "active_clients": active_clients,
            "inactive_clients": inactive_clients,
            "total_online_sensors": total_online_sensors,
            "total_equipment": total_equipment,
            "total_open_alerts": total_open_alerts,
        },
        "platform_usage": {
            "total_users": total_users,
            "active_users": active_users,
            "roles": role_counts,
        },
        "breakdown_by_client": breakdown,
        "recent_onboarding": {
            "clients": [TenantOut.model_validate(tenant) for tenant in recent_tenants],
            "users": [UserOut.model_validate(user) for user in recent_users],
        },
        "recent_alert_activity": [
            {
                "id": alert.id,
                "tenant": alert.tenant.name if alert.tenant else None,
                "equipment": alert.equipment.name if alert.equipment else None,
                "sensor": alert.sensor.name if alert.sensor else None,
                "severity": alert.severity,
                "status": alert.status,
                "triggered_at": alert.triggered_at,
                "cleared_at": alert.cleared_at,
            }
            for alert in recent_alerts
        ],
    }
