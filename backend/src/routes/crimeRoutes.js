const express = require('express');
const { getCrimePrediction } = require('../controllers/crimeController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/crime/predict', authenticate, getCrimePrediction);

module.exports = router;

