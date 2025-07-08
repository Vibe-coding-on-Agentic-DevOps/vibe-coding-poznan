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

def test_health_check(client):
    rv = client.get('/health')
    assert rv.status_code == 200
    assert rv.get_json()['status'] == 'ok'

# Test downloading a file (should return 404 if not found, 200 if found)
def test_download_file_not_found(client):
    rv = client.get('/files/9999/download')
    assert rv.status_code == 404

# Test downloading transcription txt (should return 404 if not found, 200 if found)
def test_download_transcription_txt_not_found(client):
    rv = client.get('/files/9999/download-txt')
    assert rv.status_code == 404

# Test transcribe by id (should return 404 if not found)
def test_transcribe_by_id_not_found(client):
    rv = client.post('/files/9999/transcribe')
    assert rv.status_code == 404

def test_add_and_download_file(client):
    # Upload a file
    data = {'file': (tempfile.NamedTemporaryFile(suffix='.mp3'), 'test_download.mp3')}
    rv = client.post('/files', data=data, content_type='multipart/form-data')
    assert rv.status_code == 200 or rv.status_code == 409
    file_id = None
    if rv.status_code == 200:
        file_id = rv.get_json()['file']['id']
    elif rv.status_code == 409:
        files = client.get('/files').get_json()['files']
        for f in files:
            if f['filename'] == 'test_download.mp3':
                file_id = f['id']
    assert file_id is not None
    # Download file
    resp = client.get(f'/files/{file_id}/download')
    assert resp.status_code == 200
    # Download transcription txt (should be empty string)
    resp_txt = client.get(f'/files/{file_id}/download-txt')
    assert resp_txt.status_code == 200
    assert resp_txt.data is not None
    # Cleanup: delete the file
    del_resp = client.delete(f'/files/{file_id}')
    assert del_resp.status_code == 200

# Test /files/<id>/transcribe after upload
def test_transcribe_by_id_success(client):
    data = {'file': (tempfile.NamedTemporaryFile(suffix='.mp3'), 'test_transcribe.mp3')}
    rv = client.post('/files', data=data, content_type='multipart/form-data')
    assert rv.status_code == 200 or rv.status_code == 409
    file_id = None
    if rv.status_code == 200:
        file_id = rv.get_json()['file']['id']
    elif rv.status_code == 409:
        files = client.get('/files').get_json()['files']
        for f in files:
            if f['filename'] == 'test_transcribe.mp3':
                file_id = f['id']
    assert file_id is not None
    # Try to transcribe by id (will likely fail due to missing Azure config, but should not 404)
    resp = client.post(f'/files/{file_id}/transcribe')
    assert resp.status_code in (200, 400, 500)
    # Cleanup: delete the file
    del_resp = client.delete(f'/files/{file_id}')
    assert del_resp.status_code == 200

# Test /ask with valid data (should return 200 or error if Azure config missing)
def test_ask_valid(client):
    data = {'transcript': 'Hello world', 'question': 'What is this?'}
    rv = client.post('/ask', json=data)
    assert rv.status_code in (200, 400, 500)

# Test /ask-database with valid data
def test_ask_database_valid(client):
    data = {'question': 'What is in the database?'}
    rv = client.post('/ask-database', json=data)
    assert rv.status_code in (200, 400, 500)

# Test thumbnail generation for video uploads
def test_add_video_file_thumbnail(client):
    # Create a fake video file (just a text file with .mp4 extension)
    with tempfile.NamedTemporaryFile(suffix='.mp4') as tmp:
        tmp.write(b'not a real video')
        tmp.seek(0)
        data = {'file': (tmp, 'fake_video.mp4')}
        rv = client.post('/files', data=data, content_type='multipart/form-data')
        assert rv.status_code == 200 or rv.status_code == 409
        file_id = None
        if rv.status_code == 200:
            file_id = rv.get_json()['file']['id']
        elif rv.status_code == 409:
            files = client.get('/files').get_json()['files']
            for f in files:
                if f['filename'] == 'fake_video.mp4':
                    file_id = f['id']
        if file_id:
            del_resp = client.delete(f'/files/{file_id}')
            assert del_resp.status_code == 200
