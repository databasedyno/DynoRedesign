/**
 * Test script for phone-only user email verification bug fix
 * 
 * Bug: Phone-only users (email=null) were blocked by emailVerifiedMiddleware
 * Fix: Middleware now only blocks when email && !email_verified
 * 
 * Test cases:
 * A) Phone-only user (user_id 10) - should NOT be blocked
 * B) Email + unverified user - should still be blocked
 * C) Verified email user (user_id 3) - should NOT be blocked
 * D) Health check regression test
 */

require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const BASE_URL = 'https://payment-gateway-init-2.preview.emergentagent.com/api';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Database configuration from .env
const dbConfig = {
  host: process.env.HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
  ssl: { rejectUnauthorized: false }
};

/**
 * Mint a JWT token for a user (replicates getAccessToken)
 */
async function mintToken(userId) {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log(`\n[Token Mint] Fetching user_id ${userId} from database...`);
    
    const result = await client.query('SELECT * FROM tbl_user WHERE user_id = $1', [userId]);
    
    if (result.rows.length === 0) {
      throw new Error(`User ${userId} not found in database`);
    }
    
    const row = result.rows[0];
    
    // Remove sensitive fields (as per getAccessToken logic)
    delete row.password;
    delete row.telegram_id;
    
    console.log(`[Token Mint] User found: ${row.name || 'N/A'}, email: ${row.email || 'NULL'}, mobile: ${row.mobile || 'NULL'}, email_verified: ${row.email_verified}`);
    
    // Sign JWT token
    const token = jwt.sign(row, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30d' });
    
    console.log(`[Token Mint] JWT token generated (${token.length} chars)`);
    
    return { token, user: row };
  } finally {
    await client.end();
  }
}

/**
 * Test an endpoint with a bearer token
 */
async function testEndpoint(endpoint, token, description) {
  try {
    console.log(`\n[Test] ${description}`);
    console.log(`[Test] Endpoint: GET ${endpoint}`);
    
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': USER_AGENT
      },
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log(`[Test] Status: ${response.status}`);
    console.log(`[Test] Response:`, JSON.stringify(response.data, null, 2));
    
    // Check for email verification 403 message
    const isEmailVerification403 = 
      response.status === 403 && 
      response.data && 
      (
        (response.data.message && response.data.message.toLowerCase().includes('verify your email')) ||
        (response.data.message && response.data.message.toLowerCase().includes('check your inbox'))
      );
    
    return {
      status: response.status,
      data: response.data,
      isEmailVerification403
    };
  } catch (error) {
    console.error(`[Test] Error:`, error.message);
    return {
      status: error.response?.status || 'ERROR',
      data: error.response?.data || { error: error.message },
      isEmailVerification403: false,
      error: error.message
    };
  }
}

/**
 * Create a new unverified email user
 */
async function createUnverifiedUser() {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const email = `qa.unverif.${timestamp}@dynopaytest.com`;
    
    console.log(`\n[Create User] Creating new unverified user: ${email}`);
    
    const response = await axios.post(`${BASE_URL}/user/registerUser`, {
      name: 'QA Unverif',
      email: email,
      password: 'Test@12345'
    }, {
      headers: {
        'User-Agent': USER_AGENT
      },
      validateStatus: () => true
    });
    
    console.log(`[Create User] Status: ${response.status}`);
    console.log(`[Create User] Response:`, JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.data && response.data.data.accessToken) {
      console.log(`[Create User] User created successfully with token`);
      return {
        email,
        token: response.data.data.accessToken,
        success: true
      };
    } else {
      console.error(`[Create User] Failed to create user`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.error(`[Create User] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test health check endpoint
 */
async function testHealthCheck() {
  try {
    console.log(`\n[Health Check] Testing GET /api/`);
    
    const response = await axios.get(`${BASE_URL}/`, {
      headers: {
        'User-Agent': USER_AGENT
      },
      validateStatus: () => true
    });
    
    console.log(`[Health Check] Status: ${response.status}`);
    console.log(`[Health Check] Response:`, JSON.stringify(response.data, null, 2));
    
    return {
      status: response.status,
      data: response.data,
      pass: response.status === 200
    };
  } catch (error) {
    console.error(`[Health Check] Error:`, error.message);
    return {
      status: 'ERROR',
      error: error.message,
      pass: false
    };
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(80));
  console.log('EMAIL VERIFICATION BUG FIX TEST');
  console.log('Testing phone-only user access to protected endpoints');
  console.log('='.repeat(80));
  
  const results = {
    testA: { name: 'Phone-only user (user_id 10)', endpoints: [] },
    testB: { name: 'Email + unverified user', endpoints: [] },
    testC: { name: 'Verified email user (user_id 3)', endpoints: [] },
    testD: { name: 'Health check regression', result: null }
  };
  
  try {
    // TEST A: Phone-only user (user_id 10)
    console.log('\n' + '='.repeat(80));
    console.log('TEST A: PHONE-ONLY USER (user_id 10) - THE FIX');
    console.log('Expected: NO email verification 403 on any endpoint');
    console.log('='.repeat(80));
    
    const phoneUserToken = await mintToken(10);
    
    const phoneEndpoints = [
      '/company/getCompany',
      '/dashboard',
      '/wallet/getWallet'
    ];
    
    for (const endpoint of phoneEndpoints) {
      const result = await testEndpoint(endpoint, phoneUserToken.token, `Phone-only user → ${endpoint}`);
      results.testA.endpoints.push({
        endpoint,
        status: result.status,
        isEmailVerification403: result.isEmailVerification403,
        pass: !result.isEmailVerification403
      });
    }
    
    // TEST B: Email + unverified user
    console.log('\n' + '='.repeat(80));
    console.log('TEST B: EMAIL + UNVERIFIED USER (control)');
    console.log('Expected: HTTP 403 WITH email verification message');
    console.log('='.repeat(80));
    
    const unverifiedUser = await createUnverifiedUser();
    
    if (unverifiedUser.success) {
      const result = await testEndpoint('/company/getCompany', unverifiedUser.token, 'Unverified email user → /company/getCompany');
      results.testB.endpoints.push({
        endpoint: '/company/getCompany',
        status: result.status,
        isEmailVerification403: result.isEmailVerification403,
        pass: result.isEmailVerification403 // Should be blocked
      });
    } else {
      results.testB.error = 'Failed to create unverified user';
    }
    
    // TEST C: Verified email user (user_id 3)
    console.log('\n' + '='.repeat(80));
    console.log('TEST C: VERIFIED EMAIL USER (user_id 3)');
    console.log('Expected: NOT blocked by email middleware (HTTP 200 / normal response)');
    console.log('='.repeat(80));
    
    const verifiedUserToken = await mintToken(3);
    const result = await testEndpoint('/company/getCompany', verifiedUserToken.token, 'Verified email user → /company/getCompany');
    results.testC.endpoints.push({
      endpoint: '/company/getCompany',
      status: result.status,
      isEmailVerification403: result.isEmailVerification403,
      pass: !result.isEmailVerification403
    });
    
    // TEST D: Health check regression
    console.log('\n' + '='.repeat(80));
    console.log('TEST D: HEALTH CHECK REGRESSION');
    console.log('Expected: HTTP 200');
    console.log('='.repeat(80));
    
    const healthResult = await testHealthCheck();
    results.testD.result = healthResult;
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n[TEST A] Phone-only user (user_id 10):');
    let testAPassed = true;
    for (const ep of results.testA.endpoints) {
      const status = ep.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${ep.endpoint}: HTTP ${ep.status}, email-verification-403: ${ep.isEmailVerification403}`);
      if (!ep.pass) testAPassed = false;
    }
    
    console.log('\n[TEST B] Email + unverified user:');
    let testBPassed = true;
    for (const ep of results.testB.endpoints) {
      const status = ep.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${ep.endpoint}: HTTP ${ep.status}, email-verification-403: ${ep.isEmailVerification403}`);
      if (!ep.pass) testBPassed = false;
    }
    if (results.testB.error) {
      console.log(`  ❌ FAIL - ${results.testB.error}`);
      testBPassed = false;
    }
    
    console.log('\n[TEST C] Verified email user (user_id 3):');
    let testCPassed = true;
    for (const ep of results.testC.endpoints) {
      const status = ep.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status} - ${ep.endpoint}: HTTP ${ep.status}, email-verification-403: ${ep.isEmailVerification403}`);
      if (!ep.pass) testCPassed = false;
    }
    
    console.log('\n[TEST D] Health check:');
    const testDPassed = results.testD.result.pass;
    const status = testDPassed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} - GET /api/: HTTP ${results.testD.result.status}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('FINAL VERDICT');
    console.log('='.repeat(80));
    
    const allPassed = testAPassed && testBPassed && testCPassed && testDPassed;
    
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED');
      console.log('✅ Bug fix verified: Phone-only users can now access protected endpoints');
      console.log('✅ Email verification gate still works for email users');
      console.log('✅ Verified email users not blocked');
      console.log('✅ Health check operational');
    } else {
      console.log('❌ SOME TESTS FAILED');
      if (!testAPassed) console.log('❌ TEST A FAILED: Phone-only users still blocked');
      if (!testBPassed) console.log('❌ TEST B FAILED: Email verification gate not working');
      if (!testCPassed) console.log('❌ TEST C FAILED: Verified users blocked');
      if (!testDPassed) console.log('❌ TEST D FAILED: Health check not operational');
    }
    
    console.log('='.repeat(80));
    
    // Return results for programmatic use
    return {
      allPassed,
      testAPassed,
      testBPassed,
      testCPassed,
      testDPassed,
      results
    };
    
  } catch (error) {
    console.error('\n❌ TEST EXECUTION ERROR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run tests
runTests()
  .then((results) => {
    process.exit(results.allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
