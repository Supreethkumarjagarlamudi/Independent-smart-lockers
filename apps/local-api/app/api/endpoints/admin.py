from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime
import os

from app.database.session import get_db
from app.models.models import Locker, Transaction, SystemLog, SystemConfig

router = APIRouter(prefix="/api/admin", tags=["admin"])

class OverrideLockerRequest(BaseModel):
    locker_id: str
    action: str  # "UNLOCK", "RELEASE", "MAINTENANCE", "AVAILABLE"

class FaceDebugLiveRequest(BaseModel):
    image: str  # base64-encoded JPEG

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    
    total_lockers = db.query(Locker).count()
    available_lockers = db.query(Locker).filter(Locker.status == "AVAILABLE").count()
    in_use_lockers = db.query(Locker).filter(Locker.status == "IN_USE").count()
    maintenance_lockers = db.query(Locker).filter(Locker.status == "MAINTENANCE").count()
    
    controllers_count = config.controllers_count if config else 1
    
    return {
        "total_lockers": total_lockers,
        "available_lockers": available_lockers,
        "in_use_lockers": in_use_lockers,
        "maintenance_lockers": maintenance_lockers,
        "controllers_count": controllers_count
    }

@router.get("/transactions")
def list_transactions(db: Session = Depends(get_db), limit: int = 15):
    txs = db.query(Transaction).order_by(Transaction.created_at.desc()).limit(limit).all()
    # Serialize results to return simple representation
    results = []
    for t in txs:
        results.append({
            "id": t.id,
            "transaction_id": t.transaction_id,
            "locker_id": t.locker_id,
            "flow_type": t.flow_type,
            "amount": t.amount,
            "payment_status": t.payment_status,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else None,
            "completed_at": t.completed_at.strftime("%Y-%m-%d %H:%M:%S") if t.completed_at else None,
        })
    return results

@router.get("/logs")
def list_logs(db: Session = Depends(get_db), limit: int = 20):
    logs = db.query(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit).all()
    return logs

@router.get("/status")
def get_system_status(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    
    # Simple self-diagnostic
    camera_online = config is not None and config.camera_model is not None
    
    # Poll actual hardware serial connection state
    from app.services.hardware_service import SIMULATION_MODE, hardware_service
    controllers_online = False
    if config and config.controllers_count > 0:
        all_online = True
        for i in range(1, config.controllers_count + 1):
            ctrl_id = f"CTRL-{i:03d}"
            if not hardware_service.check_controller_status(ctrl_id):
                all_online = False
                break
        controllers_online = all_online
        
    # Validate payment configuration. If hourly rate > 0, Razorpay keys must be present.
    from app.config.config import settings
    payment_online = True
    if config and config.hourly_rate > 0:
        has_db_keys = bool(config.razorpay_key_id and config.razorpay_key_secret)
        has_env_keys = bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        payment_online = has_db_keys or has_env_keys
    elif not config:
        payment_online = False

    network_online = True  # Mock cluster network connectivity check
    
    return {
        "camera": "Online" if camera_online else "Offline",
        "controllers": "Online" if controllers_online else "Offline",
        "payment": "Online" if payment_online else "Offline",
        "network": "Online" if network_online else "Offline",
        "hardware_mode": "Simulation (Mock)" if SIMULATION_MODE else "Production (Real Hardware)",
        "connected_ports": [conn.port for conn in hardware_service.connections.values() if conn and conn.is_open]
    }

@router.post("/locker/override")
def override_locker(req: OverrideLockerRequest, db: Session = Depends(get_db)):
    locker = db.query(Locker).filter(Locker.id == req.locker_id).first()
    if not locker:
        raise HTTPException(status_code=404, detail="Locker not found.")
        
    action = req.action.upper()
    
    if action == "UNLOCK":
        from app.services.hardware_service import hardware_service
        success = hardware_service.unlock_locker_door(locker.controller_id, locker.locker_number)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to trigger unlock command.")
        db.add(SystemLog(level="INFO", message=f"ADMIN OVERRIDE: Unlocked locker {locker.id}."))
        
    elif action == "RELEASE":
        locker.status = "AVAILABLE"
        # Find active transactions and close them
        tx = db.query(Transaction).filter(
            Transaction.locker_id == locker.id,
            Transaction.completed_at == None
        ).first()
        if tx:
            tx.completed_at = datetime.datetime.utcnow()
        db.add(SystemLog(level="INFO", message=f"ADMIN OVERRIDE: Released locker {locker.id} and completed transactions."))
        
    elif action == "MAINTENANCE":
        locker.status = "MAINTENANCE"
        db.add(SystemLog(level="WARNING", message=f"ADMIN OVERRIDE: Set locker {locker.id} status to MAINTENANCE."))
        
    elif action == "AVAILABLE":
        locker.status = "AVAILABLE"
        db.add(SystemLog(level="INFO", message=f"ADMIN OVERRIDE: Set locker {locker.id} status to AVAILABLE."))
        
    else:
        raise HTTPException(status_code=400, detail="Invalid override action. Valid values: UNLOCK, RELEASE, MAINTENANCE, AVAILABLE")
        
    db.commit()
    return {"success": True, "message": f"Action {action} applied to locker {req.locker_id}."}


@router.post("/reset-all")
def reset_all_lockers(db: Session = Depends(get_db)):
    """Release all IN_USE lockers and close all open transactions. Use for dev/testing resets."""
    # Close all open transactions
    open_txs = db.query(Transaction).filter(Transaction.completed_at == None).all()
    for tx in open_txs:
        tx.completed_at = datetime.datetime.utcnow()

    # Set all lockers that are IN_USE or RESERVED back to AVAILABLE
    busy_lockers = db.query(Locker).filter(Locker.status.in_(["IN_USE", "RESERVED"])).all()
    for locker in busy_lockers:
        locker.status = "AVAILABLE"

    released_count = len(busy_lockers)
    tx_count = len(open_txs)

    db.add(SystemLog(
        level="WARNING",
        message=f"ADMIN RESET: Released {released_count} locker(s) and closed {tx_count} transaction(s). System reset to clean state."
    ))
    db.commit()

    return {
        "success": True,
        "released_lockers": released_count,
        "closed_transactions": tx_count,
        "message": f"Reset complete. {released_count} locker(s) released, {tx_count} transaction(s) closed."
    }

# ─── DEV TOOLS: Face Algorithm Inspector ──────────────────────────────────────

@router.get("/face-debug")
def face_debug_info(db: Session = Depends(get_db)):
    """Returns the current face recognition algorithm metadata and model status."""
    from app.services.face_recognition_service import face_recognition_service, YUNET_MODEL_PATH, SFACE_MODEL_PATH
    from app.config.config import settings

    yunet_exists = os.path.isfile(YUNET_MODEL_PATH)
    sface_exists = os.path.isfile(SFACE_MODEL_PATH)
    yunet_size_kb = round(os.path.getsize(YUNET_MODEL_PATH) / 1024) if yunet_exists else 0
    sface_size_kb = round(os.path.getsize(SFACE_MODEL_PATH) / 1024) if sface_exists else 0

    config = db.query(SystemConfig).first()
    active_tx_count = db.query(Transaction).filter(
        Transaction.payment_status == "PAID",
        Transaction.completed_at == None,
        Transaction.face_encoding != None
    ).count()

    return {
        "algorithm": {
            "detection_model": "YuNet (OpenCV FaceDetectorYN)",
            "detection_model_file": "face_detection_yunet_2023mar.onnx",
            "recognition_model": "SFace (OpenCV FaceRecognizerSF)",
            "recognition_model_file": "face_recognition_sface_2021dec.onnx",
            "embedding_dimensions": 128,
            "similarity_metric": "Cosine Similarity (L2-normalized dot product)",
            "match_threshold": settings.FACE_MATCH_THRESHOLD,
            "description": (
                "YuNet detects face bounding boxes + 5 keypoints at ~1000fps. "
                "SFace extracts a 128-dim embedding from the aligned crop. "
                "Matching uses cosine similarity against all active transaction embeddings stored in SQLite."
            )
        },
        "model_status": {
            "yunet_loaded": face_recognition_service.initialized,
            "sface_loaded": face_recognition_service.initialized,
            "yunet_on_disk": yunet_exists,
            "sface_on_disk": sface_exists,
            "yunet_size_kb": yunet_size_kb,
            "sface_size_kb": sface_size_kb,
            "models_dir": YUNET_MODEL_PATH.replace("face_detection_yunet_2023mar.onnx", ""),
        },
        "database": {
            "active_enrolled_faces": active_tx_count,
            "face_match_threshold": settings.FACE_MATCH_THRESHOLD,
            "hourly_rate": config.hourly_rate if config else 10,
            "grace_period_minutes": config.grace_period if config else 10,
        }
    }


@router.post("/face-debug-live")
def face_debug_live(req: FaceDebugLiveRequest, db: Session = Depends(get_db)):
    """Runs face detection + similarity scoring against all active transactions. Returns debug info per candidate."""
    from app.services.face_recognition_service import face_recognition_service
    from app.config.config import settings

    success, embedding, msg = face_recognition_service.extract_face_embedding(req.image)
    
    if not success or embedding is None:
        return {
            "detection_success": False,
            "detection_message": msg,
            "candidates": [],
            "model_active": face_recognition_service.initialized
        }

    active_txs = db.query(Transaction).filter(
        Transaction.payment_status == "PAID",
        Transaction.completed_at == None,
        Transaction.face_encoding != None
    ).all()

    candidates = []
    for tx in active_txs:
        tx_emb = [float(x) for x in tx.face_encoding.split(",")]
        similarity = face_recognition_service.calculate_similarity(embedding, tx_emb)
        candidates.append({
            "locker_id": tx.locker_id,
            "transaction_id": tx.transaction_id,
            "similarity": round(similarity, 4),
            "similarity_pct": round(similarity * 100, 1),
            "would_match": similarity >= settings.FACE_MATCH_THRESHOLD,
            "threshold": settings.FACE_MATCH_THRESHOLD,
        })

    candidates.sort(key=lambda x: x["similarity"], reverse=True)

    return {
        "detection_success": True,
        "detection_message": msg,
        "embedding_dims": len(embedding),
        "candidates": candidates,
        "model_active": face_recognition_service.initialized,
        "threshold": settings.FACE_MATCH_THRESHOLD,
    }


# ─── ADMIN AUTH & REVENUE ANALYTICS ───────────────────────────────────────────

from sqlalchemy import func
from datetime import datetime, time, timedelta

class AdminLoginRequest(BaseModel):
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    expected_password = config.admin_password if (config and config.admin_password) else "admin123"
    
    if req.password == expected_password:
        return {
            "success": True,
            "message": "Login successful.",
            "is_default": expected_password == "admin123"
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid admin password.")

@router.post("/change-password")
def change_admin_password(req: ChangePasswordRequest, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="System configuration not initialized.")
        
    expected_password = config.admin_password if config.admin_password else "admin123"
    if req.old_password != expected_password:
        raise HTTPException(status_code=400, detail="Current password incorrect.")
        
    if not req.new_password or len(req.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters.")
        
    config.admin_password = req.new_password.strip()
    db.add(config)
    db.commit()
    
    return {
        "success": True,
        "message": "Password changed successfully."
    }


class UpdateConfigRequest(BaseModel):
    cluster_name: str
    station_name: str
    location: str
    free_minutes: int
    hourly_rate: float
    max_hours: int
    grace_period: int
    razorpay_key_id: Optional[str] = ""
    razorpay_key_secret: Optional[str] = ""
    face_threshold: Optional[float] = 0.80
    liveness_enabled: Optional[bool] = True

@router.post("/config/update")
def update_system_config(req: UpdateConfigRequest, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="System configuration not initialized.")
        
    config.cluster_name = req.cluster_name
    config.station_name = req.station_name
    config.location = req.location
    config.free_minutes = req.free_minutes
    config.hourly_rate = req.hourly_rate
    config.max_hours = req.max_hours
    config.grace_period = req.grace_period
    config.razorpay_key_id = req.razorpay_key_id
    config.razorpay_key_secret = req.razorpay_key_secret
    config.face_threshold = req.face_threshold if req.face_threshold is not None else 0.80
    config.liveness_enabled = req.liveness_enabled if req.liveness_enabled is not None else True
    
    db.add(config)
    db.add(SystemLog(
        level="WARNING",
        message=f"ADMIN CONFIG: Updated system settings (Hourly rate: ₹{req.hourly_rate}, Grace period: {req.grace_period} mins)."
    ))
    db.commit()
    
    return {
        "success": True,
        "message": "System configuration updated successfully."
    }


@router.get("/revenue")
def get_revenue_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    start_of_today = datetime.combine(now.date(), time.min)
    start_of_week = start_of_today - timedelta(days=now.weekday())  # Monday of this week

    # Sum only paid transactions (flow_type could be DEPOSIT or overdue payments RETRIEVE)
    today_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.payment_status == "PAID",
        Transaction.created_at >= start_of_today
    ).scalar() or 0.0

    week_revenue = db.query(func.sum(Transaction.amount)).filter(
        Transaction.payment_status == "PAID",
        Transaction.created_at >= start_of_week
    ).scalar() or 0.0

    custom_revenue = 0.0
    if start_date and end_date:
        try:
            start_dt = datetime.combine(datetime.strptime(start_date, "%Y-%m-%d").date(), time.min)
            end_dt = datetime.combine(datetime.strptime(end_date, "%Y-%m-%d").date(), time.max)
            custom_revenue = db.query(func.sum(Transaction.amount)).filter(
                Transaction.payment_status == "PAID",
                Transaction.created_at >= start_dt,
                Transaction.created_at <= end_dt
            ).scalar() or 0.0
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    return {
        "today": float(today_revenue),
        "week": float(week_revenue),
        "custom": float(custom_revenue)
    }

@router.get("/all-transactions")
def get_all_transactions(db: Session = Depends(get_db), limit: int = 250):
    txs = db.query(Transaction).order_by(Transaction.created_at.desc()).limit(limit).all()
    results = []
    for t in txs:
        # Calculate active elapsed duration if completed_at is null
        elapsed_seconds = None
        if t.payment_status == "PAID" and t.completed_at is None:
            elapsed_seconds = int((datetime.utcnow() - t.created_at).total_seconds())

        results.append({
            "id": t.id,
            "transaction_id": t.transaction_id,
            "locker_id": t.locker_id,
            "flow_type": t.flow_type,
            "amount": t.amount,
            "payment_status": t.payment_status,
            "payment_ref": t.payment_ref,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else None,
            "completed_at": t.completed_at.strftime("%Y-%m-%d %H:%M:%S") if t.completed_at else None,
            "elapsed_seconds": elapsed_seconds
        })
    return results

