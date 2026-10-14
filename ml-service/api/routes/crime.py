from fastapi import APIRouter, HTTPException, status
from api.schemas import (
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
    ModelInfoResponse,
    ErrorResponse
)
from api.services.crime_service import crime_service

router = APIRouter()

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health Status",
    description="Returns API service health and confirms whether ML model artifacts are loaded."
)
def get_health():
    return crime_service.get_health()


@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
    summary="Model Metadata Information",
    description="Returns metadata, hyperparameter configuration, and target classes of the loaded Random Forest model."
)
def get_model_info():
    try:
        return crime_service.get_model_info()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "MODEL_UNAVAILABLE", "message": str(e)}
        )


@router.post(
    "/predict-crime",
    response_model=PredictionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Unseen State or District error"},
        404: {"model": ErrorResponse, "description": "Historical record not found for specified state/district/year"},
        422: {"description": "Pydantic validation error"}
    },
    summary="Predict Next Year Dominant Crime",
    description="Accepts state, district, and year, queries historical district-wise crime data, constructs 15 model features, and predicts next year dominant crime category."
)
def predict_crime(payload: PredictionRequest):
    result = crime_service.predict(payload.state, payload.district, payload.year)
    
    if result.get("status") == "error":
        error_type = result.get("error_type")
        msg = result.get("message")
        
        if error_type == "UNSEEN_STATE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "UNSEEN_STATE", "message": "The provided state is not available in the model data."}
            )
        elif error_type == "UNSEEN_DISTRICT":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "UNSEEN_DISTRICT", "message": "The provided district is not available in the model data."}
            )
        elif error_type == "RECORD_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "RECORD_NOT_FOUND", "message": "No historical record was found for the provided state, district and year."}
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": error_type or "BAD_REQUEST", "message": msg or "Invalid request parameters."}
            )
            
    return result
