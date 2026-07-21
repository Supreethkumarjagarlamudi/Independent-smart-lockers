import datetime
import uuid
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.models.models import Transaction, Locker, SystemConfig, SystemLog
from app.config.config import settings

router = APIRouter(prefix="/api/payment", tags=["payment"])

class CreatePaymentRequest(BaseModel):
    amount: float
    flow_type: str  # "DEPOSIT" or "RETRIEVE"
    locker_id: str = None
    parent_transaction_id: str = None

class VerifyPaymentRequest(BaseModel):
    transaction_id: str

class SimulateConfirmRequest(BaseModel):
    transaction_id: str

import razorpay
import time

@router.post("/create")
def create_payment(req: CreatePaymentRequest, db: Session = Depends(get_db)):
    try:
        target_locker_id = None
        
        # 1. For DEPOSIT, check and reserve a locker. For RETRIEVE, use the existing locker.
        if req.flow_type == "DEPOSIT":
            available_locker = db.query(Locker).filter(Locker.status == "AVAILABLE").first()
            if not available_locker:
                raise HTTPException(status_code=404, detail="No lockers available at this moment.")
            target_locker_id = available_locker.id
            available_locker.status = "RESERVED"
            db.add(available_locker)
        else:
            target_locker_id = req.locker_id
            if not target_locker_id:
                raise HTTPException(status_code=400, detail="Locker ID is required for retrieval payments.")

        # 2. Generate transaction details
        tx_id = f"TXN{uuid.uuid4().int % 100000000:08d}"
        
        # Get UPI configurations from DB/settings
        config = db.query(SystemConfig).first()
        upi_vpa = config.cluster_name + "@upi" if config else settings.UPI_VPA
        merchant_name = config.cluster_name if config else settings.UPI_MERCHANT_NAME
        
        # 3. Construct UPI Deep Link / Razorpay UPI QR
        key_id = config.razorpay_key_id if (config and config.razorpay_key_id) else settings.RAZORPAY_KEY_ID
        key_secret = config.razorpay_key_secret if (config and config.razorpay_key_secret) else settings.RAZORPAY_KEY_SECRET
        
        # Enforce that keys cannot be empty if amount is paid (amount > 0)
        if req.amount > 0 and (not key_id or not key_secret):
            raise HTTPException(status_code=400, detail="Payment Gateway is not configured. Please contact the administrator.")
            
        upi_link = None
        payment_ref = None
        
        if key_id and key_secret:
            try:
                client = razorpay.Client(auth=(key_id, key_secret))
                # Create a single-use UPI QR code via Razorpay
                qr_data = client.qrcode.create({
                    "type": "upi_qr",
                    "name": f"Locker Kiosk {tx_id}",
                    "usage": "single_use",
                    "fixed_amount": True,
                    "payment_amount": int(req.amount * 100),  # amount in paise
                    "description": f"Overdue {target_locker_id} {tx_id}" if req.flow_type == "RETRIEVE" else f"Session {tx_id}",
                    "close_by": int(time.time() + 600)  # expires in 10 minutes
                })
                img_content = qr_data.get("image_content")
                img_url = qr_data.get("image_url")
                raw_string = qr_data.get("string")

                if img_content:
                    upi_link = img_content if img_content.startswith("data:") else f"data:image/png;base64,{img_content}"
                elif img_url:
                    upi_link = img_url
                else:
                    upi_link = raw_string

                payment_ref = qr_data.get("id")
                if not upi_link:
                    raise Exception("Razorpay API did not return image_content, image_url, or string in response.")
            except Exception as e:
                # Require live Razorpay connection for automatic verification
                raise HTTPException(status_code=400, detail=f"Payment Gateway Error: {str(e)}")
        
        if not upi_link:
            # Fallback mock UPI
            encoded_merchant = urllib.parse.quote(merchant_name)
            upi_link = f"upi://pay?pa={upi_vpa}&pn={encoded_merchant}&am={req.amount:.2f}&cu=INR&tn={tx_id}"
            payment_ref = "MOCK_REF"
            
        # 4. Save transaction
        transaction = Transaction(
            transaction_id=tx_id,
            locker_id=target_locker_id,
            flow_type=req.flow_type,
            amount=req.amount,
            payment_status="PENDING",
            payment_ref=payment_ref,
            created_at=datetime.datetime.utcnow()
        )
        
        db.add(transaction)
        
        # Log event
        db.add(SystemLog(
            level="INFO",
            message=f"Created {req.flow_type} payment transaction {tx_id} for locker {target_locker_id}."
        ))
        
        db.commit()
        
        is_test_mode = True
        if key_id and key_id.startswith("rzp_live_"):
            is_test_mode = False
            
        return {
            "transaction_id": tx_id,
            "upi_link": upi_link,
            "amount": req.amount,
            "locker_id": target_locker_id,
            "is_test_mode": is_test_mode
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create payment: {str(e)}")

@router.post("/verify")
def verify_payment(req: VerifyPaymentRequest, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.transaction_id == req.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    # Check status with Razorpay if keys are configured
    config = db.query(SystemConfig).first()
    key_id = config.razorpay_key_id if (config and config.razorpay_key_id) else settings.RAZORPAY_KEY_ID
    key_secret = config.razorpay_key_secret if (config and config.razorpay_key_secret) else settings.RAZORPAY_KEY_SECRET
    
    if key_id and key_secret and tx.payment_status == "PENDING" and tx.payment_ref and tx.payment_ref != "MOCK_REF":
        try:
            client = razorpay.Client(auth=(key_id, key_secret))
            payments = client.qrcode.fetch_payments(tx.payment_ref)
            if payments.get("items") and any(p.get("status") in ["captured", "authorized"] for p in payments["items"]):
                tx.payment_status = "PAID"
                db.add(SystemLog(
                    level="INFO",
                    message=f"Razorpay payment confirmed for transaction {tx.transaction_id}."
                ))
                db.commit()
        except Exception as e:
            print(f"Razorpay payment status verification query failed: {e}")
            
    return {
        "transaction_id": tx.transaction_id,
        "payment_status": tx.payment_status,
        "locker_id": tx.locker_id
    }

@router.post("/simulate-confirm")
def simulate_confirm(req: SimulateConfirmRequest, db: Session = Depends(get_db)):
    """
    Simulates the webhook callback from the payment gateway to mark a transaction as PAID.
    In a real production environment, this is replaced by an API webhook endpoint.
    """
    # Enforce test mode check to block simulation in production
    config = db.query(SystemConfig).first()
    key_id = config.razorpay_key_id if (config and config.razorpay_key_id) else settings.RAZORPAY_KEY_ID
    if key_id and key_id.startswith("rzp_live_"):
        raise HTTPException(status_code=403, detail="Payment simulation is disabled in Live Mode.")

    tx = db.query(Transaction).filter(Transaction.transaction_id == req.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    if tx.payment_status != "PAID":
        tx.payment_status = "PAID"
        tx.payment_ref = f"REF{uuid.uuid4().int % 10000000000:010d}"
        
        # Log payment success
        db.add(SystemLog(
            level="INFO",
            message=f"Payment received for {tx.transaction_id}. Ref: {tx.payment_ref}."
        ))
        db.commit()
        
    return {
        "success": True,
        "transaction_id": tx.transaction_id,
        "payment_status": tx.payment_status
    }


class CancelPaymentRequest(BaseModel):
    transaction_id: str

@router.post("/cancel")
def cancel_payment(req: CancelPaymentRequest, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.transaction_id == req.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
        
    if tx.payment_status == "PENDING":
        if tx.flow_type == "DEPOSIT":
            locker = db.query(Locker).filter(Locker.id == tx.locker_id).first()
            if locker and locker.status == "RESERVED":
                locker.status = "AVAILABLE"
                db.add(locker)
                
        tx.payment_status = "FAILED"
        db.add(tx)
        db.add(SystemLog(
            level="WARNING",
            message=f"Payment transaction {tx.transaction_id} cancelled/timed out. Locker {tx.locker_id} set back to AVAILABLE."
        ))
        db.commit()
        return {"success": True, "message": f"Transaction cancelled. Locker {tx.locker_id} released."}
        
    return {"success": False, "message": "Transaction is not pending."}

