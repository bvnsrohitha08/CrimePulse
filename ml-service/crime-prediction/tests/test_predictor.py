import unittest
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.predictor import CrimePredictor, predict_next_year_crime
from src.trainer import train_and_serialize_model
from src.config import MODEL_FILE

class TestCrimePredictor(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        """Ensure reproduced model artifacts exist before testing."""
        if not MODEL_FILE.exists():
            print("Model artifact missing, running reproduction training...")
            train_and_serialize_model()
        cls.predictor = CrimePredictor()

    def test_notebook_supported_example(self):
        """Test exact example from notebook (ANDHRA PRADESH, ADILABAD, 2011)."""
        res = self.predictor.predict_next_year_crime("ANDHRA PRADESH", "ADILABAD", 2011)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["state"], "ANDHRA PRADESH")
        self.assertEqual(res["district"], "ADILABAD")
        self.assertEqual(res["input_year"], 2011)
        self.assertEqual(res["target_year"], 2012)
        self.assertEqual(str(res["predicted_crime"]), "HURT/GREVIOUS HURT")
        self.assertGreaterEqual(res["confidence_percentage"], 90.0)
        self.assertEqual(len(res["probabilities"]), 6)

    def test_valid_location_and_year(self):
        """Test valid state, district, and year (KARNATAKA, BANGALORE COMMR., 2010)."""
        res = predict_next_year_crime("KARNATAKA", "BANGALORE COMMR.", 2010)
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["target_year"], 2011)

    def test_invalid_unseen_state(self):
        """Test unseen/invalid state handling."""
        res = self.predictor.predict_next_year_crime("NONEXISTENT_STATE", "ADILABAD", 2011)
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error_type"], "UNSEEN_STATE")

    def test_invalid_unseen_district(self):
        """Test unseen/invalid district handling."""
        res = self.predictor.predict_next_year_crime("ANDHRA PRADESH", "NONEXISTENT_DISTRICT", 2011)
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error_type"], "UNSEEN_DISTRICT")

    def test_unavailable_year(self):
        """Test year not available in dataset."""
        res = self.predictor.predict_next_year_crime("ANDHRA PRADESH", "ADILABAD", 1995)
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error_type"], "RECORD_NOT_FOUND")

    def test_invalid_input_types(self):
        """Test type validation for invalid year inputs."""
        res = self.predictor.predict_next_year_crime("ANDHRA PRADESH", "ADILABAD", "invalid_year")
        self.assertEqual(res["status"], "error")
        self.assertEqual(res["error_type"], "INVALID_INPUT")

if __name__ == "__main__":
    unittest.main()
