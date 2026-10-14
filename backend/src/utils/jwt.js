const jwt = require('jsonwebtoken');

const DEFAULT_EXPIRY = '1h';

/**
 * Retrieves the JWT signing secret from environment configuration.
 * Throws an explicit error if missing or empty, avoiding any insecure fallback.
 *
 * @returns {string} Configured JWT secret
 */
const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error('JWT_SECRET environment variable is missing or empty. Authentication operations cannot proceed.');
  }
  return secret.trim();
};

/**
 * Retrieves the configured JWT expiration duration.
 * Defaults safely to 1 hour if unspecified.
 *
 * @returns {string} Token expiry duration
 */
const getJWTExpiresIn = () => {
  return process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY;
};

/**
 * Signs a payload and returns a signed JSON Web Token.
 *
 * @param {Object} payload - User claims to encode into the token
 * @param {Object} [options] - Optional custom jsonwebtoken sign options
 * @returns {string} Signed JWT
 */
const signToken = (payload, options = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('JWT payload must be a non-null object.');
  }

  const secret = getJWTSecret();
  const expiresIn = options.expiresIn || getJWTExpiresIn();

  return jwt.sign(payload, secret, {
    ...options,
    expiresIn
  });
};

/**
 * Verifies and decodes a JSON Web Token.
 *
 * @param {string} token - The raw JWT token string
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string.');
  }

  const secret = getJWTSecret();
  return jwt.verify(token, secret);
};

module.exports = {
  signToken,
  verifyToken,
  getJWTSecret,
  getJWTExpiresIn,
  DEFAULT_EXPIRY
};
