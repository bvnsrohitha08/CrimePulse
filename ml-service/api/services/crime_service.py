import joblib
import sys
from pathlib import Path

# Add ml-service/crime-prediction to Python path
PREDICTION_SERVICE_DIR = Path(__file__).resolve().parent.parent.parent / "crime-prediction"
if str(PREDICTION_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(PREDICTION_SERVICE_DIR))

from src.predictor import CrimePredictor
from src.config import METADATA_FILE, MODEL_FILE, ENCODERS_FILE

class CrimeService:
    """
    Singleton service layer wrapping the CrimePredictor and managing model lifecycle.
    Loads model artifacts ONCE upon application startup.
    """
    def __init__(self):
        self.predictor = None
        self.metadata = None
        self.is_loaded = False

    def initialize(self):
        """Loads model artifacts and metadata into memory ONCE during application startup."""
        try:
            print(f"Loading ML model artifacts from {MODEL_FILE}...")
            self.predictor = CrimePredictor(
                model_file=MODEL_FILE,
                encoders_file=ENCODERS_FILE
            )
            if METADATA_FILE.exists():
                self.metadata = joblib.load(METADATA_FILE)
            else:
                self.metadata = {}
                
            self.is_loaded = True
            print("ML Model successfully loaded into memory.")
        except Exception as e:
            print(f"Error loading ML model artifacts: {e}")
            self.is_loaded = False
            raise e

    def get_health(self) -> dict:
        """Returns application health and model load state."""
        return {
            "status": "ok" if self.is_loaded else "unhealthy",
            "service": "crimepulse-ml",
            "model_loaded": self.is_loaded
        }

    def get_model_info(self) -> dict:
        """Returns model metadata and parameters."""
        if not self.is_loaded or self.predictor is None:
            raise RuntimeError("Model service is not initialized.")
            
        classes = list(self.predictor.encoders["target_encoder"].classes_)
        n_estimators = self.metadata.get("n_estimators", 300)
        
        return {
            "model_type": "PureRandomForestClassifier",
            "n_estimators": n_estimators,
            "max_depth": 15,
            "feature_count": 15,
            "class_count": len(classes),
            "classes": classes
        }

    def predict(self, state: str, district: str, year: int) -> dict:
        """Delegates prediction request to CrimePredictor."""
        if not self.is_loaded or self.predictor is None:
            raise RuntimeError("Model service is not initialized.")
            
        return self.predictor.predict_next_year_crime(state, district, year)

# Shared singleton instance
crime_service = CrimeService()
