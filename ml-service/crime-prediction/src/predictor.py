import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from src.config import DATA_PATH, MODEL_FILE, ENCODERS_FILE, PREDICTION_CATEGORIES, FEATURE_NAMES
from src.preprocessing import load_and_clean_dataset
from src.pure_rf import PureRandomForestClassifier, PureLabelEncoder

class CrimePredictor:
    """
    Reusable local inference engine wrapping the pre-trained Random Forest model
    and LabelEncoders preserved from team member's Google Colab notebook.
    """
    
    def __init__(self, model_file=MODEL_FILE, encoders_file=ENCODERS_FILE, data_path=DATA_PATH):
        self.model_file = Path(model_file)
        self.encoders_file = Path(encoders_file)
        self.data_path = Path(data_path)
        
        self.rf_model = None
        self.encoders = None
        self.dataset = None
        
        self._load_resources()
        
    def _load_resources(self):
        """Loads serialized model artifacts, encoders, and historical lookup dataset."""
        if not self.model_file.exists() or not self.encoders_file.exists():
            raise FileNotFoundError(
                f"Model artifacts missing. Run `python -m src.trainer` to generate reproduced artifacts at {self.model_file}."
            )
            
        self.rf_model = joblib.load(self.model_file)
        self.encoders = joblib.load(self.encoders_file)
        self.dataset = load_and_clean_dataset(self.data_path)
        
    def predict_next_year_crime(self, state: str, district: str, year: int) -> dict:
        """
        Executes prediction pipeline for next year's dominant crime category.
        
        Parameters:
            state (str): State or Union Territory name
            district (str): District name
            year (int): Historical observation year present in dataset
            
        Returns:
            dict: Structured prediction dictionary containing target year, predicted crime, confidence, and probability table.
        """
        if not isinstance(state, str) or not state.strip():
            return {
                "status": "error",
                "error_type": "INVALID_INPUT",
                "message": "State name must be a non-empty string."
            }
            
        if not isinstance(district, str) or not district.strip():
            return {
                "status": "error",
                "error_type": "INVALID_INPUT",
                "message": "District name must be a non-empty string."
            }
            
        try:
            year = int(year)
        except (ValueError, TypeError):
            return {
                "status": "error",
                "error_type": "INVALID_INPUT",
                "message": "Year must be a valid integer."
            }

        state_norm = state.strip().upper()
        district_norm = district.strip().upper()

        state_encoder = self.encoders["state_encoder"]
        district_encoder = self.encoders["district_encoder"]
        target_encoder = self.encoders["target_encoder"]

        # Validate state in encoder classes
        if state_norm not in state_encoder.classes_:
            return {
                "status": "error",
                "error_type": "UNSEEN_STATE",
                "message": f"State '{state}' was not seen during model training."
            }

        # Validate district in encoder classes
        if district_norm not in district_encoder.classes_:
            return {
                "status": "error",
                "error_type": "UNSEEN_DISTRICT",
                "message": f"District '{district}' was not seen during model training."
            }

        # Find historical record matching State, District, Year
        record = self.dataset[
            (self.dataset["STATE/UT"] == state_norm) &
            (self.dataset["DISTRICT"] == district_norm) &
            (self.dataset["YEAR"] == year)
        ]

        if record.empty:
            return {
                "status": "error",
                "error_type": "RECORD_NOT_FOUND",
                "message": f"No historical record found for State '{state_norm}', District '{district_norm}', Year {year}."
            }

        row = record.iloc[0]

        # Extract 6 crime counts
        input_data = {
            crime: float(row[crime]) for crime in PREDICTION_CATEGORIES
        }

        # Calculate ratios
        total_crimes = sum(input_data.values())
        denominator = total_crimes if total_crimes > 0 else 1.0

        for crime in PREDICTION_CATEGORIES:
            input_data[f"{crime}_RATIO"] = input_data[crime] / denominator

        # Apply encoders
        input_data["STATE_ENCODED"] = int(state_encoder.transform([state_norm])[0])
        input_data["DISTRICT_ENCODED"] = int(district_encoder.transform([district_norm])[0])
        input_data["YEAR"] = year

        # Create DataFrame with exact 15-feature order
        input_df = pd.DataFrame([input_data])[FEATURE_NAMES]

        # Execute Random Forest inference
        prediction_idx = self.rf_model.predict(input_df)[0]
        probabilities = self.rf_model.predict_proba(input_df)[0]

        predicted_crime = target_encoder.inverse_transform([prediction_idx])[0]
        confidence = float(probabilities[prediction_idx] * 100.0)

        # Build probability distribution table
        prob_list = []
        for idx, cls_name in enumerate(target_encoder.classes_):
            prob_list.append({
                "crime_category": cls_name,
                "probability_percentage": round(float(probabilities[idx] * 100.0), 2)
            })

        prob_list.sort(key=lambda x: x["probability_percentage"], reverse=True)

        return {
            "status": "success",
            "state": state_norm,
            "district": district_norm,
            "input_year": year,
            "target_year": year + 1,
            "predicted_crime": predicted_crime,
            "confidence_percentage": round(confidence, 2),
            "probabilities": prob_list
        }


def predict_next_year_crime(state: str, district: str, year: int) -> dict:
    """Convenience functional interface for predictions."""
    predictor = CrimePredictor()
    return predictor.predict_next_year_crime(state, district, year)
