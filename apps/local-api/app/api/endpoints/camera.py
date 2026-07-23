from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import base64
import numpy as np
import cv2

from app.services.camera_control_service import CameraControlService
from app.services.image_quality_analyzer import ImageQualityAnalyzer
from app.services.face_quality_analyzer import FaceQualityAnalyzer
from app.services.recommendation_engine import RecommendationEngine
from app.services.recognition_test_service import RecognitionTestService
from app.services.face_recognition_service import face_recognition_service

router = APIRouter(prefix="/api/calibration", tags=["calibration"])

# Instantiations
camera_control = CameraControlService()
face_analyzer = FaceQualityAnalyzer(face_recognition_service.detector)
recognition_tester = RecognitionTestService(face_recognition_service)

# Schemas
class SetControlRequest(BaseModel):
    name: str
    value: int

class AnalyzeFrameRequest(BaseModel):
    image: str  # Base64 string

class AutoTuneRequest(BaseModel):
    image: str  # Base64 string

class TestRecognitionRequest(BaseModel):
    image: str  # Base64 string

def decode_base64_img(base64_str: str) -> np.ndarray:
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

@router.get("/device-info")
def get_device_info():
    return camera_control.get_device_info()

@router.get("/controls")
def list_controls():
    return camera_control.list_controls()

@router.post("/set-control")
def set_control(req: SetControlRequest):
    success = camera_control.set_control(req.name, req.value)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to set control {req.name}.")
    return {"success": True, "message": f"Control {req.name} updated to {req.value}."}

@router.post("/analyze")
def analyze_frame(req: AnalyzeFrameRequest):
    try:
        img = decode_base64_img(req.image)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image data.")
            
        # Run analyzers
        img_metrics = ImageQualityAnalyzer.analyze_frame(img)
        face_metrics = face_analyzer.analyze_face(img)
        
        # Run recommendation synthesis
        evaluation = RecommendationEngine.evaluate(img_metrics, face_metrics)
        
        return {
            "image_quality": img_metrics,
            "face_quality": face_metrics,
            "evaluation": evaluation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/autotune")
def auto_tune_assistant(req: AutoTuneRequest):
    try:
        img = decode_base64_img(req.image)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image data.")
            
        img_metrics = ImageQualityAnalyzer.analyze_frame(img)
        face_metrics = face_analyzer.analyze_face(img)
        
        controls = camera_control.list_controls()
        
        suggestions = RecommendationEngine.suggest_auto_tune(
            controls, 
            img_metrics.get("avg_brightness", 120),
            face_metrics.get("face_brightness", 120),
            img_metrics.get("sharpness", 200)
        )
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto tune failed: {str(e)}")

@router.post("/test-recognition")
def test_recognition(req: TestRecognitionRequest):
    try:
        img = decode_base64_img(req.image)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image data.")
            
        test_results = recognition_tester.test_pipeline(img)
        return test_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recognition test pipeline failed: {str(e)}")

@router.post("/save")
def save_calibration():
    # Settings are auto-saved to file when set_control is invoked
    return {"success": True, "message": "Calibration profile saved locally successfully."}

@router.post("/reset")
def reset_calibration():
    try:
        # Clear settings file
        if os.path.exists(camera_control.settings_path):
            os.remove(camera_control.settings_path)
            
        # Restore default values
        controls = camera_control.list_controls()
        for ctrl in controls:
            camera_control.set_control(ctrl["name"], ctrl["default"])
            
        return {"success": True, "message": "Camera calibration reset to default parameters."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset calibration: {str(e)}")
