"""change secret type from enum to free-form string

Revision ID: 20260325_0007
Revises: 20260324_0006
Create Date: 2026-03-25 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260325_0007"
down_revision = "20260324_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The type column was defined with Enum(..., native_enum=False) which stores
    # values as VARCHAR with a CHECK constraint. We need to:
    # 1. Drop the CHECK constraint that restricts values to ('key', 'token', 'endpoint')
    # 2. Alter the column type to VARCHAR(100) for explicit sizing

    # Drop the CHECK constraint. The constraint name follows SQLAlchemy's convention
    # for non-native enums: "ck_<table>_<column>" or the enum name "secret_type".
    # Try both common patterns.
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT con.conname
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
                WHERE rel.relname = 'secrets'
                  AND con.contype = 'c'
                  AND pg_get_constraintdef(con.oid) LIKE '%type%'
            )
            LOOP
                EXECUTE 'ALTER TABLE secrets DROP CONSTRAINT ' || quote_ident(r.conname);
            END LOOP;
        END $$;
    """)

    # Alter column type to VARCHAR(100)
    op.alter_column(
        "secrets",
        "type",
        existing_type=sa.VARCHAR(length=255),
        type_=sa.String(length=100),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Restore the column and add back the CHECK constraint
    op.alter_column(
        "secrets",
        "type",
        existing_type=sa.String(length=100),
        type_=sa.VARCHAR(length=255),
        existing_nullable=False,
    )

    # Re-add the CHECK constraint for the original enum values
    op.execute("""
        ALTER TABLE secrets
        ADD CONSTRAINT ck_secrets_type
        CHECK (type IN ('key', 'token', 'endpoint'))
    """)
