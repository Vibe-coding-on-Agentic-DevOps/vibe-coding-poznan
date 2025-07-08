"""
Add segments column to Transcription table
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20230702_add_segments_column'
down_revision = 'add_thumbnail_column'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('transcription', sa.Column('segments', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('transcription', 'segments')
