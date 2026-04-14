"""Add timestamps to dashboard assignments.

Revision ID: 0002_dash_assign_ts
Revises: 0001_platform_init
Create Date: 2026-04-14 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_dash_assign_ts"
down_revision = "0001_platform_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dashboard_assignments",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("dashboard_assignments", "created_at")
