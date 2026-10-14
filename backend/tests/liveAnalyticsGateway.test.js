const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const { signToken } = require('../src/utils/jwt');

const runLiveTests = async () => {
  console.log('--- STARTING LIVE EXPRESS TO FASTAPI ANALYTICS GATEWAY VERIFICATION ---\n');

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

  // 1. Ensure MongoDB is connected
  await connectDB();

  // 2. Start Express app on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/analytics`;
  console.log(`📡 Live Express test instance listening on port ${port}\n`);

  // 3. Find or mock a user for token generation
  const testUser = await User.findOne();
  if (!testUser) {
    console.error('❌ No user found in MongoDB to generate test JWT');
    process.exit(1);
  }

  const token = signToken({
    id: testUser._id.toString(),
    email: testUser.email,
    role: testUser.role
  });

  const authHeaders = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  try {
    // Test 1: Unauthenticated request receives 401 (Not "Cannot GET")
    console.log('--- 1. Live Unauthenticated Request Check ---');
    const unauthRes = await fetch(`${baseUrl}/metadata`);
    const unauthData = await unauthRes.json();
    assert(unauthRes.status === 401, 'Unauthenticated request receives HTTP 401 (Route IS registered)');
    assert(unauthData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');

    // Test 2: Authenticated Live GET /api/analytics/metadata against FastAPI 8000
    console.log('\n--- 2. Live Authenticated GET /api/analytics/metadata ---');
    const metaRes = await fetch(`${baseUrl}/metadata?state=ANDHRA%20PRADESH`, { headers: authHeaders });
    const metaData = await metaRes.json();
    assert(metaRes.status === 200, 'Live metadata endpoint returns HTTP 200');
    assert(metaData.total_records === 8609, 'Live dataset contains 8609 records');
    assert(metaData.states.length === 35, 'Live dataset contains 35 states');
    assert(Array.isArray(metaData.districts) && metaData.districts.includes('ADILABAD'), 'Districts returned for ANDHRA PRADESH');

    // Test 3: Authenticated Live GET /api/analytics/trends
    console.log('\n--- 3. Live Authenticated GET /api/analytics/trends ---');
    const trendsRes = await fetch(`${baseUrl}/trends?state=ANDHRA%20PRADESH&start_year=2001&end_year=2005`, { headers: authHeaders });
    const trendsData = await trendsRes.json();
    assert(trendsRes.status === 200, 'Live trends endpoint returns HTTP 200');
    assert(trendsData.location_type === 'state', 'Location type is state');
    assert(trendsData.data.length === 5, 'Returns 5 annual data points (2001-2005)');
    assert(trendsData.summary.total_count > 0, 'Total crime count is positive');

    // Test 4: Authenticated Live GET /api/analytics/category-distribution
    console.log('\n--- 4. Live Authenticated GET /api/analytics/category-distribution ---');
    const catRes = await fetch(`${baseUrl}/category-distribution?year=2010`, { headers: authHeaders });
    const catData = await catRes.json();
    assert(catRes.status === 200, 'Live category distribution returns HTTP 200');
    assert(catData.categories.length === 28, 'Returns 28 individual categories (excluding totals)');
    assert(catData.categories[0].count > 0, 'Categories sorted descending with positive count');

    // Test 5: Authenticated Live GET /api/analytics/comparison
    console.log('\n--- 5. Live Authenticated GET /api/analytics/comparison ---');
    const compRes = await fetch(`${baseUrl}/comparison?comparison_type=state&locations=ANDHRA%20PRADESH,KARNATAKA&start_year=2005&end_year=2007`, { headers: authHeaders });
    const compData = await compRes.json();
    assert(compRes.status === 200, 'Live comparison returns HTTP 200');
    assert(compData.series.length === 2, 'Returns series for both states');

    // Test 6: Authenticated Live GET /api/analytics/olap
    console.log('\n--- 6. Live Authenticated GET /api/analytics/olap ---');
    const olapRes = await fetch(`${baseUrl}/olap?operation=rollup&level=national&year=2010`, { headers: authHeaders });
    const olapData = await olapRes.json();
    assert(olapRes.status === 200, 'Live OLAP returns HTTP 200');
    assert(olapData.operation === 'rollup', 'OLAP rollup operation confirmed');

    // Test 7: Authenticated Live GET /api/analytics/model-evaluation
    console.log('\n--- 7. Live Authenticated GET /api/analytics/model-evaluation ---');
    const modelRes = await fetch(`${baseUrl}/model-evaluation`, { headers: authHeaders });
    const modelData = await modelRes.json();
    assert(modelRes.status === 200, 'Live model evaluation returns HTTP 200');
    assert(modelData.model_type === 'PureRandomForestClassifier', 'Model type is PureRandomForestClassifier');
    assert(typeof modelData.test_accuracy === 'number' && modelData.test_accuracy > 0.8, 'Test accuracy is > 80%');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    const mongoose = require('mongoose');
    await mongoose.connection.close();
  }


  console.log(`\n--- LIVE GATEWAY TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runLiveTests().catch((err) => {
  console.error('Fatal live test error:', err);
  process.exit(1);
});
