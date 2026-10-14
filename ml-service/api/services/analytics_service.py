import joblib
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
import numpy as np
import pandas as pd

# Ensure ml-service/crime-prediction is in Python path
PREDICTION_SERVICE_DIR = Path(__file__).resolve().parent.parent.parent / "crime-prediction"
if str(PREDICTION_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(PREDICTION_SERVICE_DIR))

from src.config import DATA_PATH, METADATA_FILE, MODEL_FILE
from src.preprocessing import load_and_clean_dataset

class AnalyticsError(Exception):
    """Custom domain exception for analytics validation and query errors."""
    def __init__(self, message: str, status_code: int = 400, error_code: str = "BAD_REQUEST"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code

class AnalyticsService:
    """
    Read-only singleton analytical engine operating directly on the in-memory cleaned
    historical district-wise crime dataset (2001-2012).
    """

    def __init__(self):
        self.df: Optional[pd.DataFrame] = None
        self.metadata: Dict[str, Any] = {}
        self.available_years: List[int] = []
        self.available_states: List[str] = []
        self.state_districts: Dict[str, List[str]] = {}
        self.crime_columns: List[str] = []
        self.individual_categories: List[str] = []
        self.summary_categories: List[str] = ["OTHER IPC CRIMES", "TOTAL IPC CRIMES"]
        self.is_loaded: bool = False

    def initialize(self):
        """Loads and cleans dataset and evaluation metadata once at service startup."""
        try:
            print(f"Initializing AnalyticsService: loading dataset from {DATA_PATH}...")
            if not DATA_PATH.exists():
                raise FileNotFoundError(f"Historical crime dataset not found at {DATA_PATH}")

            # Load and clean dataset matching notebook Cells 2 & 3
            # (standardizes uppercase names, drops duplicates, removes DISTRICT == 'TOTAL', fills nulls with 0)
            df = load_and_clean_dataset(DATA_PATH)
            self.df = df.copy()

            # Cache dimensional metadata
            self.available_years = sorted([int(y) for y in self.df["YEAR"].unique()])
            self.available_states = sorted([str(s) for s in self.df["STATE/UT"].unique()])

            self.state_districts = {}
            for state in self.available_states:
                state_subset = self.df[self.df["STATE/UT"] == state]
                self.state_districts[state] = sorted([str(d) for d in state_subset["DISTRICT"].unique()])

            # Extract crime columns
            id_cols = {"STATE/UT", "DISTRICT", "YEAR"}
            self.crime_columns = [col for col in self.df.columns if col not in id_cols]
            self.individual_categories = [
                col for col in self.crime_columns if col not in self.summary_categories
            ]

            # Load model evaluation metadata
            if METADATA_FILE.exists():
                self.metadata = joblib.load(METADATA_FILE)
            else:
                self.metadata = {}

            self.is_loaded = True
            print(f"AnalyticsService loaded successfully ({len(self.df)} clean records, "
                  f"{len(self.available_states)} states, {len(self.available_years)} years).")
        except Exception as e:
            print(f"Error initializing AnalyticsService: {e}")
            self.is_loaded = False
            raise e

    def _ensure_initialized(self):
        if not self.is_loaded or self.df is None:
            raise AnalyticsError("Analytics service is not initialized or dataset is unavailable.", status_code=503, error_code="SERVICE_UNAVAILABLE")

    def _normalize_category(self, category: Optional[str]) -> str:
        """Validates and normalizes crime category name. Defaults to 'TOTAL IPC CRIMES'."""
        if not category or not str(category).strip():
            return "TOTAL IPC CRIMES"
        norm = str(category).strip().upper()
        if norm not in self.crime_columns:
            raise AnalyticsError(
                f"Crime category '{category}' is invalid. Supported categories: {self.crime_columns}",
                status_code=400,
                error_code="INVALID_CATEGORY"
            )
        return norm

    def _normalize_state(self, state: Optional[str]) -> Optional[str]:
        """Normalizes and validates state name if provided."""
        if state is None or not str(state).strip():
            return None
        norm = str(state).strip().upper()
        if norm not in self.available_states:
            raise AnalyticsError(
                f"State '{state}' was not found in dataset. Available states: {self.available_states}",
                status_code=400,
                error_code="INVALID_STATE"
            )
        return norm

    def _normalize_district(self, district: Optional[str], state_norm: Optional[str]) -> Optional[str]:
        """Normalizes and validates district within state."""
        if district is None or not str(district).strip():
            return None
        if not state_norm:
            raise AnalyticsError(
                "When specifying a district filter, the state must also be specified.",
                status_code=400,
                error_code="MISSING_STATE"
            )
        norm = str(district).strip().upper()
        allowed = self.state_districts.get(state_norm, [])
        if norm not in allowed:
            raise AnalyticsError(
                f"District '{district}' was not found in state '{state_norm}'. Available districts in this state: {allowed}",
                status_code=400,
                error_code="INVALID_DISTRICT"
            )
        return norm

    def _validate_year_range(self, start_year: Optional[int], end_year: Optional[int]) -> tuple[int, int]:
        """Validates and defaults temporal window within 2001-2012."""
        min_avail = self.available_years[0]
        max_avail = self.available_years[-1]
        s_year = min_avail if start_year is None else int(start_year)
        e_year = max_avail if end_year is None else int(end_year)

        if s_year > e_year:
            raise AnalyticsError(
                f"start_year ({s_year}) cannot be greater than end_year ({e_year}).",
                status_code=400,
                error_code="INVALID_YEAR_RANGE"
            )
        if s_year < min_avail or e_year > max_avail:
            raise AnalyticsError(
                f"Year range {s_year}-{e_year} is out of dataset bounds ({min_avail}-{max_avail}).",
                status_code=400,
                error_code="YEAR_OUT_OF_BOUNDS"
            )
        return s_year, e_year

    # -------------------------------------------------------------------------
    # A. Metadata Endpoint
    # -------------------------------------------------------------------------
    def get_metadata(self, state: Optional[str] = None) -> Dict[str, Any]:
        self._ensure_initialized()
        state_norm = self._normalize_state(state) if state else None

        districts = None
        if state_norm:
            districts = self.state_districts.get(state_norm, [])

        return {
            "year_range": {
                "min_year": self.available_years[0],
                "max_year": self.available_years[-1],
                "years": self.available_years
            },
            "states": self.available_states,
            "districts": districts,
            "crime_categories": self.individual_categories,
            "summary_categories": self.summary_categories,
            "total_records": len(self.df)
        }

    def _get_aggregate_source(self, district: Optional[str] = None) -> pd.DataFrame:
        """
        Returns the data source for aggregations.
        When aggregating across districts (at state or national level), 'DELHI UT TOTAL'
        is excluded to prevent double-counting Delhi's figures against its constituent districts.
        """
        if not district and self.df is not None:
            return self.df[self.df["DISTRICT"] != "DELHI UT TOTAL"]
        return self.df

    # -------------------------------------------------------------------------
    # B. Historical Trends Endpoint
    # -------------------------------------------------------------------------
    def get_trends(
        self,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        state: Optional[str] = None,
        district: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        self._ensure_initialized()
        s_year, e_year = self._validate_year_range(start_year, end_year)
        cat_norm = self._normalize_category(category)
        state_norm = self._normalize_state(state)
        district_norm = self._normalize_district(district, state_norm)

        df_source = self._get_aggregate_source(district_norm)
        mask = (df_source["YEAR"] >= s_year) & (df_source["YEAR"] <= e_year)

        if district_norm and state_norm:
            loc_type = "district"
            mask &= (df_source["STATE/UT"] == state_norm) & (df_source["DISTRICT"] == district_norm)
            filtered = df_source.loc[mask]
            # Group by year in case of multiple observations, then sort
            grouped = filtered.groupby("YEAR")[cat_norm].sum().reset_index()
        elif state_norm:
            loc_type = "state"
            mask &= (df_source["STATE/UT"] == state_norm)
            filtered = df_source.loc[mask]
            # Sum all constituent district rows for this state without aggregate double-counting
            grouped = filtered.groupby("YEAR")[cat_norm].sum().reset_index()
        else:
            loc_type = "national"
            filtered = df_source.loc[mask]
            # National sum across all district observations without aggregate double-counting
            grouped = filtered.groupby("YEAR")[cat_norm].sum().reset_index()

        # Build complete chronological series for the requested range
        yearly_map = dict(zip(grouped["YEAR"], grouped[cat_norm]))
        data = []
        counts = []
        for y in range(s_year, e_year + 1):
            c = int(yearly_map.get(y, 0))
            data.append({"year": y, "count": c})
            counts.append(c)

        summary = {
            "total_count": int(sum(counts)),
            "min_count": int(min(counts)) if counts else 0,
            "max_count": int(max(counts)) if counts else 0,
            "avg_count": round(float(np.mean(counts)), 2) if counts else 0.0
        }

        return {
            "location_type": loc_type,
            "state": state_norm,
            "district": district_norm,
            "category": cat_norm,
            "start_year": s_year,
            "end_year": e_year,
            "data": data,
            "summary": summary
        }

    # -------------------------------------------------------------------------
    # C. Category Distribution Endpoint
    # -------------------------------------------------------------------------
    def get_category_distribution(
        self,
        year: int,
        state: Optional[str] = None,
        district: Optional[str] = None,
        include_summaries: bool = False
    ) -> Dict[str, Any]:
        self._ensure_initialized()
        if year not in self.available_years:
            raise AnalyticsError(
                f"Year {year} is not in available years ({self.available_years[0]}-{self.available_years[-1]}).",
                status_code=400,
                error_code="INVALID_YEAR"
            )

        state_norm = self._normalize_state(state)
        district_norm = self._normalize_district(district, state_norm)

        df_source = self._get_aggregate_source(district_norm)
        mask = df_source["YEAR"] == int(year)
        if district_norm and state_norm:
            loc_type = "district"
            mask &= (df_source["STATE/UT"] == state_norm) & (df_source["DISTRICT"] == district_norm)
        elif state_norm:
            loc_type = "state"
            mask &= (df_source["STATE/UT"] == state_norm)
        else:
            loc_type = "national"

        filtered = df_source.loc[mask]
        target_categories = self.crime_columns if include_summaries else self.individual_categories

        categories_data = []
        total_recorded = 0
        if not filtered.empty:
            cat_sums = filtered[target_categories].sum()
            if include_summaries and "TOTAL IPC CRIMES" in filtered.columns:
                total_recorded = int(filtered["TOTAL IPC CRIMES"].sum())
                denom = total_recorded if total_recorded > 0 else 1
            else:
                total_recorded = int(cat_sums.sum())
                denom = total_recorded if total_recorded > 0 else 1

            for cat in target_categories:
                cnt = int(cat_sums[cat])
                pct = round(float((cnt / denom) * 100.0), 2)
                categories_data.append({
                    "category": cat,
                    "count": cnt,
                    "percentage": pct
                })

            # Sort descending by recorded count
            categories_data.sort(key=lambda x: x["count"], reverse=True)

        return {
            "year": int(year),
            "location_type": loc_type,
            "state": state_norm,
            "district": district_norm,
            "include_summaries": include_summaries,
            "total_recorded_crimes": total_recorded,
            "categories": categories_data
        }

    # -------------------------------------------------------------------------
    # D. Multi-Location Comparison Endpoint
    # -------------------------------------------------------------------------
    def get_comparison(
        self,
        comparison_type: str,
        locations: List[str],
        state: Optional[str] = None,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        self._ensure_initialized()
        c_type = str(comparison_type).strip().lower()
        if c_type not in ["state", "district"]:
            raise AnalyticsError(
                "comparison_type must be either 'state' or 'district'.",
                status_code=400,
                error_code="INVALID_COMPARISON_TYPE"
            )

        if not locations or not isinstance(locations, list):
            raise AnalyticsError("locations parameter must be a non-empty list of location names.", status_code=400, error_code="INVALID_LOCATIONS")

        # Impose reasonable limits (1 to 10 locations)
        cleaned_locations = [str(loc).strip().upper() for loc in locations if str(loc).strip()]
        if not cleaned_locations:
            raise AnalyticsError("At least one location must be provided.", status_code=400, error_code="EMPTY_LOCATIONS")
        if len(cleaned_locations) > 10:
            raise AnalyticsError("A maximum of 10 locations can be compared per request.", status_code=400, error_code="LOCATION_LIMIT_EXCEEDED")

        s_year, e_year = self._validate_year_range(start_year, end_year)
        cat_norm = self._normalize_category(category)

        state_norm = self._normalize_state(state)
        if c_type == "district" and not state_norm:
            raise AnalyticsError("state parameter is required when comparing districts.", status_code=400, error_code="MISSING_STATE")

        # Validate each location exists
        if c_type == "state":
            for loc in cleaned_locations:
                if loc not in self.available_states:
                    raise AnalyticsError(f"State '{loc}' was not found in dataset.", status_code=400, error_code="INVALID_LOCATION")
        else:
            allowed_districts = self.state_districts.get(state_norm, [])
            for loc in cleaned_locations:
                if loc not in allowed_districts:
                    raise AnalyticsError(f"District '{loc}' was not found in state '{state_norm}'.", status_code=400, error_code="INVALID_LOCATION")

        # Generate series per location
        series_list = []
        year_counts_map = {y: {} for y in range(s_year, e_year + 1)}

        for loc in cleaned_locations:
            if c_type == "state":
                df_source = self._get_aggregate_source(district=None)
                mask = (df_source["YEAR"] >= s_year) & (df_source["YEAR"] <= e_year) & (df_source["STATE/UT"] == loc)
            else:
                df_source = self._get_aggregate_source(district=loc)
                mask = (df_source["YEAR"] >= s_year) & (df_source["YEAR"] <= e_year) & (df_source["STATE/UT"] == state_norm) & (df_source["DISTRICT"] == loc)

            sub_df = df_source.loc[mask]
            grouped = sub_df.groupby("YEAR")[cat_norm].sum().to_dict()

            loc_points = []
            loc_total = 0
            for y in range(s_year, e_year + 1):
                val = int(grouped.get(y, 0))
                loc_points.append({"year": y, "count": val})
                year_counts_map[y][loc] = val
                loc_total += val

            series_list.append({
                "location": loc,
                "data": loc_points,
                "total": loc_total
            })

        yearly_comparison = [
            {"year": y, "counts": year_counts_map[y]} for y in range(s_year, e_year + 1)
        ]

        return {
            "comparison_type": c_type,
            "state_scope": state_norm if c_type == "district" else None,
            "category": cat_norm,
            "start_year": s_year,
            "end_year": e_year,
            "locations": cleaned_locations,
            "series": series_list,
            "yearly_comparison": yearly_comparison
        }

    # -------------------------------------------------------------------------
    # E. OLAP Operations Endpoint
    # -------------------------------------------------------------------------
    def get_olap(
        self,
        operation: str,
        level: Optional[str] = "state",
        state: Optional[str] = None,
        year: Optional[int] = None,
        category: Optional[str] = None,
        dimension: Optional[str] = None,
        value: Optional[str] = None,
        years: Optional[List[int]] = None,
        states: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        index: Optional[str] = "state",
        columns: Optional[str] = "year",
        values: Optional[str] = "TOTAL IPC CRIMES"
    ) -> Dict[str, Any]:
        self._ensure_initialized()
        op = str(operation).strip().lower()

        if op == "rollup":
            lvl = str(level or "state").strip().lower()
            cat = self._normalize_category(category)
            filtered = self._get_aggregate_source(district=None).copy()
            if year is not None:
                if year not in self.available_years:
                    raise AnalyticsError(f"Year {year} is not in available years.", status_code=400, error_code="INVALID_YEAR")
                filtered = filtered[filtered["YEAR"] == int(year)]

            if lvl == "state":
                res = filtered.groupby("STATE/UT")[cat].sum().sort_values(ascending=False).reset_index()
                data = [{"state": row["STATE/UT"], "count": int(row[cat])} for _, row in res.iterrows()]
                desc = f"Roll-up from district observations to state level for '{cat}'"
            elif lvl == "national":
                total = int(filtered[cat].sum())
                data = [{"scope": "All India", "count": total}]
                desc = f"Roll-up from district observations to national aggregate for '{cat}'"
            else:
                raise AnalyticsError("Rollup level must be either 'state' or 'national'.", status_code=400, error_code="INVALID_LEVEL")

            return {
                "operation": "rollup",
                "description": desc,
                "dimensions_applied": {"level": lvl, "year": year, "category": cat},
                "row_count": len(data),
                "data": data
            }

        elif op == "drilldown":
            state_norm = self._normalize_state(state)
            if not state_norm:
                raise AnalyticsError("state parameter is required for drilldown operation.", status_code=400, error_code="MISSING_STATE")
            cat = self._normalize_category(category)
            agg_source = self._get_aggregate_source(district=None)
            filtered = agg_source[agg_source["STATE/UT"] == state_norm]
            if year is not None:
                if year not in self.available_years:
                    raise AnalyticsError(f"Year {year} is not in available years.", status_code=400, error_code="INVALID_YEAR")
                filtered = filtered[filtered["YEAR"] == int(year)]

            res = filtered.groupby("DISTRICT")[cat].sum().sort_values(ascending=False).reset_index()
            data = [{"district": row["DISTRICT"], "count": int(row[cat])} for _, row in res.iterrows()]

            return {
                "operation": "drilldown",
                "description": f"Drill-down from state '{state_norm}' into district-level totals for '{cat}'",
                "dimensions_applied": {"state": state_norm, "year": year, "category": cat},
                "row_count": len(data),
                "data": data
            }

        elif op == "slice":
            dim = str(dimension or "").strip().lower()
            if not dim or not value:
                raise AnalyticsError("Both 'dimension' and 'value' parameters are required for slice.", status_code=400, error_code="MISSING_SLICE_PARAM")
            cat = self._normalize_category(category)
            agg_source = self._get_aggregate_source(district=None)

            if dim == "year":
                try:
                    y_val = int(value)
                except ValueError:
                    raise AnalyticsError("Slice value for dimension 'year' must be an integer.", status_code=400, error_code="INVALID_SLICE_VALUE")
                if y_val not in self.available_years:
                    raise AnalyticsError(f"Year {y_val} is out of dataset bounds.", status_code=400, error_code="INVALID_YEAR")
                filtered = agg_source[agg_source["YEAR"] == y_val]
                res = filtered.groupby("STATE/UT")[cat].sum().reset_index()
                data = [{"state": row["STATE/UT"], "count": int(row[cat])} for _, row in res.iterrows()]
                desc = f"Slice along dimension 'year' = {y_val} for '{cat}'"

            elif dim == "state":
                state_val = self._normalize_state(value)
                filtered = agg_source[agg_source["STATE/UT"] == state_val]
                res = filtered.groupby("YEAR")[cat].sum().reset_index()
                data = [{"year": int(row["YEAR"]), "count": int(row[cat])} for _, row in res.iterrows()]
                desc = f"Slice along dimension 'state' = '{state_val}' for '{cat}'"

            else:
                raise AnalyticsError("Slice dimension must be either 'year' or 'state'.", status_code=400, error_code="INVALID_DIMENSION")

            return {
                "operation": "slice",
                "description": desc,
                "dimensions_applied": {"dimension": dim, "value": value, "category": cat},
                "row_count": len(data),
                "data": data
            }

        elif op == "dice":
            # Multi-dimensional subcube
            dice_years = [int(y) for y in (years or self.available_years)]
            for y in dice_years:
                if y not in self.available_years:
                    raise AnalyticsError(f"Year {y} is invalid in dice filter.", status_code=400, error_code="INVALID_YEAR")

            dice_states = [str(s).strip().upper() for s in (states or self.available_states)]
            for s in dice_states:
                if s not in self.available_states:
                    raise AnalyticsError(f"State '{s}' is invalid in dice filter.", status_code=400, error_code="INVALID_STATE")

            dice_cats = [self._normalize_category(c) for c in (categories or ["TOTAL IPC CRIMES"])]

            agg_source = self._get_aggregate_source(district=None)
            mask = (agg_source["YEAR"].isin(dice_years)) & (agg_source["STATE/UT"].isin(dice_states))
            filtered = agg_source.loc[mask]

            grouped = filtered.groupby(["STATE/UT", "YEAR"])[dice_cats].sum().reset_index()
            data = []
            for _, row in grouped.iterrows():
                entry = {
                    "state": row["STATE/UT"],
                    "year": int(row["YEAR"])
                }
                for c in dice_cats:
                    entry[c] = int(row[c])
                data.append(entry)

            return {
                "operation": "dice",
                "description": "Dice along selected years, states, and crime categories",
                "dimensions_applied": {
                    "years": dice_years,
                    "states": dice_states,
                    "categories": dice_cats
                },
                "row_count": len(data),
                "data": data
            }

        elif op == "pivot":
            idx = str(index or "state").strip().lower()
            col = str(columns or "year").strip().lower()
            val = self._normalize_category(values or "TOTAL IPC CRIMES")

            col_map = {"state": "STATE/UT", "year": "YEAR", "district": "DISTRICT"}
            if idx not in col_map or col not in col_map:
                raise AnalyticsError("Pivot index and columns must be one of: 'state', 'year', 'district'.", status_code=400, error_code="INVALID_PIVOT_AXIS")
            if idx == col:
                raise AnalyticsError("Pivot index and columns cannot be the same dimension.", status_code=400, error_code="SAME_PIVOT_AXES")

            state_scope = None
            if idx == "district" or col == "district":
                if not state:
                    raise AnalyticsError("state parameter is required when pivoting on 'district'.", status_code=400, error_code="MISSING_STATE")
                state_scope = self._normalize_state(state)
                # When pivoting on district within a state, exclude aggregate rows like DELHI UT TOTAL
                df_pivot_source = self.df[(self.df["STATE/UT"] == state_scope) & (self.df["DISTRICT"] != "DELHI UT TOTAL")]
            else:
                df_pivot_source = self._get_aggregate_source(district=None)

            pivot_df = pd.pivot_table(
                df_pivot_source,
                values=val,
                index=col_map[idx],
                columns=col_map[col],
                aggfunc="sum",
                fill_value=0
            )

            # Structure pivot data into serializable format
            # Row-oriented table format with row_key and column values
            rows = []
            pivot_columns = [str(c) for c in pivot_df.columns]
            for row_key, row_series in pivot_df.iterrows():
                row_dict = {"row_key": str(row_key)}
                for col_name in pivot_columns:
                    # original column lookup
                    c_key = int(col_name) if col == "year" else col_name
                    row_dict[col_name] = int(row_series[c_key])
                rows.append(row_dict)

            return {
                "operation": "pivot",
                "description": f"Cross-tabulation of '{idx}' (rows) by '{col}' (columns) for values '{val}'",
                "dimensions_applied": {
                    "index": idx,
                    "columns": col,
                    "values": val,
                    "state_scope": state_scope
                },
                "pivot_columns": pivot_columns,
                "row_count": len(rows),
                "data": rows
            }

        else:
            raise AnalyticsError(
                f"Unsupported OLAP operation '{operation}'. Supported operations: ['rollup', 'drilldown', 'slice', 'dice', 'pivot']",
                status_code=400,
                error_code="UNSUPPORTED_OPERATION"
            )

    # -------------------------------------------------------------------------
    # F. Model Evaluation Information Endpoint
    # -------------------------------------------------------------------------
    def get_model_evaluation(self) -> Dict[str, Any]:
        self._ensure_initialized()
        if not self.metadata:
            raise AnalyticsError("Model evaluation metadata is not available.", status_code=404, error_code="METADATA_UNAVAILABLE")

        return {
            "model_type": "PureRandomForestClassifier",
            "n_estimators": self.metadata.get("n_estimators", 300),
            "test_accuracy": self.metadata.get("test_accuracy", 0.0),
            "train_years": self.metadata.get("train_years", [2001, 2008]),
            "test_years": self.metadata.get("test_years", [2009, 2011]),
            "train_samples": self.metadata.get("train_samples", 0),
            "test_samples": self.metadata.get("test_samples", 0),
            "classes": self.metadata.get("classes", []),
            "feature_names": self.metadata.get("feature_names", []),
            "confusion_matrix": self.metadata.get("confusion_matrix", []),
            "class_report": self.metadata.get("class_report", {}),
            "feature_importances": None,
            "feature_importances_note": (
                "Feature importances were computed in the exploratory research notebook phase and are "
                "not serialized in the pure-Python Random Forest model artifact."
            ),
            "disclaimer": (
                "Model evaluation reflects empirical classification performance on historical held-out test data (2009–2011) "
                "and does not represent the real-world probability that a crime will occur."
            )
        }

# Global singleton instance
analytics_service = AnalyticsService()
