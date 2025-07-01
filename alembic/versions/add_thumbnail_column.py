"""add thumbnail column to transcription

Revision ID: add_thumbnail_column
Revises: f761ada052b3
Create Date: 2025-07-01
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_thumbnail_column'
down_revision = 'f761ada052b3'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('transcription', sa.Column('thumbnail', sa.String(length=256), nullable=True))

def downgrade() -> None:
    op.drop_column('transcription', 'thumbnail')
