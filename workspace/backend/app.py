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
                files=files,
                data={'response_format': 'verbose_json'}
            )
            if response.ok:
                data = response.json()
                print('Whisper response:', data)  # Debug print
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
            else:
                return jsonify({'error': response.text}), response.status_code
    finally:
        os.remove(filepath)
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
