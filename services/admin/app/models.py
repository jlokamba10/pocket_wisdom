from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    name = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    client_id = Column(Integer, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    location = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    name = Column(String(128), nullable=False)
    rule_type = Column(String(32), nullable=False)
    metric = Column(String(64), nullable=False)
    threshold = Column(String(32), nullable=True)
    window_seconds = Column(Integer, nullable=True)
    enabled = Column(Boolean, default=True)
    webhook_url = Column(Text, nullable=True)
    email = Column(String(128), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
