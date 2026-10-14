const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Analysis = require('../src/models/Analysis');
const { connectDB } = require('../src/config/db');

const runEndToEndIntegration = async () => {
  console.log('=== CRIME_PULSE PHASE 5 PART 4: END-TO-END INTEGRATION VERIFICATION ===\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  const API_BASE = 'http://127.0.0.1:5000/api';
  const ML_BASE = 'http://127.0.0.1:8000';

  // Track created artifacts strictly for guaranteed cleanup
  const createdUserIds = [];
  const createdAnalysisIds = [];

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Service Verification & Health Checks
    // -------------------------------------------------------------------------
    console.log('--- 1. Service Verification & Live Health Checks ---');

    // 1a. FastAPI Service Health
    let mlHealth;
    try {
      const mlRes = await fetch(`${ML_BASE}/health`);
      mlHealth = await mlRes.json();
      assert(mlRes.status === 200, 'FastAPI /health returned HTTP 200');
      assert(mlHealth.status === 'ok', 'FastAPI health status is "ok"');
      assert(mlHealth.model_loaded === true, 'FastAPI confirms Random Forest model is loaded in memory');
    } catch (err) {
      console.error('❌ FastAPI service is unavailable on port 8000:', err.message);
      process.exit(1);
    }

    // 1b. Express Gateway Health
    let beHealth;
    try {
      const beRes = await fetch(`${API_BASE}/health`);
      beHealth = await beRes.json();
      assert(beRes.status === 200, 'Express /api/health returned HTTP 200');
      assert(beHealth.status === 'ok', 'Express health status is "ok"');
    } catch (err) {
      console.error('❌ Express server is unavailable on port 5000:', err.message);
      process.exit(1);
    }

    // 1c. Express Database Health
    let dbHealth;
    try {
      const dbRes = await fetch(`${API_BASE}/health/db`);
      dbHealth = await dbRes.json();
      assert(dbRes.status === 200, 'Express /api/health/db returned HTTP 200');
      assert(dbHealth.status === 'ok' && dbHealth.database === 'connected', 'Express confirms MongoDB Atlas is connected');
    } catch (err) {
      console.error('❌ Express database health check failed:', err.message);
      process.exit(1);
    }

    // 1d. Direct Connection to Atlas for Ground Truth Verification
    const directConnected = await connectDB();
    assert(directConnected, 'Direct verification connection to MongoDB Atlas established');

    // -------------------------------------------------------------------------
    // Phase 2: User A Registration & Authentication Flow
    // -------------------------------------------------------------------------
    console.log('\n--- 2. User A Registration & Real Authentication ---');

    const timestamp = Date.now();
    const userAPayload = {
      name: 'E2E Verification Analyst A',
      email: `e2e.analyst.a.${timestamp}@crimepulse.internal`,
      password: 'StrongP@ssw0rd!2026'
    };

    const regResA = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userAPayload)
    });

    const regDataA = await regResA.json();
    assert(regResA.status === 201, 'User A registered with HTTP 201');
    assert(typeof regDataA.token === 'string' && regDataA.token.length > 20, 'Obtained real JWT token upon registration');
    assert(regDataA.user && regDataA.user.id, 'User A object returned with valid ID');
    assert(regDataA.user.passwordHash === undefined, 'passwordHash strictly excluded from registration response');

    const userAId = regDataA.user.id || regDataA.user._id;
    const tokenA = regDataA.token;
    createdUserIds.push(userAId);

    // Verify User A can also log in through real login endpoint
    const loginResA = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAPayload.email,
        password: userAPayload.password
      })
    });
    const loginDataA = await loginResA.json();
    assert(loginResA.status === 200, 'User A logged in with HTTP 200');
    assert(typeof loginDataA.token === 'string', 'Login returns valid JWT');

    // Verify User A profile with /api/auth/me
    const meResA = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const meDataA = await meResA.json();
    assert(meResA.status === 200, 'User A verified via /api/auth/me with HTTP 200');
    assert(meDataA.user.id === userAId, 'Profile ID matches registered ID');

    // -------------------------------------------------------------------------
    // Phase 3: Real Authenticated Prediction & Ground-Truth Persistence
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Real Prediction Execution & Persistence Verification ---');

    const predictionPayload = {
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      year: 2011
    };

    const predRes1 = await fetch(`${API_BASE}/crime/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify(predictionPayload)
    });

    const predData1 = await predRes1.json();
    assert(predRes1.status === 200, 'Prediction request returned HTTP 200');
    assert(predData1.status === 'success', 'FastAPI prediction status is "success"');
    assert(predData1.predicted_crime === 'HURT/GREVIOUS HURT', 'Dominant predicted crime matches model output');
    assert(predData1.target_year === 2012, 'Target year is 2012 (input year + 1)');
    assert(typeof predData1.confidence_percentage === 'number' && predData1.confidence_percentage > 90, 'Confidence score returned');
    assert(Array.isArray(predData1.probabilities) && predData1.probabilities.length === 6, 'Contains full 6-category probabilities');
    assert(typeof predData1.analysis_id === 'string' && predData1.analysis_id.length === 24, 'Confirmed analysis_id returned');

    const analysisId1 = predData1.analysis_id;
    createdAnalysisIds.push(analysisId1);

    // Direct Atlas Ground Truth Verification
    const atlasDoc1 = await Analysis.findById(analysisId1);
    assert(atlasDoc1 !== null, 'Analysis document confirmed directly in MongoDB Atlas');
    assert(atlasDoc1.status === 'COMPLETED', 'Atlas document status is COMPLETED');
    assert(atlasDoc1.userId.toString() === userAId, 'Atlas document userId matches authenticated User A ID');
    assert(atlasDoc1.state === 'ANDHRA PRADESH', 'Atlas document state matches input');
    assert(atlasDoc1.predictedCrime === 'HURT/GREVIOUS HURT', 'Atlas document persisted predictedCrime');

    // -------------------------------------------------------------------------
    // Phase 4: History & Single Record Retrieval via Express
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Prediction History & Single Lookup Retrieval ---');

    // 4a. GET /api/analysis
    const historyResA = await fetch(`${API_BASE}/analysis`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const historyDataA = await historyResA.json();
    assert(historyResA.status === 200, 'GET /api/analysis returned HTTP 200');
    assert(Array.isArray(historyDataA.records), 'History returns records array');
    assert(historyDataA.records.some((r) => r._id === analysisId1), 'Saved analysis appears in User A history list');
    assert(historyDataA.pagination.total >= 1, 'Pagination reports at least 1 record');
    assert(historyDataA.pagination.page === 1, 'Pagination page defaults to 1');
    assert(historyDataA.records[0].__v === undefined, '__v field is sanitized from history');

    // 4b. GET /api/analysis/:id
    const singleResA = await fetch(`${API_BASE}/analysis/${analysisId1}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const singleDataA = await singleResA.json();
    assert(singleResA.status === 200, 'GET /api/analysis/:id returned HTTP 200');
    assert(singleDataA._id === analysisId1, 'Returned single analysis ID matches');
    assert(singleDataA.predictedCrime === 'HURT/GREVIOUS HURT', 'Returned single analysis data matches');
    assert(singleDataA.__v === undefined, '__v field is sanitized from single lookup');

    // -------------------------------------------------------------------------
    // Phase 5: Unauthenticated Rejection & Non-Persistence
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Unauthenticated Request Rejection Verification ---');

    const preUnauthCount = await Analysis.countDocuments();

    const unauthRes = await fetch(`${API_BASE}/crime/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(predictionPayload)
    });
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');
    assert(unauthData.error === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED');

    const postUnauthCount = await Analysis.countDocuments();
    assert(postUnauthCount === preUnauthCount, 'No Analysis document was created in MongoDB Atlas for unauthenticated request');

    // -------------------------------------------------------------------------
    // Phase 6: Cross-Tenant Isolation & Anti-Enumeration (User B)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Cross-User Tenant Isolation & Safe 404s ---');

    const userBPayload = {
      name: 'E2E Verification Analyst B',
      email: `e2e.analyst.b.${timestamp}@crimepulse.internal`,
      password: 'StrongP@ssw0rd!2026B'
    };

    const regResB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userBPayload)
    });
    const regDataB = await regResB.json();
    assert(regResB.status === 201, 'User B registered with HTTP 201');

    const userBId = regDataB.user.id || regDataB.user._id;
    const tokenB = regDataB.token;
    createdUserIds.push(userBId);

    // User B history must NOT contain User A's records
    const historyResB = await fetch(`${API_BASE}/analysis`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const historyDataB = await historyResB.json();
    assert(historyResB.status === 200, 'User B history returns HTTP 200');
    assert(historyDataB.records.length === 0, 'User B history is empty and does NOT leak User A records');

    // User B attempts to access User A's analysis by ID
    const crossRes = await fetch(`${API_BASE}/analysis/${analysisId1}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const crossData = await crossRes.json();
    assert(crossRes.status === 404, 'User B requesting User A record returns HTTP 404');
    assert(crossData.error === 'RECORD_NOT_FOUND', 'Returns RECORD_NOT_FOUND error code');

    // User B requests a genuinely non-existent record ID
    const nonExistentId = '661840000000000000000999';
    const nonExistentRes = await fetch(`${API_BASE}/analysis/${nonExistentId}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const nonExistentData = await nonExistentRes.json();
    assert(nonExistentRes.status === 404, 'Non-existent ID returns HTTP 404');
    assert(crossData.error === nonExistentData.error, 'Error code is IDENTICAL between cross-tenant and nonexistent lookups');
    assert(crossData.message === nonExistentData.message, 'Error message is IDENTICAL preventing record enumeration');

    // -------------------------------------------------------------------------
    // Phase 7: Spoofed Ownership Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Spoofed Ownership Parameter Tampering Defense ---');

    // User A attempts to set userId to User B in body
    const spoofedRes = await fetch(`${API_BASE}/crime/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        ...predictionPayload,
        userId: userBId
      })
    });
    const spoofedData = await spoofedRes.json();
    assert(spoofedRes.status === 200, 'Prediction succeeds under authenticated context');

    const analysisId2 = spoofedData.analysis_id;
    createdAnalysisIds.push(analysisId2);

    const atlasDoc2 = await Analysis.findById(analysisId2);
    assert(atlasDoc2 !== null, 'Second analysis persisted in Atlas');
    assert(atlasDoc2.userId.toString() === userAId, 'Record owner is strictly bound to req.user._id (User A)');
    assert(atlasDoc2.userId.toString() !== userBId, 'Client-supplied userId: userB was completely rejected');

    // -------------------------------------------------------------------------
    // Phase 8: Comprehensive Cleanup & Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Test Data Cleanup & Verification ---');

    // Delete created Analysis records
    const deleteAnalysesRes = await Analysis.deleteMany({ _id: { $in: createdAnalysisIds } });
    assert(deleteAnalysesRes.deletedCount === createdAnalysisIds.length, `Deleted all ${createdAnalysisIds.length} created Analysis test records`);

    // Delete created User records
    const deleteUsersRes = await User.deleteMany({ _id: { $in: createdUserIds } });
    assert(deleteUsersRes.deletedCount === createdUserIds.length, `Deleted all ${createdUserIds.length} created User test records`);

    // Verify Atlas no longer contains any of the test documents
    const remainingAnalyses = await Analysis.countDocuments({ _id: { $in: createdAnalysisIds } });
    const remainingUsers = await User.countDocuments({ _id: { $in: createdUserIds } });

    assert(remainingAnalyses === 0, 'Confirmed 0 test analysis records remaining in MongoDB Atlas');
    assert(remainingUsers === 0, 'Confirmed 0 test user accounts remaining in MongoDB Atlas');

  } catch (err) {
    console.error('❌ Unexpected error during E2E verification:', err);
    failed++;
  } finally {
    // Failsafe cleanup in case of test assertion failure
    if (createdAnalysisIds.length > 0 || createdUserIds.length > 0) {
      try {
        await Analysis.deleteMany({ _id: { $in: createdAnalysisIds } });
        await User.deleteMany({ _id: { $in: createdUserIds } });
      } catch (cleanupErr) {
        console.error('⚠️ Failsafe cleanup error:', cleanupErr.message);
      }
    }
    await mongoose.connection.close();
  }

  console.log(`\n=== E2E INTEGRATION SUMMARY: ${passed} Passed | ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
};

runEndToEndIntegration();
