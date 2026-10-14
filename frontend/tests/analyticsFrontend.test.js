import { setToken, clearToken } from '../src/services/tokenService.js';
import {
  API_ENDPOINTS
} from '../src/config/api.js';
import {
  getAnalyticsMetadata,
  getAnalyticsTrends,
  getAnalyticsCategoryDistribution,
  getAnalyticsComparison,
  getAnalyticsOlap,
  getAnalyticsModelEvaluation,
  registerUser,
  ApiError
} from '../src/services/apiService.js';

const runTests = async () => {
  console.log('=== STARTING CRIME ANALYTICS FRONTEND & GATEWAY INTEGRATION TESTS ===\n');

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

  // Mock localStorage for Node ESM runtime if not present
  if (!globalThis.localStorage) {
    const storage = new Map();
    globalThis.localStorage = {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, val) => storage.set(key, String(val)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear()
    };
  }

  // =========================================================================
  // 1. API Endpoints Configuration & Client URL Construction
  // =========================================================================
  console.log('--- 1. API Endpoints Configuration & Contract Verification ---');

  testAssert(Boolean(API_ENDPOINTS.ANALYTICS), 'API_ENDPOINTS defines ANALYTICS group');
  testAssert(API_ENDPOINTS.ANALYTICS.METADATA.endsWith('/analytics/metadata'), 'METADATA endpoint points to /analytics/metadata');
  testAssert(API_ENDPOINTS.ANALYTICS.TRENDS.endsWith('/analytics/trends'), 'TRENDS endpoint points to /analytics/trends');
  testAssert(API_ENDPOINTS.ANALYTICS.CATEGORY_DISTRIBUTION.endsWith('/analytics/category-distribution'), 'CATEGORY_DISTRIBUTION endpoint configured');
  testAssert(API_ENDPOINTS.ANALYTICS.COMPARISON.endsWith('/analytics/comparison'), 'COMPARISON endpoint configured');
  testAssert(API_ENDPOINTS.ANALYTICS.OLAP.endsWith('/analytics/olap'), 'OLAP endpoint configured');
  testAssert(API_ENDPOINTS.ANALYTICS.MODEL_EVALUATION.endsWith('/analytics/model-evaluation'), 'MODEL_EVALUATION endpoint configured');

  // =========================================================================
  // 2. Query Parameter Construction & Multi-value Serialization
  // =========================================================================
  console.log('\n--- 2. Request Construction & Query Serialization (Unit Mock) ---');

  const originalFetch = globalThis.fetch;
  let capturedUrl = null;
  let capturedHeaders = null;

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options?.headers || {};
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ mock: true })
    };
  };

  setToken('mock-jwt-token-12345');

  // Test Comparison with location array
  await getAnalyticsComparison({
    comparison_type: 'state',
    locations: ['MAHARASHTRA', 'TAMIL NADU', 'KARNATAKA'],
    start_year: 2005,
    end_year: 2010,
    category: 'MURDER'
  });

  testAssert(capturedUrl.includes('/analytics/comparison?'), 'Calls comparison endpoint with query string');
  testAssert(capturedUrl.includes('comparison_type=state'), 'Serializes comparison_type');
  testAssert(
    capturedUrl.includes('locations=MAHARASHTRA') &&
    capturedUrl.includes('locations=TAMIL+NADU') || capturedUrl.includes('locations=TAMIL%20NADU'),
    'Serializes repeated location array parameters correctly'
  );
  testAssert(capturedUrl.includes('start_year=2005') && capturedUrl.includes('end_year=2010'), 'Serializes year range');
  testAssert(capturedHeaders.Authorization === 'Bearer mock-jwt-token-12345', 'Attaches Authorization Bearer token header');

  // Test OLAP parameter serialization
  await getAnalyticsOlap({
    operation: 'pivot',
    index: 'state',
    columns: 'year',
    values: 'BURGLARY',
    state: 'MAHARASHTRA'
  });

  testAssert(capturedUrl.includes('/analytics/olap?'), 'Calls OLAP endpoint');
  testAssert(capturedUrl.includes('operation=pivot'), 'Serializes OLAP operation');
  testAssert(capturedUrl.includes('index=state'), 'Serializes pivot index dimension');
  testAssert(capturedUrl.includes('columns=year'), 'Serializes pivot column dimension');
  testAssert(capturedUrl.includes('values=BURGLARY'), 'Serializes pivot values metric');

  // Restore fetch
  globalThis.fetch = originalFetch;
  clearToken();

  // =========================================================================
  // 3. Live End-to-End Integration Tests via Express Gateway
  // =========================================================================
  console.log('\n--- 3. Live End-to-End Analytics Integration via Express Gateway ---');

  const testUser = {
    name: 'Analytics Test Analyst',
    email: `analyst_test_${Date.now()}@crimepulse.org`,
    password: 'SecurePassword123!',
    badgeId: `ANL-${Math.floor(1000 + Math.random() * 9000)}`,
    department: 'Statistical Crime Analysis Unit'
  };

  let registeredToken = null;

  try {
    // 3a. Register test analyst to acquire authenticated JWT session
    const authResult = await registerUser(testUser);
    registeredToken = authResult.token;
    setToken(registeredToken);
    testAssert(typeof registeredToken === 'string' && registeredToken.length > 20, 'Registered test analyst and acquired valid JWT session');

    // 3b. Test GET /api/analytics/metadata (National scope)
    const meta = await getAnalyticsMetadata();
    testAssert(Array.isArray(meta.states) && meta.states.length === 35, `Metadata returns ${meta.states.length} verified Indian States/UTs`);
    testAssert(meta.states.includes('MAHARASHTRA') && meta.states.includes('KERALA'), 'Contains major states in metadata list');
    testAssert(meta.year_range?.min_year === 2001 && meta.year_range?.max_year === 2012, 'Metadata year range covers 2001 to 2012');
    testAssert(meta.year_range?.years?.length === 12, 'Year range contains 12 discrete chronological years');
    testAssert(Array.isArray(meta.crime_categories) && meta.crime_categories.length >= 25, `Returns ${meta.crime_categories?.length} distinct crime categories`);
    testAssert(Array.isArray(meta.summary_categories) && meta.summary_categories.includes('TOTAL IPC CRIMES'), 'Distinguishes summary categories like TOTAL IPC CRIMES');

    // 3c. Test GET /api/analytics/metadata (State-filtered for districts)
    const stateMeta = await getAnalyticsMetadata({ state: 'MAHARASHTRA' });
    testAssert(Array.isArray(stateMeta.districts) && stateMeta.districts.length > 0, `Returns ${stateMeta.districts.length} districts for MAHARASHTRA`);
    testAssert(stateMeta.districts.includes('MUMBAI COMMR.') || stateMeta.districts.includes('PUNE COMMR.'), 'Districts include verified Maharashtra administrative units');

    // 3d. Test GET /api/analytics/trends (National Scope)
    const nationalTrends = await getAnalyticsTrends({
      category: 'TOTAL IPC CRIMES',
      start_year: 2001,
      end_year: 2012
    });
    testAssert(nationalTrends.location_type === 'national', 'Trends reports location_type as "national"');
    testAssert(Array.isArray(nationalTrends.data) && nationalTrends.data.length === 12, 'National trends returns 12 year-by-year points');
    testAssert(nationalTrends.data[0].year === 2001 && nationalTrends.data[11].year === 2012, 'Data points are ordered chronologically');
    testAssert(typeof nationalTrends.data[0].count === 'number' && nationalTrends.data[0].count > 1000000, 'Recorded count reflects authentic national volume');
    testAssert(nationalTrends.summary?.total_count > 0, 'Trends calculates summary total_count');
    testAssert(nationalTrends.summary?.min_count > 0, 'Trends calculates summary min_count');
    testAssert(nationalTrends.summary?.max_count >= nationalTrends.summary?.min_count, 'Trends summary max_count is >= min_count');

    // 3e. Test GET /api/analytics/trends (State & District Scope)
    const districtTrends = await getAnalyticsTrends({
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      category: 'BURGLARY',
      start_year: 2005,
      end_year: 2010
    });
    testAssert(districtTrends.location_type === 'district', 'Trends reports location_type as "district"');
    testAssert(districtTrends.state === 'ANDHRA PRADESH' && districtTrends.district === 'ADILABAD', 'Echoes correct geographic filters');
    testAssert(districtTrends.data.length === 6, 'Returns exactly 6 years for 2005-2010 window');

    // 3f. Test GET /api/analytics/category-distribution
    const catDist = await getAnalyticsCategoryDistribution({
      state: 'KARNATAKA',
      year: 2011,
      exclude_summary: true
    });
    testAssert(Array.isArray(catDist.categories) && catDist.categories.length > 0, `Category distribution returns ${catDist.categories.length} categories`);
    testAssert(catDist.total_recorded_crimes > 0, 'Calculates total recorded crimes for state & year');
    const hasTotalIpc = catDist.categories.some((c) => c.category === 'TOTAL IPC CRIMES');
    testAssert(!hasTotalIpc, 'exclude_summary=true correctly removes aggregate summary categories');
    testAssert(typeof catDist.categories[0].percentage === 'number', 'Calculates category percentage');

    // 3g. Test GET /api/analytics/comparison (State comparison)
    const stateComp = await getAnalyticsComparison({
      comparison_type: 'state',
      locations: ['MAHARASHTRA', 'TAMIL NADU', 'UTTAR PRADESH'],
      category: 'TOTAL IPC CRIMES',
      start_year: 2001,
      end_year: 2012
    });
    testAssert(stateComp.comparison_type === 'state', 'Comparison reports comparison_type as state');
    testAssert(Array.isArray(stateComp.series) && stateComp.series.length === 3, 'Returns 3 comparison series for 3 requested states');
    testAssert(stateComp.series.map(s => s.location).includes('MAHARASHTRA'), 'Includes MAHARASHTRA series');

    // 3h. Test GET /api/analytics/comparison (District comparison within a state)
    const distComp = await getAnalyticsComparison({
      comparison_type: 'district',
      state: 'MAHARASHTRA',
      locations: ['PUNE COMMR.', 'MUMBAI COMMR.'],
      category: 'ROBBERY',
      start_year: 2005,
      end_year: 2008
    });
    testAssert(distComp.comparison_type === 'district', 'Comparison reports comparison_type as district');
    testAssert(distComp.series.length === 2, 'Returns 2 district series');

    // 3i. Test GET /api/analytics/olap (Rollup, Drilldown, Slice, Dice, Pivot)
    const rollupRes = await getAnalyticsOlap({
      operation: 'rollup',
      level: 'state',
      category: 'TOTAL IPC CRIMES'
    });
    testAssert(rollupRes.operation === 'rollup', 'OLAP executes rollup operation');
    testAssert(Array.isArray(rollupRes.data) && rollupRes.data.length > 0, 'Rollup returns aggregated state rows');

    const drilldownRes = await getAnalyticsOlap({
      operation: 'drilldown',
      state: 'KERALA',
      category: 'THEFT'
    });
    testAssert(drilldownRes.operation === 'drilldown', 'OLAP executes drilldown operation');
    testAssert(drilldownRes.dimensions_applied?.state === 'KERALA', 'Drilldown filters to state KERALA');
    testAssert(Array.isArray(drilldownRes.data) && drilldownRes.data.length > 0, 'Drilldown returns district breakdown');

    const sliceRes = await getAnalyticsOlap({
      operation: 'slice',
      dimension: 'year',
      value: '2012',
      category: 'BURGLARY'
    });
    testAssert(sliceRes.operation === 'slice', 'OLAP executes slice operation');
    testAssert(String(sliceRes.dimensions_applied?.value) === '2012', 'Slice sets slice value 2012');

    const diceRes = await getAnalyticsOlap({
      operation: 'dice',
      states: ['GOA', 'KERALA'],
      years: [2010, 2011],
      categories: ['MURDER', 'ROBBERY']
    });
    testAssert(diceRes.operation === 'dice', 'OLAP executes dice operation');
    testAssert(Array.isArray(diceRes.data), 'Dice returns filtered multidimensional cube');

    const pivotRes = await getAnalyticsOlap({
      operation: 'pivot',
      index: 'state',
      columns: 'year',
      values: 'BURGLARY'
    });
    testAssert(pivotRes.operation === 'pivot', 'OLAP executes pivot operation');
    testAssert(Array.isArray(pivotRes.pivot_columns) && pivotRes.pivot_columns.length > 0, 'Pivot returns pivot_columns matrix headers');
    testAssert(Array.isArray(pivotRes.data) && pivotRes.data.length > 0, 'Pivot returns 2D cross-tabulated dataset');

    // 3j. Test GET /api/analytics/model-evaluation
    const modelEval = await getAnalyticsModelEvaluation();
    testAssert(typeof modelEval.test_accuracy === 'number', `Model evaluation returns test accuracy: ${(modelEval.test_accuracy * 100).toFixed(2)}%`);
    testAssert(modelEval.model_type === 'PureRandomForestClassifier', 'Reports model type as PureRandomForestClassifier');
    testAssert(Array.isArray(modelEval.classes) && modelEval.classes.length === 6, 'Reports 6 supported dominant crime classes');
    testAssert(Array.isArray(modelEval.confusion_matrix) && modelEval.confusion_matrix.length === 6, 'Returns 6x6 confusion matrix');
    testAssert(Boolean(modelEval.class_report), 'Includes detailed per-class classification report');
    testAssert(Array.isArray(modelEval.train_years) && Array.isArray(modelEval.test_years), 'Includes train and test years');
    testAssert(typeof modelEval.disclaimer === 'string', 'Includes explicit model interpretation disclaimer');

    // =========================================================================
    // 4. Authentication & Error Handling Edge Cases
    // =========================================================================
    console.log('\n--- 4. Authentication Enforcement & Gateway Security ---');

    // Clear token and verify unauthenticated request rejection
    clearToken();
    try {
      await getAnalyticsMetadata();
      testAssert(false, 'Unauthenticated request should throw ApiError');
    } catch (err) {
      testAssert(err instanceof ApiError && err.status === 401, 'Unauthenticated access returns HTTP 401 Unauthorized');
      console.log('    [INFO] Unauthenticated caught error message:', JSON.stringify(err.message));
      testAssert(typeof err.message === 'string' && err.message.length > 0, 'Returns clear authentication failure message');
    }

    // Re-set token and test invalid query parameter handling (e.g. invalid start_year > end_year)
    setToken(registeredToken);
    try {
      await getAnalyticsTrends({ start_year: 2012, end_year: 2005 });
      testAssert(false, 'Inverted year range should be rejected by backend');
    } catch (err) {
      testAssert(err instanceof ApiError && (err.status === 400 || err.status === 422), 'Inverted year range returns HTTP 400 / 422 Bad Request');
    }

    // Comparison exceeding max limit of 10 locations
    try {
      const tooManyLocs = Array.from({ length: 12 }, (_, i) => `LOC_${i}`);
      await getAnalyticsComparison({ comparison_type: 'state', locations: tooManyLocs });
      testAssert(false, 'Exceeding 10 location limit should be rejected by backend');
    } catch (err) {
      testAssert(err instanceof ApiError && (err.status === 400 || err.status === 422), 'Exceeding 10 location limit returns HTTP 400 LOCATION_LIMIT_EXCEEDED');
    }

    // District comparison without state
    try {
      await getAnalyticsComparison({ comparison_type: 'district', locations: ['DISTRICT A', 'DISTRICT B'] });
      testAssert(false, 'District comparison without state should be rejected');
    } catch (err) {
      testAssert(err instanceof ApiError && (err.status === 400 || err.status === 422), 'District comparison without state returns HTTP 400 Bad Request');
    }

  } catch (err) {
    console.error('Fatal unexpected error in test suite:', err);
    testAssert(false, `Unexpected test suite failure: ${err.message}`);
  } finally {
    // 5. Clean up test user from MongoDB Atlas
    try {
      const { execSync } = await import('node:child_process');
      execSync('node C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\7ab0fcce-1859-461c-8b74-bd2bb43f6822\\scratch\\cleanTestUsers.js', {
        cwd: 'c:/Users/user/Desktop/CrimePulse/backend',
        stdio: 'ignore'
      });
      console.log('  🧹 Cleaned up transient test users from database.');
    } catch {
      // Ignore cleanup error
    }
  }

  console.log(`\n=== CRIME ANALYTICS TEST SUMMARY: ${passed} Passed | ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
