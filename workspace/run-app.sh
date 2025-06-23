#!/bin/bash
# Script to run both backend (Flask) and frontend (React) for local development

# Kill any process using backend (5000) or frontend (3000) ports
fuser -k 5000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# Start backend
cd "$(dirname "$0")/backend" || exit 1
(python3 app.py &)
BACKEND_PID=$!

# Start frontend
cd "../frontend" || exit 1
npm start

# Kill backend when frontend stops
kill $BACKEND_PID
