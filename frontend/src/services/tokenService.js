/**
 * Token Storage Service for CrimePulse Frontend
 *
 * SECURITY & STORAGE TRADE-OFF NOTICE:
 * Tokens are persisted in browser localStorage to support seamless page reloads
 * across browser sessions.
 *
 * Trade-off: While localStorage is accessible to client JavaScript and does NOT
 * provide protection against Cross-Site Scripting (XSS), it provides the simplest
 * compatible client-side token persistence for the current REST JWT backend.
 *
 * Token access is centralized exclusively through this module so that future migration
 * to secure HttpOnly cookies or memory-only refresh mechanisms will require changes only
 * to this file and the API client.
 *
 * Passwords, secrets, and raw decoded claims are NEVER written to browser storage.
 */

const TOKEN_KEY = 'crimepulse_jwt_token';

/**
 * Retrieves the stored JWT token.
 * @returns {string|null}
 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the JWT token in browser storage.
 * @param {string} token
 */
export function setToken(token) {
  try {
    if (token && typeof token === 'string') {
      localStorage.setItem(TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Graceful fallback if storage is restricted
  }
}

/**
 * Clears the stored JWT token.
 */
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Graceful fallback
  }
}
