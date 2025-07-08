"""
Add transcription_status column to Transcription table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20230703_add_transcription_status_column'
down_revision = '20230702_add_segments_column'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('transcription', sa.Column('transcription_status', sa.String(length=32), nullable=False, server_default='not_transcribed'))

def downgrade():
    op.drop_column('transcription', 'transcription_status')
