import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "Smart Locker Cluster API"
    VERSION: str = "1.0.0"
    
    # Database config (resolved to absolute path in local-api project directory)
    _base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    _db_dir = os.path.join(_base_dir, "data")
    os.makedirs(_db_dir, exist_ok=True)
    _db_path = os.path.join(_db_dir, "smart_lockers.db")
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{_db_path}")
    
    # UPI Merchant Details
    UPI_VPA: str = os.getenv("UPI_VPA", "simats@upi")
    UPI_MERCHANT_NAME: str = os.getenv("UPI_MERCHANT_NAME", "SIMATS Smart Locker")
    
    # Face Recognition Threshold (Cosine similarity: higher means more strict, typically 0.6 is good for FaceRecognizerSF)
    FACE_MATCH_THRESHOLD: float = float(os.getenv("FACE_MATCH_THRESHOLD", "0.60"))
    
    # Static locker cost
    LOCKER_PRICE_INR: float = float(os.getenv("LOCKER_PRICE_INR", "60.0"))

    # Razorpay API Credentials
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")

    # Admin Credentials
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

settings = Settings()
