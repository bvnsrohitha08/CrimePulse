/**
 * Dedicated ML Service Client for CrimePulse FastAPI Microservice.
 * Handles communication, response parsing, timeouts, and error handling.
 */

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Custom error class for ML service failures.
 */
class MLServiceError extends Error {
  constructor(message, statusCode = 500, code = 'ML_SERVICE_ERROR', details = null) {
    super(message);
    this.name = 'MLServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Sends a prediction request to the FastAPI ML microservice.
 *
 * @param {Object} params
 * @param {string} params.state - State or Union Territory name (e.g. "ANDHRA PRADESH")
 * @param {string} params.district - District name (e.g. "ADILABAD")
 * @param {number|string} params.year - Historical observation year (e.g. 2011)
 * @param {Object} [options]
 * @param {number} [options.timeout] - Custom request timeout in milliseconds
 * @returns {Promise<Object>} FastAPI PredictionResponse schema object
 */
const predictCrime = async ({ state, district, year }, options = {}) => {
  const baseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const url = `${baseUrl.replace(/\/+$/, '')}/predict-crime`;
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;

  // Client-side parameter validation
  if (!state || typeof state !== 'string' || !state.trim()) {
    throw new MLServiceError('State parameter is required and must be a non-empty string.', 400, 'INVALID_INPUT');
  }
  if (!district || typeof district !== 'string' || !district.trim()) {
    throw new MLServiceError('District parameter is required and must be a non-empty string.', 400, 'INVALID_INPUT');
  }
  const parsedYear = Number(year);
  if (isNaN(parsedYear) || !Number.isInteger(parsedYear)) {
    throw new MLServiceError('Year parameter is required and must be a valid integer.', 400, 'INVALID_INPUT');
  }

  const payload = {
    state: state.trim(),
    district: district.trim(),
    year: parsedYear
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new MLServiceError(
        'Invalid JSON response received from ML service.',
        response.status || 500,
        'INVALID_RESPONSE'
      );
    }

    if (!response.ok) {
      let errorCode = 'ML_SERVICE_ERROR';
      let errorMessage = `ML service returned status ${response.status}`;
      let errorDetails = data;

      if (data && data.detail) {
        if (typeof data.detail === 'object' && !Array.isArray(data.detail)) {
          errorCode = data.detail.error || errorCode;
          errorMessage = data.detail.message || errorMessage;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorCode = 'VALIDATION_ERROR';
          errorMessage = 'ML service request validation failed.';
        }
      }

      throw new MLServiceError(errorMessage, response.status, errorCode, errorDetails);
    }

    return data;
  } catch (error) {
    clearTimeout(timer);

    if (error instanceof MLServiceError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new MLServiceError(
        `ML service request timed out after ${timeoutMs}ms.`,
        504,
        'TIMEOUT'
      );
    }

    throw new MLServiceError(
      `Failed to connect to ML service: ${error.message}`,
      503,
      'NETWORK_ERROR'
    );
  }
};

/**
 * Generic GET helper for forwarding analytics queries to the FastAPI ML service.
 *
 * @param {string} endpoint - Path under /analytics (e.g. '/analytics/metadata')
 * @param {Object} [queryParams={}] - Key-value map of query parameters
 * @param {Object} [options={}] - Options such as timeout
 * @returns {Promise<Object>} Upstream JSON response
 */
const fetchAnalytics = async (endpoint, queryParams = {}, options = {}) => {
  const baseUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const urlObj = new URL(`${cleanBase}${cleanEndpoint}`);
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;

  if (queryParams && typeof queryParams === 'object') {
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;
      if (Array.isArray(val)) {
        val.forEach((item) => {
          if (item !== undefined && item !== null && item !== '') {
            urlObj.searchParams.append(key, String(item));
          }
        });
      } else {
        urlObj.searchParams.append(key, String(val));
      }
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new MLServiceError(
        'Invalid JSON response received from ML service.',
        response.status || 500,
        'INVALID_RESPONSE'
      );
    }

    if (!response.ok) {
      let errorCode = 'ML_SERVICE_ERROR';
      let errorMessage = `ML service returned status ${response.status}`;
      let errorDetails = data;

      if (data && data.detail) {
        if (typeof data.detail === 'object' && !Array.isArray(data.detail)) {
          errorCode = data.detail.error || errorCode;
          errorMessage = data.detail.message || errorMessage;
        } else if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorCode = 'VALIDATION_ERROR';
          errorMessage = 'ML service request validation failed.';
        }
      }

      throw new MLServiceError(errorMessage, response.status, errorCode, errorDetails);
    }

    return data;
  } catch (error) {
    clearTimeout(timer);

    if (error instanceof MLServiceError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new MLServiceError(
        `ML service request timed out after ${timeoutMs}ms.`,
        504,
        'TIMEOUT'
      );
    }

    throw new MLServiceError(
      `Failed to connect to ML service: ${error.message}`,
      503,
      'NETWORK_ERROR'
    );
  }
};

const getAnalyticsMetadata = (queryParams, options) =>
  fetchAnalytics('/analytics/metadata', queryParams, options);

const getAnalyticsTrends = (queryParams, options) =>
  fetchAnalytics('/analytics/trends', queryParams, options);

const getAnalyticsCategoryDistribution = (queryParams, options) =>
  fetchAnalytics('/analytics/category-distribution', queryParams, options);

const getAnalyticsComparison = (queryParams, options) =>
  fetchAnalytics('/analytics/comparison', queryParams, options);

const getAnalyticsOlap = (queryParams, options) =>
  fetchAnalytics('/analytics/olap', queryParams, options);

const getAnalyticsModelEvaluation = (options) =>
  fetchAnalytics('/analytics/model-evaluation', {}, options);

module.exports = {
  predictCrime,
  fetchAnalytics,
  getAnalyticsMetadata,
  getAnalyticsTrends,
  getAnalyticsCategoryDistribution,
  getAnalyticsComparison,
  getAnalyticsOlap,
  getAnalyticsModelEvaluation,
  MLServiceError
};

