"""Add admin profile fields."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260318_0004"
down_revision = "20260317_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.add_column(sa.Column("full_name", sa.String(length=160), nullable=True))
        batch_op.add_column(sa.Column("email", sa.String(length=320), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.drop_column("email")
        batch_op.drop_column("full_name")
