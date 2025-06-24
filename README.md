# 🎬 Video Transcriber

A modern, user-friendly web app for instantly transcribing your videos—whether they're meetings, lectures, interviews, or random clips—using Azure OpenAI Whisper and GPT. Effortlessly search, jump to moments, and ask questions about your video content to save time and boost productivity! 🚀

---

## 📚 Table of Contents
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

## 📝 Overview
Video Transcriber lets you upload any video—meetings, lectures, interviews, or just random clips—and get a fast, accurate transcription. Instantly search through the transcript, jump to specific moments, find keywords, and even ask AI-powered questions about your video. Save hours of manual review and get straight to what matters! ✨

## ✨ Features
- Upload and transcribe videos in various formats (mp4, mkv, avi, etc.)
- **Unsupported file types are automatically converted to a supported format before transcription, so you can upload almost any video!**
- Automatic audio extraction and conversion
- Accurate transcription using Azure OpenAI Whisper
- Search through the transcript and jump to video moments 🔍
- Keyword highlighting and instant navigation
- Ask prompts about the video using GPT 🤖
- Download or copy transcribed text
- Responsive UI with React Bootstrap

## 🛠️ Tech Stack
- **Frontend:** React, React Bootstrap
- **Backend:** Python Flask
- **Transcription:** Azure OpenAI Whisper
- **Other:** ffmpeg (for audio extraction)

## 🏗️ Architecture
```
[User] ⇄ [React Frontend] ⇄ [Flask Backend] ⇄ [Azure OpenAI Whisper & GPT]
```
- The frontend handles file uploads, search, and AI queries.
- The backend processes files, interacts with Azure, and returns transcriptions and GPT responses.

## ⚡ Setup & Installation
### Prerequisites
- Node.js (v18+ recommended)
- Python 3.10+
- ffmpeg
- Azure account with OpenAI Whisper and GPT deployments

### 1. Clone the Repository
```bash
git clone https://github.com/Vibe-coding-on-Agentic-DevOps/vibe-coding-poz-wro.git
cd vibe-coding-poz-wro
```

### 2. Configure Environment Variables
- Copy `workspace/backend/.env.example` to `workspace/backend/.env` (or ensure `.env` exists).
- Fill in your Azure Whisper and GPT API endpoints and keys:
  - `AZURE_OPENAI_ENDPOINT` (Whisper)
  - `AZURE_OPENAI_KEY` (Whisper)
  - `AZURE_GPT_ENDPOINT` (GPT)
  - `AZURE_GPT_KEY` (GPT)

### 3. Quick Setup (Recommended)
Run the setup script to install all dependencies:
```bash
./workspace/setup-dev.sh
```

### 4. Running the App
Start both backend and frontend with one command:
```bash
./workspace/run-app.sh
```

#### Manual Start (Optional)
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

## 🚀 Usage
1. Open the frontend in your browser (usually at http://localhost:3000).
2. Upload a video file.
3. Instantly search, jump to moments, highlight keywords, and ask questions about your video!

## ☁️ Deployment
- Designed for easy deployment to Azure (App Service, Container Apps, etc.).
- Update environment variables as needed for production.

## 🤝 Contributing
Contributions are welcome! Please open issues or submit pull requests for improvements.

## 🪪 License
This project is licensed under the MIT License.
