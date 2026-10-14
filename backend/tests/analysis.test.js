const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const Analysis = require('../src/models/Analysis');
const User = require('../src/models/User');
const { signToken } = require('../src/utils/jwt');

const runTests = async () => {
  console.log('--- STARTING PREDICTION HISTORY & OWNERSHIP UNIT TESTS ---\n');

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
  const historyUrl = `http://127.0.0.1:${port}/api/analysis`;

  // Preserve original methods
  const originalUserFindById = User.findById;
  const originalAnalysisFind = Analysis.find;
  const originalAnalysisCountDocuments = Analysis.countDocuments;
  const originalAnalysisFindOne = Analysis.findOne;

  // Mock Users
  const userA = {
    _id: '66184000000000000000000a',
    name: 'Analyst Alice',
    email: 'alice@crimepulse.org',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const userB = {
    _id: '66184000000000000000000b',
    name: 'Analyst Bob',
    email: 'bob@crimepulse.org',
    role: 'CUSTOMER',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  User.findById = async (id) => {
    if (!id) return null;
    const strId = id.toString();
    if (strId === userA._id) return { ...userA };
    if (strId === userB._id) return { ...userB };
    return null;
  };

  const tokenA = signToken({ id: userA._id, email: userA.email, role: userA.role });
  const tokenB = signToken({ id: userB._id, email: userB.email, role: userB.role });

  const headersUserA = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenA}`
  };

  const headersUserB = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenB}`
  };

  try {
    // =========================================================================
    // 1. GET /api/analysis — Authentication & Isolation Tests
    // =========================================================================
    console.log('--- 1. History Endpoint Authentication & Isolation ---');

    // 1a. Unauthenticated request rejected with HTTP 401
    let findCalledOnUnauth = false;
    Analysis.find = () => {
      findCalledOnUnauth = true;
      return { select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => [] }) }) }) }) };
    };

    const resUnauth = await fetch(historyUrl);
    const dataUnauth = await resUnauth.json();
    assert(resUnauth.status === 401, 'Rejects unauthenticated history request with HTTP 401');
    assert(dataUnauth.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');
    assert(findCalledOnUnauth === false, 'Database Analysis.find NOT called for unauthenticated request');

    // 1b. User A retrieves only User A records
    let capturedFindQuery = null;
    let capturedSort = null;
    let capturedSkip = null;
    let capturedLimit = null;

    Analysis.find = (query) => {
      capturedFindQuery = query;
      return {
        select: () => ({
          sort: (sortObj) => {
            capturedSort = sortObj;
            return {
              skip: (skipVal) => {
                capturedSkip = skipVal;
                return {
                  limit: (limitVal) => {
                    capturedLimit = limitVal;
                    return {
                      lean: async () => [
                        {
                          _id: '661840000000000000000101',
                          userId: userA._id,
                          state: 'ANDHRA PRADESH',
                          district: 'ADILABAD',
                          inputYear: 2011,
                          targetYear: 2012,
                          predictedCrime: 'HURT/GREVIOUS HURT',
                          confidencePercentage: 98.37,
                          status: 'COMPLETED'
                        }
                      ]
                    };
                  }
                };
              }
            };
          }
        })
      };
    };

    Analysis.countDocuments = async (query) => {
      assert(query.userId.toString() === userA._id, 'countDocuments filters strictly by userA._id');
      return 1;
    };

    const resUserA = await fetch(historyUrl, { headers: headersUserA });
    const dataUserA = await resUserA.json();

    assert(resUserA.status === 200, 'User A history returns HTTP 200');
    assert(capturedFindQuery.userId.toString() === userA._id, 'Database query filters strictly by req.user._id');
    assert(capturedSort && capturedSort.createdAt === -1, 'Sorts records newest first (createdAt: -1)');
    assert(dataUserA.records.length === 1, 'Returns User A records');
    assert(dataUserA.records[0].userId === userA._id, 'Returned record belongs to User A');
    assert(dataUserA.records[0].__v === undefined, 'Internal __v field is excluded');
    assert(dataUserA.pagination.total === 1, 'Pagination total count matches');

    // =========================================================================
    // 2. Pagination Logic & Limits
    // =========================================================================
    console.log('\n--- 2. Pagination Logic & Boundaries ---');

    // 2a. Defaults (page 1, limit 10)
    assert(capturedSkip === 0, 'Default skip is 0 (page 1)');
    assert(capturedLimit === 10, 'Default limit is 10');
    assert(dataUserA.pagination.page === 1, 'Default pagination page is 1');
    assert(dataUserA.pagination.limit === 10, 'Default pagination limit is 10');
    assert(dataUserA.pagination.totalPages === 1, 'Total pages calculated correctly');

    // 2b. Valid custom page and limit (page 3, limit 5)
    Analysis.countDocuments = async () => 22;
    const resCustom = await fetch(`${historyUrl}?page=3&limit=5`, { headers: headersUserA });
    const dataCustom = await resCustom.json();
    assert(resCustom.status === 200, 'Custom pagination returns HTTP 200');
    assert(capturedSkip === 10, 'Calculates skip correctly for page 3, limit 5 ((3-1)*5 = 10)');
    assert(capturedLimit === 5, 'Applies requested limit 5');
    assert(dataCustom.pagination.page === 3, 'Response reports page 3');
    assert(dataCustom.pagination.limit === 5, 'Response reports limit 5');
    assert(dataCustom.pagination.total === 22, 'Response reports total 22');
    assert(dataCustom.pagination.totalPages === 5, 'Response reports totalPages 5 (ceil(22/5))');

    // 2c. Maximum limit capped at 50
    const resMaxLimit = await fetch(`${historyUrl}?limit=100`, { headers: headersUserA });
    const dataMaxLimit = await resMaxLimit.json();
    assert(resMaxLimit.status === 200, 'Returns HTTP 200 when limit exceeds 50');
    assert(capturedLimit === 50, 'Caps limit at 50 in database query');
    assert(dataMaxLimit.pagination.limit === 50, 'Response pagination reports capped limit of 50');

    // 2d. Invalid page parameter: 0
    const resInvalidPage0 = await fetch(`${historyUrl}?page=0`, { headers: headersUserA });
    const dataInvalidPage0 = await resInvalidPage0.json();
    assert(resInvalidPage0.status === 400, 'Rejects page=0 with HTTP 400');
    assert(dataInvalidPage0.error === 'INVALID_PAGINATION', 'Error code is INVALID_PAGINATION for page=0');

    // 2e. Invalid page parameter: negative
    const resInvalidPageNeg = await fetch(`${historyUrl}?page=-2`, { headers: headersUserA });
    assert(resInvalidPageNeg.status === 400, 'Rejects negative page with HTTP 400');

    // 2f. Invalid page parameter: non-integer / string
    const resInvalidPageStr = await fetch(`${historyUrl}?page=abc`, { headers: headersUserA });
    assert(resInvalidPageStr.status === 400, 'Rejects non-numeric page with HTTP 400');

    // 2g. Invalid limit parameter: 0
    const resInvalidLimit0 = await fetch(`${historyUrl}?limit=0`, { headers: headersUserA });
    assert(resInvalidLimit0.status === 400, 'Rejects limit=0 with HTTP 400');

    // 2h. Invalid limit parameter: negative
    const resInvalidLimitNeg = await fetch(`${historyUrl}?limit=-10`, { headers: headersUserA });
    assert(resInvalidLimitNeg.status === 400, 'Rejects negative limit with HTTP 400');

    // 2i. Invalid limit parameter: non-integer / string
    const resInvalidLimitStr = await fetch(`${historyUrl}?limit=xyz`, { headers: headersUserA });
    assert(resInvalidLimitStr.status === 400, 'Rejects non-numeric limit with HTTP 400');

    // 2j. Zero records handled safely
    Analysis.countDocuments = async () => 0;
    Analysis.find = () => ({
      select: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => []
            })
          })
        })
      })
    });
    const resZero = await fetch(historyUrl, { headers: headersUserA });
    const dataZero = await resZero.json();
    assert(resZero.status === 200, 'Zero records query returns HTTP 200');
    assert(Array.isArray(dataZero.records) && dataZero.records.length === 0, 'Returns empty records array');
    assert(dataZero.pagination.total === 0, 'Pagination total is 0');
    assert(dataZero.pagination.totalPages === 0, 'Pagination totalPages is 0');

    // 2k. Database error during history query handled safely
    Analysis.find = () => {
      throw new Error('Database connection read failure');
    };
    const resDbErr = await fetch(historyUrl, { headers: headersUserA });
    const dataDbErr = await resDbErr.json();
    assert(resDbErr.status === 500, 'Database error on history query returns HTTP 500');
    assert(dataDbErr.error === 'DATABASE_ERROR', 'Returns DATABASE_ERROR without leaking driver stack');

    // =========================================================================
    // 3. GET /api/analysis/:id — Single Analysis & Ownership Verification
    // =========================================================================
    console.log('\n--- 3. Single Analysis Retrieval & Ownership Enforcement ---');

    const analysisIdA = '661840000000000000000101';
    const analysisIdB = '661840000000000000000202';

    // 3a. Unauthenticated lookup rejected with HTTP 401
    let findOneCalledUnauth = false;
    Analysis.findOne = () => {
      findOneCalledUnauth = true;
      return { select: () => ({ lean: () => null }) };
    };

    const resSingleUnauth = await fetch(`${historyUrl}/${analysisIdA}`);
    const dataSingleUnauth = await resSingleUnauth.json();
    assert(resSingleUnauth.status === 401, 'Rejects unauthenticated single record request with HTTP 401');
    assert(dataSingleUnauth.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');
    assert(findOneCalledUnauth === false, 'Database Analysis.findOne NOT called on unauthenticated request');

    // 3b. Malformed ID format rejected before database call (HTTP 400)
    let findOneCalledInvalidId = false;
    Analysis.findOne = () => {
      findOneCalledInvalidId = true;
      return { select: () => ({ lean: () => null }) };
    };

    const resInvalidIdStr = await fetch(`${historyUrl}/invalid-id-not-24-hex`, { headers: headersUserA });
    const dataInvalidIdStr = await resInvalidIdStr.json();
    assert(resInvalidIdStr.status === 400, 'Rejects malformed string ID with HTTP 400');
    assert(dataInvalidIdStr.error === 'INVALID_ID', 'Returns INVALID_ID error code');
    assert(findOneCalledInvalidId === false, 'Database Analysis.findOne NOT called for invalid ID');

    const resInvalidIdShort = await fetch(`${historyUrl}/12345`, { headers: headersUserA });
    assert(resInvalidIdShort.status === 400, 'Rejects short ID with HTTP 400');

    // 3c. User A retrieves their own analysis record (HTTP 200)
    let capturedFindOneQuery = null;
    const mockRecordA = {
      _id: analysisIdA,
      userId: userA._id,
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      inputYear: 2011,
      targetYear: 2012,
      predictedCrime: 'HURT/GREVIOUS HURT',
      confidencePercentage: 98.37,
      probabilities: [
        { crimeCategory: 'HURT/GREVIOUS HURT', probabilityPercentage: 98.37 }
      ],
      status: 'COMPLETED'
    };

    Analysis.findOne = (query) => {
      capturedFindOneQuery = query;
      return {
        select: () => ({
          lean: async () => {
            if (query._id === analysisIdA && query.userId.toString() === userA._id) {
              return { ...mockRecordA };
            }
            return null;
          }
        })
      };
    };

    const resGetOwn = await fetch(`${historyUrl}/${analysisIdA}`, { headers: headersUserA });
    const dataGetOwn = await resGetOwn.json();
    assert(resGetOwn.status === 200, 'User A retrieves own analysis with HTTP 200');
    assert(capturedFindOneQuery._id === analysisIdA, 'Query specifies requested record ID');
    assert(capturedFindOneQuery.userId.toString() === userA._id, 'Query enforces userId matches authenticated req.user._id');
    assert(dataGetOwn._id === analysisIdA, 'Returned record ID matches');
    assert(dataGetOwn.predictedCrime === 'HURT/GREVIOUS HURT', 'Returned correct predicted crime');
    assert(dataGetOwn.__v === undefined, 'Database __v excluded from response');

    // 3d. User A attempts to retrieve User B's analysis record (Returns safe HTTP 404)
    const resGetOther = await fetch(`${historyUrl}/${analysisIdB}`, { headers: headersUserA });
    const dataGetOther = await resGetOther.json();
    assert(resGetOther.status === 404, 'User A requesting User B record returns HTTP 404');
    assert(dataGetOther.error === 'RECORD_NOT_FOUND', 'Returns RECORD_NOT_FOUND error code');
    assert(dataGetOther.message === 'Analysis record not found.', 'Returns safe non-disclosing message');

    // 3e. Non-existent record ID returns IDENTICAL safe HTTP 404 (prevents record enumeration)
    const nonExistentId = '661840000000000000000999';
    const resGetNonExistent = await fetch(`${historyUrl}/${nonExistentId}`, { headers: headersUserA });
    const dataGetNonExistent = await resGetNonExistent.json();
    assert(resGetNonExistent.status === 404, 'Non-existent record ID returns HTTP 404');
    assert(dataGetNonExistent.error === dataGetOther.error, 'Error code is identical between cross-tenant and non-existent IDs');
    assert(dataGetNonExistent.message === dataGetOther.message, 'Error message is identical preventing enumeration');

    // 3f. Client-supplied userId query parameter is ignored
    capturedFindOneQuery = null;
    const resSpoofedParam = await fetch(`${historyUrl}/${analysisIdB}?userId=${userB._id}`, { headers: headersUserA });
    assert(resSpoofedParam.status === 404, 'Spoofed userId parameter fails to access other user record');
    assert(capturedFindOneQuery.userId.toString() === userA._id, 'Query strictly used req.user._id and ignored client parameter');

    // 3g. Database error during single analysis query handled safely
    Analysis.findOne = () => {
      throw new Error('Database socket error during findOne');
    };
    const resSingleDbErr = await fetch(`${historyUrl}/${analysisIdA}`, { headers: headersUserA });
    const dataSingleDbErr = await resSingleDbErr.json();
    assert(resSingleDbErr.status === 500, 'Database error on single lookup returns HTTP 500');
    assert(dataSingleDbErr.error === 'DATABASE_ERROR', 'Returns DATABASE_ERROR without leaking internals');

  } finally {
    User.findById = originalUserFindById;
    Analysis.find = originalAnalysisFind;
    Analysis.countDocuments = originalAnalysisCountDocuments;
    Analysis.findOne = originalAnalysisFindOne;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n--- PREDICTION HISTORY & OWNERSHIP TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
