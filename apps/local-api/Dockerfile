FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies required for OpenCV/YuNet/NumPy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libopenblas-dev \
    libjpeg62-turbo \
    libwebp-dev \
    libpng-dev \
    libtiff-dev \
    python3-numpy \
    python3-opencv \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

# Map Python module path to use the system-installed packages
ENV PYTHONPATH=/usr/lib/python3/dist-packages

COPY requirements.txt .
# Install pure Python packages from requirements.txt via standard PyPI
RUN pip install --no-cache-dir -r requirements.txt

ARG ADMIN_PASSWORD=admin123
ARG RAZORPAY_KEY_ID=""
ARG RAZORPAY_KEY_SECRET=""

ENV ADMIN_PASSWORD=$ADMIN_PASSWORD
ENV RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID
ENV RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET

COPY . .

EXPOSE 8000

# Run uvicorn on all interfaces so the container port is accessible
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
