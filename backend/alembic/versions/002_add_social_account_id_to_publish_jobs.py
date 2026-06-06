"""Add social_account_id to publish_jobs

Revision ID: 002
Revises: 001
Create Date: 2026-06-06 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "publish_jobs",
        sa.Column(
            "social_account_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_publish_jobs_social_account_id",
        "publish_jobs",
        "social_accounts",
        ["social_account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_publish_jobs_social_account_id",
        "publish_jobs",
        ["social_account_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_publish_jobs_social_account_id", table_name="publish_jobs")
    op.drop_constraint("fk_publish_jobs_social_account_id", "publish_jobs", type_="foreignkey")
    op.drop_column("publish_jobs", "social_account_id")
