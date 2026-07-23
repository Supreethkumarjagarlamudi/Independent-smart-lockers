import numpy as np
from app.services.face_quality_analyzer import FaceQualityAnalyzer
from app.services.environment_analyzer import EnvironmentAnalyzer

class CameraValidationService:
    def __init__(self, detector):
        self.face_analyzer = FaceQualityAnalyzer(detector)
        self.env_analyzer = EnvironmentAnalyzer()

    def validate_frame(self, img: np.ndarray) -> dict:
        """
        Runs validation and scene checks on a single frame.
        """
        # 1. Run face quality analyzer
        face_metrics = self.face_analyzer.analyze_face(img)
        
        # 2. Run environment analyzer
        env_metrics = self.env_analyzer.analyze_environment(img, face_metrics)

        # 3. Compile Checklist
        face_detected = face_metrics.get("face_detected", False)
        
        lighting_good = False
        if face_detected:
            lighting_good = (
                not env_metrics.get("background_too_bright", False) and
                not env_metrics.get("background_too_dark", False) and
                face_metrics.get("face_brightness", 0.0) >= 65.0
            )
        else:
            lighting_good = (
                not env_metrics.get("background_too_bright", False) and
                not env_metrics.get("background_too_dark", False) and
                not env_metrics.get("image_underexposed", False)
            )

        sharpness_good = not env_metrics.get("low_sharpness", False) and not env_metrics.get("motion_blur", False)
        exposure_acceptable = not env_metrics.get("image_underexposed", False) and not env_metrics.get("image_overexposed", False)
        
        face_size_acceptable = False
        if face_detected:
            face_size_acceptable = 18.0 <= face_metrics.get("face_size", 0.0) <= 60.0

        pose_acceptable = False
        if face_detected:
            pose = face_metrics.get("pose", {"yaw": 0.0, "pitch": 0.0, "roll": 0.0})
            pose_acceptable = (
                abs(pose.get("yaw", 0.0)) <= 15.0 and
                abs(pose.get("pitch", 0.0)) <= 15.0 and
                abs(pose.get("roll", 0.0)) <= 15.0
            )

        fps_stable = not env_metrics.get("low_frame_rate", False)
        resolution_supported = not env_metrics.get("low_resolution", False)

        checklist = {
            "face_detected": face_detected,
            "lighting_good": lighting_good,
            "sharpness_good": sharpness_good,
            "exposure_acceptable": exposure_acceptable,
            "face_size_acceptable": face_size_acceptable,
            "pose_acceptable": pose_acceptable,
            "fps_stable": fps_stable,
            "resolution_supported": resolution_supported
        }

        # 4. Camera Status
        # All checklist items must be green (True) for the camera to be ready
        camera_ready = all(checklist.values())
        camera_status = "Ready" if camera_ready else "Not Ready"

        # 5. Explain Why (Actionable Feedback Messages)
        reasons = []
        if not face_detected:
            reasons.append("Face is not detected. Please step in front of the camera.")
        else:
            if face_metrics.get("face_brightness", 0.0) < 65.0:
                reasons.append("Face is too dark.")
                reasons.append("Improve room lighting.")
            if env_metrics.get("background_too_bright", False):
                reasons.append("Reduce strong backlight.")
            if face_metrics.get("face_size", 0.0) < 18.0:
                reasons.append("Face is too small.")
                reasons.append("Move closer to the camera.")
            elif face_metrics.get("face_size", 0.0) > 60.0:
                reasons.append("Face is too large. Move back slightly.")
            
            pose = face_metrics.get("pose", {"yaw": 0.0, "pitch": 0.0, "roll": 0.0})
            if abs(pose.get("pitch", 0.0)) > 15.0:
                reasons.append("Move camera slightly lower or adjust face angle.")
            if abs(pose.get("yaw", 0.0)) > 15.0 or abs(pose.get("roll", 0.0)) > 15.0:
                reasons.append("Look straight at the camera.")

            if face_metrics.get("face_occluded", False):
                reasons.append("Glasses reflection detected or face is occluded.")

        if env_metrics.get("image_underexposed", False) and not face_detected:
            reasons.append("Improve room lighting.")
        if env_metrics.get("motion_blur", False) or env_metrics.get("low_sharpness", False):
            reasons.append("Image is blurry. Clean the lens or stabilize the camera.")
        if env_metrics.get("multiple_faces", False):
            reasons.append("Only one person should stand in front of the camera.")

        return {
            "camera_status": camera_status,
            "checklist": checklist,
            "reasons": reasons,
            "face_metrics": face_metrics,
            "env_metrics": env_metrics
        }
