import os
import base64
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import openai

app = Flask(__name__)
CORS(app)

# Set your Azure OpenAI API key and endpoint as environment variables
OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY')
OPENAI_API_BASE = os.getenv('AZURE_OPENAI_API_BASE')
OPENAI_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION', '2023-12-01-preview')
OPENAI_DEPLOYMENT_ID = os.getenv('AZURE_OPENAI_DEPLOYMENT_ID')

openai.api_type = 'azure'
openai.api_key = OPENAI_API_KEY
openai.api_base = OPENAI_API_BASE
openai.api_version = OPENAI_API_VERSION


def pixelate_image(image: Image.Image, pixel_size: int = 8) -> Image.Image:
    # Resize down and up to pixelate
    small = image.resize(
        (image.width // pixel_size, image.height // pixel_size),
        resample=Image.NEAREST
    )
    return small.resize(image.size, Image.NEAREST)


@app.route('/generate-pixel-art', methods=['POST'])
def generate_pixel_art():
    data = request.json
    drawing_b64 = data.get('drawing')
    prompt = data.get('prompt')
    pixelate = data.get('pixelate', False)

    # Decode base64 image
    image_data = base64.b64decode(drawing_b64.split(',')[-1])
    image = Image.open(BytesIO(image_data)).convert('RGBA')

    if pixelate:
        image = pixelate_image(image)

    # Optionally, save or process the image further
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    # Call Azure OpenAI DALL·E
    try:
        response = openai.Image.create(
            prompt=prompt,
            n=1,
            size="256x256",
            response_format="b64_json",
            deployment_id=OPENAI_DEPLOYMENT_ID
        )
        generated_b64 = response['data'][0]['b64_json']
        return jsonify({
            'generated_image': generated_b64
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
