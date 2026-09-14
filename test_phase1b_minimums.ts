/**
 * Phase 1b Testing: Consolidated Minimums + Per-Brand min_order_usd
 * 
 * Tests:
 * 1. UNIT: orderMinimums module functions
 * 2. SETTINGS API: updateCompany validation
 * 3. ENFORCEMENT/SURFACING: getData, configured-currencies, createCryptoPayment
 * 4. REGRESSION: health check
 */

import axios from 'axios';

// Import the orderMinimums module for unit tests
import {
  SURFACE_DEFAULT_MIN_USD,
  getEffectiveMinOrderUsd,
  normalizeMerchantMin,
  getMerchantMinOrderUsdByCompanyId,
  MERCHANT_MIN_ORDER_BOUNDS,
  type MinSurface
} from './backend/services/checkout/orderMinimums';

const BASE_URL = 'http://localhost:8001';
const OWNER_EMAIL = 'onarrival21@gmail.com';
const OWNER_PASSWORD = 'Katiekendra123@';

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function logTest(test: string, passed: boolean, details: string, error?: string) {
  results.push({ test, passed, details, error });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${test}`);
  console.log(`  ${details}`);
  if (error) console.log(`  Error: ${error}`);
}

// ============================================================================
// TEST 1: UNIT TESTS (orderMinimums module)
// ============================================================================

async function test1_unitTests() {
  console.log('\n=== TEST 1: UNIT TESTS (orderMinimums module) ===\n');

  // Test 1a: SURFACE_DEFAULT_MIN_USD structure
  try {
    const expected = { store: 10, api: 5, buy_button: 5, payment_link: 1 };
    const actual = SURFACE_DEFAULT_MIN_USD;
    
    const matches = 
      actual.store === expected.store &&
      actual.api === expected.api &&
      actual.buy_button === expected.buy_button &&
      actual.payment_link === expected.payment_link;
    
    logTest(
      '1a: SURFACE_DEFAULT_MIN_USD structure',
      matches,
      `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`
    );
  } catch (error: any) {
    logTest('1a: SURFACE_DEFAULT_MIN_USD structure', false, 'Exception thrown', error.message);
  }

  // Test 1b: getEffectiveMinOrderUsd
  try {
    const tests = [
      { surface: 'api' as MinSurface, merchantMin: undefined, expected: 5 },
      { surface: 'store' as MinSurface, merchantMin: undefined, expected: 10 },
      { surface: 'api' as MinSurface, merchantMin: 20, expected: 20 },
      { surface: 'store' as MinSurface, merchantMin: 3, expected: 10 },
    ];

    let allPassed = true;
    const details: string[] = [];

    for (const t of tests) {
      const result = getEffectiveMinOrderUsd(t.surface, t.merchantMin);
      const passed = result === t.expected;
      allPassed = allPassed && passed;
      details.push(
        `getEffectiveMinOrderUsd('${t.surface}', ${t.merchantMin ?? 0}) = ${result} (expected ${t.expected}) ${passed ? '✓' : '✗'}`
      );
    }

    logTest('1b: getEffectiveMinOrderUsd', allPassed, details.join('\n  '));
  } catch (error: any) {
    logTest('1b: getEffectiveMinOrderUsd', false, 'Exception thrown', error.message);
  }

  // Test 1c: normalizeMerchantMin
  try {
    const tests = [
      { input: '', expected: null },
      { input: 0, expected: null },
      { input: '25', expected: 25 },
      { input: 25.5, expected: 25.5 },
      { input: null, expected: null },
      { input: undefined, expected: null },
    ];

    let allPassed = true;
    const details: string[] = [];

    for (const t of tests) {
      const result = normalizeMerchantMin(t.input);
      const passed = result === t.expected;
      allPassed = allPassed && passed;
      details.push(
        `normalizeMerchantMin(${JSON.stringify(t.input)}) = ${result} (expected ${t.expected}) ${passed ? '✓' : '✗'}`
      );
    }

    logTest('1c: normalizeMerchantMin', allPassed, details.join('\n  '));
  } catch (error: any) {
    logTest('1c: normalizeMerchantMin', false, 'Exception thrown', error.message);
  }

  // Test 1d: getMerchantMinOrderUsdByCompanyId with invalid ID
  try {
    const result = await getMerchantMinOrderUsdByCompanyId(0);
    const passed = result === 0;
    logTest(
      '1d: getMerchantMinOrderUsdByCompanyId(0)',
      passed,
      `Result: ${result} (expected 0 for invalid ID)`
    );
  } catch (error: any) {
    logTest('1d: getMerchantMinOrderUsdByCompanyId(0)', false, 'Exception thrown', error.message);
  }
}

// ============================================================================
// TEST 2: SETTINGS API (updateCompany)
// ============================================================================

async function test2_settingsApi() {
  console.log('\n=== TEST 2: SETTINGS API (updateCompany) ===\n');

  let token = '';
  let companyId = 1; // The Dev Store

  // Login to get token
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/user/login`, {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    token = loginRes.data.data.token;
    console.log('✓ Logged in successfully');
  } catch (error: any) {
    logTest('2: Login', false, 'Failed to login', error.message);
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Test 2a: Set min_order_usd to 25
  try {
    const updateRes = await axios.put(
      `${BASE_URL}/api/updateCompany/${companyId}`,
      { min_order_usd: 25 },
      { headers }
    );
    
    const passed = updateRes.status === 200;
    logTest(
      '2a: PUT updateCompany with min_order_usd=25',
      passed,
      `Status: ${updateRes.status}, Response: ${JSON.stringify(updateRes.data)}`
    );

    // Verify it persisted
    if (passed) {
      const getRes = await axios.get(`${BASE_URL}/api/company/${companyId}`, { headers });
      const minOrder = getRes.data.data?.min_order_usd;
      const verified = minOrder === 25 || minOrder === '25.00' || minOrder === '25';
      logTest(
        '2a-verify: GET company returns min_order_usd=25',
        verified,
        `min_order_usd: ${minOrder}`
      );
    }
  } catch (error: any) {
    logTest('2a: PUT updateCompany with min_order_usd=25', false, 'Request failed', error.response?.data?.message || error.message);
  }

  // Test 2b: Validation - min_order_usd=0 should fail
  try {
    const updateRes = await axios.put(
      `${BASE_URL}/api/updateCompany/${companyId}`,
      { min_order_usd: 0 },
      { headers }
    );
    logTest(
      '2b: Validation min_order_usd=0',
      false,
      `Expected 400, got ${updateRes.status}`
    );
  } catch (error: any) {
    const passed = error.response?.status === 400;
    logTest(
      '2b: Validation min_order_usd=0',
      passed,
      `Status: ${error.response?.status}, Message: ${error.response?.data?.message || error.message}`
    );
  }

  // Test 2c: Validation - min_order_usd=200000 should fail
  try {
    const updateRes = await axios.put(
      `${BASE_URL}/api/updateCompany/${companyId}`,
      { min_order_usd: 200000 },
      { headers }
    );
    logTest(
      '2c: Validation min_order_usd=200000',
      false,
      `Expected 400, got ${updateRes.status}`
    );
  } catch (error: any) {
    const passed = error.response?.status === 400;
    logTest(
      '2c: Validation min_order_usd=200000',
      passed,
      `Status: ${error.response?.status}, Message: ${error.response?.data?.message || error.message}`
    );
  }

  // Test 2d: Clear min_order_usd with empty string
  try {
    const updateRes = await axios.put(
      `${BASE_URL}/api/updateCompany/${companyId}`,
      { min_order_usd: '' },
      { headers }
    );
    
    const passed = updateRes.status === 200;
    logTest(
      '2d: Clear min_order_usd with empty string',
      passed,
      `Status: ${updateRes.status}`
    );

    if (passed) {
      const getRes = await axios.get(`${BASE_URL}/api/company/${companyId}`, { headers });
      const minOrder = getRes.data.data?.min_order_usd;
      const verified = minOrder === null || minOrder === undefined;
      logTest(
        '2d-verify: GET company returns min_order_usd=null',
        verified,
        `min_order_usd: ${minOrder}`
      );
    }
  } catch (error: any) {
    logTest('2d: Clear min_order_usd', false, 'Request failed', error.response?.data?.message || error.message);
  }
}

// ============================================================================
// TEST 3: ENFORCEMENT/SURFACING
// ============================================================================

async function test3_enforcementSurfacing() {
  console.log('\n=== TEST 3: ENFORCEMENT/SURFACING ===\n');

  let token = '';
  let companyId = 1;
  let paymentLinkRef = '';

  // Login
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/user/login`, {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    token = loginRes.data.data.token;
    console.log('✓ Logged in successfully');
  } catch (error: any) {
    logTest('3: Login', false, 'Failed to login', error.message);
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };

  // Step 1: Set owner min_order_usd=25
  try {
    await axios.put(
      `${BASE_URL}/api/updateCompany/${companyId}`,
      { min_order_usd: 25 },
      { headers }
    );
    console.log('✓ Set min_order_usd=25');
  } catch (error: any) {
    logTest('3: Set min_order_usd=25', false, 'Failed to set', error.message);
    return;
  }

  // Step 2: Create a throwaway $15 payment link
  try {
    const createRes = await axios.post(
      `${BASE_URL}/pay/createPaymentLink`,
      {
        amount: 15,
        currency: 'USD',
        name: `qa_phase1b_test_${Date.now()}`,
        description: 'Test link for Phase 1b enforcement',
      },
      { headers }
    );
    
    paymentLinkRef = createRes.data.data?.reference || createRes.data.data?.data;
    console.log(`✓ Created payment link: ${paymentLinkRef}`);
  } catch (error: any) {
    logTest('3: Create payment link', false, 'Failed to create', error.response?.data?.message || error.message);
    return;
  }

  // Test 3a: POST /api/pay/getData
  try {
    const getDataRes = await axios.post(`${BASE_URL}/api/pay/getData`, {
      data: paymentLinkRef,
      timezone: 'UTC',
      language: 'en',
    });

    const data = getDataRes.data.data;
    const coinMinimums = data.coin_minimums;
    const minOrderUsd = data.min_order_usd;

    // Check that all coin_minimums values are >= 25
    let allCoinsAbove25 = true;
    const coinDetails: string[] = [];
    if (coinMinimums && typeof coinMinimums === 'object') {
      for (const [coin, min] of Object.entries(coinMinimums)) {
        const minVal = Number(min);
        coinDetails.push(`${coin}: $${minVal}`);
        if (minVal < 25) allCoinsAbove25 = false;
      }
    } else {
      allCoinsAbove25 = false;
    }

    const passed = allCoinsAbove25 && minOrderUsd === 25;
    logTest(
      '3a: getData coin_minimums >= 25 and min_order_usd === 25',
      passed,
      `min_order_usd: ${minOrderUsd}, coin_minimums: ${coinDetails.join(', ')}`
    );
  } catch (error: any) {
    logTest('3a: getData', false, 'Request failed', error.response?.data?.message || error.message);
  }

  // Test 3b: GET /api/pay/configured-currencies (need checkout session)
  try {
    // First get a checkout session token
    const getDataRes = await axios.post(`${BASE_URL}/api/pay/getData`, {
      data: paymentLinkRef,
      timezone: 'UTC',
      language: 'en',
    });
    const sessionToken = getDataRes.data.data?.token;

    if (!sessionToken) {
      logTest('3b: configured-currencies', false, 'No session token', 'Could not get checkout session token');
    } else {
      const configRes = await axios.get(`${BASE_URL}/api/pay/configured-currencies`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      const data = configRes.data.data;
      const coinMinimums = data.coin_minimums;
      const minOrderUsd = data.min_order_usd;

      let allCoinsAbove25 = true;
      const coinDetails: string[] = [];
      if (coinMinimums && typeof coinMinimums === 'object') {
        for (const [coin, min] of Object.entries(coinMinimums)) {
          const minVal = Number(min);
          coinDetails.push(`${coin}: $${minVal}`);
          if (minVal < 25) allCoinsAbove25 = false;
        }
      } else {
        allCoinsAbove25 = false;
      }

      const passed = allCoinsAbove25 && minOrderUsd === 25;
      logTest(
        '3b: configured-currencies coin_minimums >= 25 and min_order_usd === 25',
        passed,
        `min_order_usd: ${minOrderUsd}, coin_minimums: ${coinDetails.join(', ')}`
      );
    }
  } catch (error: any) {
    logTest('3b: configured-currencies', false, 'Request failed', error.response?.data?.message || error.message);
  }

  // Test 3c: POST /api/pay/createCryptoPayment (should block with 400)
  try {
    // Get session token
    const getDataRes = await axios.post(`${BASE_URL}/api/pay/getData`, {
      data: paymentLinkRef,
      timezone: 'UTC',
      language: 'en',
    });
    const sessionToken = getDataRes.data.data?.token;

    if (!sessionToken) {
      logTest('3c: createCryptoPayment block', false, 'No session token', 'Could not get checkout session token');
    } else {
      try {
        const createPaymentRes = await axios.post(
          `${BASE_URL}/api/pay/createCryptoPayment`,
          {
            currency: 'BTC',
            data: paymentLinkRef,
          },
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        
        // Should not reach here
        logTest(
          '3c: createCryptoPayment block',
          false,
          `Expected 400, got ${createPaymentRes.status}`
        );
      } catch (error: any) {
        const status = error.response?.status;
        const message = error.response?.data?.message || '';
        const passed = status === 400 && message.toLowerCase().includes('minimum');
        
        logTest(
          '3c: createCryptoPayment blocks with 400 "minimum order is $25"',
          passed,
          `Status: ${status}, Message: ${message}`
        );
      }
    }
  } catch (error: any) {
    logTest('3c: createCryptoPayment block', false, 'Setup failed', error.message);
  }

  // Cleanup: Reset min_order_usd to null
  try {
    await axios.put(
      `${BASE_URL}/api/updateCompany/${companyId}`,
      { min_order_usd: null },
      { headers }
    );
    console.log('✓ Reset min_order_usd to null');
  } catch (error: any) {
    console.log(`⚠ Failed to reset min_order_usd: ${error.message}`);
  }

  // Cleanup: Delete the throwaway payment link
  if (paymentLinkRef) {
    try {
      await axios.delete(`${BASE_URL}/pay/deletePaymentLink/${paymentLinkRef}`, { headers });
      console.log(`✓ Deleted payment link: ${paymentLinkRef}`);
    } catch (error: any) {
      console.log(`⚠ Failed to delete payment link: ${error.message}`);
    }
  }
}

// ============================================================================
// TEST 4: REGRESSION (health check)
// ============================================================================

async function test4_regression() {
  console.log('\n=== TEST 4: REGRESSION (health check) ===\n');

  try {
    const healthRes = await axios.get(`${BASE_URL}/api/health`);
    const status = healthRes.data.status;
    const passed = status === 'healthy';
    
    logTest(
      '4: GET /api/health',
      passed,
      `Status: ${status}, Response: ${JSON.stringify(healthRes.data)}`
    );
  } catch (error: any) {
    logTest('4: GET /api/health', false, 'Request failed', error.message);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('PHASE 1b TESTING: Consolidated Minimums + Per-Brand min_order_usd');
  console.log('='.repeat(80));

  await test1_unitTests();
  await test2_settingsApi();
  await test3_enforcementSurfacing();
  await test4_regression();

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\nTotal: ${total} tests`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.test}`);
      console.log(`     ${r.details}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
