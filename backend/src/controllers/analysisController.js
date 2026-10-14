const mongoose = require('mongoose');
const Analysis = require('../models/Analysis');

/**
 * Validates that a string is a valid 24-character hexadecimal MongoDB ObjectId.
 *
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/analysis
 * Returns the authenticated user's prediction analysis history with pagination.
 *
 * Query parameters:
 * - page: Positive integer (default: 1)
 * - limit: Positive integer (default: 10, max: 50)
 */
const getAnalyses = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication is required.'
      });
    }

    let page = 1;
    let limit = 10;

    // Validate page parameter
    if (req.query.page !== undefined && req.query.page !== '') {
      const parsedPage = Number(req.query.page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return res.status(400).json({
          error: 'INVALID_PAGINATION',
          message: 'Page parameter must be a positive integer.'
        });
      }
      page = parsedPage;
    }

    // Validate limit parameter
    if (req.query.limit !== undefined && req.query.limit !== '') {
      const parsedLimit = Number(req.query.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        return res.status(400).json({
          error: 'INVALID_PAGINATION',
          message: 'Limit parameter must be a positive integer.'
        });
      }
      // Cap maximum limit at 50
      limit = Math.min(parsedLimit, 50);
    }

    const skip = (page - 1) * limit;

    let records;
    let total;

    try {
      [records, total] = await Promise.all([
        Analysis.find({ userId: req.user._id })
          .select('-__v')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Analysis.countDocuments({ userId: req.user._id })
      ]);
    } catch (dbErr) {
      console.error('❌ Database error during analysis history query:', dbErr.message);
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve analysis history.'
      });
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.status(200).json({
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/analysis/:id
 * Returns a single analysis record by ID only if owned by the authenticated user.
 * Returns safe 404 if the record does not exist or belongs to another user.
 */
const getAnalysisById = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication is required.'
      });
    }

    const { id } = req.params;

    // Validate ObjectId format before querying database
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Analysis ID must be a valid 24-character hexadecimal identifier.'
      });
    }

    let record;
    try {
      // Query strictly using both analysis _id and authenticated user ID
      record = await Analysis.findOne({
        _id: id,
        userId: req.user._id
      })
        .select('-__v')
        .lean();
    } catch (dbErr) {
      console.error('❌ Database error during analysis record lookup:', dbErr.message);
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to retrieve analysis record.'
      });
    }

    // Safe 404 without disclosing whether the record exists under another owner
    if (!record) {
      return res.status(404).json({
        error: 'RECORD_NOT_FOUND',
        message: 'Analysis record not found.'
      });
    }

    return res.status(200).json({
      analysis: record,
      ...record
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAnalyses,
  getAnalysisById,
  isValidObjectId
};
