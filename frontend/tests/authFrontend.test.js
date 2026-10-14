import {
  validateName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  getUtf8ByteLength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES
} from '../src/utils/validation.js';
import { getToken, setToken, clearToken } from '../src/services/tokenService.js';
import {
  apiFetch,
  registerUser,
  loginUser,
  getCurrentUser,
  ApiError
} from '../src/services/apiService.js';

const runTests = async () => {
  console.log('=== STARTING FRONTEND AUTHENTICATION UNIT & INTEGRATION TESTS ===\n');

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
  // 1. Validation Logic Unit Tests
  // =========================================================================
  console.log('--- 1. Validation Rules & Policy Tests ---');

  // Name validation
  testAssert(!validateName('').isValid, 'Rejects empty name');
  testAssert(!validateName('   ').isValid, 'Rejects whitespace-only name');
  testAssert(!validateName('A'.repeat(101)).isValid, 'Rejects name exceeding 100 characters');
  testAssert(validateName('Analyst Maya').isValid, 'Accepts valid name');

  // Email validation
  testAssert(!validateEmail('').isValid, 'Rejects empty email');
  testAssert(!validateEmail('invalid-email').isValid, 'Rejects email missing @');
  testAssert(!validateEmail('test@').isValid, 'Rejects incomplete email');
  testAssert(!validateEmail('test@domain').isValid, 'Rejects email missing top-level domain');
  testAssert(validateEmail('analyst@crimepulse.org').isValid, 'Accepts standard email format');
  testAssert(validateEmail('test.analyst+tag@sub.domain.co.in').isValid, 'Accepts complex valid email');

  // Password validation (Length & Bcrypt 72-byte Limit)
  testAssert(MAX_PASSWORD_BYTES === 72, 'MAX_PASSWORD_BYTES equals 72');
  testAssert(typeof apiFetch === 'function', 'apiFetch is an exported function');
  testAssert(!validatePassword('short').isValid, `Rejects password under ${MIN_PASSWORD_LENGTH} characters`);
  testAssert(validatePassword('12345678').isValid, 'Accepts exact 8-character password');
  
  const ascii72 = 'A'.repeat(72);
  testAssert(validatePassword(ascii72).isValid, 'Accepts exact 72-byte ASCII boundary password');
  testAssert(getUtf8ByteLength(ascii72) === 72, 'Accurately computes 72 UTF-8 bytes for ASCII string');

  const ascii73 = 'A'.repeat(73);
  testAssert(!validatePassword(ascii73).isValid, 'Rejects 73-byte ASCII password exceeding 72-byte limit');

  // Multibyte Unicode passwords (e.g. 4-byte emojis, 3-byte characters)
  const emoji18 = '🔒'.repeat(18); // 18 * 4 = 72 bytes
  testAssert(getUtf8ByteLength(emoji18) === 72, 'Accurately computes 72 UTF-8 bytes for 18 emojis');
  testAssert(validatePassword(emoji18).isValid, 'Accepts exact 72-byte emoji password');

  const emoji19 = '🔒'.repeat(19); // 19 * 4 = 76 bytes
  testAssert(getUtf8ByteLength(emoji19) === 76, 'Accurately computes 76 UTF-8 bytes for 19 emojis');
  testAssert(!validatePassword(emoji19).isValid, 'Rejects 76-byte emoji password exceeding 72-byte limit');

  // Password confirmation
  testAssert(!validatePasswordConfirmation('secret123', '').isValid, 'Rejects empty confirm password');
  testAssert(!validatePasswordConfirmation('secret123', 'different').isValid, 'Rejects mismatched passwords');
  testAssert(validatePasswordConfirmation('secret123', 'secret123').isValid, 'Accepts matching passwords');

  // =========================================================================
  // 2. Token Storage Service Tests
  // =========================================================================
  console.log('\n--- 2. Token Storage Service Tests ---');

  // Mock localStorage for Node runtime
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };

  clearToken();
  testAssert(getToken() === null, 'getToken returns null initially');

  setToken('mock_jwt_token_abc');
  testAssert(getToken() === 'mock_jwt_token_abc', 'setToken stores and retrieves token');

  setToken('  padded_token_xyz  ');
  testAssert(getToken() === 'padded_token_xyz', 'setToken trims whitespace from token');

  clearToken();
  testAssert(getToken() === null, 'clearToken removes token from storage');

  // =========================================================================
  // 3. API Client & Headers Tests
  // =========================================================================
  console.log('\n--- 3. API Client Request Construction & Error Handling ---');

  const originalFetch = globalThis.fetch;

  try {
    // 3a. Attaches Authorization header when token is stored
    let capturedHeaders = null;
    let capturedBody = null;
    let capturedMethod = null;

    globalThis.fetch = async (url, options) => {
      capturedHeaders = options.headers;
      capturedBody = options.body;
      capturedMethod = options.method;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ user: { id: 'user_123', name: 'Test User' } })
      };
    };

    setToken('test_bearer_token');
    await getCurrentUser();
    testAssert(capturedHeaders.Authorization === 'Bearer test_bearer_token', 'apiFetch attaches Bearer token from storage');
    testAssert(capturedHeaders.Accept === 'application/json', 'apiFetch sets Accept: application/json');

    // 3b. Sets Content-Type and serializes body for POST requests
    setToken(null);
    await loginUser({ email: 'test@example.com', password: 'Password123' });
    testAssert(capturedHeaders['Content-Type'] === 'application/json', 'POST request includes Content-Type: application/json');
    testAssert(capturedHeaders.Authorization === undefined, 'Does not send Authorization header when token is null');
    testAssert(JSON.parse(capturedBody).email === 'test@example.com', 'Body correctly serialized to JSON string');
    testAssert(capturedMethod === 'POST', 'Method is POST');

    // 3c. Safe Error Mapping (HTTP 401 INVALID_CREDENTIALS)
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' })
    });

    try {
      await loginUser({ email: 'test@example.com', password: 'WrongPassword' });
      testAssert(false, 'Should throw ApiError on 401');
    } catch (err) {
      testAssert(err instanceof ApiError, 'Throws ApiError instance on non-2xx');
      testAssert(err.status === 401, 'ApiError retains HTTP status code 401');
      testAssert(err.code === 'INVALID_CREDENTIALS', 'ApiError retains error code INVALID_CREDENTIALS');
      testAssert(err.message === 'Invalid email or password.', 'ApiError preserves safe server message');
    }

    // 3d. Safe Network Error Mapping
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed: connection refused');
    };

    try {
      await getCurrentUser();
      testAssert(false, 'Should throw ApiError on network failure');
    } catch (err) {
      testAssert(err instanceof ApiError, 'Network failure throws ApiError');
      testAssert(err.code === 'NETWORK_ERROR', 'Network error has code NETWORK_ERROR');
      testAssert(err.status === 0, 'Network error status is 0');
      testAssert(err.message.includes('Unable to connect'), 'Network error has safe user message without stack trace');
    }

  } finally {
    globalThis.fetch = originalFetch;
    clearToken();
  }

  // =========================================================================
  // 4. Live Backend API Integration Tests (Real HTTP to Backend)
  // =========================================================================
  console.log('\n--- 4. Live Backend Integration Tests (Real Express HTTP) ---');

  // Verify running backend on port 5000 is accessible
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
    console.warn('⚠️ Express backend on port 5000 is not currently running. Skipping live HTTP tests.');
  } else {
    const uniqueTime = Date.now();
    const testUser = {
      name: 'Frontend Auth Test User',
      email: `frontend.auth.${uniqueTime}@crimepulse.internal`,
      password: 'StrongP@ssw0rd!2026'
    };

    // 4a. Live Register
    const regResult = await registerUser(testUser);
    testAssert(typeof regResult.token === 'string', 'Live register returns valid JWT token');
    testAssert(regResult.user && regResult.user.email === testUser.email, 'Live register returns user profile');
    testAssert(regResult.user.role === 'CUSTOMER', 'Live register enforces default CUSTOMER role');
    testAssert(regResult.user.passwordHash === undefined, 'Live register strictly omits passwordHash');

    // 4b. Live Login
    const loginResult = await loginUser({ email: testUser.email, password: testUser.password });
    testAssert(typeof loginResult.token === 'string', 'Live login returns valid JWT token');
    testAssert(loginResult.user.id === regResult.user.id, 'Live login returns matching user ID');

    // 4c. Live Invalid Login (401)
    try {
      await loginUser({ email: testUser.email, password: 'WrongPassword123' });
      testAssert(false, 'Live wrong password should fail');
    } catch (err) {
      testAssert(err.status === 401, 'Live invalid credentials return HTTP 401');
      testAssert(err.code === 'INVALID_CREDENTIALS', 'Returns error code INVALID_CREDENTIALS');
    }

    // 4d. Live Duplicate Register (409)
    try {
      await registerUser(testUser);
      testAssert(false, 'Live duplicate email should fail');
    } catch (err) {
      testAssert(err.status === 409, 'Live duplicate email returns HTTP 409');
      testAssert(err.code === 'EMAIL_ALREADY_EXISTS', 'Returns error code EMAIL_ALREADY_EXISTS');
    }

    // 4e. Live getCurrentUser (GET /api/auth/me) with token
    const meResult = await getCurrentUser(loginResult.token);
    testAssert(meResult.user && meResult.user.email === testUser.email, 'Live GET /api/auth/me returns valid user');
    testAssert(meResult.user.passwordHash === undefined, 'GET /api/auth/me strictly omits passwordHash');

    // 4f. Live Unauthenticated getCurrentUser (401)
    try {
      await getCurrentUser('invalid.tampered.token');
      testAssert(false, 'Invalid token should fail');
    } catch (err) {
      testAssert(err.status === 401, 'Invalid token returns HTTP 401');
      testAssert(err.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED for invalid token');
    }
    // 4g. Clean up the created test user from MongoDB Atlas
    try {
      const { execSync } = await import('node:child_process');
      const cleanScript = `const mongoose=require('mongoose'); const dotenv=require('dotenv'); dotenv.config(); mongoose.connect(process.env.MONGODB_URI).then(async ()=>{ await mongoose.connection.collection('users').deleteOne({ email: '${testUser.email}' }); await mongoose.connection.close(); }).catch(()=>{});`;
      execSync(`node -e "${cleanScript}"`, {
        cwd: 'c:/Users/user/Desktop/CrimePulse/backend',
        stdio: 'ignore'
      });
      console.log('  🧹 Cleaned up transient test user account from Atlas.');
    } catch {
      // Ignore if child_process/backend is unreachable
    }
  }

  console.log(`\n=== FRONTEND AUTH TEST SUMMARY: ${passed} Passed | ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
