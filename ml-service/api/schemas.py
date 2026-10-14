from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class PredictionRequest(BaseModel):
    state: str = Field(..., min_length=1, description="State or Union Territory name", example="ANDHRA PRADESH")
    district: str = Field(..., min_length=1, description="District name", example="ADILABAD")
    year: int = Field(..., description="Historical observation year present in dataset", example=2011)

class ProbabilityItem(BaseModel):
    crime_category: str = Field(..., description="Crime category name")
    probability_percentage: float = Field(..., description="Model confidence/probability percentage")

class PredictionResponse(BaseModel):
    status: str = Field(..., example="success")
    state: str = Field(..., example="ANDHRA PRADESH")
    district: str = Field(..., example="ADILABAD")
    input_year: int = Field(..., example=2011)
    target_year: int = Field(..., example=2012)
    predicted_crime: str = Field(..., example="HURT/GREVIOUS HURT")
    confidence_percentage: float = Field(..., example=98.37)
    probabilities: List[ProbabilityItem]

class HealthResponse(BaseModel):
    status: str = Field(..., example="ok")
    service: str = Field(..., example="crimepulse-ml")
    model_loaded: bool = Field(..., example=True)

class ModelInfoResponse(BaseModel):
    model_type: str = Field(..., example="PureRandomForestClassifier")
    n_estimators: int = Field(..., example=300)
    max_depth: int = Field(..., example=15)
    feature_count: int = Field(..., example=15)
    class_count: int = Field(..., example=6)
    classes: List[str]

class ErrorResponse(BaseModel):
    error: str = Field(..., example="UNSEEN_STATE")
    message: str = Field(..., example="The provided state is not available in the model data.")

# =============================================================================
# Historical Analytics Schemas (Phase 8)
# =============================================================================

class YearRangeInfo(BaseModel):
    min_year: int
    max_year: int
    years: List[int]

class MetadataResponse(BaseModel):
    year_range: YearRangeInfo
    states: List[str]
    districts: Optional[List[str]] = None
    crime_categories: List[str]
    summary_categories: List[str]
    total_records: int

class TrendPoint(BaseModel):
    year: int
    count: int

class TrendSummary(BaseModel):
    total_count: int
    min_count: int
    max_count: int
    avg_count: float

class TrendsResponse(BaseModel):
    location_type: str
    state: Optional[str] = None
    district: Optional[str] = None
    category: str
    start_year: int
    end_year: int
    data: List[TrendPoint]
    summary: TrendSummary

class CategoryDistributionItem(BaseModel):
    category: str
    count: int
    percentage: float

class CategoryDistributionResponse(BaseModel):
    year: int
    location_type: str
    state: Optional[str] = None
    district: Optional[str] = None
    include_summaries: bool
    total_recorded_crimes: int
    categories: List[CategoryDistributionItem]

class ComparisonLocationSeries(BaseModel):
    location: str
    data: List[TrendPoint]
    total: int

class ComparisonResponse(BaseModel):
    comparison_type: str
    state_scope: Optional[str] = None
    category: str
    start_year: int
    end_year: int
    locations: List[str]
    series: List[ComparisonLocationSeries]
    yearly_comparison: List[Dict[str, Any]]

class OlapResponse(BaseModel):
    operation: str
    description: str
    dimensions_applied: Dict[str, Any]
    pivot_columns: Optional[List[str]] = None
    row_count: int
    data: List[Dict[str, Any]]

class ModelEvaluationResponse(BaseModel):
    model_type: str
    n_estimators: int
    test_accuracy: float
    train_years: List[int]
    test_years: List[int]
    train_samples: int
    test_samples: int
    classes: List[str]
    feature_names: List[str]
    confusion_matrix: List[List[int]]
    class_report: Dict[str, Any]
    feature_importances: Optional[Any] = None
    feature_importances_note: str
    disclaimer: str

