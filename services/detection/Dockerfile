FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY services/detection/requirements.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install additional detection dependencies
RUN pip install --no-cache-dir \
    ultralytics \
    opencv-python-headless \
    pillow \
    torch \
    torchvision

# Copy detection service code
COPY services/detection/ ./services/detection/

# Copy models directory
COPY models/ ./models/

# Set Python path
ENV PYTHONPATH=/app/services/detection

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Run the application
CMD ["python", "services/detection/main.py"]
