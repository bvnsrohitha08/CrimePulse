/**
 * Centralized API configuration for CrimePulse Frontend
 */
export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://localhost:5000/api';

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/health`,
  HEALTH_DB: `${API_BASE_URL}/health/db`,
  AUTH: {
    REGISTER: `${API_BASE_URL}/auth/register`,
    LOGIN: `${API_BASE_URL}/auth/login`,
    ME: `${API_BASE_URL}/auth/me`,
  },
  PREDICTION: {
    PREDICT: `${API_BASE_URL}/crime/predict`,
  },
  ANALYSIS: {
    HISTORY: `${API_BASE_URL}/analysis`,
    GET_BY_ID: (id) => `${API_BASE_URL}/analysis/${id}`,
  },
  ANALYTICS: {
    METADATA: `${API_BASE_URL}/analytics/metadata`,
    TRENDS: `${API_BASE_URL}/analytics/trends`,
    CATEGORY_DISTRIBUTION: `${API_BASE_URL}/analytics/category-distribution`,
    COMPARISON: `${API_BASE_URL}/analytics/comparison`,
    OLAP: `${API_BASE_URL}/analytics/olap`,
    MODEL_EVALUATION: `${API_BASE_URL}/analytics/model-evaluation`,
  },
};
