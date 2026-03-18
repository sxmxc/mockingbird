"""Add admin login hardening fields."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260318_0006"
down_revision = "20260318_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.add_column(sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("last_failed_login_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("locked_until", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.drop_column("locked_until")
        batch_op.drop_column("last_failed_login_at")
        batch_op.drop_column("failed_login_attempts")
