"""
Add owner_id column to Transcription table for user-specific data
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250708_add_owner_id_column'
down_revision = None  # Set this to the latest valid revision in your migration history
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('transcription', sa.Column('owner_id', sa.String(length=128), nullable=True, index=True))

def downgrade():
    op.drop_column('transcription', 'owner_id')
