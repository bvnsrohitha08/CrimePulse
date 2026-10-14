import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure ml-service root is on sys.path
ML_SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(ML_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_SERVICE_DIR))

from api.routes.crime import router as crime_router
from api.routes.analytics import router as analytics_router
from api.services.crime_service import crime_service
from api.services.analytics_service import analytics_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan handler: loads ML model artifacts and historical analytics dataset ONCE upon service startup."""
    print("Initializing CrimePulse ML Service Lifespan...")
    crime_service.initialize()
    analytics_service.initialize()
    yield
    print("Shutting down CrimePulse ML Service...")

app = FastAPI(
    title="CrimePulse ML Microservice",
    description="Inference and historical crime analytics REST API powered by historical district-wise crime data and Random Forest classification.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for future local frontend development
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(crime_router)
app.include_router(analytics_router)

