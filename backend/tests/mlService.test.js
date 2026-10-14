const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  predictCrime,
  fetchAnalytics,
  getAnalyticsMetadata,
  getAnalyticsTrends,
  getAnalyticsCategoryDistribution,
  getAnalyticsComparison,
  getAnalyticsOlap,
  getAnalyticsModelEvaluation,
  MLServiceError
} = require('../src/services/mlService');


const runTests = async () => {
  console.log('--- STARTING ML SERVICE CLIENT UNIT TESTS ---\n');

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

  const originalFetch = global.fetch;

  try {
    // 1. Successful prediction request
    console.log('--- 1. Successful Prediction Request ---');
    global.fetch = async (url, options) => {
      assert(url === 'http://127.0.0.1:8000/predict-crime', 'Correct endpoint URL constructed');
      const body = JSON.parse(options.body);
      assert(body.state === 'ANDHRA PRADESH', 'Correct state sent in JSON body');
      assert(body.district === 'ADILABAD', 'Correct district sent in JSON body');
      assert(body.year === 2011, 'Correct year sent in JSON body');

      return {
        ok: true,
        status: 200,
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
            { crime_category: 'THEFT', probability_percentage: 1.63 }
          ]
        })
      };
    };

    const res = await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 });
    assert(res.predicted_crime === 'HURT/GREVIOUS HURT', 'Returned correct predicted_crime');
    assert(res.confidence_percentage === 98.37, 'Returned correct confidence_percentage');

    // 2. Client-side Input Validation Errors
    console.log('\n--- 2. Client-side Input Validation Errors ---');
    try {
      await predictCrime({ state: '', district: 'ADILABAD', year: 2011 });
      assert(false, 'Should throw on empty state');
    } catch (err) {
      assert(err instanceof MLServiceError && err.code === 'INVALID_INPUT', 'Throws INVALID_INPUT on empty state');
    }

    try {
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 'invalid_year' });
      assert(false, 'Should throw on invalid year');
    } catch (err) {
      assert(err instanceof MLServiceError && err.code === 'INVALID_INPUT', 'Throws INVALID_INPUT on non-integer year');
    }

    // 3. Structured 400/404 FastAPI Errors
    console.log('\n--- 3. FastAPI Non-2xx Structured Errors ---');
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        detail: {
          error: 'UNSEEN_STATE',
          message: 'The provided state is not available in the model data.'
        }
      })
    });

    try {
      await predictCrime({ state: 'UNKNOWN', district: 'ADILABAD', year: 2011 });
      assert(false, 'Should throw on 400 UNSEEN_STATE');
    } catch (err) {
      assert(err instanceof MLServiceError, 'Error is MLServiceError instance');
      assert(err.statusCode === 400, 'Error status is 400');
      assert(err.code === 'UNSEEN_STATE', 'Error code extracted from detail.error');
      assert(err.message === 'The provided state is not available in the model data.', 'Error message extracted');
    }

    // 3b. 404 RECORD_NOT_FOUND error
    global.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({
        detail: {
          error: 'RECORD_NOT_FOUND',
          message: 'No historical record was found for the provided state, district and year.'
        }
      })
    });

    try {
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 1990 });
      assert(false, 'Should throw on 404 RECORD_NOT_FOUND');
    } catch (err) {
      assert(err instanceof MLServiceError, 'Error is MLServiceError instance');
      assert(err.statusCode === 404, 'Error status is 404');
      assert(err.code === 'RECORD_NOT_FOUND', 'Error code is RECORD_NOT_FOUND');
      assert(err.message.includes('No historical record was found'), 'Error message extracted for RECORD_NOT_FOUND');
    }

    // 4. Invalid Non-JSON Server Response
    console.log('\n--- 4. Invalid JSON Server Response ---');
    global.fetch = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      }
    });

    try {
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 });
      assert(false, 'Should throw on invalid JSON response');
    } catch (err) {
      assert(err instanceof MLServiceError, 'Error is MLServiceError instance');
      assert(err.code === 'INVALID_RESPONSE', 'Error code is INVALID_RESPONSE');
    }

    // 5. Network Connection Failure
    console.log('\n--- 5. Network Connection Failure ---');
    global.fetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };

    try {
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 });
      assert(false, 'Should throw on network error');
    } catch (err) {
      assert(err instanceof MLServiceError, 'Error is MLServiceError instance');
      assert(err.statusCode === 503, 'Error status is 503');
      assert(err.code === 'NETWORK_ERROR', 'Error code is NETWORK_ERROR');
    }

    // 6. Request Timeout (AbortError)
    console.log('\n--- 6. Request Timeout ---');
    global.fetch = async (url, options) => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };

    try {
      await predictCrime({ state: 'ANDHRA PRADESH', district: 'ADILABAD', year: 2011 }, { timeout: 100 });
      assert(false, 'Should throw on request timeout');
    } catch (err) {
      assert(err instanceof MLServiceError, 'Error is MLServiceError instance');
      assert(err.statusCode === 504, 'Error status is 504');
      assert(err.code === 'TIMEOUT', 'Error code is TIMEOUT');
    }

    // 7. Analytics Proxy Methods
    console.log('\n--- 7. Analytics Proxy Methods & Query Serialization ---');

    // 7a. getAnalyticsMetadata
    global.fetch = async (url) => {
      assert(url === 'http://127.0.0.1:8000/analytics/metadata?state=KERALA', 'Metadata URL serialized with state param');
      return {
        ok: true,
        status: 200,
        json: async () => ({ states: ['KERALA'], total_records: 8609 })
      };
    };
    const metaRes = await getAnalyticsMetadata({ state: 'KERALA' });
    assert(metaRes.total_records === 8609, 'getAnalyticsMetadata returns expected payload');

    // 7b. getAnalyticsTrends
    global.fetch = async (url) => {
      assert(url.includes('/analytics/trends'), 'Trends endpoint targeted');
      assert(url.includes('start_year=2001'), 'start_year included');
      assert(url.includes('end_year=2005'), 'end_year included');
      return {
        ok: true,
        status: 200,
        json: async () => ({ location_type: 'national', data: [] })
      };
    };
    const trendsRes = await getAnalyticsTrends({ start_year: 2001, end_year: 2005 });
    assert(trendsRes.location_type === 'national', 'getAnalyticsTrends returns expected payload');

    // 7c. getAnalyticsCategoryDistribution
    global.fetch = async (url) => {
      assert(url.includes('/analytics/category-distribution?year=2010'), 'Category distribution URL serialized');
      return {
        ok: true,
        status: 200,
        json: async () => ({ year: 2010, categories: [] })
      };
    };
    const catRes = await getAnalyticsCategoryDistribution({ year: 2010 });
    assert(catRes.year === 2010, 'getAnalyticsCategoryDistribution returns expected payload');

    // 7d. getAnalyticsComparison with repeated array parameters
    global.fetch = async (url) => {
      assert(url.includes('/analytics/comparison?'), 'Comparison endpoint targeted');
      assert(url.includes('comparison_type=state'), 'comparison_type included');
      assert(url.includes('locations=KERALA'), 'First location included');
      assert(url.includes('locations=TAMIL+NADU') || url.includes('locations=TAMIL%20NADU'), 'Second location included as repeated param');
      return {
        ok: true,
        status: 200,
        json: async () => ({ comparison_type: 'state', locations: ['KERALA', 'TAMIL NADU'] })
      };
    };
    const compRes = await getAnalyticsComparison({ comparison_type: 'state', locations: ['KERALA', 'TAMIL NADU'] });
    assert(compRes.locations.length === 2, 'getAnalyticsComparison returns expected payload');

    // 7e. getAnalyticsOlap
    global.fetch = async (url) => {
      assert(url.includes('/analytics/olap?operation=rollup'), 'OLAP endpoint targeted with operation');
      return {
        ok: true,
        status: 200,
        json: async () => ({ operation: 'rollup', data: [] })
      };
    };
    const olapRes = await getAnalyticsOlap({ operation: 'rollup' });
    assert(olapRes.operation === 'rollup', 'getAnalyticsOlap returns expected payload');

    // 7f. getAnalyticsModelEvaluation
    global.fetch = async (url) => {
      assert(url === 'http://127.0.0.1:8000/analytics/model-evaluation', 'Model evaluation URL targeted');
      return {
        ok: true,
        status: 200,
        json: async () => ({ model_type: 'PureRandomForestClassifier', test_accuracy: 0.8273 })
      };
    };
    const evalRes = await getAnalyticsModelEvaluation();
    assert(evalRes.test_accuracy === 0.8273, 'getAnalyticsModelEvaluation returns expected payload');

    // 7g. Analytics Upstream Error Propagation
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        detail: {
          error: 'INVALID_CATEGORY',
          message: 'Unknown crime category.'
        }
      })
    });

    try {
      await getAnalyticsTrends({ category: 'FAKE_CATEGORY' });
      assert(false, 'Should throw on 400 upstream error');
    } catch (err) {
      assert(err instanceof MLServiceError, 'Throws MLServiceError');
      assert(err.statusCode === 400, 'Propagates status code 400');
      assert(err.code === 'INVALID_CATEGORY', 'Propagates code INVALID_CATEGORY');
      assert(err.message === 'Unknown crime category.', 'Propagates message');
    }

  } finally {

    global.fetch = originalFetch;
  }

  console.log(`\n--- ML SERVICE TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
