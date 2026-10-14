const express = require('express');
const {
  getMetadata,
  getTrends,
  getCategoryDistribution,
  getComparison,
  getOlap,
  getModelEvaluation
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Enforce JWT authentication on all analytics gateway endpoints
router.use(authenticate);

// Mounted under /api/analytics
router.get('/metadata', getMetadata);
router.get('/trends', getTrends);
router.get('/category-distribution', getCategoryDistribution);
router.get('/comparison', getComparison);
router.get('/olap', getOlap);
router.get('/model-evaluation', getModelEvaluation);

module.exports = router;
