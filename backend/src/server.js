const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration from .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB Atlas
  await connectDB();

  // Start Express server
  const server = app.listen(PORT, () => {
    console.log(`🚀 CrimePulse Backend API Gateway running on port ${PORT}`);
    console.log(`📍 Health Endpoint: http://127.0.0.1:${PORT}/api/health`);
    console.log(`📍 Database Health Endpoint: http://127.0.0.1:${PORT}/api/health/db`);
    console.log(`📍 Analytics Gateway: http://127.0.0.1:${PORT}/api/analytics/metadata`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use by another process.`);
      console.error(`💡 To find and terminate the process holding port ${PORT} in Windows PowerShell, run:`);
      console.error(`   Get-NetTCPConnection -LocalPort ${PORT} | Select-Object OwningProcess`);
      console.error(`   Stop-Process -Id <PID> -Force\n`);
      process.exit(1);
    } else {
      console.error(`\n❌ Server startup error:`, err);
      process.exit(1);
    }
  });
};


startServer();
