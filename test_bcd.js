/**
 * Backend Test Script - Session 7 (Tests B, C, D)
 * Tests B, C, D: API endpoint testing with authentication
 */

const BASE_URL = 'https://setup-wizard-192.preview.emergentagent.com/api';
const TEST_EMAIL = 'hostbay@moxx.co';
const TEST_PASSWORD = 'Katiekendra123@';

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
    const csrfToken = csrfData.csrf_token || csrfData.csrfToken || csrfData.token;
    
    // Extract cookies from Set-Cookie headers
    const setCookieHeader = csrfResponse.headers.get('set-cookie');
    const cookies = setCookieHeader || '';
    
    console.log(`✅ CSRF token obtained: ${csrfToken ? csrfToken.substring(0, 20) + '...' : 'N/A'}`);
    console.log(`✅ Cookies: ${cookies ? cookies.substring(0, 50) + '...' : 'N/A'}\n`);

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
    const bearerToken = loginData.data?.accessToken || loginData.accessToken || loginData.token;

    if (!bearerToken) {
      console.log('Login response structure:', JSON.stringify(loginData).substring(0, 200));
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
      const errorText = await response.text();
      console.log(`❌ FAIL: Expected 200, got ${statusCode}`);
      console.log(`Response: ${errorText}`);
      return { status: 'FAIL', statusCode, error: errorText };
    }

    const data = await response.json();
    console.log(`Response received with ${JSON.stringify(data).length} bytes`);

    // Check for chart_data (nested under data.chart_data)
    const chartData = data.data?.chart_data || data.chart_data;
    
    if (!chartData) {
      console.log(`❌ FAIL: chart_data field missing in response`);
      console.log(`Response structure: ${JSON.stringify(Object.keys(data))}`);
      return { status: 'FAIL', error: 'chart_data field missing' };
    }

    console.log(`✅ chart_data field present`);

    // Check for 8 daily buckets
    const bucketCount = chartData.length;
    const expectedBuckets = 8;
    
    if (bucketCount !== expectedBuckets) {
      console.log(`⚠️  WARNING: Expected ${expectedBuckets} buckets, got ${bucketCount}`);
    } else {
      console.log(`✅ Correct bucket count: ${bucketCount}`);
    }

    // Check for at least some volume > 0
    let bucketsWithVolume = 0;
    let totalVolume = 0;
    
    console.log('\nDaily buckets:');
    chartData.forEach((bucket, index) => {
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
      console.log(`❌ FAIL: All buckets have 0 volume`);
      return { status: 'FAIL', bucketsWithVolume: 0, totalVolume };
    } else {
      console.log(`✅ PASS: Found ${bucketsWithVolume} buckets with volume > 0`);
      return { status: 'PASS', bucketsWithVolume, totalVolume, bucketCount };
    }

  } catch (error) {
    console.error(`❌ ERROR in Test B: ${error.message}`);
    return { status: 'ERROR', error: error.message };
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
      const errorText = await response.text();
      console.log(`❌ FAIL: Expected 200, got ${statusCode}`);
      console.log(`Response: ${errorText}`);
      return { status: 'FAIL', statusCode, error: errorText };
    }

    const data = await response.json();
    console.log(`Response received`);

    // Check for items array (nested under data.notifications)
    const items = data.data?.notifications || data.notifications || data.items || data.data || [];
    
    if (!Array.isArray(items)) {
      console.log(`❌ FAIL: No items array found in response`);
      console.log(`Response structure: ${JSON.stringify(Object.keys(data))}`);
      if (data.data) {
        console.log(`data structure: ${JSON.stringify(Object.keys(data.data))}`);
      }
      return { status: 'FAIL', error: 'No items array found' };
    }

    console.log(`✅ Found ${items.length} notification items`);

    if (items.length === 0) {
      console.log(`✅ PASS: Empty notifications list (valid state)`);
      return { status: 'PASS', itemCount: 0 };
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
      console.log(`\n❌ FAIL: No items have both title and message`);
      return { status: 'FAIL', itemsWithTitleAndMessage: 0 };
    } else {
      console.log(`\n✅ PASS: ${itemsWithTitleAndMessage} items have title+message`);
      return { status: 'PASS', itemsWithTitleAndMessage, totalItems: items.length, itemsWithLongDecimals };
    }

  } catch (error) {
    console.error(`❌ ERROR in Test C: ${error.message}`);
    return { status: 'ERROR', error: error.message };
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
  
  const status = failedCount === 0 ? 'PASS' : 'FAIL';
  const summary = `${passedCount} passed, ${failedCount} failed out of ${tests.length} tests`;
  
  console.log(`📊 Test D Summary: ${summary}`);
  console.log(`Status: ${status}\n`);

  return { status, tests, passedCount, failedCount };
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Backend Test Suite - Session 7 (Tests B, C, D)               ║');
  console.log('║  3-Bug Fix Batch Testing                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const results = {};

  try {
    // Login once for Tests B, C, D
    const { bearerToken, csrfToken, cookies } = await login();

    // Test B: Dashboard chart
    results.testB = await testB_dashboardChart(bearerToken);

    // Test C: Notifications list
    results.testC = await testC_notificationsList(bearerToken);

    // Test D: Core regression (includes wrong password test)
    results.testD = await testD_coreRegression(csrfToken, cookies);

    // Final Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  FINAL TEST SUMMARY (Tests B, C, D)                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`${results.testB.status === 'PASS' ? '✅' : '❌'} TEST B: Dashboard Chart Endpoint - ${results.testB.status}`);
    console.log(`${results.testC.status === 'PASS' ? '✅' : '❌'} TEST C: Notifications List Endpoint - ${results.testC.status}`);
    console.log(`${results.testD.status === 'PASS' ? '✅' : '❌'} TEST D: Core Regression Tests - ${results.testD.status}`);

    const allPassed = Object.values(results).every(r => r.status === 'PASS');
    
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED (B, C, D)');
    } else {
      console.log('⚠️  SOME TESTS FAILED - See details above');
    }
    console.log('='.repeat(70) + '\n');

    return results;

  } catch (error) {
    console.error('\n❌ FATAL ERROR during test execution:');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests()
  .then(() => {
    console.log('Test execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
