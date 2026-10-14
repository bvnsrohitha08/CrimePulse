import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "crime_dataset_india.csv"
MODEL_DIR = BASE_DIR / "model" / "reproduced"

# Ensure output model directory exists
MODEL_DIR.mkdir(parents=True, exist_ok=True)

MODEL_FILE = MODEL_DIR / "rf_model.joblib"
ENCODERS_FILE = MODEL_DIR / "encoders.joblib"
METADATA_FILE = MODEL_DIR / "metadata.joblib"

# Crime categories used in historical prediction (Source of truth: Notebook Cell 4)
PREDICTION_CATEGORIES = [
    "THEFT",
    "HURT/GREVIOUS HURT",
    "CAUSING DEATH BY NEGLIGENCE",
    "RIOTS",
    "BURGLARY",
    "MURDER"
]

# Exact 15 feature names in exact column sequence (Source of truth: Notebook Cell 8)
FEATURE_NAMES = [
    "YEAR",
    "THEFT",
    "HURT/GREVIOUS HURT",
    "CAUSING DEATH BY NEGLIGENCE",
    "RIOTS",
    "BURGLARY",
    "MURDER",
    "THEFT_RATIO",
    "HURT/GREVIOUS HURT_RATIO",
    "CAUSING DEATH BY NEGLIGENCE_RATIO",
    "RIOTS_RATIO",
    "BURGLARY_RATIO",
    "MURDER_RATIO",
    "STATE_ENCODED",
    "DISTRICT_ENCODED"
]

# Random Forest Hyperparameters matching Notebook Cell 10 exactly
RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": 15,
    "min_samples_split": 5,
    "random_state": 42,
    "class_weight": "balanced",
    "n_jobs": -1
}
