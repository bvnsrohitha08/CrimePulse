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

class TestCrimePulseAPI(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        """Initialize crime service and TestClient with lifespan context."""
        crime_service.initialize()
        cls.test_client_cm = TestClient(app)
        cls.client = cls.test_client_cm.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.test_client_cm.__exit__(None, None, None)

    def test_health_endpoint(self):
        """Test GET /health returns HTTP 200 and model_loaded=True."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "crimepulse-ml")
        self.assertTrue(data["model_loaded"])

    def test_model_info_endpoint(self):
        """Test GET /model-info returns HTTP 200 and correct model metadata."""
        response = self.client.get("/model-info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["model_type"], "PureRandomForestClassifier")
        self.assertEqual(data["n_estimators"], 300)
        self.assertEqual(data["max_depth"], 15)
        self.assertEqual(data["feature_count"], 15)
        self.assertEqual(data["class_count"], 6)
        self.assertEqual(len(data["classes"]), 6)
        self.assertIn("HURT/GREVIOUS HURT", data["classes"])

    def test_predict_crime_valid(self):
        """Test POST /predict-crime with valid payload (ANDHRA PRADESH, ADILABAD, 2011)."""
        payload = {
            "state": "ANDHRA PRADESH",
            "district": "ADILABAD",
            "year": 2011
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["state"], "ANDHRA PRADESH")
        self.assertEqual(data["district"], "ADILABAD")
        self.assertEqual(data["input_year"], 2011)
        self.assertEqual(data["target_year"], 2012)
        self.assertIn("predicted_crime", data)
        self.assertIn("confidence_percentage", data)
        self.assertEqual(len(data["probabilities"]), 6)

    def test_predict_crime_invalid_state(self):
        """Test POST /predict-crime with unseen state returns HTTP 400."""
        payload = {
            "state": "UNSEEN_STATE_XYZ",
            "district": "ADILABAD",
            "year": 2011
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "UNSEEN_STATE")

    def test_predict_crime_invalid_district(self):
        """Test POST /predict-crime with unseen district returns HTTP 400."""
        payload = {
            "state": "ANDHRA PRADESH",
            "district": "UNSEEN_DISTRICT_XYZ",
            "year": 2011
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "UNSEEN_DISTRICT")

    def test_predict_crime_unavailable_year(self):
        """Test POST /predict-crime with unavailable historical year returns HTTP 404."""
        payload = {
            "state": "ANDHRA PRADESH",
            "district": "ADILABAD",
            "year": 1990
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertEqual(data["detail"]["error"], "RECORD_NOT_FOUND")

    def test_predict_crime_invalid_year_type(self):
        """Test POST /predict-crime with non-integer year returns HTTP 422."""
        payload = {
            "state": "ANDHRA PRADESH",
            "district": "ADILABAD",
            "year": "invalid_year"
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_predict_crime_missing_state(self):
        """Test POST /predict-crime missing state field returns HTTP 422."""
        payload = {
            "district": "ADILABAD",
            "year": 2011
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_predict_crime_missing_district(self):
        """Test POST /predict-crime missing district field returns HTTP 422."""
        payload = {
            "state": "ANDHRA PRADESH",
            "year": 2011
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_predict_crime_missing_year(self):
        """Test POST /predict-crime missing year field returns HTTP 422."""
        payload = {
            "state": "ANDHRA PRADESH",
            "district": "ADILABAD"
        }
        response = self.client.post("/predict-crime", json=payload)
        self.assertEqual(response.status_code, 422)

if __name__ == "__main__":
    unittest.main()
