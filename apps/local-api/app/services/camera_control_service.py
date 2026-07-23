import re
import subprocess
import os
import json

from app.services.camera_configuration_repository import CameraConfigurationRepository

class CameraControlService:
    def __init__(self, device_path="/dev/video0", settings_path="camera_settings.json"):
        self.device_path = device_path
        self.repository = CameraConfigurationRepository(settings_path)


    def _is_linux(self):
        return os.name != "nt" and hasattr(os, "uname") and os.uname().sysname == "Linux"

    def get_device_info(self):
        """
        Gathers basic hardware info using v4l2-ctl --info.
        """
        info = {
            "name": "Generic Webcam",
            "device_path": self.device_path,
            "driver": "Unknown",
            "status": "Offline",
            "resolution": "640x480",
            "fps": "30 FPS",
            "pixel_format": "MJPG"
        }
        
        if not self._is_linux():
            info["status"] = "Mock Mode (Development)"
            return info

        try:
            # Check if device exists
            if not os.path.exists(self.device_path):
                return info

            res = subprocess.run(
                ["v4l2-ctl", "-d", self.device_path, "--info"],
                capture_output=True, text=True, timeout=2
            )
            if res.returncode == 0:
                info["status"] = "Online"
                # Parse output
                for line in res.stdout.splitlines():
                    line = line.strip()
                    if ":" in line:
                        k, v = line.split(":", 1)
                        k_clean = k.strip().lower()
                        v_clean = v.strip()
                        if "card type" in k_clean:
                            info["name"] = v_clean
                        elif "driver name" in k_clean:
                            info["driver"] = v_clean

            # Get current format and FPS
            res_fmt = subprocess.run(
                ["v4l2-ctl", "-d", self.device_path, "--get-fmt-video"],
                capture_output=True, text=True, timeout=2
            )
            if res_fmt.returncode == 0:
                for line in res_fmt.stdout.splitlines():
                    if "Width/Height" in line:
                        parts = line.split(":", 1)[1].strip().split("/")
                        info["resolution"] = f"{parts[0]}x{parts[1]}"
                    elif "Pixel Format" in line:
                        info["pixel_format"] = line.split(":", 1)[1].strip()

        except Exception as e:
            print(f"Error reading V4L2 device info: {e}")
            info["status"] = "Error"
            
        return info

    def list_controls(self):
        """
        Dynamically detects supported V4L2 controls and returns them as a list of dicts.
        """
        controls = []
        if not self._is_linux():
            # Return high-quality mock controls for non-linux development environments
            return [
                {"name": "brightness", "type": "int", "min": -64, "max": 64, "step": 1, "default": 0, "value": 0},
                {"name": "contrast", "type": "int", "min": 0, "max": 95, "step": 1, "default": 32, "value": 32},
                {"name": "saturation", "type": "int", "min": 0, "max": 100, "step": 1, "default": 64, "value": 64},
                {"name": "gamma", "type": "int", "min": 100, "max": 300, "step": 1, "default": 100, "value": 100},
                {"name": "gain", "type": "int", "min": 0, "max": 100, "step": 1, "default": 0, "value": 0},
                {"name": "sharpness", "type": "int", "min": 0, "max": 7, "step": 1, "default": 3, "value": 3},
                {"name": "backlight_compensation", "type": "int", "min": 0, "max": 4, "step": 1, "default": 0, "value": 0},
                {"name": "white_balance_automatic", "type": "bool", "min": 0, "max": 1, "step": 1, "default": 1, "value": 1},
                {"name": "white_balance_temperature", "type": "int", "min": 2800, "max": 6500, "step": 10, "default": 4600, "value": 4600},
                {"name": "exposure_auto", "type": "menu", "min": 0, "max": 3, "step": 1, "default": 3, "value": 3, "options": {"0": "Auto Mode", "1": "Manual Mode", "3": "Aperture Priority Mode"}},
                {"name": "exposure_time_absolute", "type": "int", "min": 1, "max": 10000, "step": 1, "default": 156, "value": 156}
            ]

        try:
            res = subprocess.run(
                ["v4l2-ctl", "-d", self.device_path, "--list-ctrls"],
                capture_output=True, text=True, timeout=2
            )
            if res.returncode != 0:
                return []

            # Regex to parse controls
            # Example: brightness 0x00980900 (int)    : min=-64 max=64 step=1 default=0 value=0
            pattern = re.compile(r"^(\w+)\s+(0x[0-9a-fA-F]+)\s+\((\w+)\)\s+:\s+(.*)$")
            
            for line in res.stdout.splitlines():
                line = line.strip()
                match = pattern.match(line)
                if match:
                    ctrl_name = match.group(1)
                    ctrl_type = match.group(3)
                    tail = match.group(4)
                    
                    # Parse properties like min, max, default, value, etc.
                    props = {}
                    for item in re.split(r'\s+', tail):
                        if "=" in item:
                            k, v = item.split("=", 1)
                            try:
                                props[k] = int(v) if not v.startswith("0x") else int(v, 16)
                            except ValueError:
                                props[k] = v

                    ctrl_data = {
                        "name": ctrl_name,
                        "type": ctrl_type,
                        "min": props.get("min", 0),
                        "max": props.get("max", 1),
                        "step": props.get("step", 1),
                        "default": props.get("default", 0),
                        "value": props.get("value", 0)
                    }

                    # Extract menu options if applicable
                    if ctrl_type == "menu":
                        # Run command to fetch menu options specifically
                        ctrl_data["options"] = self._get_menu_options(ctrl_name)
                    
                    controls.append(ctrl_data)
        except Exception as e:
            print(f"Error parsing V4L2 controls: {e}")
            
        return controls

    def _get_menu_options(self, ctrl_name):
        options = {}
        if not self._is_linux():
            return options
        try:
            res = subprocess.run(
                ["v4l2-ctl", "-d", self.device_path, f"--list-ctrls"],
                capture_output=True, text=True, timeout=1
            )
            capture = False
            for line in res.stdout.splitlines():
                if line.startswith(ctrl_name):
                    capture = True
                    continue
                if capture:
                    if line.startswith(" ") or line.startswith("\t"):
                        m = re.match(r"^\s*(\d+):\s*(.*)$", line)
                        if m:
                            options[m.group(1)] = m.group(2).strip()
                    else:
                        break
        except Exception:
            pass
        return options

    def set_control(self, name, value):
        """
        Dynamically applies control settings.
        """
        print(f"Applying V4L2 Control: {name}={value}")
        if not self._is_linux():
            # Dev mock mode
            self.save_control_setting(name, value)
            return True

        try:
            res = subprocess.run(
                ["v4l2-ctl", "-d", self.device_path, f"--set-ctrl={name}={value}"],
                capture_output=True, text=True, timeout=2
            )
            if res.returncode == 0:
                self.save_control_setting(name, value)
                return True
            else:
                print(f"Failed to set control {name}={value}: {res.stderr}")
                return False
        except Exception as e:
            print(f"Exception while setting control: {e}")
            return False

    def save_control_setting(self, name, value):
        settings = self.load_saved_settings()
        settings[name] = value
        self.repository.save_configuration(settings)

    def load_saved_settings(self):
        return self.repository.load_configuration()

    def apply_saved_settings(self):
        """
        Loads and applies all saved configuration.
        """
        settings = self.load_saved_settings()
        if not settings:
            return
        print(f"Loading and applying {len(settings)} saved camera settings...")
        for name, val in settings.items():
            self.set_control(name, val)

