const mongoose = require('mongoose');

const probabilitySchema = new mongoose.Schema(
  {
    crimeCategory: {
      type: String,
      required: true
    },
    probabilityPercentage: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    district: {
      type: String,
      required: true,
      trim: true
    },
    inputYear: {
      type: Number,
      required: true
    },
    targetYear: {
      type: Number,
      required: false
    },
    predictedCrime: {
      type: String,
      required: false
    },
    confidencePercentage: {
      type: Number,
      required: false
    },
    probabilities: [probabilitySchema],
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },
    errorCode: {
      type: String,
      required: false
    },
    errorMessage: {
      type: String,
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Secondary index for time-series queries per user
analysisSchema.index({ createdAt: -1 });

const Analysis = mongoose.model('Analysis', analysisSchema);

module.exports = Analysis;
