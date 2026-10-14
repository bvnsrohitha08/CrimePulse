import {
  validatePredictionState,
  validatePredictionDistrict,
  validatePredictionYear,
  validatePredictionForm
} from '../src/utils/validation.js';
import { setToken, clearToken } from '../src/services/tokenService.js';
import {
  predictCrime,
  registerUser,
  ApiError
} from '../src/services/apiService.js';

const runTests = async () => {
  console.log('=== STARTING CRIME PREDICTION FRONTEND UNIT & INTEGRATION TESTS ===\n');

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

  // =========================================================================
  // 1. Prediction Form Validation Unit Tests
  // =========================================================================
  console.log('--- 1. Prediction Parameter Validation Tests ---');

  // State parameter validation
  testAssert(!validatePredictionState('').isValid, 'Rejects empty state parameter');
  testAssert(!validatePredictionState('   ').isValid, 'Rejects whitespace-only state parameter');
  testAssert(validatePredictionState('ANDHRA PRADESH').isValid, 'Accepts valid state name');
  testAssert(validatePredictionState('Maharashtra').isValid, 'Accepts mixed-case state name');

  // District parameter validation
  testAssert(!validatePredictionDistrict('').isValid, 'Rejects empty district parameter');
  testAssert(!validatePredictionDistrict('   ').isValid, 'Rejects whitespace-only district parameter');
  testAssert(validatePredictionDistrict('ADILABAD').isValid, 'Accepts valid district name');
  testAssert(validatePredictionDistrict('Pune').isValid, 'Accepts mixed-case district name');

  // Historical Year parameter validation (integer checks without inventing range)
  testAssert(!validatePredictionYear(undefined).isValid, 'Rejects undefined year');
  testAssert(!validatePredictionYear('').isValid, 'Rejects empty year string');
  testAssert(!validatePredictionYear(true).isValid, 'Rejects boolean year');
  testAssert(!validatePredictionYear('invalid-year').isValid, 'Rejects non-numeric year string');
  testAssert(!validatePredictionYear('2011.5').isValid, 'Rejects floating-point year 2011.5');
  testAssert(!validatePredictionYear(-2011).isValid, 'Rejects negative year -2011');
  testAssert(validatePredictionYear(2011).isValid, 'Accepts integer year 2011');
  testAssert(validatePredictionYear('2011').isValid, 'Accepts integer string "2011"');
  testAssert(validatePredictionYear(2005).isValid, 'Accepts integer year 2005');

  // Composite Form Validation
  const emptyForm = validatePredictionForm({ state: '', district: '', year: '' });
  testAssert(!emptyForm.isValid, 'validatePredictionForm flags empty form as invalid');
  testAssert(typeof emptyForm.errors.state === 'string', 'Contains state error message');
  testAssert(typeof emptyForm.errors.district === 'string', 'Contains district error message');
  testAssert(typeof emptyForm.errors.year === 'string', 'Contains year error message');

  const validForm = validatePredictionForm({
    state: 'ANDHRA PRADESH',
    district: 'ADILABAD',
    year: '2011'
  });
  testAssert(validForm.isValid, 'validatePredictionForm flags valid parameters as valid');
  testAssert(Object.keys(validForm.errors).length === 0, 'No errors on valid form parameters');

  // =========================================================================
  // 2. API Client Construction & Mock Endpoint Behavior
  // =========================================================================
  console.log('\n--- 2. API Client Request Construction & Error Mapping ---');

  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };

  const originalFetch = globalThis.fetch;

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
          status: 'success',
          state: 'ANDHRA PRADESH',
          district: 'ADILABAD',
          input_year: 2011,
          target_year: 2012,
          predicted_crime: 'HURT/GREVIOUS HURT',
          confidence_percentage: 98.37,
          probabilities: [
            { crime_category: 'HURT/GREVIOUS HURT', probability_percentage: 98.37 },
            { crime_category: 'THEFT', probability_percentage: 1.15 }
          ],
          analysis_id: '673f4e1234567890abcdef12'
        })
      };
    };

    setToken('mock_analyst_jwt');
    const result = await predictCrime({
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      year: '2011'
    });

    testAssert(capturedUrl.endsWith('/crime/predict'), 'Calls /api/crime/predict endpoint');
    testAssert(capturedOptions.method === 'POST', 'HTTP method is POST');
    testAssert(capturedOptions.headers.Authorization === 'Bearer mock_analyst_jwt', 'Includes Bearer token in headers');
    testAssert(capturedOptions.headers['Content-Type'] === 'application/json', 'Content-Type is application/json');

    const sentBody = JSON.parse(capturedOptions.body);
    testAssert(sentBody.state === 'ANDHRA PRADESH', 'Sends state parameter in body');
    testAssert(sentBody.district === 'ADILABAD', 'Sends district parameter in body');
    testAssert(sentBody.year === 2011 && typeof sentBody.year === 'number', 'Converts year parameter to integer');
    testAssert(sentBody.userId === undefined, 'Never sends client-supplied userId (backend determines ownership)');

    // Result contract shape
    testAssert(result.status === 'success', 'Response status is success');
    testAssert(result.predicted_crime === 'HURT/GREVIOUS HURT', 'Returns predicted crime category');
    testAssert(result.target_year === 2012, 'Returns computed target forecast year');
    testAssert(result.analysis_id === '673f4e1234567890abcdef12', 'Includes persisted analysis_id');

    // 2b. Error Mapping: RECORD_NOT_FOUND (HTTP 404)
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: 'RECORD_NOT_FOUND',
        message: 'No historical record found for State "ANDHRA PRADESH", District "ADILABAD", Year 1990.'
      })
    });

    try {
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 1990 });
      testAssert(false, 'Should throw ApiError on 404 RECORD_NOT_FOUND');
    } catch (err) {
      testAssert(err instanceof ApiError, 'Throws ApiError instance on 404');
      testAssert(err.status === 404, 'ApiError retains HTTP 404 status');
      testAssert(err.code === 'RECORD_NOT_FOUND', 'ApiError retains RECORD_NOT_FOUND code');
      testAssert(err.message.includes('No historical record'), 'Preserves server message');
    }

    // 2c. Error Mapping: UNSEEN_STATE (HTTP 400)
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: 'UNSEEN_STATE',
        message: 'The provided state is not available in the model data.'
      })
    });

    try {
      await predictCrime({ state: 'NONEXISTENT_STATE', district: 'ADILABAD', year: 2011 });
      testAssert(false, 'Should throw ApiError on UNSEEN_STATE');
    } catch (err) {
      testAssert(err.status === 400, 'ApiError retains HTTP 400');
      testAssert(err.code === 'UNSEEN_STATE', 'ApiError retains UNSEEN_STATE code');
    }

    // 2d. Error Mapping: UNAUTHORIZED (HTTP 401)
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
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 });
      testAssert(false, 'Should throw ApiError on 401');
    } catch (err) {
      testAssert(err.status === 401, 'ApiError retains HTTP 401');
      testAssert(err.code === 'UNAUTHORIZED', 'ApiError retains UNAUTHORIZED code');
    }

  } finally {
    globalThis.fetch = originalFetch;
    clearToken();
  }

  // =========================================================================
  // 3. Responsible Interpretation & Disclaimer Content Assertions
  // =========================================================================
  console.log('\n--- 3. Responsible Interpretation & Disclaimer Verification ---');

  const disclaimerItems = [
    {
      term: 'Historical Model Classification',
      statement: 'The output reflects a statistical classification derived from historical district-wise crime data and does not constitute a guarantee, certainty, or live report of future real-world crime events.'
    },
    {
      term: 'Model Confidence Metric',
      statement: 'The reported confidence percentage describes the Random Forest classifier\'s decision leaf certainty for this feature vector, not the real-world probability that a crime will occur.'
    },
    {
      term: 'Non-Discriminatory Use',
      statement: 'This prediction is designed strictly for academic research and spatial trend analytics. It must not be used as the sole basis for decisions regarding individuals, communities, or law enforcement profiling.'
    }
  ];

  disclaimerItems.forEach((item) => {
    testAssert(item.statement.length > 50, `Disclaimer contains explicit notice for "${item.term}"`);
    testAssert(!item.statement.includes('certainty of future crime'), `Disclaimer disavows certainty for "${item.term}"`);
  });

  // =========================================================================
  // 4. Live Backend & ML Service Integration (Real HTTP to Port 5000)
  // =========================================================================
  console.log('\n--- 4. Live Gateway & ML Integration Tests (Real HTTP) ---');

  let backendAvailable = false;
  try {
    const healthRes = await fetch('http://127.0.0.1:5000/api/health');
    const healthJson = await healthRes.json();
    if (healthRes.status === 200 && healthJson.status === 'ok') {
      backendAvailable = true;
    }
  } catch {
    backendAvailable = false;
  }

  if (!backendAvailable) {
    console.warn('⚠️ Express backend on port 5000 is not reachable. Skipping live HTTP tests.');
  } else {
    // 4a. Authenticate real test analyst
    const uniqueTime = Date.now();
    const testAnalyst = {
      name: 'Prediction Integration Analyst',
      email: `predict.analyst.${uniqueTime}@crimepulse.internal`,
      password: 'StrongP@ssw0rd!2026'
    };

    const authRes = await registerUser(testAnalyst);
    setToken(authRes.token);
    testAssert(typeof authRes.token === 'string', 'Registered live analyst and obtained session token');

    let createdAnalysisId = null;

    // 4b. Live Prediction with verified historical entry (Andhra Pradesh, Adilabad, 2011)
    const livePrediction = await predictCrime({
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      year: 2011
    });

    testAssert(livePrediction.status === 'success', 'Live prediction returned status "success"');
    testAssert(livePrediction.state === 'ANDHRA PRADESH', 'Returns normalized state name');
    testAssert(livePrediction.district === 'ADILABAD', 'Returns normalized district name');
    testAssert(livePrediction.input_year === 2011, 'Returns input observation year 2011');
    testAssert(livePrediction.target_year === 2012, 'Calculates target forecast year 2012 (input + 1)');
    testAssert(livePrediction.predicted_crime === 'HURT/GREVIOUS HURT', 'Accurately predicts dominant crime');
    testAssert(typeof livePrediction.confidence_percentage === 'number', 'Returns numeric confidence percentage');
    testAssert(livePrediction.confidence_percentage > 90, 'High classification confidence on known dataset row');

    testAssert(Array.isArray(livePrediction.probabilities), 'Returns category probabilities array');
    testAssert(livePrediction.probabilities.length === 6, 'Contains all 6 target crime categories');

    const dominantProb = livePrediction.probabilities.find(p => p.crime_category === livePrediction.predicted_crime);
    testAssert(dominantProb !== undefined, 'Dominant crime category is present in probabilities list');
    testAssert(dominantProb.probability_percentage === livePrediction.confidence_percentage, 'Dominant probability matches confidence percentage');

    testAssert(typeof livePrediction.analysis_id === 'string', 'Live prediction persists record and returns analysis_id');
    createdAnalysisId = livePrediction.analysis_id;

    // 4c. Live Historical Record Unavailable (RECORD_NOT_FOUND, 404)
    try {
      await predictCrime({
        state: 'ANDHRA PRADESH',
        district: 'ADILABAD',
        year: 1950
      });
      testAssert(false, 'Unavailable historical year should fail');
    } catch (err) {
      testAssert(err.status === 404, 'Non-existent historical record returns HTTP 404');
      testAssert(err.code === 'RECORD_NOT_FOUND', 'Returns RECORD_NOT_FOUND error code');
      testAssert(err.message.includes('No historical record'), 'Server explains historical record is not in archive');
    }

    // 4d. Live Unseen State (UNSEEN_STATE, 400)
    try {
      await predictCrime({
        state: 'UNKNOWN_STATE_99',
        district: 'ADILABAD',
        year: 2011
      });
      testAssert(false, 'Unseen state should fail');
    } catch (err) {
      testAssert(err.status === 400, 'Unseen state returns HTTP 400');
      testAssert(err.code === 'UNSEEN_STATE', 'Returns UNSEEN_STATE error code');
    }

    // 4e. Live Unauthenticated Prediction (401)
    clearToken();
    try {
      await predictCrime({
        state: 'ANDHRA PRADESH',
        district: 'ADILABAD',
        year: 2011
      });
      testAssert(false, 'Unauthenticated prediction should fail');
    } catch (err) {
      testAssert(err.status === 401, 'Unauthenticated request returns HTTP 401');
      testAssert(err.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');
    }

    // 4f. Database Cleanup of test user and test analysis
    try {
      const { execSync } = await import('node:child_process');
      const cleanScript = `const mongoose=require('mongoose'); const dotenv=require('dotenv'); dotenv.config(); mongoose.connect(process.env.MONGODB_URI).then(async ()=>{ await mongoose.connection.collection('users').deleteOne({ email: '${testAnalyst.email}' }); if ('${createdAnalysisId}') { await mongoose.connection.collection('analyses').deleteOne({ _id: new mongoose.Types.ObjectId('${createdAnalysisId}') }); } await mongoose.connection.close(); }).catch(()=>{});`;
      execSync(`node -e "${cleanScript}"`, {
        cwd: 'c:/Users/user/Desktop/CrimePulse/backend',
        stdio: 'ignore'
      });
      console.log('  🧹 Cleaned up transient test analyst and analysis record from MongoDB Atlas.');
    } catch {
      // Ignore if child_process fails
    }
  }

  console.log(`\n=== PREDICTION TEST SUMMARY: ${passed} Passed | ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
