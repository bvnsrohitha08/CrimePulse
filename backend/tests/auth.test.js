const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const { hashPassword, comparePassword, validatePasswordPolicy } = require('../src/utils/password');
const { signToken, verifyToken, getJWTSecret } = require('../src/utils/jwt');

const runTests = async () => {
  console.log('--- STARTING AUTHENTICATION & SECURITY UNIT TESTS ---\n');

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

  // Start Express test server on an ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const registerUrl = `http://127.0.0.1:${port}/api/auth/register`;
  const loginUrl = `http://127.0.0.1:${port}/api/auth/login`;
  const meUrl = `http://127.0.0.1:${port}/api/auth/me`;

  // Preserve original methods and env vars
  const originalUserCreate = User.create;
  const originalUserFindOne = User.findOne;
  const originalUserFindById = User.findById;
  const originalJwtSecret = process.env.JWT_SECRET;

  try {
    // =========================================================================
    // 1. PASSWORD UTILITY UNIT TESTS
    // =========================================================================
    console.log('--- 1. Password Utility & Policy Tests ---');

    const shortPolicy = validatePasswordPolicy('short');
    assert(!shortPolicy.isValid, 'Rejects password shorter than 8 characters');

    // ASCII Boundaries
    const asciiExact72 = 'A'.repeat(72);
    const asciiExactPolicy = validatePasswordPolicy(asciiExact72);
    assert(asciiExactPolicy.isValid, 'Accepts exact 72-byte ASCII boundary password');

    const asciiOver72 = 'A'.repeat(73);
    const asciiOverPolicy = validatePasswordPolicy(asciiOver72);
    assert(!asciiOverPolicy.isValid, 'Rejects 73-byte ASCII password exceeding 72-byte limit');

    // Multibyte 2-byte Unicode Boundaries (e.g. 'é' = 2 bytes)
    const unicode2ByteExact = 'é'.repeat(36); // 36 * 2 = 72 bytes
    assert(validatePasswordPolicy(unicode2ByteExact).isValid, 'Accepts 72-byte 2-byte Unicode boundary password (36 chars)');

    const unicode2ByteOver = 'é'.repeat(37); // 37 * 2 = 74 bytes (only 37 characters!)
    assert(!validatePasswordPolicy(unicode2ByteOver).isValid, 'Rejects 74-byte 2-byte Unicode password exceeding 72-byte limit (37 chars)');

    // Multibyte 3-byte Unicode Boundaries (e.g. '€' = 3 bytes)
    const unicode3ByteExact = '€'.repeat(24); // 24 * 3 = 72 bytes
    assert(validatePasswordPolicy(unicode3ByteExact).isValid, 'Accepts 72-byte 3-byte Unicode boundary password (24 chars)');

    const unicode3ByteOver = '€'.repeat(25); // 25 * 3 = 75 bytes (only 25 characters!)
    assert(!validatePasswordPolicy(unicode3ByteOver).isValid, 'Rejects 75-byte 3-byte Unicode password exceeding 72-byte limit (25 chars)');

    // Multibyte 4-byte Unicode Boundaries (e.g. '🔒' = 4 bytes)
    const unicode4ByteExact = '🔒'.repeat(18); // 18 * 4 = 72 bytes
    assert(validatePasswordPolicy(unicode4ByteExact).isValid, 'Accepts 72-byte 4-byte emoji boundary password (18 emoji)');

    const unicode4ByteOver = '🔒'.repeat(19); // 19 * 4 = 76 bytes (only 19 emoji!)
    assert(!validatePasswordPolicy(unicode4ByteOver).isValid, 'Rejects 76-byte 4-byte emoji password exceeding 72-byte limit (19 emoji)');

    const validPolicy = validatePasswordPolicy('ValidPassword123!');
    assert(validPolicy.isValid, 'Accepts valid password meeting length policy');

    const nonStringPolicy = validatePasswordPolicy(12345678);
    assert(!nonStringPolicy.isValid, 'Rejects non-string password type');

    const hashed = await hashPassword('MySecretP@ss123');
    assert(typeof hashed === 'string' && hashed.startsWith('$2b$'), 'Hashes password using bcrypt ($2b$ prefix)');

    const matchSuccess = await comparePassword('MySecretP@ss123', hashed);
    assert(matchSuccess === true, 'comparePassword returns true for correct plaintext password');

    const matchFailure = await comparePassword('WrongPassword!', hashed);
    assert(matchFailure === false, 'comparePassword returns false for incorrect plaintext password');

    const matchNull = await comparePassword(null, hashed);
    assert(matchNull === false, 'comparePassword handles null candidate safely without throwing');

    // Hashing and comparison of 72-byte Unicode boundary password
    const hashedUnicode72 = await hashPassword(unicode4ByteExact);
    assert(typeof hashedUnicode72 === 'string' && hashedUnicode72.startsWith('$2b$'), 'Successfully hashes exact 72-byte Unicode password');

    const matchUnicodeSuccess = await comparePassword(unicode4ByteExact, hashedUnicode72);
    assert(matchUnicodeSuccess === true, 'comparePassword validates exact 72-byte Unicode password');

    const matchUnicodeOver = await comparePassword(unicode4ByteOver, hashedUnicode72);
    assert(matchUnicodeOver === false, 'comparePassword rejects over-limit Unicode password safely without silent truncation match');

    // =========================================================================
    // 2. JWT UTILITY UNIT TESTS
    // =========================================================================
    console.log('\n--- 2. JWT Utility & Configuration Tests ---');

    process.env.JWT_SECRET = 'test_unit_jwt_secret_key_12345';
    const testPayload = { id: 'user_123', email: 'test@example.com', role: 'CUSTOMER' };
    const signedJwt = signToken(testPayload);
    assert(typeof signedJwt === 'string' && signedJwt.split('.').length === 3, 'signToken generates valid three-part JWT');

    const decoded = verifyToken(signedJwt);
    assert(decoded.id === 'user_123' && decoded.role === 'CUSTOMER', 'verifyToken correctly decodes token payload');
    assert(typeof decoded.exp === 'number', 'Token contains expiration timestamp');

    // Missing secret safety
    delete process.env.JWT_SECRET;
    let missingSecretThrew = false;
    try {
      signToken(testPayload);
    } catch (err) {
      missingSecretThrew = true;
      assert(err.message.includes('JWT_SECRET'), 'Fails safely with explicit error when JWT_SECRET is unset');
    }
    assert(missingSecretThrew, 'signToken throws when JWT_SECRET is missing');

    // Restore JWT_SECRET
    process.env.JWT_SECRET = originalJwtSecret || 'temporary_test_secret_for_suite';

    // =========================================================================
    // 3. REGISTRATION ENDPOINT TESTS (MOCKED DB)
    // =========================================================================
    console.log('\n--- 3. Registration Endpoint Tests ---');

    // 3a. Successful Registration
    let createCalledParams = null;
    User.findOne = async () => null; // Email not taken
    User.create = async (params) => {
      createCalledParams = params;
      return {
        _id: 'mock_created_user_id',
        name: params.name,
        email: params.email,
        passwordHash: params.passwordHash,
        role: params.role,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    };

    const regRes1 = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'JANE.DOE@EXAMPLE.COM',
        password: 'SecurePassword123!'
      })
    });
    const regData1 = await regRes1.json();

    assert(regRes1.status === 201, 'Registration returns HTTP 201 on success');
    assert(regData1.token && typeof regData1.token === 'string', 'Returns JWT token upon registration');
    assert(regData1.user && regData1.user.email === 'jane.doe@example.com', 'Normalized email returned in safe user object');
    assert(regData1.user.role === 'CUSTOMER', 'Default role assigned is CUSTOMER');
    assert(regData1.user.passwordHash === undefined, 'Never exposes passwordHash in response body');
    assert(createCalledParams && createCalledParams.passwordHash.startsWith('$2b$'), 'Password stored in database is bcrypt hash');

    // 3a-2. Successful Registration with Exact 72-byte Unicode Password
    const regResUnicode = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unicode User',
        email: 'unicode.user@example.com',
        password: '🔒'.repeat(18) // 18 * 4 = 72 bytes
      })
    });
    const regDataUnicode = await regResUnicode.json();
    assert(regResUnicode.status === 201, 'Registration accepts exact 72-byte Unicode password');
    assert(regDataUnicode.token && typeof regDataUnicode.token === 'string', 'Returns JWT token for Unicode password registration');

    // 3b. Privilege Escalation Prevention (Role injection attempt)
    console.log('\n--- 3b. Privilege Escalation Prevention ---');
    let privilegeAttemptParams = null;
    User.create = async (params) => {
      privilegeAttemptParams = params;
      return { _id: 'mock_user_role_test', ...params };
    };

    await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Eve',
        email: 'eve@evil.com',
        password: 'Password123!',
        role: 'OWNER'
      })
    });
    assert(privilegeAttemptParams.role === 'CUSTOMER', 'Reject client-supplied role: OWNER and enforces CUSTOMER');

    await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Staff Candidate',
        email: 'staff@example.com',
        password: 'Password123!',
        role: 'STAFF'
      })
    });
    assert(privilegeAttemptParams.role === 'CUSTOMER', 'Reject client-supplied role: STAFF and enforces CUSTOMER');

    // 3c. Validation Failures (Missing / Invalid Inputs)
    console.log('\n--- 3c. Registration Input Validation Failures ---');
    const invalidInputs = [
      { body: { email: 'a@b.com', password: 'Password123!' }, desc: 'Missing name' },
      { body: { name: '   ', email: 'a@b.com', password: 'Password123!' }, desc: 'Whitespace name' },
      { body: { name: 'Alice', password: 'Password123!' }, desc: 'Missing email' },
      { body: { name: 'Alice', email: 'not-an-email', password: 'Password123!' }, desc: 'Malformed email' },
      { body: { name: 'Alice', email: 'a@b.com' }, desc: 'Missing password' },
      { body: { name: 'Alice', email: 'a@b.com', password: 'short' }, desc: 'Password under 8 chars' },
      { body: { name: 'Alice', email: 'a@b.com', password: 'x'.repeat(75) }, desc: 'ASCII password over 72 bytes' },
      { body: { name: 'Alice', email: 'a@b.com', password: '🔒'.repeat(19) }, desc: 'Unicode emoji password over 72 bytes (76 bytes)' },
      { body: { name: 'Alice', email: 'a@b.com', password: 'é'.repeat(37) }, desc: '2-byte Unicode password over 72 bytes (74 bytes)' }
    ];

    for (const testCase of invalidInputs) {
      const res = await fetch(registerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.body)
      });
      const data = await res.json();
      assert(res.status === 400 && data.error === 'INVALID_INPUT', `Returns HTTP 400 on ${testCase.desc}`);
    }

    // 3d. Duplicate Email (Pre-check)
    console.log('\n--- 3d. Duplicate Email Pre-Check ---');
    User.findOne = async () => ({ _id: 'existing_user_id', email: 'taken@example.com' });
    let createCalledOnDuplicate = false;
    User.create = async () => { createCalledOnDuplicate = true; };

    const dupRes = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: 'taken@example.com',
        password: 'Password123!'
      })
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, 'Returns HTTP 409 when email already exists');
    assert(dupData.error === 'EMAIL_ALREADY_EXISTS', 'Returns error code EMAIL_ALREADY_EXISTS');
    assert(createCalledOnDuplicate === false, 'User.create not called on duplicate email');

    // 3e. Duplicate Key Race Condition (E11000)
    console.log('\n--- 3e. Duplicate Key Race Condition (E11000) ---');
    User.findOne = async () => null; // Pre-check passed
    User.create = async () => {
      const err = new Error('E11000 duplicate key error collection: crimepulse.users index: email_1');
      err.code = 11000;
      throw err;
    };

    const raceRes = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Race User',
        email: 'race@example.com',
        password: 'Password123!'
      })
    });
    const raceData = await raceRes.json();
    assert(raceRes.status === 409, 'Returns HTTP 409 when database throws E11000 duplicate key race');
    assert(raceData.error === 'EMAIL_ALREADY_EXISTS', 'Returns safe EMAIL_ALREADY_EXISTS error on E11000');

    // 3f. Unexpected Database Failures on Registration
    console.log('\n--- 3f. Unexpected Database Failure on Registration ---');
    User.findOne = async () => { throw new Error('DB connection reset'); };
    const dbErrRes = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', password: 'Password123!' })
    });
    const dbErrData = await dbErrRes.json();
    assert(dbErrRes.status === 500, 'Returns HTTP 500 on unexpected database error');
    assert(dbErrData.error === 'DATABASE_ERROR', 'Returns generic DATABASE_ERROR without leaking driver stack');

    // 3g. Missing JWT Secret on Registration
    console.log('\n--- 3g. Missing JWT Secret Configuration During Registration ---');
    User.findOne = async () => null;
    User.create = async (params) => ({ _id: 'user_jwt_fail', ...params });
    delete process.env.JWT_SECRET;

    const noSecretRes = await fetch(registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', password: 'Password123!' })
    });
    const noSecretData = await noSecretRes.json();
    assert(noSecretRes.status === 500, 'Returns HTTP 500 when JWT_SECRET is unconfigured');
    assert(noSecretData.error === 'CONFIGURATION_ERROR', 'Returns CONFIGURATION_ERROR without token');
    assert(noSecretData.token === undefined, 'No token issued when JWT_SECRET is missing');

    process.env.JWT_SECRET = originalJwtSecret || 'temporary_test_secret_for_suite';

    // =========================================================================
    // 4. LOGIN ENDPOINT TESTS (MOCKED DB)
    // =========================================================================
    console.log('\n--- 4. Login Endpoint Tests ---');

    const knownHash = await hashPassword('CorrectPassword123!');
    const mockUserDoc = {
      _id: 'mock_login_user_id',
      name: 'Valid User',
      email: 'valid.user@example.com',
      passwordHash: knownHash,
      role: 'CUSTOMER',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 4a. Successful Login
    console.log('\n--- 4a. Successful Login ---');
    User.findOne = () => ({
      select: async (fields) => {
        assert(fields === '+passwordHash', 'Explicitly selected +passwordHash in login query');
        return mockUserDoc;
      }
    });

    const loginRes1 = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'VALID.USER@EXAMPLE.COM', // Tests case-insensitivity
        password: 'CorrectPassword123!'
      })
    });
    const loginData1 = await loginRes1.json();

    assert(loginRes1.status === 200, 'Login returns HTTP 200 on valid credentials');
    assert(loginData1.token && typeof loginData1.token === 'string', 'Returns JWT token on login');
    assert(loginData1.user && loginData1.user.email === 'valid.user@example.com', 'Returns safe user object');
    assert(loginData1.password === undefined, 'Never exposes password in login response');

    // 4a-2. Successful Login with Exact 72-byte Unicode Password
    const unicode72Hash = await hashPassword('🔒'.repeat(18));
    const mockUnicodeUserDoc = {
      _id: 'mock_unicode_user_id',
      name: 'Unicode User',
      email: 'unicode.user@example.com',
      passwordHash: unicode72Hash,
      role: 'CUSTOMER',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    User.findOne = () => ({
      select: async () => mockUnicodeUserDoc
    });

    const loginResUnicode = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unicode.user@example.com',
        password: '🔒'.repeat(18)
      })
    });
    const loginDataUnicode = await loginResUnicode.json();
    assert(loginResUnicode.status === 200, 'Login succeeds with exact 72-byte Unicode password');
    assert(loginDataUnicode.token && typeof loginDataUnicode.token === 'string', 'Returns JWT token for Unicode login');

    // 4b. Incorrect Password
    console.log('\n--- 4b. Incorrect Password ---');
    const loginRes2 = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'valid.user@example.com',
        password: 'WrongPassword123!'
      })
    });
    const loginData2 = await loginRes2.json();

    assert(loginRes2.status === 401, 'Returns HTTP 401 on incorrect password');
    assert(loginData2.error === 'INVALID_CREDENTIALS', 'Returns error code INVALID_CREDENTIALS');
    assert(loginData2.message === 'Invalid email or password.', 'Returns generic message on incorrect password');
    assert(loginData2.token === undefined, 'No token issued on wrong password');

    // 4c. Unknown Email (Account Enumeration Defense)
    console.log('\n--- 4c. Unknown Email (Generic 401 Defense) ---');
    User.findOne = () => ({
      select: async () => null // User does not exist
    });

    const loginRes3 = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!'
      })
    });
    const loginData3 = await loginRes3.json();

    assert(loginRes3.status === 401, 'Returns HTTP 401 on unknown email');
    assert(loginData3.error === 'INVALID_CREDENTIALS', 'Returns identical INVALID_CREDENTIALS code');
    assert(loginData3.message === loginData2.message, 'Returns IDENTICAL error message preventing account enumeration');

    // 4d. Missing or Malformed Login Inputs
    console.log('\n--- 4d. Missing or Malformed Login Inputs ---');
    const invalidLoginInputs = [
      { body: { password: 'Password123!' }, desc: 'Missing email' },
      { body: { email: '   ', password: 'Password123!' }, desc: 'Empty email' },
      { body: { email: 'user@example.com' }, desc: 'Missing password' },
      { body: { email: 12345, password: 'Password123!' }, desc: 'Non-string email' },
      { body: { email: 'user@example.com', password: 12345 }, desc: 'Non-string password' },
      { body: { email: 'user@example.com', password: 'A'.repeat(73) }, desc: 'ASCII password exceeding 72 bytes' },
      { body: { email: 'user@example.com', password: '🔒'.repeat(19) }, desc: 'Unicode emoji password exceeding 72 bytes (76 bytes)' },
      { body: { email: 'user@example.com', password: 'é'.repeat(37) }, desc: '2-byte Unicode password exceeding 72 bytes (74 bytes)' }
    ];

    for (const tc of invalidLoginInputs) {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tc.body)
      });
      const data = await res.json();
      assert(res.status === 400 && data.error === 'INVALID_INPUT', `Returns HTTP 400 on ${tc.desc}`);
    }

    // 4e. Unexpected Database Failure During Login
    console.log('\n--- 4e. Unexpected Database Failure During Login ---');
    User.findOne = () => ({
      select: async () => { throw new Error('Database read socket timeout'); }
    });

    const loginDbErrRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'Password123!' })
    });
    const loginDbErrData = await loginDbErrRes.json();
    assert(loginDbErrRes.status === 500, 'Returns HTTP 500 on database error during login');
    assert(loginDbErrData.error === 'DATABASE_ERROR', 'Returns generic DATABASE_ERROR');

    // 4f. Missing JWT Secret During Login
    console.log('\n--- 4f. Missing JWT Secret During Login ---');
    User.findOne = () => ({
      select: async () => mockUserDoc
    });
    delete process.env.JWT_SECRET;

    const loginNoSecretRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid.user@example.com', password: 'CorrectPassword123!' })
    });
    const loginNoSecretData = await loginNoSecretRes.json();
    assert(loginNoSecretRes.status === 500, 'Returns HTTP 500 on login when JWT_SECRET is missing');
    assert(loginNoSecretData.error === 'CONFIGURATION_ERROR', 'Returns CONFIGURATION_ERROR');
    // Restore JWT_SECRET before Section 5
    process.env.JWT_SECRET = originalJwtSecret || 'temporary_test_secret_for_suite';

    // =========================================================================
    // 5. AUTHENTICATION MIDDLEWARE & PROTECTED /api/auth/me ENDPOINT TESTS
    // =========================================================================
    console.log('\n--- 5. Authentication Middleware & Protected /api/auth/me Tests ---');

    const testSecret = 'isolated_auth_test_secret_key_98765';
    process.env.JWT_SECRET = testSecret;

    const validUserDoc = {
      _id: 'auth_user_id_456',
      name: 'Authenticated User',
      email: 'auth.user@example.com',
      role: 'CUSTOMER',
      passwordHash: '$2b$10$SensitiveMockHashThatMustNeverLeak',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    };

    const validAuthToken = signToken({
      id: validUserDoc._id,
      email: validUserDoc.email,
      role: validUserDoc.role
    });

    // 5a. Missing Authorization header
    console.log('\n--- 5a. Missing Authorization Header ---');
    const noHeaderRes = await fetch(meUrl);
    const noHeaderData = await noHeaderRes.json();
    assert(noHeaderRes.status === 401, 'Rejects request missing Authorization header with HTTP 401');
    assert(noHeaderData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code on missing header');

    // 5b. Incorrect Authorization scheme
    console.log('\n--- 5b. Incorrect Authorization Scheme ---');
    const basicRes = await fetch(meUrl, {
      headers: { 'Authorization': 'Basic dXNlcjpwYXNzd29yZA==' }
    });
    const basicData = await basicRes.json();
    assert(basicRes.status === 401, 'Rejects non-Bearer authorization scheme (Basic) with HTTP 401');
    assert(basicData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error on invalid scheme');

    const tokenSchemeRes = await fetch(meUrl, {
      headers: { 'Authorization': 'Token xyz123' }
    });
    assert(tokenSchemeRes.status === 401, 'Rejects Token scheme with HTTP 401');

    const bareBearerRes = await fetch(meUrl, {
      headers: { 'Authorization': 'Bearer' }
    });
    assert(bareBearerRes.status === 401, 'Rejects bare Bearer without token with HTTP 401');

    // 5c. Empty Bearer token
    console.log('\n--- 5c. Empty Bearer Token ---');
    const emptyBearerRes = await fetch(meUrl, {
      headers: { 'Authorization': 'Bearer    ' }
    });
    assert(emptyBearerRes.status === 401, 'Rejects whitespace-only bearer token with HTTP 401');

    // 5d. Malformed token string
    console.log('\n--- 5d. Malformed Token String ---');
    const malformedRes = await fetch(meUrl, {
      headers: { 'Authorization': 'Bearer not.a.valid.jwt.structure' }
    });
    const malformedData = await malformedRes.json();
    assert(malformedRes.status === 401, 'Rejects malformed token string with HTTP 401');
    assert(malformedData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED on malformed token');

    // 5e. Invalid signature (signed with different secret)
    console.log('\n--- 5e. Invalid Signature ---');
    const wrongSecretToken = jwt.sign(
      { id: validUserDoc._id, email: validUserDoc.email, role: 'CUSTOMER' },
      'completely_different_untrusted_secret'
    );
    const wrongSigRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${wrongSecretToken}` }
    });
    const wrongSigData = await wrongSigRes.json();
    assert(wrongSigRes.status === 401, 'Rejects token signed with wrong secret with HTTP 401');
    assert(wrongSigData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED on invalid signature');

    // 5f. Expired token
    console.log('\n--- 5f. Expired Token ---');
    const expiredToken = jwt.sign(
      { id: validUserDoc._id, email: validUserDoc.email, role: 'CUSTOMER' },
      testSecret,
      { expiresIn: -10 } // Expired 10 seconds ago
    );
    const expiredRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    const expiredData = await expiredRes.json();
    assert(expiredRes.status === 401, 'Rejects expired token with HTTP 401');
    assert(expiredData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED on expired token');

    // 5g. Missing user identifier in token payload
    console.log('\n--- 5g. Missing User Identifier in Payload ---');
    const noUserIdToken = jwt.sign(
      { role: 'CUSTOMER', someOtherClaim: 'test' },
      testSecret,
      { expiresIn: '1h' }
    );
    const noUserIdRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${noUserIdToken}` }
    });
    const noUserIdData = await noUserIdRes.json();
    assert(noUserIdRes.status === 401, 'Rejects token missing user ID claim with HTTP 401');
    assert(noUserIdData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED on missing user ID');

    // 5h. Token referencing a deleted user (DB returns null)
    console.log('\n--- 5h. Token Referencing Deleted User ---');
    User.findById = async (id) => null; // User was deleted

    const deletedUserRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${validAuthToken}` }
    });
    const deletedUserData = await deletedUserRes.json();
    assert(deletedUserRes.status === 401, 'Rejects token referencing deleted user with HTTP 401');
    assert(deletedUserData.error === 'UNAUTHORIZED', 'Returns UNAUTHORIZED when user no longer exists');
    assert(deletedUserData.message === 'User account no longer exists.', 'Returns clear safe message for deleted account');

    // 5i. Database lookup failure during authentication
    console.log('\n--- 5i. Database Lookup Failure ---');
    User.findById = async () => {
      throw new Error('Database socket connection reset during auth check');
    };

    const dbFailRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${validAuthToken}` }
    });
    assert(dbFailRes.status === 500, 'Database failure returns HTTP 500 server error and is NOT misreported as 401 credentials error');

    // 5j. Current DB role taking precedence over stale token claim
    console.log('\n--- 5j. Current DB Role Precedence Over Stale Token Role ---');
    const staleRoleToken = jwt.sign(
      { id: validUserDoc._id, email: validUserDoc.email, role: 'CUSTOMER' }, // Stale claim in token
      testSecret,
      { expiresIn: '1h' }
    );

    User.findById = async (id) => ({
      _id: id,
      name: 'Promoted Admin',
      email: 'admin@example.com',
      role: 'OWNER', // Real current role in database
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const roleRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${staleRoleToken}` }
    });
    const roleData = await roleRes.json();
    assert(roleRes.status === 200, 'Protected endpoint returns HTTP 200 on valid authenticated session');
    assert(roleData.user.role === 'OWNER', 'Current database role (OWNER) takes precedence over stale token role (CUSTOMER)');

    // 5k. Successful GET /api/auth/me and Safe Response Serialization
    console.log('\n--- 5k. Successful GET /api/auth/me & Safe Serialization ---');
    User.findById = async (id) => validUserDoc;

    const meRes = await fetch(meUrl, {
      headers: { 'Authorization': `Bearer ${validAuthToken}` }
    });
    const meData = await meRes.json();

    assert(meRes.status === 200, 'GET /api/auth/me returns HTTP 200 for authenticated user');
    assert(meData.user !== undefined, 'Returns user profile object');
    assert(meData.user.id === 'auth_user_id_456', 'Returns correct user id');
    assert(meData.user.name === 'Authenticated User', 'Returns correct user name');
    assert(meData.user.email === 'auth.user@example.com', 'Returns correct user email');
    assert(meData.user.role === 'CUSTOMER', 'Returns correct user role');
    assert(meData.user.createdAt !== undefined, 'Returns user createdAt timestamp');
    assert(meData.user.passwordHash === undefined, 'Never exposes passwordHash in /api/auth/me response');
    assert(meData.passwordHash === undefined, 'passwordHash strictly omitted from root response');

  } finally {
    // Restore original references
    User.create = originalUserCreate;
    User.findOne = originalUserFindOne;
    User.findById = originalUserFindById;
    process.env.JWT_SECRET = originalJwtSecret;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n--- AUTHENTICATION SECURITY TEST SUMMARY: ${passed} Passed | ${failed} Failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
