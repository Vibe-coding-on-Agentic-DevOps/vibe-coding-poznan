from flask import Flask, request, jsonify
from flask_cors import CORS
import os

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
    # Save file temporarily
    filepath = os.path.join('/tmp', file.filename)
    file.save(filepath)
    # TODO: Call Azure OpenAI Whisper API here
    # For now, return a placeholder
    transcription = 'Transcription would appear here.'
    os.remove(filepath)
    return jsonify({'transcription': transcription})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
