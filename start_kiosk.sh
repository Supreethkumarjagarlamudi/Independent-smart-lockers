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

# Check if we should use Docker Compose
USE_DOCKER=false
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
    USE_DOCKER=true
    echo "Docker detected. Using Docker Compose to run services..."
fi

# Clear Chromium crash flags (safeguards screen on abrupt shutdowns)
if [ -f ~/.config/chromium/Default/Preferences ]; then
    echo "Wiping Chromium exit crash states..."
    sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/g' ~/.config/chromium/Default/Preferences 2>/dev/null
    sed -i 's/"exited_cleanly":false/"exited_cleanly":true/g' ~/.config/chromium/Default/Preferences 2>/dev/null
fi

if [ "$USE_DOCKER" = true ]; then
    # 1. Start Docker Container Services
    echo "Starting Docker Compose services (in background)..."
    docker compose up -d
    
    # Wait for the containers to fully start and compile
    echo "Waiting for services to become responsive on ports 8000 and 5173..."
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null && curl -s http://localhost:8000/health > /dev/null; then
            echo "All dockerized services are online!"
            break
        fi
        sleep 2
    done
else
    # 1. Start the FastAPI Python Backend (Host Fallback)
    echo "Starting Backend API (Port 8000) on Host..."
    if [ -d "apps/local-api/.venv" ]; then
        source apps/local-api/.venv/bin/activate
    fi
    cd apps/local-api
    uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
    BACKEND_PID=$!
    cd "$PROJECT_DIR"

    # 2. Start the Vite React Frontend (Host Fallback)
    echo "Starting Frontend UI (Port 5173) on Host..."
    cd apps/kiosk-ui
    npm run dev -- --host 0.0.0.0 --port 5173 > frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd "$PROJECT_DIR"

    # Wait 5 seconds for services to initialize
    echo "Waiting for host services to warm up..."
    sleep 5
fi

# 3. Launch Chromium Browser in Fullscreen Kiosk Mode
echo "Launching Chromium in Fullscreen Kiosk Mode..."
# Disable screensaver and power saving
export DISPLAY=:0
xset s noblank 2>/dev/null
xset s off 2>/dev/null
xset -dpms 2>/dev/null

# Open Chromium pointing to the kiosk interface with Wayland/V4L2 compatibility overrides
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
    --fast-start \
    --ozone-platform=x11 \
    --use-fake-ui-for-media-stream \
    --allow-file-access-from-files &
CHROMIUM_PID=$!

echo "=== All kiosk services initialized successfully! ==="

if [ "$USE_DOCKER" = true ]; then
    # Keep script running to monitor chromium window process
    wait $CHROMIUM_PID
else
    # Keep script running to monitor all local host processes
    wait $BACKEND_PID $FRONTEND_PID $CHROMIUM_PID
fi
