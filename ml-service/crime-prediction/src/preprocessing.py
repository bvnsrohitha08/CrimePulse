import pandas as pd
import numpy as np
from src.config import PREDICTION_CATEGORIES, FEATURE_NAMES
from src.pure_rf import PureLabelEncoder

def load_and_clean_dataset(data_path):
    """
    Loads and cleans the exact district-wise IPC crime dataset matching notebook Cells 2 & 3.
    """
    df = pd.read_csv(data_path)
    
    # Standardize column names
    df.columns = df.columns.str.strip().str.upper()
    
    # Standardize categorical columns
    df["STATE/UT"] = df["STATE/UT"].astype(str).str.strip().str.upper()
    df["DISTRICT"] = df["DISTRICT"].astype(str).str.strip().str.upper()
    
    # Remove duplicate rows
    df = df.drop_duplicates()
    
    # Remove aggregate TOTAL rows
    df = df[df["DISTRICT"] != "TOTAL"].copy()
    
    # Convert crime columns to numeric
    id_columns = ["STATE/UT", "DISTRICT", "YEAR"]
    crime_columns = [col for col in df.columns if col not in id_columns]
    
    for col in crime_columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        
    df[crime_columns] = df[crime_columns].fillna(0)
    return df


def prepare_training_data(df):
    """
    Prepares training features and target labels matching notebook Cells 7 & 8.
    """
    df_model = df.copy()
    
    # Find dominant crime in each district/year
    df_model["DOMINANT_CRIME"] = df_model[PREDICTION_CATEGORIES].idxmax(axis=1)
    
    # Sort chronologically
    df_model = df_model.sort_values(["STATE/UT", "DISTRICT", "YEAR"])
    
    # Target = dominant crime of next year
    df_model["TARGET_NEXT_YEAR"] = (
        df_model.groupby(["STATE/UT", "DISTRICT"])["DOMINANT_CRIME"].shift(-1)
    )
    df_model["NEXT_YEAR"] = (
        df_model.groupby(["STATE/UT", "DISTRICT"])["YEAR"].shift(-1)
    )
    
    # Keep only consecutive years
    df_model = df_model[df_model["NEXT_YEAR"] == df_model["YEAR"] + 1].copy()
    
    # Extract raw feature columns
    X = df_model[["STATE/UT", "DISTRICT", "YEAR"] + PREDICTION_CATEGORIES].copy()
    y = df_model["TARGET_NEXT_YEAR"].copy()
    
    # Calculate crime ratios
    total_selected = X[PREDICTION_CATEGORIES].sum(axis=1).replace(0, 1)
    for crime in PREDICTION_CATEGORIES:
        X[f"{crime}_RATIO"] = X[crime] / total_selected
        
    # Fit Encoders
    state_encoder = PureLabelEncoder()
    district_encoder = PureLabelEncoder()
    target_encoder = PureLabelEncoder()
    
    X["STATE_ENCODED"] = state_encoder.fit_transform(X["STATE/UT"])
    X["DISTRICT_ENCODED"] = district_encoder.fit_transform(X["DISTRICT"])
    y_encoded = target_encoder.fit_transform(y)
    
    # Drop raw string columns and enforce exact feature column ordering
    X = X.drop(columns=["STATE/UT", "DISTRICT"])
    X = X[FEATURE_NAMES]
    
    encoders = {
        "state_encoder": state_encoder,
        "district_encoder": district_encoder,
        "target_encoder": target_encoder
    }
    
    return df_model, X, y_encoded, encoders
