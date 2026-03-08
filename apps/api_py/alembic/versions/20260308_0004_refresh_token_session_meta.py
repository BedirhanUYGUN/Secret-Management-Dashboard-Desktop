"""add refresh token session metadata

Revision ID: 20260308_0004
Revises: 20260226_0003
Create Date: 2026-03-08 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260308_0004"
down_revision = "20260226_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column("session_label", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("user_agent", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("ip_address", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "last_used_at")
    op.drop_column("refresh_tokens", "ip_address")
    op.drop_column("refresh_tokens", "user_agent")
    op.drop_column("refresh_tokens", "session_label")
