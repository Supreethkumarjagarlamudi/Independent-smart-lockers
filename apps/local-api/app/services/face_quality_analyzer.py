import cv2
import numpy as np
import base64
import math

class FaceQualityAnalyzer:
    def __init__(self, detector):
        self.detector = detector

    def analyze_face(self, img: np.ndarray) -> dict:
        """
        Runs face detection and evaluates biometric criteria.
        Returns detailed analytics and the annotated image (base64).
        """
        if img is None:
            return {"face_detected": False, "num_faces": 0, "message": "No image frame received."}

        h, w, _ = img.shape
        img_center_x, img_center_y = w / 2, h / 2

        # Safe Capture Zone boundaries (e.g., 20% to 80% width/height)
        safe_x1, safe_y1 = int(w * 0.20), int(h * 0.15)
        safe_x2, safe_y2 = int(w * 0.80), int(h * 0.85)

        # Clone image for annotations
        annotated_img = img.copy()

        # Draw Center Guide
        cv2.drawMarker(annotated_img, (int(img_center_x), int(img_center_y)), (148, 163, 184), cv2.MARKER_CROSS, 30, 2)
        # Draw Safe Capture Zone Box
        cv2.rectangle(annotated_img, (safe_x1, safe_y1), (safe_x2, safe_y2), (219, 234, 254), 2, cv2.LINE_AA)

        # Set input size for YuNet
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)

        # Fallback if no faces detected
        if faces is None or len(faces) == 0:
            # Return empty response but with annotated image
            return {
                "face_detected": False,
                "num_faces": 0,
                "face_size": 0,
                "face_centered": False,
                "face_brightness": 0,
                "face_sharpness": 0,
                "pose": {"yaw": 0, "pitch": 0, "roll": 0},
                "confidence": 0.0,
                "annotated_image": self._encode_image(annotated_img)
            }

        # Analyze the primary face (the one with the largest bounding box)
        primary_face = None
        max_area = 0
        
        for face in faces:
            box = face[0:4].astype(int)
            area = box[2] * box[3]
            if area > max_area:
                max_area = area
                primary_face = face

        box = primary_face[0:4].astype(int)
        landmarks = primary_face[4:14].reshape((5, 2)).astype(int)
        confidence = float(primary_face[14])

        fx, fy, fw, fh = box
        face_center_x = fx + fw / 2
        face_center_y = fy + fh / 2

        # 1. Face Size (Percentage of image height)
        face_size_pct = round((fh / h) * 100, 2)

        # 2. Face Centeredness
        dist_from_center = math.sqrt((face_center_x - img_center_x)**2 + (face_center_y - img_center_y)**2)
        face_centered = dist_from_center < (min(h, w) * 0.15) # Centered if within 15% radius

        # 3. Face Region Brightness and Sharpness
        face_brightness = 0.0
        face_sharpness = 0.0
        
        # Ensure box boundary safety
        x1_clamped = max(0, fx)
        y1_clamped = max(0, fy)
        x2_clamped = min(w, fx + fw)
        y2_clamped = min(h, fy + fh)
        
        if (x2_clamped > x1_clamped) and (y2_clamped > y1_clamped):
            face_roi = img[y1_clamped:y2_clamped, x1_clamped:x2_clamped]
            gray_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            face_brightness = float(np.mean(gray_roi))
            face_sharpness = float(cv2.Laplacian(gray_roi, cv2.CV_64F).var())

        # 4. Pose Estimation (Euler Angles: Yaw, Pitch, Roll)
        yaw, pitch, roll = self._estimate_pose(landmarks, w, h)

        # 5. Occlusion & Eye Visibility Check
        # Check standard deviation of eye regions to detect reflections/glare
        glare_detected = False
        refl_score = 0.0
        try:
            # Look at a small ROI around eyes
            re_x, re_y = landmarks[0] # Right eye
            le_x, le_y = landmarks[1] # Left eye
            eye_w = int(fw * 0.15)
            
            re_roi = gray_roi[max(0, re_y - fy - eye_w):min(fh, re_y - fy + eye_w), max(0, re_x - fx - eye_w):min(fw, re_x - fx + eye_w)]
            le_roi = gray_roi[max(0, le_y - fy - eye_w):min(fh, le_y - fy + eye_w), max(0, le_x - fx - eye_w):min(fw, le_x - fx + eye_w)]
            
            if re_roi.size > 0 and le_roi.size > 0:
                # Highly saturated pixels in eye region indicate glasses reflection
                refl_score = float((np.sum(re_roi > 240) + np.sum(le_roi > 240)) / (re_roi.size + le_roi.size) * 100)
                glare_detected = refl_score > 8.0
        except Exception:
            pass

        # Bounding box color based on quality
        box_color = (34, 197, 94) # Green (Excellent)
        if not face_centered or face_size_pct < 20 or abs(yaw) > 15 or abs(pitch) > 15:
            box_color = (234, 179, 8) # Yellow (Warning)

        # Draw Bounding Box and landmarks
        cv2.rectangle(annotated_img, (fx, fy), (fx + fw, fy + fh), box_color, 2, cv2.LINE_AA)
        
        # Draw Landmarks
        colors = [(239, 68, 68), (59, 130, 246), (34, 197, 94), (168, 85, 247), (234, 179, 8)]
        for idx, pt in enumerate(landmarks):
            cv2.circle(annotated_img, tuple(pt), 4, colors[idx % len(colors)], -1)

        return {
            "face_detected": True,
            "num_faces": len(faces),
            "face_size": face_size_pct,
            "face_centered": face_centered,
            "face_brightness": round(face_brightness, 2),
            "face_sharpness": round(face_sharpness, 2),
            "pose": {
                "yaw": round(yaw, 2),
                "pitch": round(pitch, 2),
                "roll": round(roll, 2)
            },
            "glare_detected": glare_detected,
            "reflection_score": round(refl_score, 2),
            "confidence": round(confidence * 100, 2),
            "annotated_image": self._encode_image(annotated_img)
        }

    def _estimate_pose(self, landmarks, width, height):
        """
        Estimates Pitch, Yaw, and Roll using PnP solver with generic 3D face model points.
        """
        # Generic 3D model coordinates (in millimeters)
        model_points = np.array([
            (-150.0, 90.0, -180.0),    # Right eye
            (150.0, 90.0, -180.0),     # Left eye
            (0.0, -45.0, 0.0),         # Nose tip
            (-100.0, -180.0, -135.0),  # Right mouth corner
            (100.0, -180.0, -135.0)    # Left mouth corner
        ], dtype=np.float32)

        # 2D image coordinates from landmarks
        image_points = np.array(landmarks, dtype=np.float32)

        # Camera intrinsics (approximate values based on center)
        focal_length = width
        center = (width / 2, height / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float32)

        dist_coeffs = np.zeros((4, 1), dtype=np.float32) # Assume zero lens distortion
        
        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )

        if not success:
            return 0.0, 0.0, 0.0

        # Convert rotation vector to rotation matrix
        rmat, _ = cv2.Rodrigues(rotation_vector)

        # Compute Euler angles (Yaw, Pitch, Roll) from rotation matrix
        # Formula adapted to retrieve standard facial angles
        sy = math.sqrt(rmat[0,0] * rmat[0,0] +  rmat[1,0] * rmat[1,0])
        singular = sy < 1e-6

        if not singular:
            x = math.atan2(rmat[2,1] , rmat[2,2])
            y = math.atan2(-rmat[2,0], sy)
            z = math.atan2(rmat[1,0], rmat[0,0])
        else:
            x = math.atan2(-rmat[1,2], rmat[1,1])
            y = math.atan2(-rmat[2,0], sy)
            z = 0

        # Convert to degrees
        pitch = x * (180.0 / math.pi)
        yaw = y * (180.0 / math.pi)
        roll = z * (180.0 / math.pi)

        # Adjust offsets to relative neutral pose
        return yaw, pitch, roll

    def _encode_image(self, img: np.ndarray) -> str:
        """
        Helper to convert cv2 image to base64 jpeg.
        """
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buffer).decode('utf-8')
