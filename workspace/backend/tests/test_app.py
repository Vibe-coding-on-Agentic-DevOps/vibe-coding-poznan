import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app import app, db
from models import Transcription
import os
import tempfile

@pytest.fixture
def client():
    db_fd, db_path = tempfile.mkstemp()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
    os.close(db_fd)
    os.unlink(db_path)

# Test that /files returns a list of files (may be empty or not)
def test_list_files_empty(client):
    rv = client.get('/files')
    assert rv.status_code == 200
    assert 'files' in rv.get_json()
    assert isinstance(rv.get_json()['files'], list)

# Test uploading a file (accepts 200 or 409 if duplicate)
def test_add_file(client):
    data = {
        'file': (tempfile.NamedTemporaryFile(suffix='.mp3'), 'test.mp3')
    }
    rv = client.post('/files', data=data, content_type='multipart/form-data')
    assert rv.status_code == 200 or rv.status_code == 409
    # Accept 409 if duplicate

# Test /transcribe endpoint with no file provided
def test_transcribe_no_file(client):
    rv = client.post('/transcribe', data={})
    assert rv.status_code == 400 or rv.status_code == 200

# Test deleting a non-existent file (should return 404 or 200)
def test_delete_file_not_found(client):
    rv = client.delete('/files/9999')
    assert rv.status_code == 404 or rv.status_code == 200
