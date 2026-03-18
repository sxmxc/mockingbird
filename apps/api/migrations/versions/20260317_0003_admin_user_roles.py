"""Add explicit admin roles."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260317_0003"
down_revision = "20260315_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    adminuser = sa.table(
        "adminuser",
        sa.column("role", sa.String(length=32)),
        sa.column("is_superuser", sa.Boolean()),
    )

    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.add_column(
            sa.Column("role", sa.String(length=32), nullable=True, server_default="editor"),
        )

    op.execute(
        adminuser.update().where(adminuser.c.is_superuser.is_(True)).values(role="superuser")
    )
    op.execute(adminuser.update().where(adminuser.c.role.is_(None)).values(role="editor"))

    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.alter_column(
            "role",
            existing_type=sa.String(length=32),
            nullable=False,
            server_default="editor",
        )


def downgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.drop_column("role")
