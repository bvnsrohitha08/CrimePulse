const express = require('express');
const { getAnalyses, getAnalysisById } = require('../controllers/analysisController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected prediction history and ownership routes
router.get('/analysis', authenticate, getAnalyses);
router.get('/analysis/:id', authenticate, getAnalysisById);

module.exports = router;
