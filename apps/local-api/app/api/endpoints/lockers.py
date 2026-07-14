import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.models.models import Locker, Transaction, SystemLog
from app.services.hardware_service import hardware_service

router = APIRouter(prefix="/api/lockers", tags=["lockers"])

class ReleaseRequest(BaseModel):
    transaction_id: str

@router.get("")
def list_lockers(db: Session = Depends(get_db)):
    lockers = db.query(Locker).all()
    return lockers

@router.post("/unlock/{locker_id}")
def unlock_locker(locker_id: str, db: Session = Depends(get_db)):
    locker = db.query(Locker).filter(Locker.id == locker_id).first()
    if not locker:
        raise HTTPException(status_code=404, detail="Locker not found.")
        
    # Send unlock pulse to physical relay board
    success = hardware_service.unlock_locker_door(locker.controller_id, locker.locker_number)
    if not success:
        raise HTTPException(status_code=500, detail="Hardware controller communication failure.")
        
    # Log unlocking
    db.add(SystemLog(
        level="INFO",
        message=f"Locker {locker_id} door unlocked successfully."
    ))
    db.commit()
    
    return {"success": True, "message": f"Locker {locker_id} unlocked."}

@router.post("/release/{locker_id}")
def release_locker(locker_id: str, req: ReleaseRequest, db: Session = Depends(get_db)):
    locker = db.query(Locker).filter(Locker.id == locker_id).first()
    if not locker:
        raise HTTPException(status_code=404, detail="Locker not found.")
        
    tx = db.query(Transaction).filter(Transaction.transaction_id == req.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    # Update locker status back to AVAILABLE
    locker.status = "AVAILABLE"
    
    # Mark transaction as completed
    tx.completed_at = datetime.datetime.utcnow()
    
    # Log locker release
    db.add(SystemLog(
        level="INFO",
        message=f"Locker {locker_id} released. Transaction {req.transaction_id} marked complete."
    ))
    
    db.commit()
    
    return {"success": True, "message": f"Locker {locker_id} successfully released."}
