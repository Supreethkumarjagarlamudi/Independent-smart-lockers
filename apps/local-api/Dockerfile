FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies required for OpenCV/YuNet
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# 1. Install heavy ARM-binary packages via Piwheels index to save compile time
RUN pip install --no-cache-dir --timeout 100 --index-url https://www.piwheels.org/simple numpy==1.26.4 opencv-python-headless==4.8.1.78
# 2. Install pure Python packages from requirements.txt via standard PyPI (retains default hash integrity)
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run uvicorn on all interfaces so the container port is accessible
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
