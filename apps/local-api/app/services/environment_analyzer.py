import cv2
import numpy as np
import time

class EnvironmentAnalyzer:
    def __init__(self):
        self.last_frame_time = None
        self.frame_intervals = []

    def analyze_environment(self, img: np.ndarray, face_metrics: dict) -> dict:
        """
        Analyzes the overall scene environment suitability for face recognition.
        """
        if img is None:
            return {}

        h, w, _ = img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 1. Average scene brightness
        avg_brightness = float(np.mean(gray))

        # 2. Exposure checks
        underexposed = avg_brightness < 60.0
        overexposed = avg_brightness > 200.0

        # 3. Background brightness check
        # We can calculate background brightness by masking out the face box if a face is detected
        background_too_bright = False
        background_too_dark = False
        
        face_detected = face_metrics.get("face_detected", False)
        if face_detected:
            # Mask out face bounding box to estimate background
            face_pos = face_metrics.get("face_position", {"x": int(w/2), "y": int(h/2)})
            # approximate size
            fw = int(w * (face_metrics.get("face_size", 30.0) / 100.0))
            fh = fw
            fx = max(0, int(face_pos["x"] - fw/2))
            fy = max(0, int(face_pos["y"] - fh/2))
            
            mask = np.ones(gray.shape, dtype=np.uint8) * 255
            mask[fy:min(h, fy+fh), fx:min(w, fx+fw)] = 0
            bg_mean = float(cv2.mean(gray, mask=mask)[0])
            
            background_too_bright = bg_mean > 180.0
            background_too_dark = bg_mean < 45.0
        else:
            background_too_bright = avg_brightness > 180.0
            background_too_dark = avg_brightness < 45.0

        # 4. Sharpness & Motion Blur
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        low_sharpness = sharpness < 90.0
        motion_blur = sharpness < 40.0

        # 5. Glare Check
        # High glare if there is a significant fraction of saturated pixels (>250)
        saturated_ratio = float(np.sum(gray > 250) / gray.size * 100.0)
        high_glare = saturated_ratio > 5.0 or face_metrics.get("glare_detected", False)

        # 6. Resolution
        low_resolution = w < 640 or h < 480

        # 7. Frame rate estimation (FPS)
        current_time = time.time()
        fps = 30.0 # Default
        if self.last_frame_time is not None:
            interval = current_time - self.last_frame_time
            if 0.01 < interval < 2.0:
                self.frame_intervals.append(interval)
                if len(self.frame_intervals) > 10:
                    self.frame_intervals.pop(0)
                avg_interval = sum(self.frame_intervals) / len(self.frame_intervals)
                fps = 1.0 / avg_interval
        self.last_frame_time = current_time
        
        low_frame_rate = fps < 15.0

        # 8. Multiple faces
        multiple_faces = face_metrics.get("multiple_faces", False)

        return {
            "avg_brightness": round(avg_brightness, 2),
            "sharpness": round(sharpness, 2),
            "fps": round(fps, 1),
            "background_too_bright": background_too_bright,
            "background_too_dark": background_too_dark,
            "image_underexposed": underexposed,
            "image_overexposed": overexposed,
            "high_glare": high_glare,
            "motion_blur": motion_blur,
            "low_sharpness": low_sharpness,
            "low_frame_rate": low_frame_rate,
            "multiple_faces": multiple_faces,
            "low_resolution": low_resolution
        }
