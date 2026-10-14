const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // Bcrypt maximum effective password length in UTF-8 bytes
const MAX_PASSWORD_LENGTH = MAX_PASSWORD_BYTES; // Maintained for backwards compatibility

/**
 * Validates password length and type to ensure security, prevent DoS,
 * and enforce bcrypt's 72-byte UTF-8 input limit for both ASCII and Unicode.
 *
 * @param {string} password - Raw plaintext password
 * @returns {{ isValid: boolean, message?: string }} Validation result
 */
const validatePasswordPolicy = (password) => {
  if (typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password must be a string.'
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    };
  }

  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > MAX_PASSWORD_BYTES) {
    return {
      isValid: false,
      message: `Password cannot exceed ${MAX_PASSWORD_BYTES} bytes.`
    };
  }

  return { isValid: true };
};

/**
 * Securely hashes a plaintext password using bcrypt with 10 salt rounds.
 *
 * @param {string} plainPassword - Plaintext password
 * @returns {Promise<string>} Generated bcrypt hash
 */
const hashPassword = async (plainPassword) => {
  const policy = validatePasswordPolicy(plainPassword);
  if (!policy.isValid) {
    throw new Error(policy.message);
  }

  return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Compares a candidate plaintext password against a stored bcrypt hash.
 *
 * @param {string} plainPassword - Plaintext candidate password
 * @param {string} passwordHash - Stored bcrypt hash
 * @returns {Promise<boolean>} True if match, false otherwise
 */
const comparePassword = async (plainPassword, passwordHash) => {
  if (
    typeof plainPassword !== 'string' ||
    typeof passwordHash !== 'string' ||
    !plainPassword ||
    !passwordHash
  ) {
    return false;
  }

  // Reject passwords exceeding bcrypt's 72-byte limit to prevent silent truncation matching
  if (Buffer.byteLength(plainPassword, 'utf8') > MAX_PASSWORD_BYTES) {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch (error) {
    return false;
  }
};

module.exports = {
  SALT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  MAX_PASSWORD_LENGTH,
  validatePasswordPolicy,
  hashPassword,
  comparePassword
};
