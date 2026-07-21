#!/bin/bash

# =====================================================================
# RASPBERRY PI 4 / 5 - ONE-CLICK SMART LOCKER SEAMLESS INSTALLER
# =====================================================================
# Installs system dependencies, Docker, Brave Browser, dialout/serial
# permissions, pulls pre-built container registry images, starts
# services, and configures graphical desktop autostart kiosk mode.
# =====================================================================

if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this script with sudo:"
  echo "   sudo ./install_kiosk.sh"
  exit 1
fi

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REAL_USER="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo "~$REAL_USER")

echo "================================================================"
echo "      🚀 STARTING SMART LOCKER SEAMLESS KIOSK INSTALLER         "
echo "================================================================"

echo "---> 1/6: Installing Host Package Dependencies..."
apt-get update -qq
apt-get install -y -qq curl git x11-xserver-utils ca-certificates > /dev/null

# Install Brave Browser if missing
if ! command -v brave-browser &> /dev/null; then
    echo "---> Installing Brave Browser..."
    curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" | tee /etc/apt/sources.list.d/brave-browser-release.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq brave-browser > /dev/null
fi

echo "---> 2/6: Installing Docker Engine..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
    systemctl enable docker
    systemctl start docker
fi

echo "---> 3/6: Setting Hardware & Container Access Permissions..."
# Add user to docker and dialout (USB serial controller hardware access)
usermod -aG docker "$REAL_USER" 2>/dev/null
usermod -aG dialout "$REAL_USER" 2>/dev/null

# Clean up any legacy erroneous directory mounts if present
if [ -d "$PROJECT_DIR/apps/local-api/smart_lockers.db" ]; then
    echo "Cleaning legacy folder mount..."
    rm -rf "$PROJECT_DIR/apps/local-api/smart_lockers.db"
fi

# Ensure workspace data and models directory exist
mkdir -p "$PROJECT_DIR/apps/local-api/data"
mkdir -p "$PROJECT_DIR/apps/local-api/models_cache"
chown -R "$REAL_USER:$REAL_USER" "$PROJECT_DIR/apps/local-api/data" "$PROJECT_DIR/apps/local-api/models_cache"

echo "---> 4/6: Pulling & Launching Pre-Built Docker Services..."
cd "$PROJECT_DIR"
# Pull pre-compiled images directly from Docker Hub (NO compile delay on Pi!)
sudo -u "$REAL_USER" docker compose pull
# Start containers in background
sudo -u "$REAL_USER" docker compose up -d

echo "---> 5/6: Configuring Desktop Kiosk Autostart..."
chmod +x "$PROJECT_DIR/start_kiosk.sh"
chmod +x "$PROJECT_DIR/install_kiosk.sh"

AUTOSTART_DIR="$USER_HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat <<EOF > "$AUTOSTART_DIR/smart_locker.desktop"
[Desktop Entry]
Type=Application
Name=Smart Locker Kiosk
Exec=$PROJECT_DIR/start_kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

chown -R "$REAL_USER:$REAL_USER" "$USER_HOME/.config"

echo "---> 6/6: Configuring OS Boot Parameters..."
if [ -f /etc/lightdm/lightdm.conf ]; then
    sed -i "s/#autologin-user=/autologin-user=$REAL_USER/g" /etc/lightdm/lightdm.conf
fi

echo "================================================================"
echo "   ✅ SEAMLESS INSTALLATION COMPLETED SUCCESSFULLY!             "
echo "================================================================"
echo " Summary of Setup:"
echo " 1. Pre-built Docker images pulled (supreeth902/locker-backend:latest)"
echo " 2. Containers launched in background (Frontend: 5173, Backend: 8000)"
echo " 3. USB Serial & WebRTC permissions granted to user '$REAL_USER'"
echo " 4. Kiosk launcher connected to boot automatically"
echo ""
echo " To complete setup, reboot your Raspberry Pi:"
echo "   sudo reboot"
echo "================================================================"
