from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.database.session import get_db
from app.models.models import SystemConfig, Locker, SystemLog
from app.services.hardware_service import hardware_service

router = APIRouter(prefix="/api/setup", tags=["setup"])

class ConfigSetupSchema(BaseModel):
    cluster_name: str
    station_name: str
    location: str
    timezone: str
    
    free_minutes: int
    hourly_rate: float
    max_hours: int
    grace_period: int
    
    camera_model: str
    controllers_count: int
    lockers_count: int
    locker_prefix: Optional[str] = "A"

class CameraInfo(BaseModel):
    id: str
    name: str
    status: str

class ControllerInfo(BaseModel):
    id: str
    status: str

@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    if config:
        return {"initialized": config.initialized, "config": config}
    return {"initialized": False, "config": None}

@router.get("/cameras", response_model=List[CameraInfo])
def discover_cameras():
    # Scan for standard webcam indexes (0, 1, 2)
    # Return detected cameras or fallback
    cameras = []
    
    # In a production kiosk, we list the devices
    # Let's mock a couple of standard USB webcams alongside system defaults
    cameras.append(CameraInfo(id="0", name="Integrated FaceTime HD Camera", status="Ready"))
    cameras.append(CameraInfo(id="1", name="Logitech Webcam C920", status="Ready"))
    
    return cameras

@router.get("/controllers", response_model=List[ControllerInfo])
def discover_controllers(count: int = 1):
    controllers = []
    for i in range(1, count + 1):
        controller_id = f"CTRL-{i:03d}"
        status = "Online" if hardware_service.check_controller_status(controller_id) else "Offline"
        controllers.append(ControllerInfo(id=controller_id, status=status))
    return controllers

@router.post("/initialize")
def initialize_cluster(schema: ConfigSetupSchema, db: Session = Depends(get_db)):
    try:
        # Delete any existing configuration first to re-initialize
        db.query(SystemConfig).delete()
        db.query(Locker).delete()
        
        # Save new configuration
        config = SystemConfig(
            cluster_name=schema.cluster_name,
            station_name=schema.station_name,
            location=schema.location,
            timezone=schema.timezone,
            free_minutes=schema.free_minutes,
            hourly_rate=schema.hourly_rate,
            max_hours=schema.max_hours,
            grace_period=schema.grace_period,
            camera_model=schema.camera_model,
            controllers_count=schema.controllers_count,
            lockers_count=schema.lockers_count,
            initialized=True
        )
        db.add(config)
        
        # Generate lockers automatically based on controllers and count
        # For simplicity, divide total lockers count evenly among controllers
        lockers_per_controller = max(1, schema.lockers_count // schema.controllers_count)
        
        locker_index = 1
        prefix_val = schema.locker_prefix or "A"
        
        for c in range(1, schema.controllers_count + 1):
            controller_id = f"CTRL-{c:03d}"
            
            for l in range(1, lockers_per_controller + 1):
                if prefix_val != "A":
                    locker_id = f"{prefix_val}-{locker_index}"
                else:
                    prefix_char = chr(64 + c) # 65 is 'A'
                    locker_id = f"{prefix_char}-{l:02d}"
                    
                locker = Locker(
                    id=locker_id,
                    controller_id=controller_id,
                    locker_number=l,
                    status="AVAILABLE"
                )
                db.add(locker)
                locker_index += 1
                
        # Audit log
        log = SystemLog(
            level="INFO",
            message=f"System initialized. Cluster: {schema.cluster_name}, Lockers: {schema.lockers_count}"
        )
        db.add(log)
        
        db.commit()
        return {"success": True, "message": "Cluster initialized successfully."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Setup initialization failed: {str(e)}")
