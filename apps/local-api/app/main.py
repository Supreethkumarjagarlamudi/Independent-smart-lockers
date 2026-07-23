import threading
import logging

# Configure root logger to output logs to console stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import Base, engine
from app.api.endpoints import setup, payment, face, lockers, admin, camera
from app.services.face_recognition_service import face_recognition_service
from app.models.models import SystemConfig, Locker

app = FastAPI(
    title="Smart Locker Cluster API",
    version="1.0.0",
)

# 1. CORS Configuration (production-ready & secure)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database table creation
# In production, we'd use migrations like Alembic. For this local deployment,
# declarative schema generation ensures the DB is instantly set up on start.
Base.metadata.create_all(bind=engine)

# Run lightweight database migration to add dynamic columns if they don't exist
from sqlalchemy import text
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE system_configs ADD COLUMN admin_password VARCHAR DEFAULT 'admin123'"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE system_configs ADD COLUMN razorpay_key_id VARCHAR"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE system_configs ADD COLUMN razorpay_key_secret VARCHAR"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE system_configs ADD COLUMN face_threshold FLOAT DEFAULT 0.80"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE system_configs ADD COLUMN liveness_enabled BOOLEAN DEFAULT 1"))
except Exception:
    pass


# 3. Include Routers
app.include_router(setup.router)
app.include_router(payment.router)
app.include_router(face.router)
app.include_router(lockers.router)
app.include_router(admin.router)
app.include_router(camera.router)

@app.on_event("startup")
def startup_event():
    # Warmup and download Face Recognition models in a background thread
    # so startup is fast and non-blocking
    threading.Thread(target=face_recognition_service.initialize_models, daemon=True).start()

@app.get("/")
def root():
    return {
        "application": "Smart Locker Cluster",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
    }

@app.get("/version")
def version():
    return {
        "version": "1.0.0",
    }

@app.get("/cluster/status")
def cluster_status():
    # Helper backward compatible endpoint checking if cluster setup is initialized
    from app.database.session import SessionLocal
    db = SessionLocal()
    try:
        config = db.query(SystemConfig).first()
        if config:
            return {
                "initialized": config.initialized,
                "cluster_name": config.cluster_name,
                "station_name": config.station_name
            }
        return {"initialized": False}
    finally:
        db.close()