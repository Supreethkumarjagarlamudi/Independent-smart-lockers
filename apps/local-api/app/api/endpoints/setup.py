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
    razorpay_key_id: Optional[str] = ""
    razorpay_key_secret: Optional[str] = ""
    admin_password: Optional[str] = "admin123"
    face_threshold: Optional[float] = 0.80
    liveness_enabled: Optional[bool] = True

class CameraInfo(BaseModel):
    id: str
    name: str
    status: str

class ControllerInfo(BaseModel):
    id: str
    name: str
    port: str
    status: str

@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    if config:
        return {"initialized": config.initialized, "config": config}
    return {"initialized": False, "config": None}

@router.get("/cameras", response_model=List[CameraInfo])
def discover_cameras():
    cameras = []
    import os
    
    # 1. Scan /sys/class/video4linux (Linux/Pi standard path for connected video devices)
    v4l_dir = "/sys/class/video4linux"
    if os.path.exists(v4l_dir):
        try:
            for vdev in sorted(os.listdir(v4l_dir)):
                dev_path = os.path.join(v4l_dir, vdev)
                name_file = os.path.join(dev_path, "name")
                if os.path.exists(name_file):
                    with open(name_file, "r") as f:
                        dev_name = f.read().strip()
                    
                    # Filter out metadata nodes, codecs, and ISP virtual devices
                    lower_name = dev_name.lower()
                    if any(word in lower_name for word in ["codec", "isp", "metadata", "fd", "video-mux", "broadcom"]):
                        continue
                    
                    cameras.append(CameraInfo(id=f"/dev/{vdev}", name=dev_name, status="Ready"))
        except Exception as e:
            print(f"Error scanning video4linux: {e}")
            
    # 2. Fallback check for standard /dev/video* devices if v4l_dir scan failed
    if not cameras and os.path.exists("/dev"):
        import glob
        try:
            devs = sorted(glob.glob("/dev/video*"))
            for dev in devs:
                name = os.path.basename(dev)
                cameras.append(CameraInfo(id=dev, name=f"USB Camera ({name})", status="Ready"))
        except Exception as e:
            print(f"Error scanning /dev/video: {e}")

    # 3. Add test fallback list ONLY if no real connected devices were detected (keeps dev environment working)
    if not cameras:
        cameras.append(CameraInfo(id="0", name="Random USB Camera", status="Ready"))
        cameras.append(CameraInfo(id="1", name="Integrated FaceTime HD Camera", status="Ready"))
        cameras.append(CameraInfo(id="2", name="Logitech Webcam C920", status="Ready"))
    else:
        # If real cameras are connected, only show the real ones + "Random USB Camera" for testing
        cameras.append(CameraInfo(id="mock_random", name="Random USB Camera", status="Ready"))
        
    return cameras

@router.get("/controllers", response_model=List[ControllerInfo])
def discover_controllers(count: Optional[int] = None):
    controllers = []
    
    # If there are active serial connections in the hardware service
    if hardware_service.connections:
        for idx, (ctrl_id, conn) in enumerate(hardware_service.connections.items()):
            port_name = conn.port if hasattr(conn, 'port') else "USB Device"
            status = "Online" if hardware_service.check_controller_status(ctrl_id) else "Offline"
            controllers.append(ControllerInfo(
                id=ctrl_id,
                name=f"Controller {idx + 1}",
                port=port_name,
                status=status
            ))
    else:
        # Fallback simulation items for setup UI
        limit = count if count is not None else 1
        for i in range(1, limit + 1):
            ctrl_id = f"CTRL-{i:03d}"
            controllers.append(ControllerInfo(
                id=ctrl_id,
                name=f"Controller {i} (Simulation)",
                port="Simulation Mode",
                status="Online"
            ))
            
    return controllers

@router.post("/initialize")
def initialize_cluster(schema: ConfigSetupSchema, update: Optional[bool] = False, db: Session = Depends(get_db)):
    try:
        # Check if update mode
        if update:
            config = db.query(SystemConfig).first()
            if config:
                config.cluster_name = schema.cluster_name
                config.station_name = schema.station_name
                config.location = schema.location
                config.timezone = schema.timezone
                config.free_minutes = schema.free_minutes
                config.hourly_rate = schema.hourly_rate
                config.max_hours = schema.max_hours
                config.grace_period = schema.grace_period
                config.camera_model = schema.camera_model
                config.controllers_count = schema.controllers_count
                config.lockers_count = schema.lockers_count
                config.razorpay_key_id = schema.razorpay_key_id
                config.razorpay_key_secret = schema.razorpay_key_secret
                if schema.admin_password:
                    config.admin_password = schema.admin_password
                if schema.face_threshold is not None:
                    config.face_threshold = schema.face_threshold
                if schema.liveness_enabled is not None:
                    config.liveness_enabled = schema.liveness_enabled
            else:
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
                    razorpay_key_id=schema.razorpay_key_id,
                    razorpay_key_secret=schema.razorpay_key_secret,
                    admin_password=schema.admin_password if schema.admin_password else "admin123",
                    face_threshold=schema.face_threshold if schema.face_threshold is not None else 0.80,
                    liveness_enabled=schema.liveness_enabled if schema.liveness_enabled is not None else True,
                    initialized=True
                )
                db.add(config)
        else:
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
                razorpay_key_id=schema.razorpay_key_id,
                razorpay_key_secret=schema.razorpay_key_secret,
                admin_password=schema.admin_password if schema.admin_password else "admin123",
                face_threshold=schema.face_threshold if schema.face_threshold is not None else 0.80,
                liveness_enabled=schema.liveness_enabled if schema.liveness_enabled is not None else True,
                initialized=True
            )
            db.add(config)
        
        # Generate lockers automatically based on controllers and count
        # For simplicity, divide total lockers count evenly among controllers
        lockers_per_controller = max(1, schema.lockers_count // schema.controllers_count)
        
        locker_index = 1
        prefix_val = schema.locker_prefix or "A"
        
        # In update mode, track existing lockers to avoid duplicate creation
        existing_lockers = {l.id: l for l in db.query(Locker).all()} if update else {}
        active_locker_ids = set()
        
        for c in range(1, schema.controllers_count + 1):
            controller_id = f"CTRL-{c:03d}"
            
            for l in range(1, lockers_per_controller + 1):
                if prefix_val != "A":
                    locker_id = f"{prefix_val}-{locker_index}"
                else:
                    prefix_char = chr(64 + c) # 65 is 'A'
                    locker_id = f"{prefix_char}-{l:02d}"
                
                active_locker_ids.add(locker_id)
                
                if locker_id in existing_lockers:
                    # Update mapping coordinates for existing locker
                    existing_lockers[locker_id].controller_id = controller_id
                    existing_lockers[locker_id].locker_number = l
                else:
                    # Append new locker
                    locker = Locker(
                        id=locker_id,
                        controller_id=controller_id,
                        locker_number=l,
                        status="AVAILABLE"
                    )
                    db.add(locker)
                locker_index += 1
                
        # Clean up decommissioned lockers, preserving occupied ones
        if update:
            for old_id, old_locker in list(existing_lockers.items()):
                if old_id not in active_locker_ids:
                    if old_locker.status == "AVAILABLE":
                        db.delete(old_locker)
                    else:
                        print(f"Warning: Occupied locker {old_id} is excluded from layout but preserved to protect active transaction.")
                        
        # Audit log
        log = SystemLog(
            level="INFO",
            message=f"System layout updated. Mode: {'Update' if update else 'Init'}, Cluster: {schema.cluster_name}, Lockers: {schema.lockers_count}"
        )
        db.add(log)
        
        db.commit()
        return {"success": True, "message": "Cluster initialized successfully."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Setup initialization failed: {str(e)}")
