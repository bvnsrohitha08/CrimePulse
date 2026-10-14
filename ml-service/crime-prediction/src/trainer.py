import joblib
import pandas as pd
import numpy as np
from src.config import DATA_PATH, MODEL_FILE, ENCODERS_FILE, METADATA_FILE, RF_PARAMS, FEATURE_NAMES
from src.preprocessing import load_and_clean_dataset, prepare_training_data
from src.pure_rf import PureRandomForestClassifier

def calculate_metrics(y_true, y_pred, classes):
    """Calculates accuracy, precision, recall, f1-score, and confusion matrix."""
    acc = float(np.mean(y_true == y_pred))
    num_classes = len(classes)
    
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(y_true, y_pred):
        cm[t, p] += 1
        
    class_reports = {}
    for i, cls_name in enumerate(classes):
        tp = cm[i, i]
        fp = np.sum(cm[:, i]) - tp
        fn = np.sum(cm[i, :]) - tp
        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = float(2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        class_reports[cls_name] = {
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1-score": round(f1, 4),
            "support": int(np.sum(cm[i, :]))
        }
        
    return {
        "accuracy": round(acc, 4),
        "confusion_matrix": cm.tolist(),
        "class_report": class_reports
    }

def train_and_serialize_model():
    """
    Executes notebook training pipeline on the exact dataset and serializes model/encoders.
    """
    print(f"Loading dataset from: {DATA_PATH}")
    df = load_and_clean_dataset(DATA_PATH)
    
    print("Preparing features and targets matching Colab notebook...")
    df_model, X, y_encoded, encoders = prepare_training_data(df)
    
    train_mask = df_model["YEAR"] <= 2008
    test_mask = df_model["YEAR"] >= 2009
    
    X_train = X.loc[train_mask].values
    X_test = X.loc[test_mask].values
    
    y_train = y_encoded[train_mask]
    y_test = y_encoded[test_mask]
    
    print(f"Training samples: {len(X_train)} | Testing samples: {len(X_test)}")
    
    # Train Random Forest Classifier with exact n_estimators=300
    rf_model = PureRandomForestClassifier(
        n_estimators=300,
        max_depth=15,
        min_samples_split=5,
        class_weight="balanced",
        random_state=42
    )
    rf_model.fit(X_train, y_train)
    
    predictions = rf_model.predict(X_test)
    metrics = calculate_metrics(y_test, predictions, encoders["target_encoder"].classes_)
    
    print(f"Model Test Accuracy (2009-2011 split, 300 trees): {metrics['accuracy'] * 100:.2f}%")
    
    # Ensure model folder exists
    MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Save reproduced model artifacts
    joblib.dump(rf_model, MODEL_FILE)
    joblib.dump(encoders, ENCODERS_FILE)
    
    metadata = {
        "feature_names": FEATURE_NAMES,
        "classes": list(encoders["target_encoder"].classes_),
        "test_accuracy": metrics['accuracy'],
        "confusion_matrix": metrics['confusion_matrix'],
        "class_report": metrics['class_report'],
        "train_years": [2001, 2008],
        "test_years": [2009, 2011],
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "n_estimators": 300
    }
    joblib.dump(metadata, METADATA_FILE)
    
    print(f"Model successfully saved to: {MODEL_FILE}")
    print(f"Encoders successfully saved to: {ENCODERS_FILE}")
    return metadata

if __name__ == "__main__":
    train_and_serialize_model()
