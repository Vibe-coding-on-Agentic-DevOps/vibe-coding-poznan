#!/bin/bash
# Setup script for local development

# Install Python requirements
cd "$(dirname "$0")/backend" || exit 1
pip install -r requirements.txt

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
  echo "ffmpeg not found, installing..."
  if [ -x "$(command -v apt-get)" ]; then
    sudo apt-get update && sudo apt-get install -y ffmpeg
  elif [ -x "$(command -v yum)" ]; then
    sudo yum install -y epel-release && sudo yum install -y ffmpeg
  elif [ -x "$(command -v brew)" ]; then
    brew install ffmpeg
  else
    echo "Please install ffmpeg manually."
    exit 1
  fi
fi

# Ensure .env exists in backend
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ".env file created from .env.example."
  else
    echo ".env.example not found. Please create your .env file manually."
    exit 1
  fi
fi

# Install Node.js dependencies
cd ../frontend || exit 1
npm install

echo "\nSetup complete!"
echo "Open two terminals and run the following commands:"
echo "1. cd $(pwd)/../backend && python3 app.py" 
echo "2. cd $(pwd) && npm start"
