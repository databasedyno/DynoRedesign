/**
 * Test A: formatCryptoAmount Unit Tests (Inline Implementation)
 * Testing the formatCryptoAmount logic directly
 */

// Inline implementation of formatCryptoAmount from backend/utils/currencyUtils.ts
function formatCryptoAmount(amount, currency = '') {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (!isFinite(num)) return String(amount);
  const upper = String(currency || '').toUpperCase();
  const isStableOrFiat = /USDT|USDC|BUSD|DAI|USD|EUR|GBP|BRL/.test(upper);
  const decimals = isStableOrFiat ? 2 : 8;
  const fixed = num.toFixed(decimals);
  // toFixed(>0) always contains '.', so trimming trailing zeros is safe
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

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

console.log('========================================');
console.log('TEST A: formatCryptoAmount Unit Tests');
console.log('========================================\n');

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
}

// Check for scientific notation
const scientificTest = formatCryptoAmount(0.00000001, 'BTC');
const hasScientific = scientificTest.includes('e') || scientificTest.includes('E');

if (hasScientific) {
  failed++;
  console.log(`❌ FAIL: Scientific notation detected for small values`);
  console.log(`   Input: (0.00000001, 'BTC') → Output: "${scientificTest}"`);
} else {
  passed++;
  console.log(`✅ PASS: No scientific notation for small values`);
}

console.log(`\n📊 Test A Summary: ${passed} passed, ${failed} failed out of ${testCases.length + 1} tests`);
console.log(`Status: ${failed === 0 ? 'PASS ✅' : 'FAIL ❌'}\n`);

// Export results for main test script
module.exports = {
  passed,
  failed,
  total: testCases.length + 1,
  status: failed === 0 ? 'PASS' : 'FAIL'
};
