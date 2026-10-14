/**
 * CrimePulse Frontend Centralized API Client
 * Manages HTTP communication with the Express API Gateway.
 */

import { API_ENDPOINTS } from '../config/api.js';
import { getToken } from './tokenService.js';

/**
 * Custom error class representing API or network errors.
 */
export class ApiError extends Error {
  constructor(message, status = 500, code = 'API_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Centralized fetch wrapper that applies headers, token auth, and structured error handling.
 *
 * @param {string} url - Target URL endpoint
 * @param {Object} [options] - Fetch request options
 * @param {string} [options.token] - Optional explicit auth token override
 * @returns {Promise<any>}
 */
export async function apiFetch(url, options = {}) {
  const { token, headers = {}, body, ...customConfig } = options;

  const activeToken = token || getToken();

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (activeToken) {
    requestHeaders.Authorization = `Bearer ${activeToken}`;
  }

  let requestBody = body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, {
      ...customConfig,
      headers: requestHeaders,
      body: requestBody,
    });
  } catch {
    throw new ApiError(
      'Unable to connect to CrimePulse server. Please check your network connection or verify that the backend is running.',
      0,
      'NETWORK_ERROR'
    );
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        'Server returned invalid JSON response.',
        response.status,
        'INVALID_JSON'
      );
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorCode = (data && data.error) || 'REQUEST_FAILED';
    const errorMessage =
      (data && data.message) ||
      (typeof data === 'string' && data.length < 200 ? data : `Request failed with status ${response.status}`);

    throw new ApiError(errorMessage, response.status, errorCode, data);
  }

  return data;
}

/**
 * Registers a new user. Always assigns role 'CUSTOMER'.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ message: string, token: string, user: Object }>}
 */
export async function registerUser({ name, email, password }) {
  return apiFetch(API_ENDPOINTS.AUTH.REGISTER, {
    method: 'POST',
    body: { name, email, password },
  });
}

/**
 * Authenticates user credentials.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ message: string, token: string, user: Object }>}
 */
export async function loginUser({ email, password }) {
  return apiFetch(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    body: { email, password },
  });
}

/**
 * Fetches the current authenticated user's profile from the backend.
 *
 * @param {string} [tokenOverride]
 * @returns {Promise<{ user: Object }>}
 */
export async function getCurrentUser(tokenOverride) {
  return apiFetch(API_ENDPOINTS.AUTH.ME, {
    method: 'GET',
    token: tokenOverride,
  });
}

/**
 * Checks overall backend API health.
 * @returns {Promise<Object>}
 */
export async function checkBackendHealth() {
  try {
    return await apiFetch(API_ENDPOINTS.HEALTH, { method: 'GET' });
  } catch (error) {
    return { status: 'unreachable', error: error.message };
  }
}

/**
 * Checks backend database connectivity health.
 * @returns {Promise<Object>}
 */
export async function checkDatabaseHealth() {
  try {
    return await apiFetch(API_ENDPOINTS.HEALTH_DB, { method: 'GET' });
  } catch (error) {
    return { status: 'unreachable', error: error.message };
  }
}

/**
 * Executes a crime prediction query via the authenticated Express API gateway.
 * The backend determines user ownership automatically from the Bearer token.
 *
 * @param {Object} params
 * @param {string} params.state - State or Union Territory name (e.g. "ANDHRA PRADESH")
 * @param {string} params.district - District name (e.g. "ADILABAD")
 * @param {number|string} params.year - Historical observation year (e.g. 2011)
 * @returns {Promise<Object>} The prediction response including predicted_crime, confidence_percentage, probabilities, and analysis_id
 */
export async function predictCrime({ state, district, year }) {
  return apiFetch(API_ENDPOINTS.PREDICTION.PREDICT, {
    method: 'POST',
    body: {
      state,
      district,
      year: Number(year),
    },
  });
}

/**
 * Fetches the authenticated user's prediction history with pagination.
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @returns {Promise<{ records: Array<Object>, pagination: { total: number, page: number, limit: number, totalPages: number } }>}
 */
export async function getAnalysisHistory({ page = 1, limit = 10 } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  }).toString();

  return apiFetch(`${API_ENDPOINTS.ANALYSIS.HISTORY}?${query}`, {
    method: 'GET',
  });
}

/**
 * Fetches a single prediction analysis record by ID.
 * Returns the record only if owned by the authenticated user.
 *
 * @param {string} id - 24-character hexadecimal MongoDB ObjectId
 * @returns {Promise<Object>}
 */
export async function getAnalysisById(id) {
  return apiFetch(API_ENDPOINTS.ANALYSIS.GET_BY_ID(id), {
    method: 'GET',
  });
}

/**
 * Fetches dataset metadata (year range, states, categories, and optional districts for a state).
 *
 * @param {Object} [params]
 * @param {string} [params.state] - Optional State/UT name to retrieve its districts
 * @returns {Promise<Object>} Metadata response object
 */
export async function getAnalyticsMetadata({ state } = {}) {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  return apiFetch(`${API_ENDPOINTS.ANALYTICS.METADATA}${query}`, {
    method: 'GET',
  });
}

/**
 * Fetches historical crime trends for the given category, year range, and geography.
 *
 * @param {Object} [params]
 * @param {number} [params.start_year]
 * @param {number} [params.end_year]
 * @param {string} [params.state]
 * @param {string} [params.district]
 * @param {string} [params.category]
 * @returns {Promise<Object>} Trends response with year points and summary metrics
 */
export async function getAnalyticsTrends({ start_year, end_year, state, district, category } = {}) {
  const params = new URLSearchParams();
  if (start_year !== undefined && start_year !== null && start_year !== '') params.append('start_year', String(start_year));
  if (end_year !== undefined && end_year !== null && end_year !== '') params.append('end_year', String(end_year));
  if (state) params.append('state', state);
  if (district) params.append('district', district);
  if (category) params.append('category', category);

  const qs = params.toString();
  const url = qs ? `${API_ENDPOINTS.ANALYTICS.TRENDS}?${qs}` : API_ENDPOINTS.ANALYTICS.TRENDS;
  return apiFetch(url, { method: 'GET' });
}

/**
 * Fetches crime category distribution for a specific observation year and optional geography.
 *
 * @param {Object} params
 * @param {number|string} params.year - Observation year (required)
 * @param {string} [params.state]
 * @param {string} [params.district]
 * @param {boolean} [params.include_summaries=false]
 * @returns {Promise<Object>} Category distribution response
 */
export async function getAnalyticsCategoryDistribution({ year, state, district, include_summaries = false } = {}) {
  const params = new URLSearchParams();
  if (year !== undefined && year !== null && year !== '') params.append('year', String(year));
  if (state) params.append('state', state);
  if (district) params.append('district', district);
  if (include_summaries) params.append('include_summaries', 'true');

  return apiFetch(`${API_ENDPOINTS.ANALYTICS.CATEGORY_DISTRIBUTION}?${params.toString()}`, {
    method: 'GET',
  });
}

/**
 * Fetches multi-location comparison across states or districts within a state.
 *
 * @param {Object} params
 * @param {string} params.comparison_type - 'state' or 'district'
 * @param {Array<string>|string} params.locations - Array of location names (up to 10)
 * @param {string} [params.state] - Scope state (required when comparison_type is 'district')
 * @param {number} [params.start_year]
 * @param {number} [params.end_year]
 * @param {string} [params.category]
 * @returns {Promise<Object>} Comparison response with series and yearly breakdowns
 */
export async function getAnalyticsComparison({
  comparison_type,
  locations,
  state,
  start_year,
  end_year,
  category,
} = {}) {
  const params = new URLSearchParams();
  if (comparison_type) params.append('comparison_type', comparison_type);

  if (Array.isArray(locations)) {
    locations.forEach((loc) => {
      if (loc) params.append('locations', loc);
    });
  } else if (typeof locations === 'string' && locations.trim()) {
    params.append('locations', locations.trim());
  }

  if (state) params.append('state', state);
  if (start_year !== undefined && start_year !== null && start_year !== '') params.append('start_year', String(start_year));
  if (end_year !== undefined && end_year !== null && end_year !== '') params.append('end_year', String(end_year));
  if (category) params.append('category', category);

  return apiFetch(`${API_ENDPOINTS.ANALYTICS.COMPARISON}?${params.toString()}`, {
    method: 'GET',
  });
}

/**
 * Executes multi-dimensional OLAP operation (rollup, drilldown, slice, dice, pivot).
 *
 * @param {Object} params - Query parameters for the OLAP operation
 * @returns {Promise<Object>} OLAP response
 */
export async function getAnalyticsOlap(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    if (Array.isArray(val)) {
      searchParams.append(key, val.join(','));
    } else {
      searchParams.append(key, String(val));
    }
  });

  return apiFetch(`${API_ENDPOINTS.ANALYTICS.OLAP}?${searchParams.toString()}`, {
    method: 'GET',
  });
}

/**
 * Fetches verified Random Forest classification model evaluation metrics and diagnostics.
 *
 * @returns {Promise<Object>} Model evaluation response
 */
export async function getAnalyticsModelEvaluation() {
  return apiFetch(API_ENDPOINTS.ANALYTICS.MODEL_EVALUATION, {
    method: 'GET',
  });
}

