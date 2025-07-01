"""
Add transcription_status column to transcription table
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('transcription', sa.Column('transcription_status', sa.String(length=32), nullable=False, server_default='not_transcribed'))

def downgrade():
    op.drop_column('transcription', 'transcription_status')
