const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const mlService = require('../src/services/mlService');
const Analysis = require('../src/models/Analysis');
const User = require('../src/models/User');
const { signToken } = require('../src/utils/jwt');

const runTests = async () => {
  console.log('--- STARTING PREDICTION API & PERSISTENCE SAFETY UNIT TESTS ---\n');

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

  // Start Express app on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/crime/predict`;

  const originalPredictCrime = mlService.predictCrime;
  const originalAnalysisCreate = Analysis.create;
  const originalUserFindById = User.findById;

  // Mock authenticated test user
  const mockUser = {
    _id: '661840000000000000000001',
    name: 'Authorized Analyst',
    email: 'analyst@crimepulse.org',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  User.findById = async (id) => {
    if (id && id.toString() === mockUser._id) {
      return { ...mockUser };
    }
    return null;
  };

  const validToken = signToken({
    id: mockUser._id,
    email: mockUser.email,
    role: mockUser.role
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${validToken}`
  };

  try {
    // 0. Unauthenticated Prediction Request is Rejected Before ML or DB Calls
    console.log('--- 0. Unauthenticated Prediction Request is Rejected ---');
    let unauthDbCalled = false;
    let unauthMlCalled = false;

    Analysis.create = async () => {
      unauthDbCalled = true;
    };
    mlService.predictCrime = async () => {
      unauthMlCalled = true;
    };

    const res0 = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 })
    });
    const data0 = await res0.json();
    assert(res0.status === 401, 'Unauthenticated request rejected with HTTP 401');
    assert(data0.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');
    assert(unauthDbCalled === false, 'Database Analysis.create NOT called on unauthenticated request');
    assert(unauthMlCalled === false, 'ML service predictCrime NOT called on unauthenticated request');

    // 1. Valid Input, Successful Prediction & Confirmed Persistence Linked to Authenticated User
    console.log('\n--- 1. Valid Authenticated Input & Confirmed Persistence ---');
    let mockAnalysisDoc = null;
    let createCalledParams = null;
    let saveCalled = false;

    Analysis.create = async (params) => {
      createCalledParams = params;
      mockAnalysisDoc = {
        _id: 'mock_analysis_id_123',
        ...params,
        save: async function () {
          saveCalled = true;
          return this;
        }
      };
      return mockAnalysisDoc;
    };

    mlService.predictCrime = async ({ state, district, year }) => {
      assert(state === 'ANDHRA PRADESH', 'Received correct state in service');
      assert(district === 'ADILABAD', 'Received correct district in service');
      assert(year === 2011, 'Received correct year in service');
      return {
        status: 'success',
        state: 'ANDHRA PRADESH',
        district: 'ADILABAD',
        input_year: 2011,
        target_year: 2012,
        predicted_crime: 'HURT/GREVIOUS HURT',
        confidence_percentage: 98.37,
        probabilities: [
          { crime_category: 'HURT/GREVIOUS HURT', probability_percentage: 98.37 }
        ]
      };
    };

    const res1 = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 })
    });

    const data1 = await res1.json();
    assert(res1.status === 200, 'Endpoint returned status 200 on confirmed persistence');
    assert(data1.predicted_crime === 'HURT/GREVIOUS HURT', 'Returned correct predicted_crime');
    assert(data1.confidence_percentage === 98.37, 'Returned correct confidence_percentage');
    assert(data1.analysis_id === 'mock_analysis_id_123', 'Returned confirmed analysis_id');

    assert(createCalledParams && createCalledParams.status === 'PENDING', 'Analysis record created with status PENDING');
    assert(createCalledParams && createCalledParams.userId === mockUser._id, 'Analysis record created with authenticated user id');
    assert(saveCalled === true, 'Analysis doc save() called after ML prediction');
    assert(mockAnalysisDoc.status === 'COMPLETED', 'Analysis record updated to status COMPLETED');
    assert(mockAnalysisDoc.targetYear === 2012, 'Analysis targetYear updated');

    // 1b. Client-Supplied userId Cannot Override Authenticated User
    console.log('\n--- 1b. Client-Supplied userId Cannot Override Authenticated User ---');
    let spoofAttemptParams = null;
    Analysis.create = async (params) => {
      spoofAttemptParams = params;
      return {
        _id: 'mock_spoof_prevented_id',
        ...params,
        save: async function () { return this; }
      };
    };

    const res1b = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        state: 'ANDHRA PRADESH',
        district: 'ADILABAD',
        year: 2011,
        userId: 'spoofed_adversary_user_id_999'
      })
    });
    assert(res1b.status === 200, 'Prediction succeeds with authenticated user');
    assert(spoofAttemptParams.userId === mockUser._id, 'Record owner is strictly bound to req.user._id, ignoring spoofed userId');

    // 2. PENDING Creation Failure Returns 503 and Does NOT Call ML Service
    console.log('\n--- 2. PENDING Creation Failure Returns 503 & Does NOT Call ML ---');
    let mlCalledOnPendingErr = false;

    Analysis.create = async () => {
      throw new Error('Database write connection lost');
    };
    mlService.predictCrime = async () => {
      mlCalledOnPendingErr = true;
    };

    const res2 = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 })
    });
    const data2 = await res2.json();
    assert(res2.status === 503, 'Returns HTTP 503 on PENDING creation failure');
    assert(data2.error === 'PERSISTENCE_ERROR', 'Error code is PERSISTENCE_ERROR');
    assert(mlCalledOnPendingErr === false, 'ML service was NOT called when PENDING creation failed');

    // 3. COMPLETED Save Failure Returns 503 Persistence Error
    console.log('\n--- 3. COMPLETED Save Failure Returns 503 Persistence Error ---');
    Analysis.create = async (params) => ({
      _id: 'mock_doc_789',
      ...params,
      save: async function () {
        throw new Error('Disk quota exceeded during save');
      }
    });

    mlService.predictCrime = async () => ({
      status: 'success',
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      input_year: 2011,
      target_year: 2012,
      predicted_crime: 'HURT/GREVIOUS HURT',
      confidence_percentage: 98.37,
      probabilities: []
    });

    const res3 = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 })
    });
    const data3 = await res3.json();
    assert(res3.status === 503, 'Returns HTTP 503 when COMPLETED save fails');
    assert(data3.error === 'PERSISTENCE_ERROR', 'Error code is PERSISTENCE_ERROR');

    // 4. ML Failure + FAILED Save Failure Preserves Original ML Error
    console.log('\n--- 4. ML Failure + FAILED Save Failure Preserves Original ML Error ---');
    Analysis.create = async (params) => ({
      _id: 'mock_failed_doc',
      ...params,
      save: async function () {
        throw new Error('Secondary DB save error');
      }
    });

    mlService.predictCrime = async () => {
      throw new mlService.MLServiceError(
        'The provided state is not available in the model data.',
        400,
        'UNSEEN_STATE'
      );
    };

    const res4 = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: 'UNKNOWN', district: 'ADILABAD', year: 2011 })
    });
    const data4 = await res4.json();
    assert(res4.status === 400, 'Preserves original ML error status 400 when FAILED save fails');
    assert(data4.error === 'UNSEEN_STATE', 'Preserves original error code UNSEEN_STATE');
    assert(data4.message === 'The provided state is not available in the model data.', 'Preserves original safe ML message');

    // 4b. Historical Record Not Found (RECORD_NOT_FOUND 404)
    console.log('\n--- 4b. Historical Record Not Found (RECORD_NOT_FOUND 404) ---');
    let failedDoc4b = null;
    Analysis.create = async (params) => {
      failedDoc4b = {
        _id: 'mock_record_4b',
        ...params,
        save: async function () { return this; }
      };
      return failedDoc4b;
    };

    mlService.predictCrime = async () => {
      throw new mlService.MLServiceError(
        'No historical record was found for the provided state, district and year.',
        404,
        'RECORD_NOT_FOUND'
      );
    };

    const res4b = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 1990 })
    });
    const data4b = await res4b.json();
    assert(res4b.status === 404, 'Returns HTTP 404 on RECORD_NOT_FOUND');
    assert(data4b.error === 'RECORD_NOT_FOUND', 'Propagates RECORD_NOT_FOUND code');
    assert(data4b.message.includes('No historical record was found'), 'Propagates safe descriptive message');
    assert(failedDoc4b && failedDoc4b.status === 'FAILED', 'Analysis status set to FAILED');
    assert(failedDoc4b && failedDoc4b.errorCode === 'RECORD_NOT_FOUND', 'Analysis errorCode set to RECORD_NOT_FOUND');

    // 5. Invalid Input Does Not Trigger Prediction or DB Creation
    console.log('\n--- 5. Invalid Input Does Not Trigger Prediction or DB Creation ---');
    let dbCreated = false;
    let mlCalled = false;

    Analysis.create = async () => {
      dbCreated = true;
    };
    mlService.predictCrime = async () => {
      mlCalled = true;
    };

    const res5 = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: '', district: 'ADILABAD', year: 2011 })
    });
    assert(res5.status === 400, 'Returns 400 for invalid input');
    assert(dbCreated === false, 'DB Analysis creation was NOT triggered on invalid input');
    assert(mlCalled === false, 'ML prediction service was NOT triggered on invalid input');

    // 6. Unexpected Internal Errors Handled
    console.log('\n--- 6. Unexpected Internal Errors Handled ---');
    Analysis.create = async (params) => ({
      _id: 'mock_doc_abc',
      ...params,
      save: async function () {
        return this;
      }
    });
    mlService.predictCrime = async () => {
      throw new Error('Unexpected internal runtime exception');
    };

    const res6 = await fetch(baseUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 })
    });
    const data6 = await res6.json();
    assert(res6.status === 500, 'Delegates to error handler middleware returning status 500');
    assert(data6.message === 'Unexpected internal runtime exception', 'Centralized error handler returns clean message');

  } finally {
    mlService.predictCrime = originalPredictCrime;
    Analysis.create = originalAnalysisCreate;
    User.findById = originalUserFindById;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n--- PREDICTION API SAFETY TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
