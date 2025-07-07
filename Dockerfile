# --- Build frontend ---
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY workspace/frontend/package*.json ./
RUN ls -l package*.json && cat package.json
RUN npm install
COPY workspace/frontend/ ./
RUN npm run build

# --- Build backend ---
FROM python:3.10-slim AS backend
WORKDIR /app/backend
COPY workspace/backend/requirements.txt ./
RUN ls -l requirements.txt && cat requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY workspace/backend/ ./

# --- Final image ---
FROM python:3.10-slim
WORKDIR /app
COPY --from=backend /app/backend /app/backend


COPY --from=frontend-build /app/frontend/build/ /app/backend/static/

# Flatten the static directory so /static/js/* is directly accessible
RUN if [ -d /app/backend/static/static ]; then mv /app/backend/static/static/* /app/backend/static/ && rmdir /app/backend/static/static; fi


# Install ffmpeg for video/audio processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Install Python dependencies in the final image
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Expose backend port
EXPOSE 5000

# Set environment variables as needed, e.g.:
# ENV AZURE_OPENAI_KEY=...
# ENV AZURE_GPT_KEY=...

# Start Flask backend (serves React static files from /static)
CMD ["python", "backend/app.py"]
