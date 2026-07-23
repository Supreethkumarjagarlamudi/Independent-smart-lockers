import os
import json

class CameraConfigurationRepository:
    def __init__(self, settings_path="camera_settings.json"):
        self.settings_path = settings_path

    def load_configuration(self) -> dict:
        """
        Loads the saved camera controls configuration dictionary.
        """
        if not os.path.exists(self.settings_path):
            return {}
        try:
            with open(self.settings_path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading camera settings: {e}")
            return {}

    def save_configuration(self, settings: dict) -> bool:
        """
        Saves the camera controls configuration dictionary.
        """
        try:
            with open(self.settings_path, "w") as f:
                json.dump(settings, f, indent=4)
            return True
        except Exception as e:
            print(f"Failed to save camera settings: {e}")
            return False

    def reset_to_defaults(self) -> bool:
        """
        Clears the saved camera settings.
        """
        try:
            if os.path.exists(self.settings_path):
                os.remove(self.settings_path)
            return True
        except Exception as e:
            print(f"Failed to delete camera settings: {e}")
            return False
