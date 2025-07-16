"""
Add owner_id column to Transcription table for user-specific data
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250708_add_owner_id_column_valid'
down_revision = '20230701_add_transcription_status_column'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('transcription', sa.Column('owner_id', sa.String(length=128), nullable=True, index=True))

def downgrade():
    op.drop_column('transcription', 'owner_id')
