from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
from dotenv import load_dotenv

# Load .env at the very top
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

def get_env_var(name, default=None):
    return os.environ.get(name) or default

AZURE_OPENAI_ENDPOINT = get_env_var('AZURE_OPENAI_ENDPOINT')
AZURE_OPENAI_KEY = get_env_var('AZURE_OPENAI_KEY')
AZURE_OPENAI_DEPLOYMENT = get_env_var('AZURE_OPENAI_DEPLOYMENT')

app = Flask(__name__)
# Increase max upload size to 500MB (adjust as needed)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024
CORS(app)

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    # Accept .mkv and other video files
    allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpeg', '.mpg'}
    audio_extensions = {'.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'}
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in allowed_extensions:
        return jsonify({'error': f'File type {ext} not supported. Allowed: {', '.join(allowed_extensions)}'}), 400
    # Save file temporarily
    filepath = os.path.join('/tmp', file.filename)
    file.save(filepath)
    audio_path = filepath
    temp_audio_created = False
    if ext not in audio_extensions:
        # Convert to mp3 using ffmpeg
        audio_path = filepath + '.mp3'
        temp_audio_created = True
        import subprocess
        ffmpeg_cmd = [
            'ffmpeg', '-y', '-i', filepath, '-vn', '-acodec', 'mp3', audio_path
        ]
        result = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            os.remove(filepath)
            return jsonify({'error': 'Failed to extract audio from video.'}), 500
    try:
        # Send audio to Azure OpenAI Whisper
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
                files=files
            )
            if response.ok:
                data = response.json()
                transcription = data.get('text', '')
            else:
                return jsonify({'error': response.text}), response.status_code
    finally:
        os.remove(filepath)
        if temp_audio_created and os.path.exists(audio_path):
            os.remove(audio_path)
    return jsonify({'transcription': transcription})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
