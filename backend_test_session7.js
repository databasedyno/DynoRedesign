/**
 * Backend Test Script - Session 7
 * 3-Bug Fix Batch: crypto amount rounding / empty volume chart / transparent mobile nav
 * 
 * CRITICAL SAFETY: READ-ONLY testing against LIVE PRODUCTION PostgreSQL
 * Only allowed mutation: POST /api/user/login with hostbay@moxx.co
 */

const BASE_URL = 'https://payment-config-hub-3.preview.emergentagent.com/api';
const TEST_EMAIL = 'hostbay@moxx.co';
const TEST_PASSWORD = 'Katiekendra123@';

// Test results storage
const results = {
  testA: { name: 'formatCryptoAmount Unit Tests', status: 'PENDING', details: [] },
  testB: { name: 'Dashboard Chart Endpoint', status: 'PENDING', details: [] },
  testC: { name: 'Notifications List Endpoint', status: 'PENDING', details: [] },
  testD: { name: 'Core Regression Tests', status: 'PENDING', details: [] },
};

// ============================================
// TEST A: formatCryptoAmount Unit Tests (Offline)
// ============================================
async function testA_formatCryptoAmount() {
  console.log('\n========================================');
  console.log('TEST A: formatCryptoAmount Unit Tests');
  console.log('========================================\n');

  try {
    // Import the function from backend (TypeScript, so we need to use the compiled version or ts-node)
    // For now, we'll test via a separate TypeScript execution
    const { execSync } = require('child_process');
    
    const testCases = [
      { input: [0.00033163515000000004, 'BTC'], expected: '0.00033164', description: 'BTC with float artifact' },
      { input: [0.6540538533333333, 'LTC'], expected: '0.65405385', description: 'LTC with repeating decimal' },
      { input: [100, 'USDT-ERC20'], expected: '100', description: 'USDT-ERC20 whole number' },
      { input: [0.0010784926928571429, 'BTC'], expected: '0.00107849', description: 'BTC small amount' },
      { input: ['0.687272', 'LTC'], expected: '0.687272', description: 'LTC string input' },
      { input: [20.62, 'USD'], expected: '20.62', description: 'USD fiat amount' },
      { input: [0.00000001, 'BTC'], expected: '0.00000001', description: 'BTC satoshi (no scientific notation)' },
      { input: [100.00, 'USDT-ERC20'], expected: '100', description: 'USDT trailing zeros removed' },
      { input: [0.65400000, 'LTC'], expected: '0.654', description: 'LTC trailing zeros removed' },
    ];

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
      const [amount, currency] = testCase.input;
      const result = formatCryptoAmount(amount, currency);
      const success = result === testCase.expected;

      if (success) {
        passed++;
        console.log(`✅ PASS: ${testCase.description}`);
        console.log(`   Input: (${amount}, '${currency}') → Output: "${result}"`);
      } else {
        failed++;
        console.log(`❌ FAIL: ${testCase.description}`);
        console.log(`   Input: (${amount}, '${currency}')`);
        console.log(`   Expected: "${testCase.expected}"`);
        console.log(`   Got: "${result}"`);
      }

      results.testA.details.push({
        description: testCase.description,
        input: testCase.input,
        expected: testCase.expected,
        actual: result,
        passed: success,
      });
    }

    // Check for scientific notation
    const scientificTest = formatCryptoAmount(0.00000001, 'BTC');
    const hasScientific = scientificTest.includes('e') || scientificTest.includes('E');
    
    if (hasScientific) {
      failed++;
      console.log(`❌ FAIL: Scientific notation detected for small values`);
      console.log(`   Input: (0.00000001, 'BTC') → Output: "${scientificTest}"`);
      results.testA.details.push({
        description: 'No scientific notation for small values',
        passed: false,
        actual: scientificTest,
      });
    } else {
      passed++;
      console.log(`✅ PASS: No scientific notation for small values`);
      results.testA.details.push({
        description: 'No scientific notation for small values',
        passed: true,
      });
    }

    results.testA.status = failed === 0 ? 'PASS' : 'FAIL';
    results.testA.summary = `${passed} passed, ${failed} failed out of ${testCases.length + 1} tests`;
    
    console.log(`\n📊 Test A Summary: ${results.testA.summary}`);
    console.log(`Status: ${results.testA.status}\n`);

  } catch (error) {
    results.testA.status = 'ERROR';
    results.testA.error = error.message;
    console.error(`❌ ERROR in Test A: ${error.message}`);
    console.error(error.stack);
  }
}

// ============================================
// TEST B: Dashboard Chart Endpoint
// ============================================
async function testB_dashboardChart(bearerToken) {
  console.log('\n========================================');
  console.log('TEST B: Dashboard Chart Endpoint');
  console.log('========================================\n');

  try {
    const url = `${BASE_URL}/dashboard/chart?period=7d&company_id=1`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    const statusCode = response.status;
    console.log(`Status: ${statusCode}`);

    if (statusCode !== 200) {
      results.testB.status = 'FAIL';
      results.testB.details.push({
        check: 'HTTP Status',
        expected: 200,
        actual: statusCode,
        passed: false,
      });
      const errorText = await response.text();
      console.log(`❌ FAIL: Expected 200, got ${statusCode}`);
      console.log(`Response: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`Response received with ${JSON.stringify(data).length} bytes`);

    // Check for chart_data
    if (!data.chart_data) {
      results.testB.status = 'FAIL';
      results.testB.details.push({
        check: 'chart_data exists',
        passed: false,
        actual: 'chart_data field missing',
      });
      console.log(`❌ FAIL: chart_data field missing in response`);
      return;
    }

    console.log(`✅ chart_data field present`);

    // Check for 8 daily buckets
    const bucketCount = data.chart_data.length;
    const expectedBuckets = 8;
    
    if (bucketCount !== expectedBuckets) {
      console.log(`⚠️  WARNING: Expected ${expectedBuckets} buckets, got ${bucketCount}`);
      results.testB.details.push({
        check: 'Bucket count',
        expected: expectedBuckets,
        actual: bucketCount,
        passed: false,
      });
    } else {
      console.log(`✅ Correct bucket count: ${bucketCount}`);
      results.testB.details.push({
        check: 'Bucket count',
        expected: expectedBuckets,
        actual: bucketCount,
        passed: true,
      });
    }

    // Check for at least some volume > 0
    let bucketsWithVolume = 0;
    let totalVolume = 0;
    
    console.log('\nDaily buckets:');
    data.chart_data.forEach((bucket, index) => {
      const date = bucket.date || bucket.day || 'unknown';
      const volume = parseFloat(bucket.volume || bucket.total_volume || 0);
      totalVolume += volume;
      
      if (volume > 0) {
        bucketsWithVolume++;
        console.log(`  ${index + 1}. ${date}: $${volume.toFixed(2)} ✅`);
      } else {
        console.log(`  ${index + 1}. ${date}: $${volume.toFixed(2)}`);
      }
    });

    console.log(`\nTotal volume across all buckets: $${totalVolume.toFixed(2)}`);
    console.log(`Buckets with volume > 0: ${bucketsWithVolume}/${bucketCount}`);

    if (bucketsWithVolume === 0) {
      results.testB.status = 'FAIL';
      results.testB.details.push({
        check: 'At least some volume > 0',
        expected: 'Several buckets with volume',
        actual: 'All buckets have 0 volume',
        passed: false,
      });
      console.log(`❌ FAIL: All buckets have 0 volume`);
    } else {
      results.testB.status = 'PASS';
      results.testB.details.push({
        check: 'At least some volume > 0',
        expected: 'Several buckets with volume',
        actual: `${bucketsWithVolume} buckets with volume`,
        passed: true,
      });
      console.log(`✅ PASS: Found ${bucketsWithVolume} buckets with volume > 0`);
    }

    // Check for specific date mentioned in test (2026-07-02 ≈ 368.28)
    const july2Bucket = data.chart_data.find(b => 
      (b.date || b.day || '').includes('2026-07-02')
    );
    
    if (july2Bucket) {
      const july2Volume = parseFloat(july2Bucket.volume || july2Bucket.total_volume || 0);
      console.log(`\n2026-07-02 volume: $${july2Volume.toFixed(2)}`);
      
      if (july2Volume > 0) {
        console.log(`✅ 2026-07-02 has volume (expected ≈ $368.28)`);
      }
    }

  } catch (error) {
    results.testB.status = 'ERROR';
    results.testB.error = error.message;
    console.error(`❌ ERROR in Test B: ${error.message}`);
    console.error(error.stack);
  }
}

// ============================================
// TEST C: Notifications List Endpoint
// ============================================
async function testC_notificationsList(bearerToken) {
  console.log('\n========================================');
  console.log('TEST C: Notifications List Endpoint');
  console.log('========================================\n');

  try {
    const url = `${BASE_URL}/notifications`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
    });

    const statusCode = response.status;
    console.log(`Status: ${statusCode}`);

    if (statusCode !== 200) {
      results.testC.status = 'FAIL';
      results.testC.details.push({
        check: 'HTTP Status',
        expected: 200,
        actual: statusCode,
        passed: false,
      });
      const errorText = await response.text();
      console.log(`❌ FAIL: Expected 200, got ${statusCode}`);
      console.log(`Response: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`Response received`);

    // Check for items array
    const items = data.notifications || data.items || data.data || [];
    
    if (!Array.isArray(items)) {
      results.testC.status = 'FAIL';
      results.testC.details.push({
        check: 'Items array exists',
        passed: false,
        actual: 'No items array found',
      });
      console.log(`❌ FAIL: No items array found in response`);
      console.log(`Response structure: ${JSON.stringify(Object.keys(data))}`);
      return;
    }

    console.log(`✅ Found ${items.length} notification items`);

    if (items.length === 0) {
      results.testC.status = 'PASS';
      results.testC.details.push({
        check: 'Items have title+message',
        passed: true,
        actual: 'No notifications (empty list is valid)',
      });
      console.log(`✅ PASS: Empty notifications list (valid state)`);
      return;
    }

    // Check first few items for title+message
    let itemsWithTitleAndMessage = 0;
    let itemsWithLongDecimals = 0;

    console.log(`\nChecking first ${Math.min(5, items.length)} notifications:`);
    
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const item = items[i];
      const hasTitle = !!item.title;
      const hasMessage = !!item.message;
      
      console.log(`\n  Notification ${i + 1}:`);
      console.log(`    Title: ${hasTitle ? '✅' : '❌'} ${item.title ? `"${item.title.substring(0, 50)}..."` : 'missing'}`);
      console.log(`    Message: ${hasMessage ? '✅' : '❌'} ${item.message ? `"${item.message.substring(0, 80)}..."` : 'missing'}`);
      
      if (hasTitle && hasMessage) {
        itemsWithTitleAndMessage++;
      }

      // Check for long decimals (historical messages may still contain them - EXPECTED)
      if (item.message) {
        const longDecimalPattern = /\d+\.\d{10,}/;
        if (longDecimalPattern.test(item.message)) {
          itemsWithLongDecimals++;
          console.log(`    ℹ️  Contains long decimal (EXPECTED for historical messages)`);
        }
      }
    }

    if (itemsWithLongDecimals > 0) {
      console.log(`\n📝 Note: ${itemsWithLongDecimals} historical messages contain long decimals (EXPECTED - client-side rounding handles history)`);
    }

    if (itemsWithTitleAndMessage === 0) {
      results.testC.status = 'FAIL';
      results.testC.details.push({
        check: 'Items have title+message',
        expected: 'At least some items with title+message',
        actual: 'No items have both title and message',
        passed: false,
      });
      console.log(`\n❌ FAIL: No items have both title and message`);
    } else {
      results.testC.status = 'PASS';
      results.testC.details.push({
        check: 'Items have title+message',
        expected: 'Items with title+message',
        actual: `${itemsWithTitleAndMessage} items have title+message`,
        passed: true,
      });
      console.log(`\n✅ PASS: ${itemsWithTitleAndMessage} items have title+message`);
    }

  } catch (error) {
    results.testC.status = 'ERROR';
    results.testC.error = error.message;
    console.error(`❌ ERROR in Test C: ${error.message}`);
    console.error(error.stack);
  }
}

// ============================================
// TEST D: Core Regression Tests
// ============================================
async function testD_coreRegression(csrfToken, cookies) {
  console.log('\n========================================');
  console.log('TEST D: Core Regression Tests');
  console.log('========================================\n');

  const tests = [];

  // D1: GET /api/ → 200
  try {
    console.log('D1: GET /api/');
    const response = await fetch(`${BASE_URL}/`, {
      method: 'GET',
    });
    const statusCode = response.status;
    console.log(`Status: ${statusCode}`);
    
    const passed = statusCode === 200;
    tests.push({
      name: 'GET /api/ → 200',
      expected: 200,
      actual: statusCode,
      passed,
    });
    
    if (passed) {
      console.log(`✅ PASS\n`);
    } else {
      console.log(`❌ FAIL: Expected 200, got ${statusCode}\n`);
    }
  } catch (error) {
    tests.push({
      name: 'GET /api/ → 200',
      passed: false,
      error: error.message,
    });
    console.error(`❌ ERROR: ${error.message}\n`);
  }

  // D2: GET /api/csrf-token → 200
  try {
    console.log('D2: GET /api/csrf-token');
    const response = await fetch(`${BASE_URL}/csrf-token`, {
      method: 'GET',
    });
    const statusCode = response.status;
    console.log(`Status: ${statusCode}`);
    
    const passed = statusCode === 200;
    tests.push({
      name: 'GET /api/csrf-token → 200',
      expected: 200,
      actual: statusCode,
      passed,
    });
    
    if (passed) {
      console.log(`✅ PASS\n`);
    } else {
      console.log(`❌ FAIL: Expected 200, got ${statusCode}\n`);
    }
  } catch (error) {
    tests.push({
      name: 'GET /api/csrf-token → 200',
      passed: false,
      error: error.message,
    });
    console.error(`❌ ERROR: ${error.message}\n`);
  }

  // D3: Wrong password login → 401
  try {
    console.log('D3: POST /api/user/login with wrong password');
    console.log('Using bogus password for hostbay (ONCE only to avoid lockout)');
    
    const response = await fetch(`${BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Cookie': cookies,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: 'WrongPassword123!',
      }),
    });
    
    const statusCode = response.status;
    console.log(`Status: ${statusCode}`);
    
    const passed = statusCode === 401;
    tests.push({
      name: 'Wrong password login → 401',
      expected: 401,
      actual: statusCode,
      passed,
    });
    
    if (passed) {
      console.log(`✅ PASS: Correctly rejected wrong password\n`);
    } else {
      console.log(`❌ FAIL: Expected 401, got ${statusCode}\n`);
      const responseText = await response.text();
      console.log(`Response: ${responseText}\n`);
    }
  } catch (error) {
    tests.push({
      name: 'Wrong password login → 401',
      passed: false,
      error: error.message,
    });
    console.error(`❌ ERROR: ${error.message}\n`);
  }

  // Summary
  const passedCount = tests.filter(t => t.passed).length;
  const failedCount = tests.filter(t => !t.passed).length;
  
  results.testD.status = failedCount === 0 ? 'PASS' : 'FAIL';
  results.testD.details = tests;
  results.testD.summary = `${passedCount} passed, ${failedCount} failed out of ${tests.length} tests`;
  
  console.log(`📊 Test D Summary: ${results.testD.summary}`);
  console.log(`Status: ${results.testD.status}\n`);
}

// ============================================
// Login Helper (CSRF + Login)
// ============================================
async function login() {
  console.log('\n========================================');
  console.log('LOGIN: Authenticating as hostbay@moxx.co');
  console.log('========================================\n');

  try {
    // Step 1: Get CSRF token
    console.log('Step 1: GET /api/csrf-token');
    const csrfResponse = await fetch(`${BASE_URL}/csrf-token`, {
      method: 'GET',
    });

    if (csrfResponse.status !== 200) {
      throw new Error(`CSRF token request failed: ${csrfResponse.status}`);
    }

    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken || csrfData.token;
    
    // Extract cookies
    const setCookieHeaders = csrfResponse.headers.raw()['set-cookie'] || [];
    const cookies = setCookieHeaders.join('; ');
    
    console.log(`✅ CSRF token obtained: ${csrfToken.substring(0, 20)}...`);
    console.log(`✅ Cookies: ${cookies.substring(0, 50)}...\n`);

    // Step 2: Login
    console.log('Step 2: POST /api/user/login');
    const loginResponse = await fetch(`${BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Cookie': cookies,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const loginStatus = loginResponse.status;
    console.log(`Status: ${loginStatus}`);

    if (loginStatus !== 200) {
      const errorText = await loginResponse.text();
      throw new Error(`Login failed: ${loginStatus} - ${errorText}`);
    }

    const loginData = await loginResponse.json();
    const bearerToken = loginData.accessToken || loginData.token;

    if (!bearerToken) {
      throw new Error('No bearer token in login response');
    }

    console.log(`✅ Login successful`);
    console.log(`✅ Bearer token obtained: ${bearerToken.substring(0, 30)}...\n`);

    return { bearerToken, csrfToken, cookies };

  } catch (error) {
    console.error(`❌ LOGIN ERROR: ${error.message}`);
    throw error;
  }
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Backend Test Suite - Session 7                                ║');
  console.log('║  3-Bug Fix Batch Testing                                       ║');
  console.log('║  Base URL: ' + BASE_URL.substring(0, 40) + '...║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Test A: Offline unit tests (no auth needed)
    await testA_formatCryptoAmount();

    // Login once for Tests B, C, D
    const { bearerToken, csrfToken, cookies } = await login();

    // Test B: Dashboard chart
    await testB_dashboardChart(bearerToken);

    // Test C: Notifications list
    await testC_notificationsList(bearerToken);

    // Test D: Core regression (includes wrong password test)
    await testD_coreRegression(csrfToken, cookies);

    // Final Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  FINAL TEST SUMMARY                                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    Object.entries(results).forEach(([key, result]) => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${statusIcon} ${key.toUpperCase()}: ${result.name} - ${result.status}`);
      if (result.summary) {
        console.log(`   ${result.summary}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const allPassed = Object.values(results).every(r => r.status === 'PASS');
    
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED');
    } else {
      console.log('⚠️  SOME TESTS FAILED - See details above');
    }
    console.log('='.repeat(70) + '\n');

    // Return results for programmatic access
    return results;

  } catch (error) {
    console.error('\n❌ FATAL ERROR during test execution:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('Test execution completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, results };
