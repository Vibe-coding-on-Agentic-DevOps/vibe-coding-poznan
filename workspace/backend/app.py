from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import requests
from dotenv import load_dotenv
from models import db, Transcription
from werkzeug.utils import secure_filename
import hashlib
import json
import subprocess
from sqlalchemy import text

# Load .env at the very top
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def get_env_var(name, default=None):
    return os.environ.get(name) or default

AZURE_OPENAI_ENDPOINT = get_env_var('AZURE_OPENAI_ENDPOINT')
AZURE_OPENAI_KEY = get_env_var('AZURE_OPENAI_KEY')
AZURE_OPENAI_DEPLOYMENT = get_env_var('AZURE_OPENAI_DEPLOYMENT')

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///transcriptions.db'
# Remove or comment out the max upload size limit
# app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024
db.init_app(app)
CORS(app)

print(f"[DEBUG] Using database file: {app.config['SQLALCHEMY_DATABASE_URI']}")
print('Using database URI:', app.config['SQLALCHEMY_DATABASE_URI'])

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
THUMBNAIL_FOLDER = os.path.join(UPLOAD_FOLDER, 'thumbnails')
os.makedirs(THUMBNAIL_FOLDER, exist_ok=True)

with app.app_context():
    db.create_all()
    
    # Check if segments column exists, if not add it
    from sqlalchemy import text
    try:
        result = db.session.execute(text("PRAGMA table_info(transcription);"))
        columns = [row[1] for row in result.fetchall()]
        if 'segments' not in columns:
            db.session.execute(text("ALTER TABLE transcription ADD COLUMN segments TEXT;"))
            db.session.commit()
            print("Added segments column to transcription table")
    except Exception as e:
        print(f"Error checking/adding segments column: {e}")
        db.session.rollback()

def generate_thumbnail(video_path, thumbnail_path):
    """Generate a thumbnail for a video file using ffmpeg."""
    cmd = [
        'ffmpeg', '-y', '-i', video_path, '-ss', '00:00:01.000', '-vframes', '1', thumbnail_path
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return result.returncode == 0

@app.route('/thumbnails/<filename>')
def get_thumbnail(filename):
    return send_from_directory(THUMBNAIL_FOLDER, filename)

@app.route('/files', methods=['GET'])
def list_files():
    # Try to get user info from Azure App Service authentication headers
    user_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    user_email = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')
    # Fallback to query param for backward compatibility
    if not user_id:
        user_id = request.args.get('userId')
    db_mode = request.args.get('dbMode', 'global')
    # If db_mode is not provided, but user_id is present, default to private
    if not db_mode and user_id:
        db_mode = 'private'
    query = Transcription.query
    if db_mode == 'private' and user_id:
        query = query.filter(Transcription.owner_id == user_id)
    elif db_mode == 'global':
        query = query.filter(Transcription.owner_id == None)
    files = query.order_by(Transcription.created_at.desc()).all()
    return jsonify({'files': [f.to_dict() for f in files], 'user': user_email or user_id})

@app.route('/files', methods=['POST'])
def add_file():
    # Try to get user info from Azure App Service authentication headers
    user_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    user_email = request.headers.get('X-MS-CLIENT-PRINCIPAL-NAME')
    # Fallback to form param for backward compatibility
    if not user_id:
        user_id = request.form.get('userId')
    db_mode = request.form.get('dbMode', 'global')
    if not db_mode and user_id:
        db_mode = 'private'
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    # File type validation (allow only video/audio)
    allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg', '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.mpga', '.oga'}
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_extensions:
        allowed_list = ', '.join(allowed_extensions)
        return jsonify({'error': f'File type {ext} not supported. Allowed: {allowed_list}'}), 400
    file_content = file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()
    file_size = len(file_content)
    # Check for duplicate by filename
    existing = Transcription.query.filter_by(filename=filename).first()
    if existing and existing.file_hash == file_hash and existing.file_size == file_size:
        return jsonify({'error': 'File already exists.'}), 409
    elif existing:
        base, ext = os.path.splitext(filename)
        i = 1
        while True:
            new_filename = f"{base}_{i}{ext}"
            if not Transcription.query.filter_by(filename=new_filename).first():
                filename = new_filename
                break
            i += 1
    # Save file to uploads directory
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    with open(file_path, 'wb') as f_out:
        f_out.write(file_content)
    # Generate thumbnail if video
    ext = os.path.splitext(filename)[1].lower()
    video_exts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg']
    thumbnail_filename = None
    if ext in video_exts:
        thumbnail_filename = f"{os.path.splitext(filename)[0]}.jpg"
        thumbnail_path = os.path.join(THUMBNAIL_FOLDER, thumbnail_filename)
        if not generate_thumbnail(file_path, thumbnail_path):
            thumbnail_filename = None
    # Save as a new record (no transcription)
    new_transcription = Transcription(
        filename=filename,
        transcription="",
        file_hash=file_hash,
        file_size=file_size,
        segments=None,
        thumbnail=thumbnail_filename,
        transcription_status="not_transcribed",
        owner_id=user_id if db_mode == 'private' and user_id else None
    )
    db.session.add(new_transcription)
    db.session.commit()
    return jsonify({'file': new_transcription.to_dict()})

@app.route('/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    user_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    if not user_id:
        user_id = request.args.get('userId')
    db_mode = request.args.get('dbMode', 'global')
    if not db_mode and user_id:
        db_mode = 'private'
    t = db.session.get(Transcription, file_id)
    if not t:
        return jsonify({'error': 'File not found'}), 404
    if db_mode == 'private' and user_id and t.owner_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    if db_mode == 'global' and t.owner_id is not None:
        return jsonify({'error': 'Unauthorized'}), 403
    # Remove file from uploads directory
    file_path = os.path.join(UPLOAD_FOLDER, t.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.session.delete(t)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/files/batch-delete', methods=['POST'])
def batch_delete_files():
    data = request.get_json()
    user_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    if not user_id:
        user_id = data.get('userId')
    db_mode = data.get('dbMode', 'global')
    if not db_mode and user_id:
        db_mode = 'private'
    if not data or 'file_ids' not in data:
        return jsonify({'error': 'No file_ids provided'}), 400
    
    file_ids = data['file_ids']
    if not isinstance(file_ids, list):
        return jsonify({'error': 'file_ids must be an array'}), 400
    
    deleted_count = 0
    errors = []
    
    for file_id in file_ids:
        try:
            t = db.session.get(Transcription, file_id)
            if not t:
                errors.append(f'File {file_id} not found')
                continue
            if db_mode == 'private' and user_id and t.owner_id != user_id:
                errors.append(f'Unauthorized to delete file {file_id}')
                continue
            if db_mode == 'global' and t.owner_id is not None:
                errors.append(f'Unauthorized to delete file {file_id}')
                continue
            
            # Remove file from uploads directory
            file_path = os.path.join(UPLOAD_FOLDER, t.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Remove thumbnail if exists
            if t.thumbnail:
                thumbnail_path = os.path.join(THUMBNAIL_FOLDER, t.thumbnail)
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
            
            db.session.delete(t)
            deleted_count += 1
        except Exception as e:
            errors.append(f'Error deleting file {file_id}: {str(e)}')
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'deleted_count': deleted_count,
        'errors': errors
    })

@app.route('/files/all', methods=['DELETE'])
def delete_all_files():
    user_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    if not user_id:
        user_id = request.args.get('userId')
    db_mode = request.args.get('dbMode', 'global')
    if not db_mode and user_id:
        db_mode = 'private'
    try:
        query = Transcription.query
        if db_mode == 'private' and user_id:
            query = query.filter(Transcription.owner_id == user_id)
        elif db_mode == 'global':
            query = query.filter(Transcription.owner_id == None)
        files = query.all()
        deleted_count = 0
        
        for t in files:
            # Remove file from uploads directory
            file_path = os.path.join(UPLOAD_FOLDER, t.filename)
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Remove thumbnail if exists
            if t.thumbnail:
                thumbnail_path = os.path.join(THUMBNAIL_FOLDER, t.thumbnail)
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
            
            db.session.delete(t)
            deleted_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'deleted_count': deleted_count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting all files: {str(e)}'}), 500

@app.route('/files/batch-transcribe', methods=['POST'])
def batch_transcribe_files():
    data = request.get_json()
    user_id = request.headers.get('X-MS-CLIENT-PRINCIPAL-ID')
    if not user_id:
        user_id = data.get('userId')
    db_mode = data.get('dbMode', 'global')
    if not db_mode and user_id:
        db_mode = 'private'
    if not data or 'file_ids' not in data:
        return jsonify({'error': 'No file_ids provided'}), 400
    
    file_ids = data['file_ids']
    if not isinstance(file_ids, list):
        return jsonify({'error': 'file_ids must be an array'}), 400
    
    success_count = 0
    errors = []
    
    for file_id in file_ids:
        try:
            t = db.session.get(Transcription, file_id)
            if not t:
                errors.append(f'File {file_id} not found')
                continue
            if db_mode == 'private' and user_id and t.owner_id != user_id:
                errors.append(f'Unauthorized to transcribe file {file_id}')
                continue
            if db_mode == 'global' and t.owner_id is not None:
                errors.append(f'Unauthorized to transcribe file {file_id}')
                continue
            file_path = os.path.join(UPLOAD_FOLDER, t.filename)
            if not os.path.exists(file_path):
                errors.append(f'File {file_id} not found on server')
                continue
            ext = os.path.splitext(t.filename)[1].lower()
            audio_extensions = {'.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'}
            audio_path = file_path
            temp_audio_created = False
            if ext not in audio_extensions:
                audio_path = file_path + '.mp3'
                temp_audio_created = True
                ffmpeg_cmd = [
                    'ffmpeg', '-y', '-i', file_path, '-vn', '-acodec', 'mp3', audio_path
                ]
                result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if result.returncode != 0:
                    errors.append(f'Failed to extract audio from video for file {file_id}')
                    continue
            try:
                with open(audio_path, 'rb') as audio_file:
                    headers = {'api-key': AZURE_OPENAI_KEY}
                    files = {'file': (os.path.basename(audio_path), audio_file, 'audio/mpeg')}
                    response = requests.post(
                        AZURE_OPENAI_ENDPOINT,
                        headers=headers,
                        files=files,
                        data={'response_format': 'verbose_json'}
                    )
                    if response.ok:
                        data = response.json()
                        transcription = data.get('text', '')
                        segments = data.get('segments', [])
                        word_segments = []
                        has_words = False
                        for seg in segments:
                            if 'words' in seg and seg['words']:
                                has_words = True
                                for word in seg['words']:
                                    word_segments.append({
                                        'text': word['word'],
                                        'start': word['start'],
                                        'end': word['end']
                                    })
                        if not has_words:
                            chunk_size = 3
                            for seg in segments:
                                words = seg.get('text', '').split()
                                start = seg.get('start', 0)
                                end = seg.get('end', 0)
                                if not words:
                                    continue
                                duration = (end - start) / max(len(words), 1) if end > start else 0
                                for i in range(0, len(words), chunk_size):
                                    chunk_words = words[i:i+chunk_size]
                                    chunk_start = start + (i * duration)
                                    chunk_end = chunk_start + (len(chunk_words) * duration)
                                    word_segments.append({
                                        'text': ' '.join(chunk_words),
                                        'start': chunk_start,
                                        'end': chunk_end
                                    })
                        if not word_segments:
                            word_segments = [{
                                'text': transcription,
                                'start': 0,
                                'end': 0
                            }]
                        t.transcription = transcription
                        t.segments = json.dumps(word_segments)
                        t.transcription_status = 'transcribed'
                        success_count += 1
                    else:
                        errors.append(f'Failed to transcribe file {file_id}: {response.text}')
            except Exception as e:
                errors.append(f'Error transcribing file {file_id}: {str(e)}')
            finally:
                if temp_audio_created and os.path.exists(audio_path):
                    os.remove(audio_path)
        except Exception as e:
            errors.append(f'Error processing file {file_id}: {str(e)}')
    db.session.commit()
    return jsonify({
        'success': True,
        'transcribed_count': success_count,
        'errors': errors
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg'}
    audio_extensions = {'.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'}
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in allowed_extensions:
        allowed = ', '.join(allowed_extensions)
        return jsonify({'error': f'File type {ext} not supported. Allowed: {allowed}'}), 400
    filename = secure_filename(file.filename)
    file_content = file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()
    file_size = len(file_content)
    # --- DB Mode logic ---
    db_mode = request.form.get('dbMode', 'private')
    user_id = request.form.get('userId')
    if db_mode == 'private' and user_id:
        owner_id = user_id
    else:
        owner_id = None
    # Check for duplicate by filename, file hash, file size, and owner_id
    existing = Transcription.query.filter_by(filename=filename, file_hash=file_hash, file_size=file_size, owner_id=owner_id).first()
    if existing and existing.transcription:
        # Return the existing transcription and saved segments
        segments_data = []
        if existing.segments:
            try:
                segments_data = json.loads(existing.segments)
            except (json.JSONDecodeError, TypeError):
                # Fallback to fake segments if JSON parsing fails
                words = existing.transcription.split()
                chunk_size = 3
                for i in range(0, len(words), chunk_size):
                    chunk_words = words[i:i+chunk_size]
                    segments_data.append({
                        'text': ' '.join(chunk_words),
                        'start': i,  # fake start
                        'end': i + len(chunk_words)  # fake end
                    })
        if not segments_data:
            segments_data = [{
                'text': existing.transcription,
                'start': 0,
                'end': 0
            }]
        return jsonify({'transcription': existing.transcription, 'segments': segments_data, 'filename': existing.filename}), 200
    elif existing and not existing.transcription:
        # If file exists but is not transcribed, run transcription and update the record
        # Save uploaded file (overwrite)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        with open(file_path, 'wb') as f_out:
            f_out.write(file_content)
        ext = os.path.splitext(filename)[1].lower()
        video_exts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg']
        thumbnail_filename = None
        if ext in video_exts:
            thumbnail_filename = f"{os.path.splitext(filename)[0]}.jpg"
            thumbnail_path = os.path.join(THUMBNAIL_FOLDER, thumbnail_filename)
            if not generate_thumbnail(file_path, thumbnail_path):
                thumbnail_filename = None
        audio_path = file_path
        temp_audio_created = False
        if ext not in audio_extensions:
            audio_path = file_path + '.mp3'
            temp_audio_created = True
            import subprocess
            ffmpeg_cmd = [
                'ffmpeg', '-y', '-i', file_path, '-vn', '-acodec', 'mp3', audio_path
            ]
            result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode != 0:
                os.remove(file_path)
                return jsonify({'error': 'Failed to extract audio from video.'}), 500
        try:
            with open(audio_path, 'rb') as audio_file:
                headers = {'api-key': AZURE_OPENAI_KEY}
                files = {'file': (os.path.basename(audio_path), audio_file, 'audio/mpeg')}
                response = requests.post(
                    AZURE_OPENAI_ENDPOINT,
                    headers=headers,
                    files=files,
                    data={'response_format': 'verbose_json'}
                )
                if response.ok:
                    data = response.json()
                    transcription = data.get('text', '')
                    segments = data.get('segments', [])
                    word_segments = []
                    has_words = False
                    for seg in segments:
                        if 'words' in seg and seg['words']:
                            has_words = True
                            for word in seg['words']:
                                word_segments.append({
                                    'text': word['word'],
                                    'start': word['start'],
                                    'end': word['end']
                                })
                    if not has_words:
                        chunk_size = 3
                        for seg in segments:
                            words = seg.get('text', '').split()
                            start = seg.get('start', 0)
                            end = seg.get('end', 0)
                            if not words:
                                continue
                            duration = (end - start) / max(len(words), 1) if end > start else 0
                            for i in range(0, len(words), chunk_size):
                                chunk_words = words[i:i+chunk_size]
                                chunk_start = start + (i * duration)
                                chunk_end = chunk_start + (len(chunk_words) * duration)
                                word_segments.append({
                                    'text': ' '.join(chunk_words),
                                    'start': chunk_start,
                                    'end': chunk_end
                                })
                    if not word_segments:
                        word_segments = [{
                            'text': transcription,
                            'start': 0,
                            'end': 0
                        }]
                    # Update the existing record
                    existing.transcription = transcription
                    existing.segments = json.dumps(word_segments)
                    existing.transcription_status = 'transcribed'
                    existing.thumbnail = thumbnail_filename
                    db.session.commit()
                else:
                    return jsonify({'error': response.text}), response.status_code
        finally:
            if temp_audio_created and os.path.exists(audio_path):
                os.remove(audio_path)
        return jsonify({'transcription': existing.transcription, 'segments': json.loads(existing.segments), 'filename': existing.filename}), 200
    elif existing:
        # Return empty transcription (should not happen, but for safety)
        return jsonify({'transcription': existing.transcription, 'segments': []}), 200
    elif existing:
        # If filename exists but is not a true duplicate, rename
        base, ext2 = os.path.splitext(filename)
        i = 1
        while True:
            new_filename = f"{base}_{i}{ext2}"
            if not Transcription.query.filter_by(filename=new_filename).first():
                filename = new_filename
                break
            i += 1
    # Save file to uploads directory
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    with open(file_path, 'wb') as f_out:
        f_out.write(file_content)
    # Generate thumbnail if video
    ext = os.path.splitext(filename)[1].lower()
    video_exts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg']
    thumbnail_filename = None
    if ext in video_exts:
        thumbnail_filename = f"{os.path.splitext(filename)[0]}.jpg"
        thumbnail_path = os.path.join(THUMBNAIL_FOLDER, thumbnail_filename)
        if not generate_thumbnail(file_path, thumbnail_path):
            thumbnail_filename = None
    audio_path = file_path  # Use uploads path for processing
    temp_audio_created = False
    if ext not in audio_extensions:
        audio_path = file_path + '.mp3'
        temp_audio_created = True
        import subprocess
        ffmpeg_cmd = [
            'ffmpeg', '-y', '-i', file_path, '-vn', '-acodec', 'mp3', audio_path
        ]
        result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            os.remove(file_path)
            return jsonify({'error': 'Failed to extract audio from video.'}), 500
    try:
        with open(audio_path, 'rb') as audio_file:
            headers = {
                'api-key': AZURE_OPENAI_KEY,
            }
            files = {
                'file': (os.path.basename(audio_path), audio_file, 'audio/mpeg')
            }
            response = requests.post(
                AZURE_OPENAI_ENDPOINT,
                headers=headers,
                files=files,
                data={'response_format': 'verbose_json'}
            )
            if response.ok:
                data = response.json()
                transcription = data.get('text', '')
                segments = data.get('segments', [])
                word_segments = []
                has_words = False
                for seg in segments:
                    if 'words' in seg and seg['words']:
                        has_words = True
                        for word in seg['words']:
                            word_segments.append({
                                'text': word['word'],
                                'start': word['start'],
                                'end': word['end']
                            })
                # If word-level is not available, split segment text into small chunks (e.g., 3 words) and estimate timings
                if not has_words:
                    chunk_size = 3  # You can adjust this for finer or coarser chunks
                    for seg in segments:
                        words = seg.get('text', '').split()
                        start = seg.get('start', 0)
                        end = seg.get('end', 0)
                        if not words:
                            continue
                        duration = (end - start) / max(len(words), 1) if end > start else 0
                        for i in range(0, len(words), chunk_size):
                            chunk_words = words[i:i+chunk_size]
                            chunk_start = start + (i * duration)
                            chunk_end = chunk_start + (len(chunk_words) * duration)
                            word_segments.append({
                                'text': ' '.join(chunk_words),
                                'start': chunk_start,
                                'end': chunk_end
                            })
                if not word_segments:
                    # Fallback: single segment for the whole transcription
                    word_segments = [{
                        'text': transcription,
                        'start': 0,
                        'end': 0
                    }]
                # Save transcription to database with correct owner_id
                new_transcription = Transcription(
                    filename=filename,
                    transcription=transcription,
                    file_hash=file_hash,
                    file_size=file_size,
                    segments=json.dumps(word_segments),
                    thumbnail=thumbnail_filename,
                    transcription_status="transcribed",
                    owner_id=owner_id
                )
                db.session.add(new_transcription)
                db.session.commit()
            else:
                return jsonify({'error': response.text}), response.status_code
    finally:
        # Do NOT delete the uploaded file from uploads
        # Only remove temp audio if created
        if temp_audio_created and os.path.exists(audio_path):
            os.remove(audio_path)
    return jsonify({'transcription': transcription, 'segments': word_segments})

@app.route('/files/<int:file_id>/transcribe', methods=['POST'])
def transcribe_by_id(file_id):
    t = db.session.get(Transcription, file_id)
    if not t:
        return jsonify({'error': 'File not found'}), 404
    if t.transcription_status == 'transcribed':
        return jsonify({'error': 'Already transcribed', 'file': t.to_dict()}), 400
    file_path = os.path.join(UPLOAD_FOLDER, t.filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found on server'}), 404
    # Extract audio if needed
    ext = os.path.splitext(t.filename)[1].lower()
    audio_extensions = {'.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'}
    audio_path = file_path
    temp_audio_created = False
    if ext not in audio_extensions:
        audio_path = file_path + '.mp3'
        temp_audio_created = True
        ffmpeg_cmd = [
            'ffmpeg', '-y', '-i', file_path, '-vn', '-acodec', 'mp3', audio_path
        ]
        result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            return jsonify({'error': 'Failed to extract audio from video.'}), 500
    try:
        with open(audio_path, 'rb') as audio_file:
            headers = {'api-key': AZURE_OPENAI_KEY}
            files = {'file': (os.path.basename(audio_path), audio_file, 'audio/mpeg')}
            response = requests.post(
                AZURE_OPENAI_ENDPOINT,
                headers=headers,
                files=files,
                data={'response_format': 'verbose_json'}
            )
            if response.ok:
                data = response.json()
                transcription = data.get('text', '')
                segments = data.get('segments', [])
                word_segments = []
                has_words = False
                for seg in segments:
                    if 'words' in seg and seg['words']:
                        has_words = True
                        for word in seg['words']:
                            word_segments.append({
                                'text': word['word'],
                                'start': word['start'],
                                'end': word['end']
                            })
                if not has_words:
                    chunk_size = 3
                    for seg in segments:
                        words = seg.get('text', '').split()
                        start = seg.get('start', 0)
                        end = seg.get('end', 0)
                        if not words:
                            continue
                        duration = (end - start) / max(len(words), 1) if end > start else 0
                        for i in range(0, len(words), chunk_size):
                            chunk_words = words[i:i+chunk_size]
                            chunk_start = start + (i * duration)
                            chunk_end = chunk_start + (len(chunk_words) * duration)
                            word_segments.append({
                                'text': ' '.join(chunk_words),
                                'start': chunk_start,
                                'end': chunk_end
                            })
                if not word_segments:
                    word_segments = [{
                        'text': transcription,
                        'start': 0,
                        'end': 0
                    }]
                t.transcription = transcription
                t.segments = json.dumps(word_segments)
                t.transcription_status = 'transcribed'
                db.session.commit()
                return jsonify({'file': t.to_dict()})
            else:
                return jsonify({'error': response.text}), response.status_code
    finally:
        if temp_audio_created and os.path.exists(audio_path):
            os.remove(audio_path)
@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()
    transcript = data.get('transcript')
    question = data.get('question')
    if not transcript or not question:
        return jsonify({'error': 'Transcript and question are required.'}), 400
    prompt = f"Transcript:\n{transcript}\n\nQuestion: {question}\nAnswer:"
    headers = {
        'api-key': get_env_var('AZURE_GPT_KEY'),
        'Content-Type': 'application/json'
    }
    payload = {
        'messages': [
            {"role": "system", "content": "You are a helpful assistant that answers questions based only on the provided transcript."},
            {"role": "user", "content": prompt}
        ]
    }
    response = requests.post(
        get_env_var('AZURE_GPT_ENDPOINT'),
        headers=headers,
        json=payload
    )
    if response.ok:
        data = response.json()
        answer = data['choices'][0]['message']['content']
        return jsonify({'answer': answer})
    else:
        return jsonify({'error': response.text}), response.status_code

@app.route('/search', methods=['GET'])
def search_transcriptions():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'results': []})
    results = Transcription.query.filter(Transcription.transcription.ilike(f'%{query}%')).all()
    return jsonify({'results': [t.to_dict() for t in results]})

@app.route('/ask-database', methods=['POST'])
def ask_database():
    data = request.get_json()
    question = data.get('question')
    if not question:
        return jsonify({'error': 'Question is required.'}), 400
    # Gather all transcriptions and their sources
    transcriptions = Transcription.query.all()
    all_transcripts = '\n\n'.join([t.transcription for t in transcriptions])
    sources = [
        {'id': t.id, 'filename': t.filename, 'created_at': t.created_at.isoformat() if t.created_at else None}
        for t in transcriptions
    ]
    prompt = f"Database of transcripts:\n{all_transcripts}\n\nQuestion: {question}\nAnswer:"
    headers = {
        'api-key': get_env_var('AZURE_GPT_KEY'),
        'Content-Type': 'application/json'
    }
    payload = {
        'messages': [
            {"role": "system", "content": "You are a helpful assistant that answers questions based only on the provided database of transcripts."},
            {"role": "user", "content": prompt}
        ]
    }
    response = requests.post(
        get_env_var('AZURE_GPT_ENDPOINT'),
        headers=headers,
        json=payload
    )
    if response.ok:
        data = response.json()
        answer = data['choices'][0]['message']['content']
        return jsonify({'answer': answer, 'sources': sources})
    else:
        return jsonify({'error': response.text}), response.status_code

@app.route('/files/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    t = db.session.get(Transcription, file_id)
    if not t:
        return jsonify({'error': 'File not found'}), 404
    file_path = os.path.join(UPLOAD_FOLDER, t.filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not available on server'}), 404
    return send_file(file_path, as_attachment=True, download_name=t.filename)

@app.route('/files/<int:file_id>/download-txt', methods=['GET'])
def download_transcription_txt(file_id):
    t = db.session.get(Transcription, file_id)
    if not t:
        return jsonify({'error': 'File not found'}), 404
    from io import BytesIO
    txt_content = t.transcription or ''
    filename = os.path.splitext(t.filename)[0] + '.txt'
    return send_file(
        BytesIO(txt_content.encode('utf-8')),
        as_attachment=True,
        download_name=filename,
        mimetype='text/plain'
    )


# --- Serve React frontend for all non-API routes ---
import os
from flask import send_from_directory

# This must be after all other @app.route definitions
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    static_folder = os.path.join(os.path.dirname(__file__), 'static')
    if path != "" and os.path.exists(os.path.join(static_folder, path)):
        return send_from_directory(static_folder, path)
    else:
        return send_from_directory(static_folder, 'index.html')

@app.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for Azure App Service, Container Apps, or Kubernetes.
    Returns 200 OK if the app and DB are reachable.
    """
    try:
        # Use SQLAlchemy text() for raw SQL
        db.session.execute(text('SELECT 1'))
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        print(f"[HEALTH CHECK ERROR] {e}")
        return jsonify({'status': 'error', 'details': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
