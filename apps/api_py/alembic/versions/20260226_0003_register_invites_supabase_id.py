"""add supabase user id and project invites

Revision ID: 20260226_0003
Revises: 20260222_0002
Create Date: 2026-02-26 00:03:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260226_0003"
down_revision: Union[str, None] = "20260222_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("supabase_user_id", sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_supabase_user_id", "users", ["supabase_user_id"]
    )

    op.create_table(
        "project_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "max_uses", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "used_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code_hash", name="uq_project_invite_code_hash"),
    )


def downgrade() -> None:
    op.drop_table("project_invites")
    op.drop_constraint("uq_users_supabase_user_id", "users", type_="unique")
    op.drop_column("users", "supabase_user_id")
