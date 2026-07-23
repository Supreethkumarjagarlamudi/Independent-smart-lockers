import time
import numpy as np
import cv2

class RecognitionTestService:
    def __init__(self, face_service):
        self.face_service = face_service

    def test_pipeline(self, img: np.ndarray) -> dict:
        """
        Runs multiple benchmark passes over the image frame to test performance.
        Returns detailed timing profiles.
        """
        metrics = {
            "detection_time_ms": 0.0,
            "recognition_time_ms": 0.0,
            "overall_success": False,
            "match_confidence": 0.0,
            "embedding_quality": "N/A"
        }

        if img is None:
            return metrics

        h, w, _ = img.shape
        if not self.face_service.initialized:
            self.face_service.initialize_models()
            if not self.face_service.initialized:
                return metrics

        try:
            # 1. Profile Detection Time
            t0 = time.perf_counter()
            self.face_service.detector.setInputSize((w, h))
            _, faces = self.face_service.detector.detect(img)
            t1 = time.perf_counter()
            
            metrics["detection_time_ms"] = round((t1 - t0) * 1000, 2)

            if faces is not None and len(faces) > 0:
                face = faces[0]
                
                # 2. Profile Recognition Feature Extraction Time
                t2 = time.perf_counter()
                aligned_face = self.face_service.recognizer.alignCrop(img, face)
                feature = self.face_service.recognizer.feature(aligned_face)
                t3 = time.perf_counter()
                
                metrics["recognition_time_ms"] = round((t3 - t2) * 1000, 2)
                metrics["overall_success"] = True
                
                # Generate sample quality assessment based on embedding standard deviation
                std_dev = float(np.std(feature))
                metrics["match_confidence"] = round(float(face[14]) * 100, 2)
                
                if std_dev > 0.05:
                    metrics["embedding_quality"] = "High (Clear distinctive features)"
                else:
                    metrics["embedding_quality"] = "Medium"
            else:
                metrics["embedding_quality"] = "No face detected"
                
        except Exception as e:
            print(f"Exception during recognition test pipeline: {e}")
            metrics["embedding_quality"] = f"Error: {str(e)}"
            
        return metrics
