# Video Transcription App

A modern web application for transcribing video files (e.g., meeting recordings) into text using Azure OpenAI Whisper.

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Setup & Installation](#setup--installation)
- [Usage](#usage)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview
This app enables users to upload video files and receive accurate, AI-powered transcriptions. It is designed for ease of use, scalability, and seamless integration with Azure services.

## Features
- Upload video files in various formats (mp4, mkv, avi, etc.)
- Automatic audio extraction and conversion
- Transcription using Azure OpenAI Whisper
- Real-time progress and error feedback
- Download or copy transcribed text
- Responsive UI with React Bootstrap

## Tech Stack
- **Frontend:** React, React Bootstrap
- **Backend:** Python Flask
- **Transcription:** Azure OpenAI Whisper
- **Other:** ffmpeg (for audio extraction)

## Architecture
```
[User] ⇄ [React Frontend] ⇄ [Flask Backend] ⇄ [Azure OpenAI Whisper]
```
- The frontend handles file uploads and displays results.
- The backend processes files, interacts with Azure, and returns transcriptions.

## Setup & Installation
### Prerequisites
- Node.js (v18+ recommended)
- Python 3.10+
- ffmpeg
- Azure account with OpenAI Whisper deployment

### 1. Clone the Repository
```bash
git clone https://github.com/Vibe-coding-on-Agentic-DevOps/vibe-coding-poz-wro.git
cd vibe-coding-poz-wro
```

### 2. Backend Setup
```bash
cd workspace/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Configure .env with your Azure credentials
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Start the App
- **Backend:**
  ```bash
  cd workspace/backend
  python app.py
  ```
- **Frontend:**
  ```bash
  cd workspace/frontend
  npm start
  ```

## Usage
1. Open the frontend in your browser (usually at http://localhost:3000).
2. Upload a video file.
3. Wait for processing and view/download the transcription.

## Deployment
- Designed for easy deployment to Azure (App Service, Container Apps, etc.).
- Update environment variables as needed for production.

## Contributing
Contributions are welcome! Please open issues or submit pull requests for improvements.

## License
This project is licensed under the MIT License.
