"""deactivate all users for fresh registration

Revision ID: 20260324_0006
Revises: 20260308_0005
Create Date: 2026-03-24 00:00:00
"""

from alembic import op


revision = "20260324_0006"
down_revision = "20260308_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE users SET is_active = false")
    op.execute("DELETE FROM refresh_tokens")


def downgrade() -> None:
    op.execute("UPDATE users SET is_active = true")
