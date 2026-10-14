# CrimePulse ML FastAPI Microservice 🚀

Inference-only REST API microservice built with **FastAPI** and **Uvicorn** wrapping the verified **`PureRandomForestClassifier`** crime pattern forecasting model.

---

## 🛠️ Installation & Setup

1. **Install API Runtime Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Start Local FastAPI Development Server**:
   From the `ml-service` root directory:
   ```bash
   python -m uvicorn api.main:app --reload --port 8000
   ```

3. **Access Interactive Swagger Documentation**:
   Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in your web browser.

---

## 📡 API Endpoints

### 1. `GET /health`
* **Description**: Verifies service status and confirms ML model artifacts are loaded in memory.
* **Response Example (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "service": "crimepulse-ml",
    "model_loaded": true
  }
  ```

---

### 2. `GET /model-info`
* **Description**: Returns hyperparameter specifications, feature counts, and target classes of the loaded model.
* **Response Example (HTTP 200)**:
  ```json
  {
    "model_type": "PureRandomForestClassifier",
    "n_estimators": 300,
    "max_depth": 15,
    "feature_count": 15,
    "class_count": 6,
    "classes": [
      "BURGLARY",
      "CAUSING DEATH BY NEGLIGENCE",
      "HURT/GREVIOUS HURT",
      "MURDER",
      "RIOTS",
      "THEFT"
    ]
  }
  ```

---

### 3. `POST /predict-crime`
* **Description**: Accepts location and year parameters, queries the historical district-wise crime data internally, constructs 15 features, and returns next year's predicted dominant crime category alongside full class probabilities.
* **Request Payload Example**:
  ```json
  {
    "state": "ANDHRA PRADESH",
    "district": "ADILABAD",
    "year": 2011
  }
  ```

* **Success Response Example (HTTP 200)**:
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

* **Error Response Examples**:
  - **Unseen State (HTTP 400)**:
    ```json
    {
      "detail": {
        "error": "UNSEEN_STATE",
        "message": "The provided state is not available in the model data."
      }
    }
    ```
  - **Unseen District (HTTP 400)**:
    ```json
    {
      "detail": {
        "error": "UNSEEN_DISTRICT",
        "message": "The provided district is not available in the model data."
      }
    }
    ```
  - **Record Not Found (HTTP 404)**:
    ```json
    {
      "detail": {
        "error": "RECORD_NOT_FOUND",
        "message": "No historical record was found for the provided state, district and year."
      }
    }
    ```
  - **Validation Error (HTTP 422)**: Returned automatically when required fields (`state`, `district`, `year`) are missing or have invalid data types.

---

## ⚙️ Architecture & Lifespan

- **Single Lifespan Initialization**: Model artifacts (`.joblib`) and the cleaned historical crime dataset (`crime_dataset_india.csv`) are loaded **ONCE** into memory during FastAPI app initialization (`lifespan`). Individual HTTP requests query in-memory data structures without performing disk reads.
- **Service Layer Separation**:
  - `routes/crime.py` delegates inference requests to `services/crime_service.py`.
  - `routes/analytics.py` delegates read-only aggregations and OLAP operations to `services/analytics_service.py`.
- **Model Engine**: Powered by the custom pure-Python `PureRandomForestClassifier` (300 estimators, max depth 15, balanced class weights).

---

## 📊 Historical Analytics Endpoints (`/analytics`)

All analytical endpoints operate on the in-memory cleaned historical district-wise crime dataset (2001–2012; 8,609 cleaned district-level observations, excluding double-counted `DISTRICT == "TOTAL"` rows).

### 1. `GET /analytics/metadata`
* **Query Parameters**:
  * `state` *(optional, string)*: Specific state/UT to retrieve its district list.
* **Response**: Available year range (2001–2012), list of 35 states/UTs, districts for specified state, 28 individual crime categories, and 2 summary categories.

### 2. `GET /analytics/trends`
* **Query Parameters**:
  * `start_year` *(optional, int)*: Start year (minimum 2001).
  * `end_year` *(optional, int)*: End year (maximum 2012).
  * `state` *(optional, string)*: State name.
  * `district` *(optional, string)*: District name (state is required when district is given).
  * `category` *(optional, string)*: Category column (defaults to `TOTAL IPC CRIMES`).
* **Aggregation Rules**:
  * **District**: Filtered directly to district observations.
  * **State**: Sums all district rows for that state (excluding state aggregate rows).
  * **National**: Sums all district rows across the dataset (excluding state aggregate rows).
* **Response**: Chronological `data` points `[{ "year": int, "count": int }]` and `summary` metrics (`total_count`, `min_count`, `max_count`, `avg_count`).

### 3. `GET /analytics/category-distribution`
* **Query Parameters**:
  * `year` *(required, int)*: Observation year (2001–2012).
  * `state` *(optional, string)*: Filter by state.
  * `district` *(optional, string)*: Filter by district.
  * `include_summaries` *(optional, boolean)*: Whether to include summary categories (`TOTAL IPC CRIMES`, `OTHER IPC CRIMES`). Defaults to `false`.
* **Response**: Descending list of categories with recorded count and percentage share.

### 4. `GET /analytics/comparison`
* **Query Parameters**:
  * `comparison_type` *(required, string)*: `'state'` or `'district'`.
  * `locations` *(required, list of strings or comma-separated)*: Up to 10 location names.
  * `state` *(optional, string)*: Scope state (required when comparing districts).
  * `start_year` / `end_year` *(optional, int)*: Year range.
  * `category` *(optional, string)*: Target crime column (defaults to `TOTAL IPC CRIMES`).
* **Response**: Location-by-location time series and aligned `yearly_comparison` cross-sections.

### 5. `GET /analytics/olap`
* **Query Parameters**:
  * `operation` *(required, string)*: `'rollup'`, `'drilldown'`, `'slice'`, `'dice'`, or `'pivot'`.
  * Supporting parameters: `level`, `state`, `year`, `category`, `dimension`, `value`, `years`, `states`, `categories`, `index`, `columns`, `values`.
* **Response**: Structured multi-dimensional cube aggregations, slices, and cross-tabulations.

### 6. `GET /analytics/model-evaluation`
* **Response**: Verified evaluation metrics from held-out classification test data (2009–2011), including `test_accuracy` (0.8273), confusion matrix, per-class metrics, and responsible-use disclaimers.

