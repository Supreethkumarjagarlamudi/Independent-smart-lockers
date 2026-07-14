#!/bin/bash

# =====================================================================
# SMART LOCKER SERVICES AUTO-START & KIOSK MODE SCRIPT
# =====================================================================
# This script starts the FastAPI backend, serves the React Vite frontend,
# and launches Chromium in fullscreen secure kiosk mode on the Pi.
# =====================================================================

# Get the directory where this script is located
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

echo "=== Starting Smart Locker Services ==="

# 1. Start the FastAPI Python Backend
echo "Starting Backend API (Port 8000)..."
if [ -d "apps/local-api/.venv" ]; then
    source apps/local-api/.venv/bin/activate
fi
cd apps/local-api
uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# 2. Start the Vite React Frontend (or serve build static files)
# For local testing, we run in dev server. For production, we can run static serve.
echo "Starting Frontend UI (Port 5173)..."
cd apps/kiosk-ui
npm run dev -- --host 0.0.0.0 --port 5173 > frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

# Wait 5 seconds for services to initialize
echo "Waiting for services to warm up..."
sleep 5

# Check if backend is alive
curl -s http://localhost:8000/api/setup/status > /dev/null
if [ $? -eq 0 ]; then
    echo "Backend API is online! [OK]"
else
    echo "Warning: Backend API did not respond, checking logs..."
fi

# 3. Launch Chromium Browser in Fullscreen Kiosk Mode
echo "Launching Chromium in Fullscreen Kiosk Mode..."
# Disable screen saver, blanking and energy saving
export DISPLAY=:0
xset s noblank
xset s off
xset -dpms

# Open Chromium pointing to the kiosk interface
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --check-for-update-interval=31536000 \
    --app=http://localhost:5173 \
    --autoplay-policy=no-user-gesture-required \
    --disable-features=TranslateUI \
    --no-first-run \
    --fast \
    --fast-start &
CHROMIUM_PID=$!

echo "=== All services launched! ==="
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Chromium PID: $CHROMIUM_PID"

# Wait for children to finish (keeps script running)
wait $BACKEND_PID $FRONTEND_PID $CHROMIUM_PID
