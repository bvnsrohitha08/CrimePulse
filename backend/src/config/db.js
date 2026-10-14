const mongoose = require('mongoose');

/**
 * Sanitizes MongoDB connection URI safely without exposing credentials.
 * Handles accidental angle brackets (<username> / <password>) and ensures target database name 'crimepulse'.
 */
const sanitizeURI = (rawUri) => {
  if (!rawUri) return '';
  let uri = rawUri.trim();

  // Strip accidental angle brackets if left around username or password
  uri = uri.replace('://<', '://').replace('>:<', ':').replace('>@', '@');

  // Ensure target database name 'crimepulse' if unspecified before query parameters
  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/crimepulse?');
  } else if (uri.endsWith('.mongodb.net/')) {
    uri = uri + 'crimepulse';
  } else if (uri.endsWith('.mongodb.net')) {
    uri = uri + '/crimepulse';
  }

  return uri;
};

/**
 * Connects to MongoDB Atlas database asynchronously using Mongoose.
 * Sanitizes logging to prevent exposing connection URI or credentials.
 */
const connectDB = async () => {
  const rawUri = process.env.MONGODB_URI;

  if (!rawUri || rawUri.includes('user_placeholder') || rawUri.includes('<username>')) {
    console.warn('⚠️ MongoDB Atlas URI is unconfigured or contains placeholders. Set a valid MONGODB_URI in backend/.env.');
    return false;
  }

  const sanitizedUri = sanitizeURI(rawUri);

  try {
    const conn = await mongoose.connect(sanitizedUri);
    console.log(`✅ MongoDB Connected: Host ${conn.connection.host} | Database: ${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    return false;
  }
};

/**
 * Helper to check current Mongoose connection status.
 * Returns true if readyState === 1 (connected).
 */
const isDBConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDB,
  isDBConnected,
  sanitizeURI
};
