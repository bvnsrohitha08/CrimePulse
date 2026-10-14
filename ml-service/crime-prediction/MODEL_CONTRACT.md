# Model Contract: Historical Crime Pattern Prediction 📜

## Model Overview
- **Model Specification**: Custom pure-Python Random Forest implementation reproducing the project's feature pipeline and achieving comparable benchmark performance (`PureRandomForestClassifier(n_estimators=300, max_depth=15, min_samples_split=5, random_state=42, class_weight='balanced')`).
- **Source**: Preserved and reproduced directly from the team member's Google Colab notebook (`Crime_pattern_analysis.ipynb`).
- **Dataset**: District-wise Crimes Committed under IPC (2001–2012) [`01_District_wise_crimes_committed_IPC_2001_2012.csv`].
- **Core Purpose**: Predicts the dominant crime category for a given district in the *subsequent year* (`YEAR + 1`) based on historical crime counts, crime ratios, location, and year.

---

## Target Definition
- **Target Variable**: `TARGET_NEXT_YEAR`
- **Target Meaning**: The crime category among the 6 selected crime types that records the highest number of reported cases in the subsequent year (`YEAR + 1`) for the specified district.
- **Classes**:
  1. `BURGLARY`
  2. `CAUSING DEATH BY NEGLIGENCE`
  3. `HURT/GREVIOUS HURT`
  4. `MURDER`
  5. `RIOTS`
  6. `THEFT`

---

## Exact Feature Order & Contract (15 Features)

When passing a feature vector `X` to the model `predict()` or `predict_proba()`, features **MUST** strictly follow this exact 15-feature sequence:

| Index | Feature Name | Data Type | Description |
|---|---|---|---|
| 0 | `YEAR` | `int64` | Historical observation input year (e.g., 2011) |
| 1 | `THEFT` | `float64` / `int64` | Absolute count of THEFT cases in observation year |
| 2 | `HURT/GREVIOUS HURT` | `float64` / `int64` | Absolute count of HURT/GREVIOUS HURT cases |
| 3 | `CAUSING DEATH BY NEGLIGENCE` | `float64` / `int64` | Absolute count of CAUSING DEATH BY NEGLIGENCE cases |
| 4 | `RIOTS` | `float64` / `int64` | Absolute count of RIOTS cases |
| 5 | `BURGLARY` | `float64` / `int64` | Absolute count of BURGLARY cases |
| 6 | `MURDER` | `float64` / `int64` | Absolute count of MURDER cases |
| 7 | `THEFT_RATIO` | `float64` | Proportion of THEFT relative to sum of 6 selected crimes |
| 8 | `HURT/GREVIOUS HURT_RATIO` | `float64` | Proportion of HURT/GREVIOUS HURT relative to 6 crimes |
| 9 | `CAUSING DEATH BY NEGLIGENCE_RATIO` | `float64` | Proportion of CAUSING DEATH BY NEGLIGENCE |
| 10 | `RIOTS_RATIO` | `float64` | Proportion of RIOTS relative to 6 crimes |
| 11 | `BURGLARY_RATIO` | `float64` | Proportion of BURGLARY relative to 6 crimes |
| 12 | `MURDER_RATIO` | `float64` | Proportion of MURDER relative to 6 crimes |
| 13 | `STATE_ENCODED` | `int64` | `PureLabelEncoder` integer transform of standardized State name |
| 14 | `DISTRICT_ENCODED` | `int64` | `PureLabelEncoder` integer transform of standardized District name |

---

## Feature Engineering Formulae

1. **Sum of Selected Crimes**:
   $$\text{total\_selected} = \sum_{c \in \text{Categories}} \text{Count}_c$$
   *(If $\text{total\_selected} = 0$, replace with $1$ to prevent division by zero)*

2. **Crime Ratio Calculation**:
   $$\text{Ratio}_c = \frac{\text{Count}_c}{\text{total\_selected}}$$

3. **Categorical Encoding**:
   - `STATE_ENCODED` = `state_encoder.transform([STATE])`
   - `DISTRICT_ENCODED` = `district_encoder.transform([DISTRICT])`

---

## Inference Input & Output Specification

### Input
- `state` (string): State or Union Territory name (e.g. `"ANDHRA PRADESH"`).
- `district` (string): District name (e.g. `"ADILABAD"`).
- `year` (integer): Historical observation year present in dataset (e.g. `2011`).

### Output Structure
```json
{
  "status": "success",
  "state": "ANDHRA PRADESH",
  "district": "ADILABAD",
  "input_year": 2011,
  "target_year": 2012,
  "predicted_crime": "HURT/GREVIOUS HURT",
  "confidence_percentage": 98.37,
  "probabilities": [
    { "crime_category": "HURT/GREVIOUS HURT", "probability_percentage": 98.37 },
    { "crime_category": "THEFT", "probability_percentage": 1.32 },
    { "crime_category": "RIOTS", "probability_percentage": 0.31 },
    { "crime_category": "BURGLARY", "probability_percentage": 0.00 },
    { "crime_category": "CAUSING DEATH BY NEGLIGENCE", "probability_percentage": 0.00 },
    { "crime_category": "MURDER", "probability_percentage": 0.00 }
  ]
}
```

---

## Model Confidence Meaning & Ethical Limitations

> [!IMPORTANT]
> **Model Confidence Clarification**:
> The `confidence_percentage` returned by the predictor is the Random Forest model's estimated class probability (`predict_proba`) for the dominant class under historical dataset distribution.
> It **DOES NOT** represent the "real-world probability that a crime will occur".

### Model Limitations & Boundaries
1. **Historical Pattern Only**: Trained on historical district-wise IPC crime data (2001–2012). Does not account for events beyond dataset temporal scope.
2. **Dominant Class Focus**: Predicts which of the 6 major crime categories will have the highest count in the subsequent year; it does not predict exact case counts.
3. **No Real-time / No Image Capabilities**: This module performs tabular ML only. It does not process images, video feeds, or YOLO detections.
4. **No Legal or Factual Proof**: Model predictions are statistical estimates for academic research and pattern visualization only. They must **never** be cited as factual proof or evidence of crime.
5. **Out-of-Vocabulary Constraints**: Inputs with unknown state or district names not present in original training encoders will return clear error responses (`UNSEEN_STATE` / `UNSEEN_DISTRICT`).
