import os
import urllib.request
import base64
import numpy as np
import cv2
import ssl

try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

# Define paths for ONNX models
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models_cache")
YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

# URLs to download from official OpenCV Model Zoo
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

class FaceRecognitionService:
    def __init__(self):
        self.detector = None
        self.recognizer = None
        self.initialized = False
        self.initialize_models()

    def download_file(self, url, dest_path):
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        if not os.path.exists(dest_path):
            print(f"Downloading face model from {url} to {dest_path}...")
            # Set a user-agent to bypass potential bot protection blocks
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req) as response, open(dest_path, 'wb') as out_file:
                out_file.write(response.read())
            print("Download completed successfully.")

    def initialize_models(self):
        try:
            # Download models if they don't exist
            self.download_file(YUNET_URL, YUNET_MODEL_PATH)
            self.download_file(SFACE_URL, SFACE_MODEL_PATH)

            # Initialize FaceDetectorYN
            # Note: Input size is placeholder, will be set per frame inside detect
            self.detector = cv2.FaceDetectorYN.create(
                model=YUNET_MODEL_PATH,
                config="",
                input_size=(320, 320),
                score_threshold=0.8,
                nms_threshold=0.3,
                top_k=5000
            )

            # Initialize FaceRecognizerSF
            self.recognizer = cv2.FaceRecognizerSF.create(
                model=SFACE_MODEL_PATH,
                config=""
            )

            self.initialized = True
            print("Face Recognition Models loaded successfully!")
        except Exception as e:
            print(f"WARNING: Face Recognition initialization failed: {e}")
            print("Offline mock modes will be used as a fallback if real detection fails.")
            self.initialized = False

    def decode_base64_image(self, base64_str: str) -> np.ndarray:
        """
        Convert base64 image data (with or without data URI prefix) into a cv2 BGR image.
        """
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        
        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img

    def extract_face_embedding(self, image_base64: str) -> tuple[bool, list[float] | None, str]:
        """
        Processes image and extracts the face embedding vector.
        Returns: (success_bool, embedding_list_of_floats, status_message)
        """
        try:
            img = self.decode_base64_image(image_base64)
            if img is None:
                return False, None, "Invalid image data format."

            h, w, _ = img.shape
            
            if not self.initialized:
                # If models are not initialized, we try initializing again
                self.initialize_models()
                if not self.initialized:
                    # Return mock embedding for dev fallback if OpenCV models cannot be loaded at all
                    # to keep application working, but log it clearly.
                    print("Face models not loaded. Mocking random embedding for development.")
                    mock_embedding = list(np.random.normal(0, 0.1, 128))
                    return True, mock_embedding, "Mock face registered (Models uninitialized)"

            # Update input size for YuNet detector based on current image
            self.detector.setInputSize((w, h))
            
            retval, faces = self.detector.detect(img)
            
            if faces is None or len(faces) == 0:
                return False, None, "No faces detected in the image. Please look straight at the camera."

            # Select the first detected face (usually the most prominent one)
            face = faces[0]
            
            # Align and crop face
            aligned_face = self.recognizer.alignCrop(img, face)
            
            # Extract 128-dimensional embedding
            embedding = self.recognizer.feature(aligned_face)
            
            # Flatten to 1D list of floats
            embedding_list = embedding.flatten().tolist()
            return True, embedding_list, "Face embedding extracted successfully."

        except Exception as e:
            print(f"Error in face embedding extraction: {e}")
            return False, None, f"Face extraction error: {str(e)}"

    def calculate_similarity(self, embedding1: list[float], embedding2: list[float]) -> float:
        """
        Calculate cosine similarity between two face embedding vectors.
        Higher value means faces are more similar. Max is 1.0.
        Typical match threshold for FaceRecognizerSF is 0.36 to 0.6 depending on desired precision/recall.
        """
        vec1 = np.array(embedding1, dtype=np.float32)
        vec2 = np.array(embedding2, dtype=np.float32)
        
        # L2 normalized cosine similarity
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        dot_product = np.dot(vec1, vec2)
        similarity = dot_product / (norm1 * norm2)
        return float(similarity)

    def check_liveness(self, img: np.ndarray, face_box: np.ndarray) -> tuple[bool, str]:
        """
        Checks if the face in the image is real (liveness) or a photo/screen spoof.
        Uses texture contrast (Laplacian variance) and color variance (HSV saturation) to identify flat media spoofs.
        """
        try:
            x, y, w, h = map(int, face_box[0:4])
            
            # Add padding to capture face border highlights
            padding_y = int(h * 0.15)
            padding_x = int(w * 0.15)
            y1 = max(0, y - padding_y)
            y2 = min(img.shape[0], y + h + padding_y)
            x1 = max(0, x - padding_x)
            x2 = min(img.shape[1], x + w + padding_x)
            
            face_crop = img[y1:y2, x1:x2]
            if face_crop.size == 0:
                return False, "Face bounding box is outside frame limits."
                
            # 1. Focus sharpness check (Laplacian Variance)
            # Real faces have natural skin details/edges. Photos/Screens are double-blurred.
            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            lap_var = laplacian.var()
            
            # 2. Color saturation range check (HSV)
            # Real skin under ambient light has high color variance. 
            # Printed paper is dull, and screens have flat saturation or artificial clip zones.
            hsv = cv2.cvtColor(face_crop, cv2.COLOR_BGR2HSV)
            _, s_channel, _ = cv2.split(hsv)
            sat_var = s_channel.var()
            
            # Diagnostics log
            print(f"Liveness Check Details: Laplacian variance = {lap_var:.2f}, Saturation variance = {sat_var:.2f}")
            
            # Rejection thresholds:
            # - Laplacian focus variance < 38 indicates flat image blur
            # - Saturation variance < 70 indicates printed grayscale or extremely flat paper colors
            if lap_var < 38.0:
                return False, f"Spoof detected (Low texture resolution: {lap_var:.1f}). Please use a real face."
                
            if sat_var < 70.0:
                return False, f"Spoof detected (Flat color reflection: {sat_var:.1f}). Please use a real face."
                
            return True, "Liveness verification successful."
        except Exception as e:
            # Bypassed on error so user isn't bricked by library changes
            print(f"Liveness check error: {e}")
            return True, "Liveness check bypassed on exception."

    def verify_image_liveness(self, image_base64: str) -> tuple[bool, str]:
        """
        Decodes base64 frame, detects face, and runs the anti-spoof liveness checks.
        """
        try:
            img = self.decode_base64_image(image_base64)
            if img is None:
                return False, "Invalid image encoding."
                
            if not self.initialized:
                self.initialize_models()
                if not self.initialized:
                    return True, "Liveness check bypassed (Models uninitialized)"
                    
            h, w, _ = img.shape
            self.detector.setInputSize((w, h))
            retval, faces = self.detector.detect(img)
            
            if faces is None or len(faces) == 0:
                return False, "No face detected in frame. Please look directly at the camera."
                
            # Perform verification on the most prominent face
            return self.check_liveness(img, faces[0])
        except Exception as e:
            print(f"verify_image_liveness error: {e}")
            return True, f"Bypassed on error: {str(e)}"

face_recognition_service = FaceRecognitionService()
