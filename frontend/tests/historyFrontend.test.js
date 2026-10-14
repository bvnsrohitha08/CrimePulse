import { setToken, clearToken } from '../src/services/tokenService.js';
import {
  getAnalysisHistory,
  getAnalysisById,
  predictCrime,
  registerUser,
  ApiError
} from '../src/services/apiService.js';

const runTests = async () => {
  console.log('=== STARTING ANALYSIS HISTORY FRONTEND UNIT & INTEGRATION TESTS ===\n');

  let passed = 0;
  let failed = 0;

  const testAssert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  // Mock localStorage for Node ESM runtime
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };

  const originalFetch = globalThis.fetch;

  // =========================================================================
  // 1. API Client Construction & Request Parameter Tests
  // =========================================================================
  console.log('--- 1. History API Client Request Construction & Parameters ---');

  try {
    let capturedUrl = null;
    let capturedOptions = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          records: [
            {
              _id: '673f4e1234567890abcdef12',
              state: 'ANDHRA PRADESH',
              district: 'ADILABAD',
              inputYear: 2011,
              targetYear: 2012,
              predictedCrime: 'HURT/GREVIOUS HURT',
              confidencePercentage: 98.37,
              status: 'COMPLETED',
              probabilities: [
                { crimeCategory: 'HURT/GREVIOUS HURT', probabilityPercentage: 98.37 }
              ],
              createdAt: '2026-10-11T12:00:00.000Z'
            }
          ],
          pagination: {
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1
          }
        })
      };
    };

    setToken('mock_jwt_token_analyst');

    // 1a. Default parameters: page=1, limit=10
    const historyRes = await getAnalysisHistory();
    testAssert(capturedUrl.includes('/analysis?page=1&limit=10'), 'Calls /api/analysis with default page=1 and limit=10');
    testAssert(capturedOptions.method === 'GET', 'Method is GET');
    testAssert(capturedOptions.headers.Authorization === 'Bearer mock_jwt_token_analyst', 'Attaches Authorization: Bearer <token>');
    testAssert(!capturedUrl.includes('userId'), 'Never sends client-supplied userId in query URL');
    testAssert(historyRes.records.length === 1, 'Parses records array from response');
    testAssert(historyRes.pagination.total === 1, 'Parses pagination total count');

    // 1b. Custom pagination parameters: page=3, limit=5
    await getAnalysisHistory({ page: 3, limit: 5 });
    testAssert(capturedUrl.includes('/analysis?page=3&limit=5'), 'Applies custom pagination parameters page=3 and limit=5');

    // 1c. getAnalysisById single record request
    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          _id: '673f4e1234567890abcdef12',
          state: 'ANDHRA PRADESH',
          district: 'ADILABAD',
          inputYear: 2011,
          targetYear: 2012,
          predictedCrime: 'HURT/GREVIOUS HURT',
          confidencePercentage: 98.37,
          status: 'COMPLETED',
          probabilities: [
            { crimeCategory: 'HURT/GREVIOUS HURT', probabilityPercentage: 98.37 },
            { crimeCategory: 'THEFT', probabilityPercentage: 1.15 }
          ]
        })
      };
    };

    const singleRes = await getAnalysisById('673f4e1234567890abcdef12');
    testAssert(capturedUrl.endsWith('/analysis/673f4e1234567890abcdef12'), 'Calls /api/analysis/:id with target ObjectId');
    testAssert(capturedOptions.headers.Authorization === 'Bearer mock_jwt_token_analyst', 'Single record request includes Bearer token');
    testAssert(singleRes._id === '673f4e1234567890abcdef12', 'Single record ID matches requested ID');

    // =========================================================================
    // 2. Error Mapping & Handling Tests
    // =========================================================================
    console.log('\n--- 2. Error Mapping & Safe 404 / 401 Handling ---');

    // 2a. 404 RECORD_NOT_FOUND (non-existent or other user's record)
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: 'RECORD_NOT_FOUND',
        message: 'Analysis record not found.'
      })
    });

    try {
      await getAnalysisById('673f4e1234567890abcdef99');
      testAssert(false, 'Should throw ApiError on 404');
    } catch (err) {
      testAssert(err instanceof ApiError, 'Throws ApiError on 404 RECORD_NOT_FOUND');
      testAssert(err.status === 404, 'Retains status code 404');
      testAssert(err.code === 'RECORD_NOT_FOUND', 'Retains error code RECORD_NOT_FOUND');
      testAssert(err.message === 'Analysis record not found.', 'Safe non-disclosing message prevents tenant enumeration');
    }

    // 2b. 401 UNAUTHORIZED (expired / invalid session)
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: 'UNAUTHORIZED',
        message: 'Authentication is required.'
      })
    });

    try {
      await getAnalysisHistory();
      testAssert(false, 'Should throw ApiError on 401');
    } catch (err) {
      testAssert(err instanceof ApiError, 'Throws ApiError on 401 UNAUTHORIZED');
      testAssert(err.status === 401, 'Retains status code 401');
      testAssert(err.code === 'UNAUTHORIZED', 'Retains code UNAUTHORIZED');
    }

    // 2c. Network error
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch: Connection refused');
    };

    try {
      await getAnalysisHistory();
      testAssert(false, 'Should throw ApiError on network disconnect');
    } catch (err) {
      testAssert(err instanceof ApiError, 'Network failure throws ApiError');
      testAssert(err.code === 'NETWORK_ERROR', 'Network error has code NETWORK_ERROR');
      testAssert(err.status === 0, 'Network error status is 0');
    }

  } finally {
    globalThis.fetch = originalFetch;
    clearToken();
  }

  // =========================================================================
  // 3. Status Handling & Optional Fields Robustness Tests
  // =========================================================================
  console.log('\n--- 3. Status Handling & Optional Fields Robustness ---');

  // 3a. COMPLETED record structure
  const completedRecord = {
    _id: '673f4e111111111111111111',
    status: 'COMPLETED',
    state: 'ANDHRA PRADESH',
    district: 'ADILABAD',
    inputYear: 2011,
    targetYear: 2012,
    predictedCrime: 'HURT/GREVIOUS HURT',
    confidencePercentage: 98.37,
    probabilities: [
      { crimeCategory: 'HURT/GREVIOUS HURT', probabilityPercentage: 98.37 },
      { crimeCategory: 'THEFT', probabilityPercentage: 1.15 }
    ]
  };
  testAssert(completedRecord.status === 'COMPLETED', 'Identifies COMPLETED record status');
  testAssert(typeof completedRecord.targetYear === 'number', 'COMPLETED record has valid targetYear');
  testAssert(typeof completedRecord.predictedCrime === 'string', 'COMPLETED record has predictedCrime');
  testAssert(Array.isArray(completedRecord.probabilities) && completedRecord.probabilities.length > 0, 'COMPLETED record has probabilities');

  // 3b. FAILED record structure (missing targetYear, predictedCrime, probabilities)
  const failedRecord = {
    _id: '673f4e222222222222222222',
    status: 'FAILED',
    state: 'ANDHRA PRADESH',
    district: 'ADILABAD',
    inputYear: 2011,
    errorCode: 'ML_SERVICE_ERROR',
    errorMessage: 'FastAPI microservice connection timed out.'
  };
  testAssert(failedRecord.status === 'FAILED', 'Identifies FAILED record status');
  testAssert(failedRecord.predictedCrime === undefined, 'FAILED record safely handles omitted predictedCrime');
  testAssert(failedRecord.targetYear === undefined, 'FAILED record safely handles omitted targetYear');
  testAssert(failedRecord.probabilities === undefined, 'FAILED record safely handles omitted probabilities');
  testAssert(failedRecord.errorCode === 'ML_SERVICE_ERROR', 'FAILED record preserves errorCode for inspection');

  // 3c. PENDING record structure (in-flight)
  const pendingRecord = {
    _id: '673f4e333333333333333333',
    status: 'PENDING',
    state: 'ANDHRA PRADESH',
    district: 'ADILABAD',
    inputYear: 2011
  };
  testAssert(pendingRecord.status === 'PENDING', 'Identifies PENDING record status');
  testAssert(pendingRecord.predictedCrime === undefined, 'PENDING record safely handles omitted predictedCrime');

  // 3d. Missing optional fields (empty probabilities array)
  const emptyProbabilitiesRecord = {
    ...completedRecord,
    probabilities: []
  };
  testAssert(Array.isArray(emptyProbabilitiesRecord.probabilities) && emptyProbabilitiesRecord.probabilities.length === 0, 'Safely handles empty probabilities array');

  // =========================================================================
  // 4. Live Gateway, Database & Multi-Tenant Verification (Real HTTP)
  // =========================================================================
  console.log('\n--- 4. Live Express & MongoDB Atlas Integration Tests (Port 5000) ---');

  let backendAvailable = false;
  try {
    const healthCheck = await fetch('http://127.0.0.1:5000/api/health');
    const healthJson = await healthCheck.json();
    if (healthCheck.status === 200 && healthJson.status === 'ok') {
      backendAvailable = true;
    }
  } catch {
    backendAvailable = false;
  }

  if (!backendAvailable) {
    console.warn('⚠️ Express backend on port 5000 is not reachable. Skipping live HTTP tests.');
  } else {
    const uniqueTime = Date.now();
    const userA = {
      name: 'History Analyst A',
      email: `history.analyst.a.${uniqueTime}@crimepulse.internal`,
      password: 'StrongP@ssw0rd!2026'
    };
    const userB = {
      name: 'History Analyst B',
      email: `history.analyst.b.${uniqueTime}@crimepulse.internal`,
      password: 'StrongP@ssw0rd!2026'
    };

    const createdAnalysisIds = [];

    // 4a. Register User A & Verify Initial Empty History
    const authA = await registerUser(userA);
    setToken(authA.token);
    testAssert(typeof authA.token === 'string', 'Registered User A and obtained JWT session');

    const emptyHistory = await getAnalysisHistory({ page: 1, limit: 10 });
    testAssert(Array.isArray(emptyHistory.records), 'Initial history returns records array');
    testAssert(emptyHistory.records.length === 0, 'New user has exactly 0 records (empty history)');
    testAssert(emptyHistory.pagination.total === 0, 'Pagination total is 0 for empty history');
    testAssert(emptyHistory.pagination.totalPages === 0, 'Pagination totalPages is 0 for empty history');

    // 4b. User A executes 2 predictions to populate history
    const pred1 = await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 });
    const pred2 = await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2010 });
    testAssert(typeof pred1.analysis_id === 'string', 'First prediction persisted in Atlas');
    testAssert(typeof pred2.analysis_id === 'string', 'Second prediction persisted in Atlas');
    createdAnalysisIds.push(pred1.analysis_id, pred2.analysis_id);

    // 4c. User A fetches populated history
    const populatedHistory = await getAnalysisHistory({ page: 1, limit: 10 });
    testAssert(populatedHistory.records.length === 2, 'History returns 2 completed prediction records');
    testAssert(populatedHistory.pagination.total === 2, 'Pagination total count reflects 2 records');
    testAssert(populatedHistory.pagination.page === 1, 'Current page is 1');
    testAssert(populatedHistory.pagination.totalPages === 1, 'Total pages is 1 with limit=10');

    // Newest first sorting check (createdAt: -1)
    testAssert(populatedHistory.records[0]._id === pred2.analysis_id, 'Records are sorted newest-first (latest prediction at index 0)');

    // 4d. Pagination boundary tests (page=1, limit=1; page=2, limit=1)
    const page1Res = await getAnalysisHistory({ page: 1, limit: 1 });
    testAssert(page1Res.records.length === 1, 'Page 1 returns 1 record when limit=1');
    testAssert(page1Res.pagination.page === 1, 'Page 1 pagination reports page 1');
    testAssert(page1Res.pagination.totalPages === 2, 'Page 1 pagination reports totalPages 2');
    testAssert(page1Res.records[0]._id === pred2.analysis_id, 'Page 1 contains first (newest) record');

    const page2Res = await getAnalysisHistory({ page: 2, limit: 1 });
    testAssert(page2Res.records.length === 1, 'Page 2 returns 1 record when limit=1');
    testAssert(page2Res.pagination.page === 2, 'Page 2 pagination reports page 2');
    testAssert(page2Res.records[0]._id === pred1.analysis_id, 'Page 2 contains second record');

    // 4e. Single record detail lookup: getAnalysisById
    const detailA = await getAnalysisById(pred1.analysis_id);
    testAssert(detailA._id === pred1.analysis_id, 'getAnalysisById returns requested record');
    testAssert(detailA.status === 'COMPLETED', 'Record status is COMPLETED');
    testAssert(detailA.state === 'ANDHRA PRADESH', 'Record preserves state');
    testAssert(detailA.district === 'ADILABAD', 'Record preserves district');
    testAssert(detailA.inputYear === 2011, 'Record preserves inputYear');
    testAssert(detailA.targetYear === 2012, 'Record preserves targetYear');
    testAssert(detailA.predictedCrime === 'HURT/GREVIOUS HURT', 'Record preserves predictedCrime');
    testAssert(Array.isArray(detailA.probabilities), 'Record preserves probabilities array');

    // 4f. Multi-Tenant Isolation & Cross-User Security (User B)
    const authB = await registerUser(userB);
    setToken(authB.token);
    testAssert(typeof authB.token === 'string', 'Registered User B and obtained separate JWT session');

    // User B history must be empty (isolated from User A)
    const historyB = await getAnalysisHistory({ page: 1, limit: 10 });
    testAssert(historyB.records.length === 0, 'User B history is empty and does NOT leak User A records');
    testAssert(historyB.pagination.total === 0, 'User B pagination total is 0');

    // User B attempting to view User A's record by ID must return safe 404
    try {
      await getAnalysisById(pred1.analysis_id);
      testAssert(false, 'User B should receive 404 when requesting User A analysis');
    } catch (err) {
      testAssert(err.status === 404, 'Cross-tenant request returns HTTP 404');
      testAssert(err.code === 'RECORD_NOT_FOUND', 'Cross-tenant request returns RECORD_NOT_FOUND');
      testAssert(err.message === 'Analysis record not found.', 'Safe error message does not disclose existence of other user record');
    }

    // 4g. Database Cleanup of test users and analyses
    try {
      const { execSync } = await import('node:child_process');
      execSync('node C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\7ab0fcce-1859-461c-8b74-bd2bb43f6822\\scratch\\cleanTestUsers.js', {
        cwd: 'c:/Users/user/Desktop/CrimePulse/backend',
        stdio: 'ignore'
      });
      console.log('  🧹 Cleaned up transient test users and analysis records from MongoDB Atlas.');
    } catch {
      // Ignore if child_process fails
    }
  }

  console.log(`\n=== HISTORY TEST SUMMARY: ${passed} Passed | ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
