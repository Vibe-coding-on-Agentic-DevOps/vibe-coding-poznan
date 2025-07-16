# revision identifiers, used by Alembic.
revision = '20250716_add_unique_filename_owner'
down_revision = '20250708_add_owner_id_column'
branch_labels = None
depends_on = None
"""
Add unique constraint on (filename, owner_id) and remove unique from filename
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Remove old unique constraint if it exists
    with op.batch_alter_table('transcription') as batch_op:
        batch_op.drop_constraint('filename', type_='unique', schema=None)
        batch_op.create_unique_constraint('uix_filename_owner', ['filename', 'owner_id'])

def downgrade():
    with op.batch_alter_table('transcription') as batch_op:
        batch_op.drop_constraint('uix_filename_owner', type_='unique', schema=None)
        batch_op.create_unique_constraint('filename', ['filename'])
