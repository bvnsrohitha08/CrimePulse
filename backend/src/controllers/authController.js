const User = require('../models/User');
const { hashPassword, comparePassword, validatePasswordPolicy, MAX_PASSWORD_BYTES } = require('../utils/password');
const { signToken } = require('../utils/jwt');

// RFC 5322 compliant simplified email format regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sanitizes a Mongoose user document to ensure sensitive fields
 * like passwordHash and internal properties are never returned.
 *
 * @param {Object} userDoc - Mongoose user document or plain object
 * @returns {Object} Safe user representation
 */
const toSafeUser = (userDoc) => {
  const userObj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete userObj.passwordHash;
  delete userObj.__v;

  return {
    id: userObj._id ? userObj._id.toString() : undefined,
    _id: userObj._id,
    name: userObj.name,
    email: userObj.email,
    role: userObj.role,
    createdAt: userObj.createdAt,
    updatedAt: userObj.updatedAt
  };
};

/**
 * POST /api/auth/register
 * Public registration endpoint. Always assigns role 'CUSTOMER'.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    // 1. Validate name
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Name is required and must be a non-empty string.'
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Name cannot exceed 100 characters.'
      });
    }

    // 2. Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Email is required and must be a non-empty string.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 255) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'A valid email address is required.'
      });
    }

    // 3. Enforce password policy
    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.isValid) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: passwordPolicy.message
      });
    }

    // 4. Pre-check for duplicate email
    let existingUser;
    try {
      existingUser = await User.findOne({ email: normalizedEmail });
    } catch (dbFindErr) {
      console.error('❌ Database query error during registration:', dbFindErr.message);
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to process registration request.'
      });
    }

    if (existingUser) {
      return res.status(409).json({
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email address already exists.'
      });
    }

    // 5. Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // 6. Create user (Strictly enforce role: 'CUSTOMER')
    let newUser;
    try {
      newUser = await User.create({
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        role: 'CUSTOMER' // Public registration cannot escalate privileges
      });
    } catch (createErr) {
      // Handle duplicate-key race condition (MongoDB E11000)
      if (createErr.code === 11000 || (createErr.name === 'MongoServerError' && createErr.code === 11000)) {
        return res.status(409).json({
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.'
        });
      }

      console.error('❌ Database error creating user record:', createErr.message);
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to create user account.'
      });
    }

    // 7. Generate JWT
    let token;
    try {
      token = signToken({
        id: newUser._id.toString(),
        email: newUser.email,
        role: newUser.role
      });
    } catch (jwtErr) {
      console.error('❌ Authentication configuration error:', jwtErr.message);
      return res.status(500).json({
        error: 'CONFIGURATION_ERROR',
        message: 'Authentication service is currently misconfigured.'
      });
    }

    // 8. Return safe user info and token
    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: toSafeUser(newUser)
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/login
 * User login endpoint verifying credentials and returning JWT.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    // 1. Validate inputs
    if (
      !email ||
      typeof email !== 'string' ||
      !email.trim() ||
      !password ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Email and password are required.'
      });
    }

    if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: `Password cannot exceed ${MAX_PASSWORD_BYTES} bytes.`
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Find user by email and explicitly select passwordHash
    let user;
    try {
      user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    } catch (dbErr) {
      console.error('❌ Database error during login query:', dbErr.message);
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Authentication service temporarily unavailable.'
      });
    }

    // Generic error response to prevent user enumeration
    const genericAuthError = {
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    };

    if (!user) {
      return res.status(401).json(genericAuthError);
    }

    // 3. Verify password hash using bcrypt
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json(genericAuthError);
    }

    // 4. Generate JWT
    let token;
    try {
      token = signToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role
      });
    } catch (jwtErr) {
      console.error('❌ Authentication configuration error:', jwtErr.message);
      return res.status(500).json({
        error: 'CONFIGURATION_ERROR',
        message: 'Authentication service is currently misconfigured.'
      });
    }

    // 5. Return safe user info and token
    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: toSafeUser(user)
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/auth/me
 * Protected endpoint returning current authenticated user profile.
 */
const getMe = (req, res) => {
  return res.status(200).json({
    user: toSafeUser(req.user)
  });
};

module.exports = {
  register,
  login,
  getMe,
  toSafeUser
};
