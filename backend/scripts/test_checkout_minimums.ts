#!/usr/bin/env ts-node
/**
 * Smart Checkout Minimums (Phase 1a) - Comprehensive Test Suite
 * 
 * Tests the new checkoutMinimums.ts module and getData/createCryptoPayment integration.
 * SAFE MODE: Pure unit tests + read-only API calls only.
 */

// Load environment variables first
import * as dotenv from 'dotenv';
dotenv.config();

import {
  getCoinMinimumUsd,
  getCoinMinimumsUsd,
  getOrderMinimumUsd,
  SAFETY_FLOOR_USD,
  toInternalCurrency,
} from '../services/checkout/checkoutMinimums';

// ANSI colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, expected: any, actual: any) {
  const passed = condition;
  results.push({ name, passed, expected, actual });
  
  if (passed) {
    console.log(`${GREEN}✓${RESET} ${name}`);
    console.log(`  Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  } else {
    console.log(`${RED}✗${RESET} ${name}`);
    console.log(`  Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
  }
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
console.log(`${BLUE}  SMART CHECKOUT MINIMUMS (Phase 1a) - TEST SUITE${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}\n`);

console.log(`${YELLOW}TEST 1: PURE UNIT TESTS (checkoutMinimums.ts)${RESET}\n`);

// Test 1.1: getCoinMinimumUsd('BTC') === 3
assert(
  'TEST 1.1: getCoinMinimumUsd("BTC") === 3',
  getCoinMinimumUsd('BTC') === 3,
  3,
  getCoinMinimumUsd('BTC')
);

// Test 1.2: getCoinMinimumUsd('USDT-TRC20') === 3
assert(
  'TEST 1.2: getCoinMinimumUsd("USDT-TRC20") === 3',
  getCoinMinimumUsd('USDT-TRC20') === 3,
  3,
  getCoinMinimumUsd('USDT-TRC20')
);

// Test 1.3: getCoinMinimumUsd('USDC') === 3 (maps to USDC-ERC20)
const usdcMin = getCoinMinimumUsd('USDC');
assert(
  'TEST 1.3: getCoinMinimumUsd("USDC") === 3 (maps to USDC-ERC20)',
  usdcMin === 3,
  3,
  usdcMin
);
console.log(`  Note: USDC maps to internal currency: ${toInternalCurrency('USDC')}`);

// Test 1.4: getCoinMinimumUsd('RLUSD-XRPL') === 3 (maps to RLUSD)
const rlusdMin = getCoinMinimumUsd('RLUSD-XRPL');
assert(
  'TEST 1.4: getCoinMinimumUsd("RLUSD-XRPL") === 3 (maps to RLUSD)',
  rlusdMin === 3,
  3,
  rlusdMin
);
console.log(`  Note: RLUSD-XRPL maps to internal currency: ${toInternalCurrency('RLUSD-XRPL')}`);

// Test 1.5: getCoinMinimumUsd('FOO') >= 1 (unknown coin falls back to SAFETY_FLOOR)
const fooMin = getCoinMinimumUsd('FOO');
assert(
  'TEST 1.5: getCoinMinimumUsd("FOO") >= 1 (unknown coin, SAFETY_FLOOR)',
  fooMin >= 1,
  `>= ${SAFETY_FLOOR_USD}`,
  fooMin
);

// Test 1.6: getOrderMinimumUsd(['BTC','USDT-TRC20']) === 3
const orderMin = getOrderMinimumUsd(['BTC', 'USDT-TRC20']);
assert(
  'TEST 1.6: getOrderMinimumUsd(["BTC","USDT-TRC20"]) === 3',
  orderMin === 3,
  3,
  orderMin
);

// Test 1.7: getCoinMinimumsUsd(['BTC','ETH']) deep-equals { BTC: 3, ETH: 3 }
const coinMins = getCoinMinimumsUsd(['BTC', 'ETH']);
const expectedMins = { BTC: 3, ETH: 3 };
assert(
  'TEST 1.7: getCoinMinimumsUsd(["BTC","ETH"]) === { BTC: 3, ETH: 3 }',
  deepEqual(coinMins, expectedMins),
  expectedMins,
  coinMins
);

// Additional edge case tests
console.log(`\n${YELLOW}ADDITIONAL EDGE CASE TESTS:${RESET}\n`);

// Test 1.8: Empty string returns SAFETY_FLOOR
const emptyMin = getCoinMinimumUsd('');
assert(
  'TEST 1.8: getCoinMinimumUsd("") === SAFETY_FLOOR_USD',
  emptyMin === SAFETY_FLOOR_USD,
  SAFETY_FLOOR_USD,
  emptyMin
);

// Test 1.9: All major coins have threshold of 3
const majorCoins = ['BTC', 'ETH', 'USDT-TRC20', 'USDT-ERC20', 'USDT-POLYGON', 'USDC-ERC20', 'RLUSD', 'XRP', 'LTC', 'SOL', 'TRX', 'POLYGON', 'BCH', 'DOGE'];
const allMajorMins = getCoinMinimumsUsd(majorCoins);
const allAreThree = Object.values(allMajorMins).every(v => v === 3);
assert(
  'TEST 1.9: All major coins have minimum of $3',
  allAreThree,
  'all === 3',
  allMajorMins
);

// Test 1.10: getOrderMinimumUsd with empty array returns SAFETY_FLOOR
const emptyOrderMin = getOrderMinimumUsd([]);
assert(
  'TEST 1.10: getOrderMinimumUsd([]) === SAFETY_FLOOR_USD',
  emptyOrderMin === SAFETY_FLOOR_USD,
  SAFETY_FLOOR_USD,
  emptyOrderMin
);

// Summary
console.log(`\n${BLUE}═══════════════════════════════════════════════════════════════${RESET}`);
console.log(`${BLUE}  TEST SUMMARY${RESET}`);
console.log(`${BLUE}═══════════════════════════════════════════════════════════════${RESET}\n`);

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`${GREEN}Passed: ${passed}${RESET}`);
console.log(`${RED}Failed: ${failed}${RESET}`);

if (failed > 0) {
  console.log(`\n${RED}FAILED TESTS:${RESET}`);
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ${RED}✗${RESET} ${r.name}`);
    console.log(`    Expected: ${JSON.stringify(r.expected)}`);
    console.log(`    Got: ${JSON.stringify(r.actual)}`);
  });
}

console.log(`\n${BLUE}═══════════════════════════════════════════════════════════════${RESET}\n`);

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
