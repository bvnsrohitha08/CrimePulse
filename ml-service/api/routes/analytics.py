from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from api.schemas import (
    MetadataResponse,
    TrendsResponse,
    CategoryDistributionResponse,
    ComparisonResponse,
    OlapResponse,
    ModelEvaluationResponse,
    ErrorResponse
)
from api.services.analytics_service import analytics_service, AnalyticsError

router = APIRouter(prefix="/analytics", tags=["Historical Analytics"])

def _handle_analytics_error(e: AnalyticsError):
    raise HTTPException(
        status_code=e.status_code,
        detail={"error": e.error_code, "message": e.message}
    )

@router.get(
    "/metadata",
    response_model=MetadataResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid state filter"},
        503: {"model": ErrorResponse, "description": "Service not initialized"}
    },
    summary="Dataset Metadata & Available Dimensions",
    description="Returns available historical year range (2001-2012), distinct states/UTs, districts for the selected state if requested, and supported individual/summary crime categories."
)
def get_metadata(
    state: Optional[str] = Query(None, description="Optional State/UT to retrieve its available districts")
):
    try:
        return analytics_service.get_metadata(state=state)
    except AnalyticsError as e:
        _handle_analytics_error(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get(
    "/trends",
    response_model=TrendsResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid year range, category, state, or district"},
        503: {"model": ErrorResponse, "description": "Service not initialized"}
    },
    summary="Historical Crime Trends",
    description="Returns year-by-year recorded crime counts suitable for trend analysis and line charts. Aggregates at district, state (sum of districts, excluding state aggregate rows), or national level."
)
def get_trends(
    start_year: Optional[int] = Query(None, description="Start year (minimum 2001)"),
    end_year: Optional[int] = Query(None, description="End year (maximum 2012)"),
    state: Optional[str] = Query(None, description="State or Union Territory name"),
    district: Optional[str] = Query(None, description="District name (state parameter is required when district is given)"),
    category: Optional[str] = Query("TOTAL IPC CRIMES", description="Crime category column (defaults to 'TOTAL IPC CRIMES')")
):
    try:
        return analytics_service.get_trends(
            start_year=start_year,
            end_year=end_year,
            state=state,
            district=district,
            category=category
        )
    except AnalyticsError as e:
        _handle_analytics_error(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get(
    "/category-distribution",
    response_model=CategoryDistributionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid year, state, or district"},
        503: {"model": ErrorResponse, "description": "Service not initialized"}
    },
    summary="Crime Category Distribution",
    description="Returns breakdown of recorded crime categories, counts, and percentages for a specific year and optional state/district. Excludes summary columns by default."
)
def get_category_distribution(
    year: int = Query(..., description="Observation year (2001-2012)"),
    state: Optional[str] = Query(None, description="State or Union Territory name"),
    district: Optional[str] = Query(None, description="District name"),
    include_summaries: bool = Query(False, description="Whether to include summary categories like TOTAL IPC CRIMES")
):
    try:
        return analytics_service.get_category_distribution(
            year=year,
            state=state,
            district=district,
            include_summaries=include_summaries
        )
    except AnalyticsError as e:
        _handle_analytics_error(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get(
    "/comparison",
    response_model=ComparisonResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Validation error or invalid locations"},
        503: {"model": ErrorResponse, "description": "Service not initialized"}
    },
    summary="Multi-Location Historical Comparison",
    description="Compares multiple states or multiple districts within a state across a specified year range and crime category. Imposes a limit of up to 10 locations per request."
)
def get_comparison(
    comparison_type: str = Query(..., description="Comparison level: 'state' or 'district'"),
    locations: List[str] = Query(..., description="List of location names (pass multiple locations query params or comma-separated)"),
    state: Optional[str] = Query(None, description="Scope state (required when comparison_type is 'district')"),
    start_year: Optional[int] = Query(None, description="Start year (minimum 2001)"),
    end_year: Optional[int] = Query(None, description="End year (maximum 2012)"),
    category: Optional[str] = Query("TOTAL IPC CRIMES", description="Crime category column")
):
    # Parse potential comma-separated values in locations
    parsed_locations: List[str] = []
    for loc_item in locations:
        for piece in loc_item.split(","):
            p = piece.strip()
            if p:
                parsed_locations.append(p)

    try:
        return analytics_service.get_comparison(
            comparison_type=comparison_type,
            locations=parsed_locations,
            state=state,
            start_year=start_year,
            end_year=end_year,
            category=category
        )
    except AnalyticsError as e:
        _handle_analytics_error(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get(
    "/olap",
    response_model=OlapResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Unsupported OLAP operation or invalid parameters"},
        503: {"model": ErrorResponse, "description": "Service not initialized"}
    },
    summary="OLAP Multi-Dimensional Operations",
    description="Provides validated OLAP operations: roll-up (district to state or national), drill-down (state to districts), slice (filter along single dimension), dice (subcube across multiple dimensions), and pivot (2D cross-tabulation)."
)
def get_olap(
    operation: str = Query(..., description="OLAP operation: 'rollup', 'drilldown', 'slice', 'dice', or 'pivot'"),
    level: Optional[str] = Query("state", description="Roll-up target level: 'state' or 'national'"),
    state: Optional[str] = Query(None, description="State filter (required for drilldown and district-level pivot)"),
    year: Optional[int] = Query(None, description="Year filter for rollup or drilldown"),
    category: Optional[str] = Query(None, description="Crime category column"),
    dimension: Optional[str] = Query(None, description="Slice dimension: 'year' or 'state'"),
    value: Optional[str] = Query(None, description="Slice target value"),
    years: Optional[List[str]] = Query(None, description="Years for dice operation (repeated or comma-separated)"),
    states: Optional[List[str]] = Query(None, description="States for dice operation (repeated or comma-separated)"),
    categories: Optional[List[str]] = Query(None, description="Crime categories for dice operation (repeated or comma-separated)"),
    index: Optional[str] = Query("state", description="Pivot row axis: 'state', 'year', or 'district'"),
    columns: Optional[str] = Query("year", description="Pivot column axis: 'state', 'year', or 'district'"),
    values: Optional[str] = Query("TOTAL IPC CRIMES", description="Pivot metric values column")
):
    # Parse list parameters for dice
    parsed_years: Optional[List[int]] = None
    if years:
        parsed_years = []
        for y_item in years:
            for piece in str(y_item).split(","):
                p = piece.strip()
                if p:
                    try:
                        parsed_years.append(int(p))
                    except ValueError:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={"error": "INVALID_YEAR", "message": f"Invalid year value '{p}' in dice filter."}
                        )

    parsed_states: Optional[List[str]] = None
    if states:
        parsed_states = []
        for s_item in states:
            for piece in str(s_item).split(","):
                p = piece.strip()
                if p:
                    parsed_states.append(p)

    parsed_categories: Optional[List[str]] = None
    if categories:
        parsed_categories = []
        for c_item in categories:
            for piece in str(c_item).split(","):
                p = piece.strip()
                if p:
                    parsed_categories.append(p)

    try:
        return analytics_service.get_olap(
            operation=operation,
            level=level,
            state=state,
            year=year,
            category=category,
            dimension=dimension,
            value=value,
            years=parsed_years,
            states=parsed_states,
            categories=parsed_categories,
            index=index,
            columns=columns,
            values=values
        )
    except AnalyticsError as e:
        _handle_analytics_error(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )

@router.get(
    "/model-evaluation",
    response_model=ModelEvaluationResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Model evaluation metadata not found"},
        503: {"model": ErrorResponse, "description": "Service not initialized"}
    },
    summary="Model Evaluation Metrics & Diagnostics",
    description="Exposes verified evaluation metrics from held-out classification test data (2009-2011), including accuracy, confusion matrix, per-class metrics, and sample counts. Does NOT represent real-world probability of crime occurrences."
)
def get_model_evaluation():
    try:
        return analytics_service.get_model_evaluation()
    except AnalyticsError as e:
        _handle_analytics_error(e)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "INTERNAL_ERROR", "message": str(e)}
        )
