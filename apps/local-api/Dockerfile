FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies required for OpenCV/YuNet
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 100 --extra-index-url https://www.piwheels.org/simple -r requirements.txt

COPY . .

EXPOSE 8000

# Run uvicorn on all interfaces so the container port is accessible
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
