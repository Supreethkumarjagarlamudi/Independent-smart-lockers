#!/bin/bash

# =====================================================================
# RASPBERRY PI 4 - ONE-CLICK SMART LOCKER INSTALLER SCRIPT
# =====================================================================
# This script automates installing Docker, setting up auto-login,
# creating autostart desktop links, building container services, 
# and configuring Chromium Kiosk Mode.
# =====================================================================

# Ensure the script is run with sudo permissions
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script with sudo."
  exit 1
fi

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
USER_HOME=$(eval echo "~$SUDO_USER")

echo "=== 1. Checking Host Package Dependencies ==="
apt update
apt install -y curl git x11-xserver-utils

# Add Brave Browser APT Repository & install brave-browser
if ! command -v brave-browser &> /dev/null; then
    echo "Adding Brave Browser repository and installing Brave..."
    curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" | tee /etc/apt/sources.list.d/brave-browser-release.list
    apt update
    apt install -y brave-browser
fi

# 2. Install Docker & Docker Compose if missing
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    # Enable docker system service
    systemctl enable docker
    systemctl start docker
    # Add logged-in user to docker permissions group
    usermod -aG docker "$SUDO_USER"
    echo "Docker installed successfully!"
else
    echo "Docker is already installed. [OK]"
fi

echo "=== 2. Creating Autostart Launcher Link ==="
# Ensure launcher script is executable
chmod +x "$PROJECT_DIR/start_kiosk.sh"

# Create Desktop Autostart Directory for the graphical user
AUTOSTART_DIR="$USER_HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Write Desktop autostart entry
cat <<EOF > "$AUTOSTART_DIR/smart_locker.desktop"
[Desktop Entry]
Type=Application
Name=Smart Locker Kiosk
Exec=$PROJECT_DIR/start_kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

# Correct ownership of autostart file back to graphical user
chown -R "$SUDO_USER:$SUDO_USER" "$USER_HOME/.config"

echo "=== 3. Pulling/Building Container Services ==="
# Trigger building the docker containers from workspace files
cd "$PROJECT_DIR"
# Run docker compose build as the sudo user to pull arm64 layers correctly
sudo -u "$SUDO_USER" docker compose build

echo "=== 4. Configuring OS Boot parameters ==="
# Check GUI autologin configuration
if [ -f /etc/lightdm/lightdm.conf ]; then
    echo "Setting lightdm config for automatic desktop autologin..."
    sed -i "s/#autologin-user=/autologin-user=$SUDO_USER/g" /etc/lightdm/lightdm.conf
fi

echo "================================================================"
echo "          INSTALLATION COMPLETE & READY FOR FLEET USE           "
echo "================================================================"
echo " What this script did:"
echo " 1. Installed Docker & Docker Compose"
echo " 2. Added user '$SUDO_USER' to docker group"
echo " 3. Built backend/frontend multi-stage Docker images"
echo " 4. Configured automatic GUI desktop login on startup"
echo " 5. Connected start_kiosk.sh to boot automatically in Kiosk Mode"
echo ""
echo " Please reboot the Raspberry Pi to start Kiosk Mode:"
echo " sudo reboot"
echo "================================================================"
