import unittest
import sys
from pathlib import Path

# Add ml-service root to sys.path
ML_SERVICE_DIR = Path(__file__).resolve().parent.parent.parent
if str(ML_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(ML_SERVICE_DIR))

from fastapi.testclient import TestClient
from api.main import app
from api.services.crime_service import crime_service
from api.services.analytics_service import analytics_service

class TestCrimePulseAnalytics(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Initialize both services and TestClient."""
        crime_service.initialize()
        analytics_service.initialize()
        cls.test_client_cm = TestClient(app)
        cls.client = cls.test_client_cm.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.test_client_cm.__exit__(None, None, None)

    # -------------------------------------------------------------------------
    # 1. Dataset loading and cleaning
    # -------------------------------------------------------------------------
    def test_dataset_loading_and_shape(self):
        """Verify historical dataset loads with expected shape, columns, and types."""
        self.assertTrue(analytics_service.is_loaded)
        self.assertIsNotNone(analytics_service.df)
        df = analytics_service.df
        # 8609 rows after removing 408 DISTRICT == 'TOTAL' rows from 9017 raw rows
        self.assertEqual(len(df), 8609)
        self.assertEqual(len(analytics_service.available_years), 12)
        self.assertEqual(analytics_service.available_years[0], 2001)
        self.assertEqual(analytics_service.available_years[-1], 2012)
        self.assertEqual(len(analytics_service.available_states), 35)
        self.assertEqual(len(analytics_service.individual_categories), 28)
        self.assertEqual(len(analytics_service.summary_categories), 2)

    # -------------------------------------------------------------------------
    # 2. Exclusion of TOTAL rows and duplicate prevention
    # -------------------------------------------------------------------------
    def test_total_district_rows_excluded(self):
        """Verify that DISTRICT == 'TOTAL' rows are completely excluded."""
        df = analytics_service.df
        total_rows = df[df["DISTRICT"] == "TOTAL"]
        self.assertEqual(len(total_rows), 0, "No DISTRICT == 'TOTAL' rows should be present")

    def test_no_duplicate_records(self):
        """Verify no duplicate records exist in accordance with established drop_duplicates rule."""
        df = analytics_service.df
        duplicates = df.duplicated()
        self.assertEqual(duplicates.sum(), 0, "Clean dataset should have zero duplicate records")

    def test_district_multi_observation_aggregation(self):
        """Verify that districts with multiple records in a year (e.g., J&K RAILWAYS 2010) are correctly aggregated."""
        response = self.client.get(
            "/analytics/trends",
            params={
                "state": "JAMMU & KASHMIR",
                "district": "RAILWAYS",
                "start_year": 2010,
                "end_year": 2010
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # 36 + 21 = 57
        self.assertEqual(data["data"][0]["count"], 57)



    # -------------------------------------------------------------------------
    # 3. Metadata values and invalid state/district inputs
    # -------------------------------------------------------------------------
    def test_get_metadata_all(self):
        """Test GET /analytics/metadata returns complete metadata."""
        response = self.client.get("/analytics/metadata")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["year_range"]["min_year"], 2001)
        self.assertEqual(data["year_range"]["max_year"], 2012)
        self.assertEqual(len(data["year_range"]["years"]), 12)
        self.assertEqual(len(data["states"]), 35)
        self.assertIn("ANDHRA PRADESH", data["states"])
        self.assertIsNone(data["districts"])
        self.assertEqual(len(data["crime_categories"]), 28)
        self.assertEqual(data["summary_categories"], ["OTHER IPC CRIMES", "TOTAL IPC CRIMES"])
        self.assertEqual(data["total_records"], 8609)

    def test_get_metadata_with_valid_state(self):
        """Test GET /analytics/metadata?state=ANDHRA PRADESH returns districts."""
        response = self.client.get("/analytics/metadata?state=ANDHRA PRADESH")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNotNone(data["districts"])
        self.assertIn("ADILABAD", data["districts"])
        self.assertIn("HYDERABAD CITY", data["districts"])

    def test_get_metadata_with_invalid_state(self):
        """Test GET /analytics/metadata with invalid state returns HTTP 400."""
        response = self.client.get("/analytics/metadata?state=NONEXISTENT_STATE")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "INVALID_STATE")

    # -------------------------------------------------------------------------
    # 4. Historical trend aggregation at district, state, and national levels
    # -------------------------------------------------------------------------
    def test_trends_national(self):
        """Test national level trend aggregation (excluding state aggregate rows)."""
        response = self.client.get("/analytics/trends?start_year=2001&end_year=2005")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["location_type"], "national")
        self.assertIsNone(data["state"])
        self.assertIsNone(data["district"])
        self.assertEqual(data["category"], "TOTAL IPC CRIMES")
        self.assertEqual(data["start_year"], 2001)
        self.assertEqual(data["end_year"], 2005)
        self.assertEqual(len(data["data"]), 5)
        self.assertEqual(data["data"][0]["year"], 2001)
        self.assertGreater(data["data"][0]["count"], 0)
        self.assertGreater(data["summary"]["total_count"], 0)
        self.assertGreater(data["summary"]["avg_count"], 0)

    def test_trends_state(self):
        """Test state level trend aggregation (sum of districts for that state)."""
        response = self.client.get("/analytics/trends?state=ANDHRA PRADESH&start_year=2001&end_year=2003")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["location_type"], "state")
        self.assertEqual(data["state"], "ANDHRA PRADESH")
        self.assertIsNone(data["district"])
        self.assertEqual(len(data["data"]), 3)

    def test_trends_district(self):
        """Test district level trend aggregation."""
        response = self.client.get("/analytics/trends?state=ANDHRA PRADESH&district=ADILABAD&start_year=2001&end_year=2003")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["location_type"], "district")
        self.assertEqual(data["state"], "ANDHRA PRADESH")
        self.assertEqual(data["district"], "ADILABAD")
        self.assertEqual(len(data["data"]), 3)

    def test_trends_custom_category(self):
        """Test trends with a specific individual crime category (MURDER)."""
        response = self.client.get("/analytics/trends?category=MURDER&start_year=2005&end_year=2007")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["category"], "MURDER")
        self.assertEqual(len(data["data"]), 3)

    def test_trends_invalid_category(self):
        """Test trends with an invalid category returns HTTP 400."""
        response = self.client.get("/analytics/trends?category=FAKE_CRIME")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "INVALID_CATEGORY")

    def test_trends_district_without_state(self):
        """Test specifying district without state returns HTTP 400."""
        response = self.client.get("/analytics/trends?district=ADILABAD")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "MISSING_STATE")

    def test_trends_invalid_district_in_state(self):
        """Test invalid district in valid state returns HTTP 400."""
        response = self.client.get("/analytics/trends?state=ANDHRA PRADESH&district=INVALID_DIST")
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "INVALID_DISTRICT")

    # -------------------------------------------------------------------------
    # 5. Category distribution and summary-column exclusion
    # -------------------------------------------------------------------------
    def test_category_distribution_national(self):
        """Test category distribution excludes summary columns by default."""
        response = self.client.get("/analytics/category-distribution?year=2010")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["year"], 2010)
        self.assertEqual(data["location_type"], "national")
        self.assertFalse(data["include_summaries"])
        self.assertEqual(len(data["categories"]), 28)
        # Verify TOTAL IPC CRIMES is excluded
        cat_names = [item["category"] for item in data["categories"]]
        self.assertNotIn("TOTAL IPC CRIMES", cat_names)
        self.assertNotIn("OTHER IPC CRIMES", cat_names)
        # Verify sorted descending
        counts = [item["count"] for item in data["categories"]]
        self.assertEqual(counts, sorted(counts, reverse=True))

    def test_category_distribution_with_summaries(self):
        """Test category distribution with include_summaries=true includes all 30 columns."""
        response = self.client.get("/analytics/category-distribution?year=2010&include_summaries=true")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["include_summaries"])
        self.assertEqual(len(data["categories"]), 30)
        cat_names = [item["category"] for item in data["categories"]]
        self.assertIn("TOTAL IPC CRIMES", cat_names)

    def test_category_distribution_state_and_district(self):
        """Test category distribution at state and district levels."""
        resp_state = self.client.get("/analytics/category-distribution?year=2011&state=KERALA")
        self.assertEqual(resp_state.status_code, 200)
        self.assertEqual(resp_state.json()["location_type"], "state")

        resp_dist = self.client.get("/analytics/category-distribution?year=2011&state=ANDHRA PRADESH&district=ADILABAD")
        self.assertEqual(resp_dist.status_code, 200)
        self.assertEqual(resp_dist.json()["location_type"], "district")

    def test_category_distribution_invalid_year(self):
        """Test category distribution with year out of bounds returns HTTP 400."""
        response = self.client.get("/analytics/category-distribution?year=1995")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "INVALID_YEAR")

    # -------------------------------------------------------------------------
    # 6. Multi-location comparisons
    # -------------------------------------------------------------------------
    def test_comparison_states_multi_param(self):
        """Test comparing states with multiple query parameters."""
        response = self.client.get("/analytics/comparison?comparison_type=state&locations=ANDHRA PRADESH&locations=KARNATAKA&start_year=2008&end_year=2010")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["comparison_type"], "state")
        self.assertEqual(data["locations"], ["ANDHRA PRADESH", "KARNATAKA"])
        self.assertEqual(len(data["series"]), 2)
        self.assertEqual(len(data["series"][0]["data"]), 3)
        self.assertEqual(len(data["yearly_comparison"]), 3)
        self.assertIn("ANDHRA PRADESH", data["yearly_comparison"][0]["counts"])
        self.assertIn("KARNATAKA", data["yearly_comparison"][0]["counts"])

    def test_comparison_states_comma_separated(self):
        """Test comparing states with comma-separated locations."""
        response = self.client.get("/analytics/comparison?comparison_type=state&locations=KERALA,TAMIL NADU&start_year=2005&end_year=2006")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["locations"], ["KERALA", "TAMIL NADU"])

    def test_comparison_districts(self):
        """Test comparing districts within a state."""
        response = self.client.get("/analytics/comparison?comparison_type=district&state=ANDHRA PRADESH&locations=ADILABAD&locations=ANANTAPUR&start_year=2005&end_year=2006")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["comparison_type"], "district")
        self.assertEqual(data["state_scope"], "ANDHRA PRADESH")
        self.assertEqual(len(data["series"]), 2)

    def test_comparison_district_missing_state(self):
        """Test district comparison missing state parameter returns HTTP 400."""
        response = self.client.get("/analytics/comparison?comparison_type=district&locations=ADILABAD")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "MISSING_STATE")

    def test_comparison_invalid_location(self):
        """Test comparing with invalid location returns HTTP 400."""
        response = self.client.get("/analytics/comparison?comparison_type=state&locations=NONEXISTENT_STATE")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "INVALID_LOCATION")

    def test_comparison_too_many_locations(self):
        """Test exceeding the 10 location limit returns HTTP 400."""
        locs = "&locations=".join([f"LOC_{i}" for i in range(12)])
        response = self.client.get(f"/analytics/comparison?comparison_type=state&locations={locs}")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "LOCATION_LIMIT_EXCEEDED")

    # -------------------------------------------------------------------------
    # 7. OLAP Operations
    # -------------------------------------------------------------------------
    def test_olap_rollup_state(self):
        """Test OLAP rollup to state level."""
        response = self.client.get("/analytics/olap?operation=rollup&level=state&year=2010")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "rollup")
        self.assertGreater(data["row_count"], 0)
        self.assertIn("state", data["data"][0])
        self.assertIn("count", data["data"][0])

    def test_olap_rollup_national(self):
        """Test OLAP rollup to national level."""
        response = self.client.get("/analytics/olap?operation=rollup&level=national&year=2010")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "rollup")
        self.assertEqual(data["row_count"], 1)
        self.assertEqual(data["data"][0]["scope"], "All India")

    def test_olap_drilldown(self):
        """Test OLAP drilldown from state to districts."""
        response = self.client.get("/analytics/olap?operation=drilldown&state=ANDHRA PRADESH&year=2010")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "drilldown")
        self.assertGreater(data["row_count"], 0)
        self.assertIn("district", data["data"][0])

    def test_olap_drilldown_missing_state(self):
        """Test OLAP drilldown without state returns HTTP 400."""
        response = self.client.get("/analytics/olap?operation=drilldown")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "MISSING_STATE")

    def test_olap_slice_by_year(self):
        """Test OLAP slice along dimension 'year'."""
        response = self.client.get("/analytics/olap?operation=slice&dimension=year&value=2011")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "slice")
        self.assertGreater(data["row_count"], 0)
        self.assertIn("state", data["data"][0])

    def test_olap_slice_by_state(self):
        """Test OLAP slice along dimension 'state'."""
        response = self.client.get("/analytics/olap?operation=slice&dimension=state&value=KERALA")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "slice")
        self.assertEqual(data["row_count"], 12)  # 2001-2012
        self.assertIn("year", data["data"][0])

    def test_olap_dice(self):
        """Test OLAP dice subcube across selected years, states, and categories."""
        response = self.client.get("/analytics/olap?operation=dice&years=2008,2009&states=KERALA,KARNATAKA&categories=MURDER")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "dice")
        self.assertEqual(data["row_count"], 4)  # 2 states x 2 years
        self.assertIn("MURDER", data["data"][0])

    def test_olap_pivot(self):
        """Test OLAP pivot table cross-tabulation."""
        response = self.client.get("/analytics/olap?operation=pivot&index=state&columns=year&values=TOTAL IPC CRIMES")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "pivot")
        self.assertEqual(len(data["pivot_columns"]), 12)
        self.assertIn("2001", data["pivot_columns"])
        self.assertIn("row_key", data["data"][0])

    def test_olap_pivot_district(self):
        """Test OLAP pivot on district with required state scope."""
        response = self.client.get("/analytics/olap?operation=pivot&index=district&columns=year&state=KERALA")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["operation"], "pivot")
        self.assertGreater(data["row_count"], 0)

    def test_olap_pivot_same_axes(self):
        """Test OLAP pivot with same index and columns returns HTTP 400."""
        response = self.client.get("/analytics/olap?operation=pivot&index=state&columns=state")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "SAME_PIVOT_AXES")

    def test_olap_unsupported_operation(self):
        """Test invalid OLAP operation name returns HTTP 400."""
        response = self.client.get("/analytics/olap?operation=invalid_op")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "UNSUPPORTED_OPERATION")

    # -------------------------------------------------------------------------
    # 8. Model evaluation output based on real metadata
    # -------------------------------------------------------------------------
    def test_model_evaluation_metrics(self):
        """Test GET /analytics/model-evaluation returns real held-out metrics."""
        response = self.client.get("/analytics/model-evaluation")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_type"], "PureRandomForestClassifier")
        self.assertEqual(data["n_estimators"], 300)
        self.assertAlmostEqual(data["test_accuracy"], 0.8273, places=2)
        self.assertEqual(data["train_years"], [2001, 2008])
        self.assertEqual(data["test_years"], [2009, 2011])
        self.assertEqual(len(data["classes"]), 6)
        self.assertEqual(len(data["confusion_matrix"]), 6)
        self.assertIn("HURT/GREVIOUS HURT", data["class_report"])
        self.assertIsNone(data["feature_importances"])
        self.assertIn("notebook phase", data["feature_importances_note"])
        self.assertIn("does not represent the real-world probability", data["disclaimer"])

    # -------------------------------------------------------------------------
    # 9. Invalid year ranges and bounds
    # -------------------------------------------------------------------------
    def test_invalid_year_range_inverted(self):
        """Test start_year > end_year returns HTTP 400."""
        response = self.client.get("/analytics/trends?start_year=2010&end_year=2005")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "INVALID_YEAR_RANGE")

    def test_invalid_year_range_out_of_bounds(self):
        """Test year out of 2001-2012 bounds returns HTTP 400."""
        response = self.client.get("/analytics/trends?start_year=1990&end_year=2000")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "YEAR_OUT_OF_BOUNDS")

    # -------------------------------------------------------------------------
    # 10. Existing prediction and health endpoints remain unchanged
    # -------------------------------------------------------------------------
    def test_existing_health_and_predict_remain_intact(self):
        """Ensure /health and /predict-crime behave identically."""
        # Health check
        h_resp = self.client.get("/health")
        self.assertEqual(h_resp.status_code, 200)
        self.assertEqual(h_resp.json()["status"], "ok")

        # Prediction check
        payload = {
            "state": "ANDHRA PRADESH",
            "district": "ADILABAD",
            "year": 2011
        }
        p_resp = self.client.post("/predict-crime", json=payload)
        self.assertEqual(p_resp.status_code, 200)
        p_data = p_resp.json()
        self.assertEqual(p_data["status"], "success")
        self.assertEqual(p_data["predicted_crime"], "HURT/GREVIOUS HURT")
        self.assertEqual(len(p_data["probabilities"]), 6)

    # -------------------------------------------------------------------------
    # 11. Regression Tests: Double-Counting Prevention & Model Reconciliation
    # -------------------------------------------------------------------------
    def test_aggregation_no_delhi_double_counting(self):
        """
        Verify state and national aggregations do NOT double-count Delhi by including
        'DELHI UT TOTAL' alongside its constituent districts.
        """
        # Delhi State Aggregate in 2001 should equal constituent districts sum: 54,384
        resp = self.client.get("/analytics/trends?state=DELHI UT&start_year=2001&end_year=2001")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["data"][0]["count"], 54384)

        # Explicit request for DELHI UT TOTAL district should return that record directly
        resp_dist = self.client.get("/analytics/trends?state=DELHI UT&district=DELHI UT TOTAL&start_year=2001&end_year=2001")
        self.assertEqual(resp_dist.status_code, 200)
        self.assertEqual(resp_dist.json()["data"][0]["count"], 54384)

        # Drilldown into DELHI UT should list constituent districts and exclude DELHI UT TOTAL
        resp_drill = self.client.get("/analytics/olap?operation=drilldown&state=DELHI UT&year=2001")
        self.assertEqual(resp_drill.status_code, 200)
        dist_names = [d["district"] for d in resp_drill.json()["data"]]
        self.assertNotIn("DELHI UT TOTAL", dist_names)
        self.assertIn("NEW DELHI", dist_names)

    def test_model_evaluation_reconciliation_exact_math(self):
        """
        Verify that model evaluation train/test counts, class support, and confusion
        matrix entries are 100% mathematically consistent.
        """
        resp = self.client.get("/analytics/model-evaluation")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["train_samples"], 5561)
        self.assertEqual(data["test_samples"], 2206)

        # Confusion matrix total entries must equal exactly test_samples (2,206)
        cm = data["confusion_matrix"]
        cm_sum = sum(sum(row) for row in cm)
        self.assertEqual(cm_sum, 2206)

        # Sum of per-class supports must equal exactly 2,206
        support_sum = sum(metrics["support"] for metrics in data["class_report"].values())
        self.assertEqual(support_sum, 2206)

        # Accuracy must equal diagonal sum / total samples
        diag_sum = sum(cm[i][i] for i in range(len(cm)))
        self.assertEqual(diag_sum, 1825)
        self.assertAlmostEqual(data["test_accuracy"], 1825 / 2206, places=4)

if __name__ == "__main__":
    unittest.main()
