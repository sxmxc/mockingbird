"""Add admin avatar URL field."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260318_0005"
down_revision = "20260318_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.add_column(sa.Column("avatar_url", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("adminuser") as batch_op:
        batch_op.drop_column("avatar_url")
