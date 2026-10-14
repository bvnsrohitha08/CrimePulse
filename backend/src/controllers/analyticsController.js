const mlService = require('../services/mlService');

/**
 * Standard error responder for ML service exceptions.
 */
const handleMLServiceError = (res, error, next) => {
  if (error instanceof mlService.MLServiceError) {
    return res.status(error.statusCode || 500).json({
      error: error.code || 'ML_SERVICE_ERROR',
      message: error.message
    });
  }
  return next(error);
};

/**
 * GET /api/analytics/metadata
 * Proxies dataset metadata request to FastAPI ML service.
 */
const getMetadata = async (req, res, next) => {
  try {
    const data = await mlService.getAnalyticsMetadata(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return handleMLServiceError(res, error, next);
  }
};

/**
 * GET /api/analytics/trends
 * Proxies historical crime trend query to FastAPI ML service.
 */
const getTrends = async (req, res, next) => {
  try {
    const data = await mlService.getAnalyticsTrends(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return handleMLServiceError(res, error, next);
  }
};

/**
 * GET /api/analytics/category-distribution
 * Proxies category distribution query to FastAPI ML service.
 */
const getCategoryDistribution = async (req, res, next) => {
  try {
    const { year } = req.query;
    if (year === undefined || year === null || year === '') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Year query parameter is required.'
      });
    }

    const data = await mlService.getAnalyticsCategoryDistribution(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return handleMLServiceError(res, error, next);
  }
};

/**
 * GET /api/analytics/comparison
 * Proxies multi-location comparison query to FastAPI ML service.
 */
const getComparison = async (req, res, next) => {
  try {
    const { comparison_type, locations } = req.query;
    if (!comparison_type || (comparison_type !== 'state' && comparison_type !== 'district')) {
      return res.status(400).json({
        error: 'INVALID_COMPARISON_TYPE',
        message: "comparison_type parameter is required and must be either 'state' or 'district'."
      });
    }

    if (!locations || (Array.isArray(locations) && locations.length === 0)) {
      return res.status(400).json({
        error: 'INVALID_LOCATIONS',
        message: 'locations parameter is required.'
      });
    }

    const data = await mlService.getAnalyticsComparison(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return handleMLServiceError(res, error, next);
  }
};

/**
 * GET /api/analytics/olap
 * Proxies multidimensional OLAP operation to FastAPI ML service.
 */
const getOlap = async (req, res, next) => {
  try {
    const { operation } = req.query;
    const validOps = ['rollup', 'drilldown', 'slice', 'dice', 'pivot'];
    if (!operation || !validOps.includes(String(operation).toLowerCase().trim())) {
      return res.status(400).json({
        error: 'UNSUPPORTED_OPERATION',
        message: `operation parameter is required and must be one of: ${validOps.join(', ')}.`
      });
    }

    const data = await mlService.getAnalyticsOlap(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return handleMLServiceError(res, error, next);
  }
};

/**
 * GET /api/analytics/model-evaluation
 * Proxies verified Random Forest model evaluation metadata to FastAPI ML service.
 */
const getModelEvaluation = async (req, res, next) => {
  try {
    const data = await mlService.getAnalyticsModelEvaluation();
    return res.status(200).json(data);
  } catch (error) {
    return handleMLServiceError(res, error, next);
  }
};

module.exports = {
  getMetadata,
  getTrends,
  getCategoryDistribution,
  getComparison,
  getOlap,
  getModelEvaluation
};
