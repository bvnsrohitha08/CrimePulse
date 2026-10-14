const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const mlService = require('../src/services/mlService');
const User = require('../src/models/User');
const { signToken } = require('../src/utils/jwt');

// Capture genuine native fetch client BEFORE any mocks are installed
const testFetch = global.fetch;

const runTests = async () => {
  console.log('--- STARTING EXPRESS ANALYTICS GATEWAY TESTS ---\n');

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
  const baseUrl = `http://127.0.0.1:${port}/api/analytics`;

  const originalFetch = global.fetch;
  const originalUserFindById = User.findById;

  // Mock authenticated analyst user
  const mockUser = {
    _id: '661840000000000000000001',
    name: 'Analyst Jane',
    email: 'jane@crimepulse.org',
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
    'Accept': 'application/json',
    'Authorization': `Bearer ${validToken}`
  };

  try {
    // =========================================================================
    // 1. Unauthenticated Requests Receive 401 and Do NOT Call Upstream
    // =========================================================================
    console.log('--- 1. Authentication Enforcement on All 6 Gateway Endpoints ---');
    const endpoints = [
      '/metadata',
      '/trends',
      '/category-distribution',
      '/comparison',
      '/olap',
      '/model-evaluation'
    ];

    for (const ep of endpoints) {
      let upstreamCalled = false;
      global.fetch = async () => {
        upstreamCalled = true;
        return { ok: true, status: 200, json: async () => ({}) };
      };

      const res = await testFetch(`${baseUrl}${ep}`);
      const data = await res.json();
      assert(res.status === 401, `Unauthenticated GET ${ep} rejected with HTTP 401`);
      assert(data.error === 'UNAUTHORIZED', `GET ${ep} returns UNAUTHORIZED error code`);
      assert(upstreamCalled === false, `Upstream service NOT called for unauthenticated GET ${ep}`);
    }

    // Invalid Bearer token rejection
    let upstreamCalledInvalidToken = false;
    global.fetch = async () => {
      upstreamCalledInvalidToken = true;
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const resInvalidToken = await testFetch(`${baseUrl}/metadata`, {
      headers: { 'Authorization': 'Bearer invalid.token.value' }
    });
    assert(resInvalidToken.status === 401, 'Request with invalid token rejected with HTTP 401');
    assert(upstreamCalledInvalidToken === false, 'Upstream service NOT called for invalid token');

    // =========================================================================
    // 2. Authenticated Requests Call Correct Upstream Endpoint & Forward Query
    // =========================================================================
    console.log('\n--- 2. Upstream Endpoint Routing & Query Parameter Forwarding ---');

    // 2a. Metadata with state filter
    let capturedUrl = '';
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          year_range: { min_year: 2001, max_year: 2012, years: [2001, 2012] },
          states: ['ANDHRA PRADESH'],
          districts: ['ADILABAD'],
          crime_categories: ['MURDER'],
          summary_categories: ['TOTAL IPC CRIMES'],
          total_records: 8609
        })
      };
    };

    const resMeta = await testFetch(`${baseUrl}/metadata?state=ANDHRA%20PRADESH`, { headers: authHeaders });
    const dataMeta = await resMeta.json();
    assert(resMeta.status === 200, 'GET /metadata returns HTTP 200');
    assert(capturedUrl.includes('/analytics/metadata'), 'Upstream path is /analytics/metadata');
    assert(capturedUrl.includes('state=ANDHRA+PRADESH') || capturedUrl.includes('state=ANDHRA%20PRADESH'), 'Forwarded state query param');
    assert(dataMeta.total_records === 8609, 'Returned upstream metadata payload intact');

    // 2b. Trends with multiple parameters
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          location_type: 'state',
          state: 'ANDHRA PRADESH',
          category: 'MURDER',
          start_year: 2001,
          end_year: 2003,
          data: [{ year: 2001, count: 2602 }],
          summary: { total_count: 2602, avg_count: 2602.0 }
        })
      };
    };

    const resTrends = await testFetch(`${baseUrl}/trends?state=ANDHRA%20PRADESH&category=MURDER&start_year=2001&end_year=2003`, { headers: authHeaders });
    const dataTrends = await resTrends.json();
    assert(resTrends.status === 200, 'GET /trends returns HTTP 200');
    assert(capturedUrl.includes('/analytics/trends'), 'Upstream path is /analytics/trends');
    assert(capturedUrl.includes('start_year=2001'), 'Forwarded start_year param');
    assert(capturedUrl.includes('end_year=2003'), 'Forwarded end_year param');
    assert(capturedUrl.includes('category=MURDER'), 'Forwarded category param');
    assert(dataTrends.data[0].count === 2602, 'Returned upstream trends payload intact');

    // 2c. Category Distribution
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          year: 2010,
          location_type: 'national',
          categories: [{ category: 'THEFT', count: 339483, percentage: 18.09 }]
        })
      };
    };

    const resCat = await testFetch(`${baseUrl}/category-distribution?year=2010&include_summaries=false`, { headers: authHeaders });
    const dataCat = await resCat.json();
    assert(resCat.status === 200, 'GET /category-distribution returns HTTP 200');
    assert(capturedUrl.includes('/analytics/category-distribution'), 'Upstream path is /analytics/category-distribution');
    assert(capturedUrl.includes('year=2010'), 'Forwarded year param');
    assert(dataCat.categories[0].category === 'THEFT', 'Returned upstream category distribution intact');

    // 2d. Comparison with multiple locations
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          comparison_type: 'state',
          locations: ['ANDHRA PRADESH', 'KARNATAKA'],
          series: [],
          yearly_comparison: []
        })
      };
    };

    const resComp = await testFetch(`${baseUrl}/comparison?comparison_type=state&locations=ANDHRA%20PRADESH&locations=KARNATAKA&start_year=2005&end_year=2010`, { headers: authHeaders });
    const dataComp = await resComp.json();
    assert(resComp.status === 200, 'GET /comparison returns HTTP 200');
    assert(capturedUrl.includes('/analytics/comparison'), 'Upstream path is /analytics/comparison');
    assert(capturedUrl.includes('comparison_type=state'), 'Forwarded comparison_type param');
    assert(dataComp.locations.length === 2, 'Returned upstream comparison intact');

    // 2e. OLAP Operation
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          operation: 'rollup',
          description: 'Roll-up to state level',
          data: [{ state: 'MAHARASHTRA', count: 200000 }]
        })
      };
    };

    const resOlap = await testFetch(`${baseUrl}/olap?operation=rollup&level=state&year=2010`, { headers: authHeaders });
    const dataOlap = await resOlap.json();
    assert(resOlap.status === 200, 'GET /olap returns HTTP 200');
    assert(capturedUrl.includes('/analytics/olap'), 'Upstream path is /analytics/olap');
    assert(capturedUrl.includes('operation=rollup'), 'Forwarded operation param');
    assert(dataOlap.operation === 'rollup', 'Returned upstream OLAP payload intact');

    // 2f. Model Evaluation
    global.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model_type: 'PureRandomForestClassifier',
          test_accuracy: 0.8273,
          classes: ['BURGLARY', 'THEFT'],
          feature_importances: null,
          disclaimer: 'Held-out test metrics'
        })
      };
    };

    const resModel = await testFetch(`${baseUrl}/model-evaluation`, { headers: authHeaders });
    const dataModel = await resModel.json();
    assert(resModel.status === 200, 'GET /model-evaluation returns HTTP 200');
    assert(capturedUrl.includes('/analytics/model-evaluation'), 'Upstream path is /analytics/model-evaluation');
    assert(dataModel.test_accuracy === 0.8273, 'Returned upstream model evaluation intact');

    // =========================================================================
    // 3. Gateway-Level Validation for Invalid or Missing Parameters
    // =========================================================================
    console.log('\n--- 3. Gateway Parameter Validation ---');

    // Category distribution missing year
    const resNoYear = await testFetch(`${baseUrl}/category-distribution`, { headers: authHeaders });
    const dataNoYear = await resNoYear.json();
    assert(resNoYear.status === 400, 'Category distribution missing year returns HTTP 400');
    assert(dataNoYear.error === 'INVALID_INPUT', 'Returns INVALID_INPUT error code');

    // Comparison missing comparison_type
    const resNoCompType = await testFetch(`${baseUrl}/comparison?locations=ANDHRA%20PRADESH`, { headers: authHeaders });
    const dataNoCompType = await resNoCompType.json();
    assert(resNoCompType.status === 400, 'Comparison missing comparison_type returns HTTP 400');
    assert(dataNoCompType.error === 'INVALID_COMPARISON_TYPE', 'Returns INVALID_COMPARISON_TYPE error code');

    // Comparison missing locations
    const resNoLoc = await testFetch(`${baseUrl}/comparison?comparison_type=state`, { headers: authHeaders });
    const dataNoLoc = await resNoLoc.json();
    assert(resNoLoc.status === 400, 'Comparison missing locations returns HTTP 400');
    assert(dataNoLoc.error === 'INVALID_LOCATIONS', 'Returns INVALID_LOCATIONS error code');

    // OLAP invalid operation
    const resBadOp = await testFetch(`${baseUrl}/olap?operation=invalid_op`, { headers: authHeaders });
    const dataBadOp = await resBadOp.json();
    assert(resBadOp.status === 400, 'OLAP invalid operation returns HTTP 400');
    assert(dataBadOp.error === 'UNSUPPORTED_OPERATION', 'Returns UNSUPPORTED_OPERATION error code');

    // =========================================================================
    // 4. Upstream Error Handling (400, 404, 500)
    // =========================================================================
    console.log('\n--- 4. Upstream Error Translation & Preservation ---');

    // 4a. Upstream 400 INVALID_STATE
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        detail: {
          error: 'INVALID_STATE',
          message: "State 'NONEXISTENT_STATE' was not found in dataset."
        }
      })
    });

    const resUp400 = await testFetch(`${baseUrl}/metadata?state=NONEXISTENT_STATE`, { headers: authHeaders });
    const dataUp400 = await resUp400.json();
    assert(resUp400.status === 400, 'Upstream 400 propagated as HTTP 400');
    assert(dataUp400.error === 'INVALID_STATE', 'Propagates upstream error code INVALID_STATE');
    assert(dataUp400.message.includes('NONEXISTENT_STATE'), 'Propagates descriptive error message');

    // 4b. Upstream 404 METADATA_UNAVAILABLE
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        detail: {
          error: 'METADATA_UNAVAILABLE',
          message: 'Model evaluation metadata is not available.'
        }
      })
    });

    const resUp404 = await testFetch(`${baseUrl}/model-evaluation`, { headers: authHeaders });
    const dataUp404 = await resUp404.json();
    assert(resUp404.status === 404, 'Upstream 404 propagated as HTTP 404');
    assert(dataUp404.error === 'METADATA_UNAVAILABLE', 'Propagates upstream error code METADATA_UNAVAILABLE');

    // 4c. Upstream 500 Internal Error
    global.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        detail: {
          error: 'INTERNAL_ERROR',
          message: 'Upstream computation exception.'
        }
      })
    });

    const resUp500 = await testFetch(`${baseUrl}/trends?state=ANDHRA%20PRADESH`, { headers: authHeaders });
    const dataUp500 = await resUp500.json();
    assert(resUp500.status === 500, 'Upstream 500 propagated as HTTP 500');
    assert(dataUp500.error === 'INTERNAL_ERROR', 'Propagates error code');

    // =========================================================================
    // 5. Network Failures, Timeouts, and Non-JSON Responses
    // =========================================================================
    console.log('\n--- 5. Network Failures, Timeouts & Bad Responses ---');

    // 5a. Network connection failure (ECONNREFUSED)
    global.fetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };

    const resNetErr = await testFetch(`${baseUrl}/metadata`, { headers: authHeaders });
    const dataNetErr = await resNetErr.json();
    assert(resNetErr.status === 503, 'Network failure returns HTTP 503');
    assert(dataNetErr.error === 'NETWORK_ERROR', 'Returns NETWORK_ERROR code');
    assert(dataNetErr.message.includes('Failed to connect to ML service'), 'Returns clean network error message');

    // 5b. Request Timeout (AbortError)
    global.fetch = async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };

    const resTimeout = await testFetch(`${baseUrl}/metadata`, { headers: authHeaders });
    const dataTimeout = await resTimeout.json();
    assert(resTimeout.status === 504, 'Request timeout returns HTTP 504');
    assert(dataTimeout.error === 'TIMEOUT', 'Returns TIMEOUT code');

    // 5c. Invalid non-JSON upstream response (e.g. 502 Bad Gateway HTML)
    global.fetch = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      }
    });

    const resBadJson = await testFetch(`${baseUrl}/metadata`, { headers: authHeaders });
    const dataBadJson = await resBadJson.json();
    assert(resBadJson.status === 502, 'Invalid JSON upstream response returns HTTP 502');
    assert(dataBadJson.error === 'INVALID_RESPONSE', 'Returns INVALID_RESPONSE code');

  } finally {
    global.fetch = originalFetch;
    User.findById = originalUserFindById;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n--- ANALYTICS GATEWAY TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
