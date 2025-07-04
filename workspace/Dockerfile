# --- Build frontend ---
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Build backend ---
FROM python:3.10-slim AS backend
WORKDIR /app/backend
COPY workspace/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY workspace/backend/ ./

# --- Final image ---
FROM python:3.10-slim
WORKDIR /app
COPY --from=backend /app/backend /app/backend
COPY --from=frontend-build /app/frontend/build /app/backend/static

# Expose backend port
EXPOSE 5000

# Set environment variables as needed, e.g.:
# ENV AZURE_OPENAI_KEY=...
# ENV AZURE_GPT_KEY=...

# Start Flask backend (serves React static files from /static)
CMD ["python", "backend/app.py"]
