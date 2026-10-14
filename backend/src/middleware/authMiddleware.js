const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Authentication Middleware for CrimePulse
 * Validates the JWT Bearer token in the Authorization header,
 * checks that the user still exists in MongoDB,
 * and attaches the current user context to req.user using the database role.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authorization header is required.'
      });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid authorization header format. Expected Bearer <token>.'
      });
    }

    const token = parts[1];

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtErr) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token.'
      });
    }

    const userId = decoded.id || decoded.sub;
    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid token payload: missing user identifier.'
      });
    }

    let user;
    try {
      user = await User.findById(userId);
    } catch (dbErr) {
      console.error('❌ Database error during user verification:', dbErr.message);
      return next(dbErr);
    }

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User account no longer exists.'
      });
    }

    // Attach minimal authenticated user context using current role from database
    req.user = {
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role, // Current database role takes precedence over token claim
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  authenticate
};
