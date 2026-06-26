"""add events column to messages table

Revision ID: d2e8f1a3b5c7
Revises: c1fa944bc484
Create Date: 2026-06-26 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e8f1a3b5c7'
down_revision: Union[str, None] = 'c1fa944bc484'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('events', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'events')
