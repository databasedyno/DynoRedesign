/**
 * Backend Test Script for Webhook Redirect Fix + last_login_ip + Signup Geo Capture
 * 
 * Tests:
 * A) WEBHOOK REDIRECT - postWithSafeRedirects function
 * B) last_login_ip - getClientIp function
 * C) SIGNUP GEO - lookupCountry and captureSignupContext
 */

import { postWithSafeRedirects } from './utils/webhookRedirect';
import { getClientIp, lookupCountry, captureSignupContext } from './utils/clientContext';
import sequelize from './utils/dbInstance';
import { userModel } from './models';

// Test results tracking
const results: { test: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

function logTest(test: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ test, status, details });
  console.log(`\n${status === 'PASS' ? '✅' : '❌'} ${test}`);
  console.log(`   ${details}`);
}

// ============================================================================
// TEST A: WEBHOOK REDIRECT
// ============================================================================
async function testWebhookRedirect() {
  console.log('\n========================================');
  console.log('TEST A: WEBHOOK REDIRECT');
  console.log('========================================');

  // Test A.1: Follow 308 redirect
  try {
    console.log('\nA.1: Testing 308 redirect follow...');
    const result = await postWithSafeRedirects(
      'https://httpbin.org/redirect-to?url=https%3A%2F%2Fhttpbin.org%2Fanything&status_code=308',
      { test: 1 },
      {}
    );
    
    if (result.response.status === 200 && result.redirectChain.length >= 1) {
      logTest(
        'A.1: 308 Redirect Follow',
        'PASS',
        `Status: ${result.response.status}, Redirects: ${result.redirectChain.length}, Final URL: ${result.finalUrl}`
      );
    } else {
      logTest(
        'A.1: 308 Redirect Follow',
        'FAIL',
        `Expected status 200 and redirectChain.length >= 1, got status ${result.response.status} and ${result.redirectChain.length} redirects`
      );
    }
  } catch (error: any) {
    logTest(
      'A.1: 308 Redirect Follow',
      'FAIL',
      `Unexpected error: ${error.message}`
    );
  }

  // Test A.2: SSRF guard on redirect target (should throw)
  try {
    console.log('\nA.2: Testing SSRF guard on redirect to localhost...');
    await postWithSafeRedirects(
      'https://httpbin.org/redirect-to?url=http%3A%2F%2F127.0.0.1%2Fx&status_code=308',
      {},
      {}
    );
    
    logTest(
      'A.2: SSRF Guard on Redirect',
      'FAIL',
      'Expected function to throw, but it succeeded'
    );
  } catch (error: any) {
    const hasSecurityMessage = error.message && error.message.toLowerCase().includes('blocked by security guard');
    const hasNoRetry = error.noRetry === true;
    
    if (hasSecurityMessage && hasNoRetry) {
      logTest(
        'A.2: SSRF Guard on Redirect',
        'PASS',
        `Correctly threw with message: "${error.message}", noRetry: ${error.noRetry}`
      );
    } else {
      logTest(
        'A.2: SSRF Guard on Redirect',
        'FAIL',
        `Error thrown but missing expected properties. Message: "${error.message}", noRetry: ${error.noRetry}`
      );
    }
  }

  // Test A.3: No-redirect path (should work normally)
  try {
    console.log('\nA.3: Testing no-redirect path...');
    const result = await postWithSafeRedirects(
      'https://httpbin.org/status/200',
      {},
      {}
    );
    
    if (result.response.status === 200 && result.redirectChain.length === 0) {
      logTest(
        'A.3: No-Redirect Path',
        'PASS',
        `Status: ${result.response.status}, Redirects: ${result.redirectChain.length} (as expected)`
      );
    } else {
      logTest(
        'A.3: No-Redirect Path',
        'FAIL',
        `Expected status 200 and 0 redirects, got status ${result.response.status} and ${result.redirectChain.length} redirects`
      );
    }
  } catch (error: any) {
    logTest(
      'A.3: No-Redirect Path',
      'FAIL',
      `Unexpected error: ${error.message}`
    );
  }
}

// ============================================================================
// TEST B: last_login_ip - getClientIp
// ============================================================================
async function testGetClientIp() {
  console.log('\n========================================');
  console.log('TEST B: last_login_ip - getClientIp');
  console.log('========================================');

  // Create mock request with x-forwarded-for chain
  const mockReq = {
    headers: {
      'x-forwarded-for': '8.8.8.8, 10.0.0.1, 172.16.0.5'
    },
    ip: '10.0.0.1',
    socket: {}
  } as any;

  console.log('\nB.1: Testing getClientIp with x-forwarded-for chain...');
  const clientIp = getClientIp(mockReq);
  
  if (clientIp === '8.8.8.8') {
    logTest(
      'B.1: getClientIp Extracts First Hop',
      'PASS',
      `Correctly extracted first IP: "${clientIp}" from chain "8.8.8.8, 10.0.0.1, 172.16.0.5"`
    );
  } else {
    logTest(
      'B.1: getClientIp Extracts First Hop',
      'FAIL',
      `Expected "8.8.8.8", got "${clientIp}"`
    );
  }

  // Verify socialAuth.ts no longer stores raw header
  console.log('\nB.2: Verifying socialAuth.ts uses getClientIp...');
  try {
    const fs = require('fs');
    const socialAuthContent = fs.readFileSync('./controller/user/socialAuth.ts', 'utf8');
    
    const hasGetClientIpImport = socialAuthContent.includes('import { getClientIp');
    const usesGetClientIp = socialAuthContent.includes('getClientIp(req)');
    const hasRawHeaderAccess = socialAuthContent.includes('req.headers["x-forwarded-for"]') && 
                                !socialAuthContent.includes('// req.headers["x-forwarded-for"]');
    
    if (hasGetClientIpImport && usesGetClientIp && !hasRawHeaderAccess) {
      logTest(
        'B.2: socialAuth.ts Uses getClientIp',
        'PASS',
        'File imports and uses getClientIp, does not directly access x-forwarded-for header'
      );
    } else {
      logTest(
        'B.2: socialAuth.ts Uses getClientIp',
        'FAIL',
        `Import: ${hasGetClientIpImport}, Uses: ${usesGetClientIp}, Raw header access: ${hasRawHeaderAccess}`
      );
    }
  } catch (error: any) {
    logTest(
      'B.2: socialAuth.ts Uses getClientIp',
      'FAIL',
      `Error reading file: ${error.message}`
    );
  }
}

// ============================================================================
// TEST C: SIGNUP GEO CAPTURE
// ============================================================================
async function testSignupGeoCapture() {
  console.log('\n========================================');
  console.log('TEST C: SIGNUP GEO CAPTURE');
  console.log('========================================');

  // Test C.1: lookupCountry
  console.log('\nC.1: Testing lookupCountry with 8.8.8.8...');
  try {
    const country = await lookupCountry('8.8.8.8');
    
    if (country && country.length > 0) {
      logTest(
        'C.1: lookupCountry Returns Country',
        'PASS',
        `Returned country: "${country}" for IP 8.8.8.8`
      );
    } else {
      logTest(
        'C.1: lookupCountry Returns Country',
        'FAIL',
        `Expected non-null country string, got: ${country}`
      );
    }
  } catch (error: any) {
    logTest(
      'C.1: lookupCountry Returns Country',
      'FAIL',
      `Error: ${error.message}`
    );
  }

  // Test C.2: captureSignupContext (create throwaway user, test, then delete)
  console.log('\nC.2: Testing captureSignupContext with throwaway user...');
  let testUserId: number | null = null;
  
  try {
    // Create throwaway user
    const timestamp = Date.now();
    const testEmail = `qa-signup-geo-${timestamp}@dynopay-test.invalid`;
    const referralCode = `QA${timestamp}`.substring(0, 20);
    
    console.log(`   Creating throwaway user: ${testEmail}`);
    const createdUser = await userModel.create({
      name: 'QA Test User',
      email: testEmail,
      referral_code: referralCode,
      login_type: 'EMAIL',
      email_verified: false,
    });
    
    testUserId = createdUser.dataValues.user_id;
    console.log(`   Created user_id: ${testUserId}`);
    
    // Mock request with x-forwarded-for
    const mockReq = {
      headers: {
        'x-forwarded-for': '8.8.8.8, 10.0.0.1, 172.16.0.5'
      },
      ip: '10.0.0.1',
      socket: {}
    } as any;
    
    // Call captureSignupContext (non-blocking)
    console.log('   Calling captureSignupContext...');
    captureSignupContext(testUserId, mockReq);
    
    // Wait for async operation to complete (~4s as per spec)
    console.log('   Waiting 4500ms for async geo lookup...');
    await new Promise(resolve => setTimeout(resolve, 4500));
    
    // Query the user to check if signup_ip and signup_country were set
    console.log('   Querying user record...');
    const [rows] = await sequelize.query(
      'SELECT signup_ip, signup_country FROM tbl_user WHERE user_id = :userId',
      { replacements: { userId: testUserId } }
    );
    
    const userData = rows[0] as any;
    console.log(`   Result: signup_ip="${userData?.signup_ip}", signup_country="${userData?.signup_country}"`);
    
    if (userData?.signup_ip === '8.8.8.8' && userData?.signup_country && userData.signup_country.length > 0) {
      logTest(
        'C.2: captureSignupContext Captures IP & Country',
        'PASS',
        `signup_ip: "${userData.signup_ip}", signup_country: "${userData.signup_country}"`
      );
    } else {
      logTest(
        'C.2: captureSignupContext Captures IP & Country',
        'FAIL',
        `Expected signup_ip="8.8.8.8" and non-null country, got signup_ip="${userData?.signup_ip}", signup_country="${userData?.signup_country}"`
      );
    }
    
    // Clean up: delete the throwaway user
    console.log(`   Cleaning up: deleting user_id ${testUserId}...`);
    await sequelize.query(
      'DELETE FROM tbl_user WHERE user_id = :userId',
      { replacements: { userId: testUserId } }
    );
    
    // Verify deletion
    const [checkRows] = await sequelize.query(
      'SELECT user_id FROM tbl_user WHERE user_id = :userId',
      { replacements: { userId: testUserId } }
    );
    
    if (checkRows.length === 0) {
      console.log('   ✓ Cleanup successful: user deleted');
    } else {
      console.log('   ⚠ Warning: user may not have been deleted');
    }
    
  } catch (error: any) {
    logTest(
      'C.2: captureSignupContext Captures IP & Country',
      'FAIL',
      `Error: ${error.message}`
    );
    
    // Attempt cleanup even on error
    if (testUserId) {
      try {
        console.log(`   Attempting cleanup of user_id ${testUserId}...`);
        await sequelize.query(
          'DELETE FROM tbl_user WHERE user_id = :userId',
          { replacements: { userId: testUserId } }
        );
        console.log('   ✓ Cleanup successful');
      } catch (cleanupError: any) {
        console.log(`   ⚠ Cleanup failed: ${cleanupError.message}`);
      }
    }
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  BACKEND TEST: Webhook Redirect + last_login_ip + Signup Geo  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  try {
    await testWebhookRedirect();
    await testGetClientIp();
    await testSignupGeoCapture();
    
    // Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const total = results.length;
    
    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED');
      console.log('\nFailed tests:');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.test}: ${r.details}`);
      });
    }
    
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();
