import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.session import Base

class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    cluster_name = Column(String, nullable=False)
    station_name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    timezone = Column(String, nullable=False)
    
    # Pricing policy
    free_minutes = Column(Integer, default=15)
    hourly_rate = Column(Float, default=10.0)
    max_hours = Column(Integer, default=24)
    grace_period = Column(Integer, default=10)
    
    # Discovery state
    camera_model = Column(String, nullable=True)
    controllers_count = Column(Integer, default=1)
    lockers_count = Column(Integer, default=10)
    
    initialized = Column(Boolean, default=False)
    admin_password = Column(String, default="admin123")
    
    # Optional credentials for integrated payments
    razorpay_key_id = Column(String, nullable=True)
    razorpay_key_secret = Column(String, nullable=True)
    
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Locker(Base):
    __tablename__ = "lockers"

    id = Column(String, primary_key=True)  # E.g., "A-01", "A-12"
    controller_id = Column(String, nullable=False)  # E.g., "CTRL-001"
    locker_number = Column(Integer, nullable=False)  # E.g., 1 to 10
    status = Column(String, default="AVAILABLE")  # "AVAILABLE", "IN_USE", "MAINTENANCE"
    
    transactions = relationship("Transaction", back_populates="locker")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)  # E.g., TXN78451236
    locker_id = Column(String, ForeignKey("lockers.id"), nullable=False)
    flow_type = Column(String, nullable=False)  # "DEPOSIT", "RETRIEVE"
    amount = Column(Float, default=0.0)
    payment_status = Column(String, default="PENDING")  # "PENDING", "PAID", "FAILED"
    payment_ref = Column(String, nullable=True)
    
    # Face recognition vector stored as comma-separated floats
    face_encoding = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    locker = relationship("Locker", back_populates="transactions")


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    level = Column(String, default="INFO")  # "INFO", "WARNING", "ERROR"
    message = Column(String, nullable=False)
