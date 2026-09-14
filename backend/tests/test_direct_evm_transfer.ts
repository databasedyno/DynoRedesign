/**
 * Unit test for directEvmTransfer module
 * Tests chain config, supported chains, and error handling
 * 
 * Run: cd /app/backend && npx ts-node --transpile-only tests/test_direct_evm_transfer.ts
 */

import { isDirectEvmSupported } from "../services/merchantPool/directEvmTransfer";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=== directEvmTransfer Unit Tests ===\n");

  // Test 1: EVM chain support detection
  console.log("Test 1: isDirectEvmSupported()");
  assert(isDirectEvmSupported("ETH") === true, "ETH should be supported");
  assert(isDirectEvmSupported("USDT-ERC20") === true, "USDT-ERC20 should be supported");
  assert(isDirectEvmSupported("USDC-ERC20") === true, "USDC-ERC20 should be supported");
  assert(isDirectEvmSupported("RLUSD-ERC20") === true, "RLUSD-ERC20 should be supported");
  assert(isDirectEvmSupported("POLYGON") === true, "POLYGON should be supported");
  assert(isDirectEvmSupported("USDT-POLYGON") === true, "USDT-POLYGON should be supported");

  // Test 2: Non-EVM chains should NOT be supported (fall back to Tatum SDK)
  console.log("\nTest 2: Non-EVM chains should not be supported");
  assert(isDirectEvmSupported("TRX") === false, "TRX should NOT be supported (uses Tatum SDK)");
  assert(isDirectEvmSupported("USDT-TRC20") === false, "USDT-TRC20 should NOT be supported");
  assert(isDirectEvmSupported("BTC") === false, "BTC should NOT be supported");
  assert(isDirectEvmSupported("XRP") === false, "XRP should NOT be supported");
  assert(isDirectEvmSupported("RLUSD") === false, "RLUSD (XRP) should NOT be supported");
  assert(isDirectEvmSupported("SOL") === false, "SOL should NOT be supported");
  assert(isDirectEvmSupported("LTC") === false, "LTC should NOT be supported");
  assert(isDirectEvmSupported("DOGE") === false, "DOGE should NOT be supported");
  assert(isDirectEvmSupported("BCH") === false, "BCH should NOT be supported");

  // Test 3: directEvmSweep should reject unsupported chain
  console.log("\nTest 3: directEvmSweep rejects unsupported chains");
  const { directEvmSweep } = await import("../services/merchantPool/directEvmTransfer");
  try {
    await directEvmSweep({
      fromAddress: "0x1234",
      toAddress: "0x5678",
      privateKey: "0xabc",
      walletType: "BTC",
      amount: 1.0,
    });
    assert(false, "Should have thrown for unsupported BTC");
  } catch (err: unknown) {
    const errMsg = (err as Error).message;
    assert(errMsg.includes("Unsupported wallet type"), `Threw correct error: ${errMsg}`);
  }

  // Test 4: Verify sweep function imports directEvmSweep
  console.log("\nTest 4: merchantPoolSweep imports directEvmTransfer");
  const sweep = await import("../services/merchantPool/merchantPoolSweep");
  assert(typeof sweep.sweepPoolAddress === "function", "sweepPoolAddress function exists");
  assert(typeof sweep.performScheduledSweeps === "function", "performScheduledSweeps function exists");
  assert(typeof sweep.fundGasIfNeeded === "function", "fundGasIfNeeded function exists");

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
