import datetime
import math
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.models.models import Transaction, Locker, SystemLog, SystemConfig
from app.services.face_recognition_service import face_recognition_service
from app.config.config import settings

router = APIRouter(prefix="/api/face", tags=["face"])

class FaceRegisterRequest(BaseModel):
    transaction_id: str
    image: str  # Base64 encoded string

class FaceVerifyRequest(BaseModel):
    image: str  # Base64 encoded string

def get_overdue_fee_for_tx(tx: Transaction, db: Session) -> float:
    try:
        config = db.query(SystemConfig).first()
        hourly_rate = config.hourly_rate if config else 10.0
        
        if hourly_rate <= 0:
            return 0.0
            
        prepaid_hours = tx.amount / hourly_rate
        prepaid_duration = datetime.timedelta(hours=prepaid_hours)
        
        expiry_time = tx.created_at + prepaid_duration
        now = datetime.datetime.utcnow()
        
        if now <= expiry_time:
            return 0.0
            
        overdue_duration = now - expiry_time
        overdue_seconds = overdue_duration.total_seconds()
        
        # Apply grace period configuration
        grace_minutes = config.grace_period if config else 10
        if overdue_seconds <= (grace_minutes * 60):
            return 0.0
            
        # Calculate overdue hours (rounded up)
        overdue_hours = math.ceil(overdue_seconds / 3600.0)
        return float(overdue_hours * hourly_rate)
    except Exception as e:
        print(f"Error calculating overdue fee: {e}")
        return 0.0

@router.post("/register")
def register_face(req: FaceRegisterRequest, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.transaction_id == req.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    if tx.payment_status != "PAID":
        raise HTTPException(status_code=400, detail="Cannot register face before payment is completed.")

    # Extract face embedding
    success, embedding, msg = face_recognition_service.extract_face_embedding(req.image)
    if not success or embedding is None:
        raise HTTPException(status_code=420, detail=msg)
        
    # Serialize embedding list to comma-separated string
    embedding_str = ",".join(map(str, embedding))
    tx.face_encoding = embedding_str
    
    # Assign the locker and change its status from RESERVED to IN_USE
    locker = db.query(Locker).filter(Locker.id == tx.locker_id).first()
    if locker:
        locker.status = "IN_USE"
        db.add(locker)
        
    db.add(tx)
    
    db.add(SystemLog(
        level="INFO",
        message=f"Face registered successfully for transaction {tx.transaction_id}, Locker assigned: {tx.locker_id}."
    ))
    
    db.commit()
    
    return {
        "success": True,
        "message": "Face registration successful.",
        "locker_id": tx.locker_id,
        "transaction_id": tx.transaction_id
    }

@router.post("/verify")
def verify_face(req: FaceVerifyRequest, db: Session = Depends(get_db)):
    # 1. Extract embedding from camera frame
    success, embedding, msg = face_recognition_service.extract_face_embedding(req.image)
    if not success or embedding is None:
        raise HTTPException(status_code=420, detail=msg)
        
    # 2. Get all active deposit transactions with active lockers (status == IN_USE)
    active_lockers = db.query(Locker).filter(Locker.status == "IN_USE").all()
    active_locker_ids = [l.id for l in active_lockers]
    
    active_txs = db.query(Transaction).filter(
        Transaction.locker_id.in_(active_locker_ids),
        Transaction.payment_status == "PAID",
        Transaction.completed_at == None,
        Transaction.face_encoding != None
    ).all()
    
    if not active_txs:
        raise HTTPException(status_code=404, detail="No active lockers found for matching.")
        
    # 3. Match embeddings and check thresholds
    threshold = settings.FACE_MATCH_THRESHOLD
    matched_transactions = []
    
    for tx in active_txs:
        tx_emb = [float(x) for x in tx.face_encoding.split(",")]
        similarity = face_recognition_service.calculate_similarity(embedding, tx_emb)
        
        if similarity >= threshold:
            overdue_fee = get_overdue_fee_for_tx(tx, db)
            matched_transactions.append({
                "locker_id": tx.locker_id,
                "transaction_id": tx.transaction_id,
                "similarity": similarity,
                "created_at": tx.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "amount": tx.amount,
                "overdue_fee": overdue_fee
            })
            
    if not matched_transactions:
        # Match failed
        db.add(SystemLog(
            level="WARNING",
            message=f"Face verification attempt failed. No active faces matched above threshold {threshold}."
        ))
        db.commit()
        raise HTTPException(
            status_code=401, 
            detail="Face verification failed. Please look directly at the camera and try again."
        )
        
    # Sort matches by similarity descending
    matched_transactions.sort(key=lambda x: x["similarity"], reverse=True)
    
    # Log match success
    db.add(SystemLog(
        level="INFO",
        message=f"Face verified successfully. Matched {len(matched_transactions)} active locker(s)."
    ))
    db.commit()
    
    if len(matched_transactions) > 1:
        return {
            "match": True,
            "multiple_matches": True,
            "matches": matched_transactions
        }
    else:
        single_match = matched_transactions[0]
        return {
            "match": True,
            "multiple_matches": False,
            "locker_id": single_match["locker_id"],
            "transaction_id": single_match["transaction_id"],
            "overdue_fee": single_match["overdue_fee"]
        }
