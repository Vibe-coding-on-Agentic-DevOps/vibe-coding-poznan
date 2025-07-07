# Backend Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY workspace/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY workspace/backend .

# Expose backend port
EXPOSE 5000

# Use gunicorn for production
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
