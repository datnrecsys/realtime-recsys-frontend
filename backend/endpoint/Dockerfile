# Backend Dockerfile for FastAPI
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8001

# Start FastAPI server
CMD ["uvicorn", "endpoint:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
