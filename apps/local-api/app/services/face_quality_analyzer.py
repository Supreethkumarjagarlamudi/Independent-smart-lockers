import cv2
import numpy as np
import base64
import math

class FaceQualityAnalyzer:
    def __init__(self, detector):
        self.detector = detector

    def analyze_face(self, img: np.ndarray) -> dict:
        """
        Runs face detection and evaluates face metrics for validation check.
        Draws bounding box, landmarks, center guide, and recommended face area.
        """
        if img is None:
            return {
                "face_detected": False,
                "num_faces": 0,
                "confidence": 0.0,
                "face_size": 0.0,
                "face_position": {"x": 0, "y": 0},
                "face_centered": False,
                "distance_estimate": 0.0,
                "face_brightness": 0.0,
                "face_sharpness": 0.0,
                "pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
                "eyes_visible": False,
                "face_occluded": False,
                "multiple_faces": False,
                "face_quality_score": 0.0,
                "classification": "Poor",
                "annotated_image": ""
            }

        h, w, _ = img.shape
        img_center_x, img_center_y = w / 2, h / 2

        # Recommended Face Area (e.g. 25% to 75% width, 20% to 80% height)
        rec_x1, rec_y1 = int(w * 0.25), int(h * 0.20)
        rec_x2, rec_y2 = int(w * 0.75), int(h * 0.80)

        # Clone image for annotations
        annotated_img = img.copy()

        # Draw Center Guide (Crosshair)
        cv2.drawMarker(annotated_img, (int(img_center_x), int(img_center_y)), (148, 163, 184), cv2.MARKER_CROSS, 30, 2)
        
        # Draw Recommended Face Area Box
        cv2.rectangle(annotated_img, (rec_x1, rec_y1), (rec_x2, rec_y2), (219, 234, 254), 2, cv2.LINE_AA)
        cv2.putText(annotated_img, "Recommended Face Area", (rec_x1 + 5, rec_y1 - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (219, 234, 254), 1, cv2.LINE_AA)

        # Run face detection
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)

        num_faces = len(faces) if faces is not None else 0
        multiple_faces = num_faces > 1

        # Fallback if no faces detected
        if num_faces == 0:
            return {
                "face_detected": False,
                "num_faces": 0,
                "confidence": 0.0,
                "face_size": 0.0,
                "face_position": {"x": 0, "y": 0},
                "face_centered": False,
                "distance_estimate": 0.0,
                "face_brightness": 0.0,
                "face_sharpness": 0.0,
                "pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
                "eyes_visible": False,
                "face_occluded": False,
                "multiple_faces": False,
                "face_quality_score": 0.0,
                "classification": "Poor",
                "annotated_image": self._encode_image(annotated_img)
            }

        # Analyze primary face (largest area)
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
        confidence = float(primary_face[14]) * 100.0

        fx, fy, fw, fh = box
        face_center_x = fx + fw / 2
        face_center_y = fy + fh / 2

        # 1. Face Position
        face_position = {"x": int(face_center_x), "y": int(face_center_y)}

        # 2. Face Size (Percentage of image height)
        face_size_pct = (fh / h) * 100.0

        # 3. Face Centeredness (Within 15% distance from image center)
        dist_from_center = math.sqrt((face_center_x - img_center_x)**2 + (face_center_y - img_center_y)**2)
        face_centered = dist_from_center < (min(h, w) * 0.15)

        # 4. Distance Estimate (Heuristics based on bounding box size)
        # Assuming typical face height is ~20cm and camera focal length is calibrated,
        # distance in meters ~ 60.0 / face_size_pct
        distance_estimate = round(60.0 / (face_size_pct + 0.1), 2)

        # 5. Face Region Brightness and Sharpness
        face_brightness = 0.0
        face_sharpness = 0.0

        x1_clamped = max(0, fx)
        y1_clamped = max(0, fy)
        x2_clamped = min(w, fx + fw)
        y2_clamped = min(h, fy + fh)

        if (x2_clamped > x1_clamped) and (y2_clamped > y1_clamped):
            face_roi = img[y1_clamped:y2_clamped, x1_clamped:x2_clamped]
            gray_roi = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            face_brightness = float(np.mean(gray_roi))
            face_sharpness = float(cv2.Laplacian(gray_roi, cv2.CV_64F).var())

        # 6. Pose Estimation (Yaw, Pitch, Roll)
        yaw, pitch, roll = self._estimate_pose(landmarks, w, h)

        # 7. Glare / Occlusion
        glare_detected = False
        refl_score = 0.0
        try:
            re_x, re_y = landmarks[0] # Right eye
            le_x, le_y = landmarks[1] # Left eye
            eye_w = int(fw * 0.15)
            
            re_roi = gray_roi[max(0, re_y - fy - eye_w):min(fh, re_y - fy + eye_w), max(0, re_x - fx - eye_w):min(fw, re_x - fx + eye_w)]
            le_roi = gray_roi[max(0, le_y - fy - eye_w):min(fh, le_y - fy + eye_w), max(0, le_x - fx - eye_w):min(fw, le_x - fx + eye_w)]
            
            if re_roi.size > 0 and le_roi.size > 0:
                refl_score = float((np.sum(re_roi > 240) + np.sum(le_roi > 240)) / (re_roi.size + le_roi.size) * 100)
                glare_detected = refl_score > 8.0
        except Exception:
            pass

        eyes_visible = bool(confidence > 80.0 and landmarks[0][0] > 0 and landmarks[1][0] > 0 and not glare_detected)
        face_occluded = bool(confidence < 85.0 or glare_detected)

        # Draw Face Bounding Box (Green if centered & correct size, Yellow/Red warning otherwise)
        box_color = (34, 197, 94) # Green
        if not face_centered or face_size_pct < 15.0 or face_size_pct > 65.0:
            box_color = (234, 179, 8) # Yellow
        if face_occluded:
            box_color = (239, 68, 68) # Red

        cv2.rectangle(annotated_img, (fx, fy), (fx + fw, fy + fh), box_color, 2, cv2.LINE_AA)

        # Draw Landmarks
        colors = [(239, 68, 68), (59, 130, 246), (34, 197, 94), (168, 85, 247), (234, 179, 8)]
        for idx, pt in enumerate(landmarks):
            cv2.circle(annotated_img, tuple(pt), 4, colors[idx % len(colors)], -1)

        # Calculate Face Quality score components (weighted sum out of 100)
        # 1. Detection Confidence (20 points max)
        sc_confidence = (confidence / 100.0) * 20.0

        # 2. Face Size Quality (20 points max)
        # Ideal range 20% to 55%
        if 20.0 <= face_size_pct <= 55.0:
            sc_size = 20.0
        else:
            diff = min(abs(face_size_pct - 20.0), abs(face_size_pct - 55.0))
            sc_size = max(0.0, 20.0 - diff * 0.8)

        # 3. Face Brightness Quality (20 points max)
        # Ideal range 70 to 180
        if 70.0 <= face_brightness <= 180.0:
            sc_brightness = 20.0
        else:
            diff = min(abs(face_brightness - 70.0), abs(face_brightness - 180.0))
            sc_brightness = max(0.0, 20.0 - diff * 0.2)

        # 4. Face Sharpness Quality (20 points max)
        # Ideal is > 100
        sc_sharpness = min(20.0, (face_sharpness / 120.0) * 20.0)

        # 5. Pose Quality (20 points max)
        # Yaw, Pitch, Roll should ideally be < 15 degrees
        pose_dev = max(0.0, abs(yaw) + abs(pitch) + abs(roll))
        sc_pose = max(0.0, 20.0 - (pose_dev * 0.3))

        face_quality_score = sc_confidence + sc_size + sc_brightness + sc_sharpness + sc_pose
        face_quality_score = max(0.0, min(100.0, round(face_quality_score, 1)))

        # Classification
        if face_quality_score >= 85.0:
            classification = "Excellent"
        elif face_quality_score >= 70.0:
            classification = "Good"
        elif face_quality_score >= 50.0:
            classification = "Acceptable"
        else:
            classification = "Poor"

        return {
            "face_detected": True,
            "num_faces": num_faces,
            "confidence": round(confidence, 2),
            "face_size": round(face_size_pct, 2),
            "face_position": face_position,
            "face_centered": face_centered,
            "distance_estimate": distance_estimate,
            "face_brightness": round(face_brightness, 2),
            "face_sharpness": round(face_sharpness, 2),
            "pose": {
                "yaw": round(yaw, 2),
                "pitch": round(pitch, 2),
                "roll": round(roll, 2)
            },
            "eyes_visible": eyes_visible,
            "face_occluded": face_occluded,
            "multiple_faces": multiple_faces,
            "face_quality_score": face_quality_score,
            "classification": classification,
            "annotated_image": self._encode_image(annotated_img)
        }

    def _estimate_pose(self, landmarks, width, height):
        model_points = np.array([
            (-150.0, 90.0, -180.0),    # Right eye
            (150.0, 90.0, -180.0),     # Left eye
            (0.0, -45.0, 0.0),         # Nose tip
            (-100.0, -180.0, -135.0),  # Right mouth corner
            (100.0, -180.0, -135.0)    # Left mouth corner
        ], dtype=np.float32)

        image_points = np.array(landmarks, dtype=np.float32)
        focal_length = width
        center = (width / 2, height / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float32)

        dist_coeffs = np.zeros((4, 1), dtype=np.float32)
        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )

        if not success:
            return 0.0, 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rotation_vector)
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

        return y * (180.0 / math.pi), x * (180.0 / math.pi), z * (180.0 / math.pi)

    def _encode_image(self, img: np.ndarray) -> str:
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buffer).decode('utf-8')
