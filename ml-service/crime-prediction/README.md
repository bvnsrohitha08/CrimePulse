# Crime Prediction Microservice 🧠

This component packages the pre-trained **Random Forest** crime prediction model and inference pipeline preserved from the team member's Google Colab notebook (`Crime_pattern_analysis.ipynb`).

---

## 📁 Component Directory Structure

```text
crime-prediction/
├── Crime_pattern_analysis.ipynb  # Original Colab Notebook (Source of Truth)
├── MODEL_CONTRACT.md              # Exact feature order & contract specification
├── README.md                      # Service documentation
├── requirements.txt               # Dependencies (pandas, numpy, scikit-learn, joblib)
├── data/
│   └── crime_dataset_india.csv    # District-wise IPC Crime Dataset (2001-2012)
├── model/
│   └── reproduced/                # Serialized model & encoder artifacts (.joblib)
├── src/
│   ├── __init__.py
│   ├── config.py                  # Category & feature definitions
│   ├── trainer.py                 # Pipeline reproduction & artifact generator
│   ├── preprocessing.py           # Feature transformer & data lookup layer
│   └── predictor.py               # Reusable inference engine
└── tests/
    └── test_predictor.py          # Unit & edge case test suite
```

---

## 🚀 How to Run Local Inference & Verification

1. **Activate Virtual Environment**:
   ```powershell
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1
   ```

2. **Generate / Reproduce Serialized Artifacts**:
   ```powershell
   python src/trainer.py
   ```

3. **Run Pipeline Tests**:
   ```powershell
   python -m unittest tests/test_predictor.py
   ```
