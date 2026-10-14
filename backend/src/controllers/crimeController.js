const mlService = require('../services/mlService');
const Analysis = require('../models/Analysis');

/**
 * POST /api/crime/predict
 * Validates input parameters, creates a PENDING Analysis record,
 * delegates prediction to ML microservice, and updates the record
 * to COMPLETED or FAILED based on the result.
 */
const getCrimePrediction = async (req, res, next) => {
  try {
    // Enforce authenticated user context
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication is required.'
      });
    }

    const { state, district, year } = req.body || {};

    if (!state || typeof state !== 'string' || !state.trim()) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'State parameter is required and must be a non-empty string.'
      });
    }

    if (!district || typeof district !== 'string' || !district.trim()) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'District parameter is required and must be a non-empty string.'
      });
    }

    const parsedYear = Number(year);
    if (
      year === undefined ||
      year === null ||
      typeof year === 'boolean' ||
      isNaN(parsedYear) ||
      !Number.isInteger(parsedYear)
    ) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Year parameter is required and must be a valid integer.'
      });
    }

    const normalizedState = state.trim();
    const normalizedDistrict = district.trim();

    // 1. Create a PENDING analysis record in MongoDB linked to authenticated user
    let analysisRecord = null;
    try {
      analysisRecord = await Analysis.create({
        state: normalizedState,
        district: normalizedDistrict,
        inputYear: parsedYear,
        status: 'PENDING',
        userId: req.user._id
      });
    } catch (dbError) {
      console.error('❌ Failed to create PENDING Analysis record:', dbError.message);
      return res.status(503).json({
        error: 'PERSISTENCE_ERROR',
        message: 'Failed to record prediction analysis in database.'
      });
    }

    // 2. Call ML microservice
    let prediction;
    try {
      prediction = await mlService.predictCrime({
        state: normalizedState,
        district: normalizedDistrict,
        year: parsedYear
      });
    } catch (mlError) {
      // 3. On ML service failure, attempt to update record status to FAILED
      try {
        analysisRecord.status = 'FAILED';
        analysisRecord.errorCode = mlError.code || 'ML_SERVICE_ERROR';
        analysisRecord.errorMessage = mlError.message || 'ML prediction request failed.';
        await analysisRecord.save();
      } catch (dbSaveError) {
        console.error('⚠️ Failed to update Analysis record to FAILED status:', dbSaveError.message);
        // Preserve and return original safe ML service error if saving FAILED also fails
      }

      if (mlError instanceof mlService.MLServiceError) {
        return res.status(mlError.statusCode || 500).json({
          error: mlError.code || 'ML_SERVICE_ERROR',
          message: mlError.message
        });
      }

      return next(mlError);
    }

    // 4. On prediction success, update record status to COMPLETED and save
    try {
      analysisRecord.status = 'COMPLETED';
      analysisRecord.targetYear = prediction.target_year;
      analysisRecord.predictedCrime = prediction.predicted_crime;
      analysisRecord.confidencePercentage = prediction.confidence_percentage;
      analysisRecord.probabilities = (prediction.probabilities || []).map((p) => ({
        crimeCategory: p.crime_category,
        probabilityPercentage: p.probability_percentage
      }));
      await analysisRecord.save();
    } catch (dbSaveError) {
      console.error('❌ Failed to update Analysis record to COMPLETED status:', dbSaveError.message);
      return res.status(503).json({
        error: 'PERSISTENCE_ERROR',
        message: 'Failed to persist completed prediction analysis in database.'
      });
    }

    // 5. Return FastAPI prediction response with confirmed analysis_id
    const responsePayload = {
      ...prediction,
      analysis_id: analysisRecord._id
    };

    return res.status(200).json(responsePayload);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCrimePrediction
};
