from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import base64
import numpy as np
import cv2

from app.services.camera_control_service import CameraControlService
from app.services.camera_validation_service import CameraValidationService
from app.services.camera_configuration_repository import CameraConfigurationRepository
from app.services.validation_report_service import ValidationReportService
from app.services.face_recognition_service import face_recognition_service

router = APIRouter(prefix="/api/calibration", tags=["calibration"])

# Instantiations
camera_control = CameraControlService()
validation_service = CameraValidationService(face_recognition_service.detector)
config_repo = CameraConfigurationRepository()

# Schemas
class SetControlRequest(BaseModel):
    name: str
    value: int

class AnalyzeFrameRequest(BaseModel):
    image: str  # Base64 string

class ReportRequest(BaseModel):
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
    # Directly set control value manually, NEVER automatically tuning
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
            
        results = validation_service.validate_frame(img)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/save")
def save_calibration():
    # settings are loaded from camera_control and explicitly saved to system profile
    settings = camera_control.load_saved_settings()
    success = config_repo.save_configuration(settings)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save calibration profile.")
    return {"success": True, "message": "Calibration profile saved locally successfully."}

@router.post("/reset")
def reset_calibration():
    try:
        success = config_repo.reset_to_defaults()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to clear settings file.")
            
        # Restore default values on active camera
        controls = camera_control.list_controls()
        for ctrl in controls:
            camera_control.set_control(ctrl["name"], ctrl["default"])
            
        return {"success": True, "message": "Camera calibration reset to default parameters."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset calibration: {str(e)}")

@router.post("/reload")
def reload_calibration():
    try:
        camera_control.apply_saved_settings()
        return {"success": True, "message": "Configuration reloaded and applied successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reload configuration: {str(e)}")

@router.post("/report")
def generate_report(req: ReportRequest):
    try:
        img = decode_base64_img(req.image)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image data.")
        
        device_info = camera_control.get_device_info()
        camera_config = camera_control.load_saved_settings()
        validation_results = validation_service.validate_frame(img)
        
        report = ValidationReportService.generate_report(device_info, camera_config, validation_results)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
