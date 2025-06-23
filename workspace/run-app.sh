#!/bin/bash
# Script to run both backend (Flask) and frontend (React) for local development

# Start backend
cd "$(dirname "$0")/backend" || exit 1
(python3 app.py &)
BACKEND_PID=$!

# Start frontend
cd "../frontend" || exit 1
npm start

# Kill backend when frontend stops
kill $BACKEND_PID
