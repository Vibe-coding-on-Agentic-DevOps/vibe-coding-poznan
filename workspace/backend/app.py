from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import requests
from dotenv import load_dotenv
from models import db, Transcription
from werkzeug.utils import secure_filename
import hashlib
import json

# Load .env at the very top
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def get_env_var(name, default=None):
    return os.environ.get(name) or default

AZURE_OPENAI_ENDPOINT = get_env_var('AZURE_OPENAI_ENDPOINT')
AZURE_OPENAI_KEY = get_env_var('AZURE_OPENAI_KEY')
AZURE_OPENAI_DEPLOYMENT = get_env_var('AZURE_OPENAI_DEPLOYMENT')

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///transcriptions.db'
# Increase max upload size to 500MB (adjust as needed)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024
db.init_app(app)
CORS(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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

@app.route('/files', methods=['GET'])
def list_files():
    files = Transcription.query.order_by(Transcription.created_at.desc()).all()
    return jsonify({'files': [f.to_dict() for f in files]})

@app.route('/files', methods=['POST'])
def add_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    file_content = file.read()
    file_hash = hashlib.sha256(file_content).hexdigest()
    file_size = len(file_content)
    # Check for duplicate by filename
    existing = Transcription.query.filter_by(filename=filename).first()
    if existing and existing.file_hash == file_hash and existing.file_size == file_size:
        # If hash and size match, skip and return error
        return jsonify({'error': 'File already exists.'}), 409
    elif existing:
        # Otherwise, rename
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
    # Save as a new record (no transcription)
    new_transcription = Transcription(
        filename=filename,
        transcription="",
        file_hash=file_hash,
        file_size=file_size,
        segments=None  # No segments for files without transcription
    )
    db.session.add(new_transcription)
    db.session.commit()
    return jsonify({'file': new_transcription.to_dict()})

@app.route('/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    t = db.session.get(Transcription, file_id)
    if not t:
        return jsonify({'error': 'File not found'}), 404
    # Remove file from uploads directory
    file_path = os.path.join(UPLOAD_FOLDER, t.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.session.delete(t)
    db.session.commit()
    return jsonify({'success': True})

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
    # Check for duplicate by filename
    existing = Transcription.query.filter_by(filename=filename).first()
    if existing and existing.file_hash == file_hash and existing.file_size == file_size and existing.transcription:
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
    elif existing and existing.file_hash == file_hash and existing.file_size == file_size:
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
                # Save transcription to database
                new_transcription = Transcription(
                    filename=filename,
                    transcription=transcription,
                    file_hash=file_hash,
                    file_size=file_size,
                    segments=json.dumps(word_segments)  # Save segments as JSON string
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
    # Concatenate all transcriptions
    all_transcripts = '\n\n'.join([t.transcription for t in Transcription.query.all()])
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
        return jsonify({'answer': answer})
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
