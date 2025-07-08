"""
Add owner_id column to Transcription table for user-specific data
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('transcription', sa.Column('owner_id', sa.String(length=128), nullable=True, index=True))

def downgrade():
    op.drop_column('transcription', 'owner_id')
