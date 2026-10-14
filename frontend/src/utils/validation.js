/**
 * Client-Side Validation Rules for CrimePulse Authentication
 * Accurately aligns with backend validation rules in backend/src/controllers/authController.js
 * and backend/src/utils/password.js.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 255;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Calculates UTF-8 byte length for a string.
 * Accurately checks bcrypt's 72-byte limit including multibyte Unicode.
 * @param {string} str
 * @returns {number}
 */
export function getUtf8ByteLength(str) {
  if (typeof str !== 'string') return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  // Fallback environment calculation
  return encodeURIComponent(str).replace(/%[A-F\d]{2}/g, 'U').length;
}

/**
 * Validates a user's name.
 * @param {string} name
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { isValid: false, message: 'Name is required and cannot be empty.' };
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { isValid: false, message: `Name cannot exceed ${MAX_NAME_LENGTH} characters.` };
  }
  return { isValid: true };
}

/**
 * Validates an email address.
 * @param {string} email
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return { isValid: false, message: 'Email address is required.' };
  }
  const trimmed = email.trim();
  if (!EMAIL_REGEX.test(trimmed) || trimmed.length > MAX_EMAIL_LENGTH) {
    return { isValid: false, message: 'Please enter a valid email address.' };
  }
  return { isValid: true };
}

/**
 * Validates a password according to backend policy (min 8 chars, max 72 UTF-8 bytes).
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { isValid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }
  const byteLength = getUtf8ByteLength(password);
  if (byteLength > MAX_PASSWORD_BYTES) {
    return { isValid: false, message: `Password cannot exceed ${MAX_PASSWORD_BYTES} bytes.` };
  }
  return { isValid: true };
}

/**
 * Validates password confirmation.
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePasswordConfirmation(password, confirmPassword) {
  if (!confirmPassword) {
    return { isValid: false, message: 'Please confirm your password.' };
  }
  if (password !== confirmPassword) {
    return { isValid: false, message: 'Passwords do not match.' };
  }
  return { isValid: true };
}

/**
 * Validates state parameter for prediction.
 * @param {string} state
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePredictionState(state) {
  if (!state || typeof state !== 'string' || !state.trim()) {
    return { isValid: false, message: 'State or Union Territory name is required.' };
  }
  return { isValid: true };
}

/**
 * Validates district parameter for prediction.
 * @param {string} district
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePredictionDistrict(district) {
  if (!district || typeof district !== 'string' || !district.trim()) {
    return { isValid: false, message: 'District name is required.' };
  }
  return { isValid: true };
}

/**
 * Validates historical observation year for prediction.
 * Follows backend integer check without inventing arbitrary range bounds.
 * @param {number|string} year
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validatePredictionYear(year) {
  if (year === undefined || year === null || (typeof year === 'string' && !year.trim())) {
    return { isValid: false, message: 'Historical observation year is required.' };
  }
  if (typeof year === 'boolean') {
    return { isValid: false, message: 'Year must be a valid integer.' };
  }
  const parsed = Number(year);
  if (isNaN(parsed) || !Number.isInteger(parsed)) {
    return { isValid: false, message: 'Year must be a valid integer.' };
  }
  if (parsed <= 0) {
    return { isValid: false, message: 'Year must be a positive integer.' };
  }
  return { isValid: true };
}

/**
 * Composite validator for prediction parameters.
 * @param {Object} params
 * @param {string} params.state
 * @param {string} params.district
 * @param {number|string} params.year
 * @returns {{ isValid: boolean, errors: { state?: string, district?: string, year?: string } }}
 */
export function validatePredictionForm({ state, district, year }) {
  const errors = {};
  const stateCheck = validatePredictionState(state);
  if (!stateCheck.isValid) errors.state = stateCheck.message;

  const districtCheck = validatePredictionDistrict(district);
  if (!districtCheck.isValid) errors.district = districtCheck.message;

  const yearCheck = validatePredictionYear(year);
  if (!yearCheck.isValid) errors.year = yearCheck.message;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
