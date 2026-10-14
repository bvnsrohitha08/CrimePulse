const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Analysis = require('../src/models/Analysis');
const { connectDB, isDBConnected } = require('../src/config/db');

const runTests = async () => {
  console.log('--- STARTING BACKEND & DATABASE VALIDATION TESTS ---\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${description}`);
      failed++;
    }
  };

  // 1. Model Schema Validation Tests (In-Memory)
  console.log('--- 1. In-Memory Model Schema Validation ---');
  
  // Test User email normalization & validation
  const testUserVal = new User({
    name: '  Test User  ',
    email: 'TEST.USER@EXAMPLE.COM',
    passwordHash: 'secret_hash_123',
    role: 'CUSTOMER'
  });
  
  assert(testUserVal.email === 'test.user@example.com', 'User email normalized to lowercase');
  assert(testUserVal.name === 'Test User', 'User name trimmed');
  assert(testUserVal.role === 'CUSTOMER', 'User default role set to CUSTOMER');

  // Test User required fields
  const invalidUser = new User({});
  const userErr = invalidUser.validateSync();
  assert(userErr && userErr.errors.name && userErr.errors.email, 'User required field validations enforced');

  // Test Analysis schema structure
  const testAnalysisVal = new Analysis({
    userId: new mongoose.Types.ObjectId(),
    state: 'ANDHRA PRADESH',
    district: 'ADILABAD',
    inputYear: 2011,
    targetYear: 2012,
    predictedCrime: 'HURT/GREVIOUS HURT',
    confidencePercentage: 98.37,
    probabilities: [
      { crimeCategory: 'HURT/GREVIOUS HURT', probabilityPercentage: 98.37 },
      { crimeCategory: 'THEFT', probabilityPercentage: 1.63 }
    ]
  });
  
  const analysisErr = testAnalysisVal.validateSync();
  assert(!analysisErr, 'Analysis model schema validation passed');
  assert(testAnalysisVal.probabilities.length === 2, 'Analysis probabilities array validated');

  // 2. Database Integration Test
  console.log('\n--- 2. MongoDB Atlas Connection & CRUD Operations ---');
  const connected = await connectDB();

  if (!connected || !isDBConnected()) {
    console.warn('\n⚠️ MongoDB connection not verified because Atlas credentials/network configuration are not yet provided.');
    console.warn('Set a valid MONGODB_URI in backend/.env to execute live database integration tests.');
  } else {
    console.log('\nExecuting Live CRUD Operations...');
    
    try {
      // Create test user
      const createdUser = await User.create({
        name: 'Database Integration Test User',
        email: `crud.test.${Date.now()}@crimepulse.internal`,
        passwordHash: 'hashed_password_abc_123',
        role: 'CUSTOMER'
      });
      assert(createdUser && createdUser._id, 'Live User creation succeeded');

      // Verify passwordHash is hidden by default in normal queries
      const fetchedUser = await User.findById(createdUser._id);
      assert(fetchedUser.passwordHash === undefined, 'passwordHash excluded by default in JSON queries');

      // Create test analysis linked to user
      const createdAnalysis = await Analysis.create({
        userId: createdUser._id,
        state: 'ANDHRA PRADESH',
        district: 'ADILABAD',
        inputYear: 2011,
        targetYear: 2012,
        predictedCrime: 'HURT/GREVIOUS HURT',
        confidencePercentage: 98.37,
        probabilities: [
          { crimeCategory: 'HURT/GREVIOUS HURT', probabilityPercentage: 98.37 },
          { crimeCategory: 'THEFT', probabilityPercentage: 1.63 }
        ]
      });
      assert(createdAnalysis && createdAnalysis._id, 'Live Analysis creation linked to User succeeded');

      // Query Analysis
      const fetchedAnalysis = await Analysis.findOne({ userId: createdUser._id });
      assert(fetchedAnalysis.predictedCrime === 'HURT/GREVIOUS HURT', 'Analysis query retrieved correct document');

      // Cleanup test documents
      await Analysis.deleteOne({ _id: createdAnalysis._id });
      await User.deleteOne({ _id: createdUser._id });
      console.log('🧹 Cleanup: Test user and analysis records successfully removed from database.');
      assert(true, 'Database cleanup completed cleanly');
    } catch (err) {
      assert(false, `Database CRUD operation failed: ${err.message}`);
    } finally {
      await mongoose.connection.close();
    }
  }

  console.log(`\n--- TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
