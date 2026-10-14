const { isDBConnected } = require('../config/db');

/**
 * GET /api/health
 * Returns core backend service health status.
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'crimepulse-backend'
  });
};

/**
 * GET /api/health/db
 * Returns MongoDB database connection status.
 */
const getDBHealth = (req, res) => {
  const connected = isDBConnected();
  if (connected) {
    return res.status(200).json({
      status: 'ok',
      database: 'connected'
    });
  } else {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      message: 'MongoDB is not connected.'
    });
  }
};

module.exports = {
  getHealth,
  getDBHealth
};
