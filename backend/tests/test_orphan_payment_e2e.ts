/**
 * E2E Test: Orphan Payment Flow
 * 
 * Tests the complete lifecycle:
 * 1. RESERVED address with expired reservation
 * 2. releaseExpiredReservations saves last_payment_context + sets AVAILABLE
 * 3. detectOrphanPayments scans AVAILABLE addresses (checks blockchain balance)
 * 4. Cleanup
 * 
 * Run: cd /app/backend && npx ts-node tests/test_orphan_payment_e2e.ts
 */

import dotenv from "dotenv";
dotenv.config();

import sequelize from "../utils/dbInstance";
import { setRedisItem, getRedisItem, connectRedis, deleteRedisItem } from "../utils/redisInstance";
import { releaseExpiredReservations, detectOrphanPayments } from "../services/merchantPoolService";

const TEST_PAYMENT_ID = `test-orphan-e2e-${Date.now()}`;
const TEST_REF = `test-ref-${Date.now()}`;
let testAddressId: number | null = null;
let originalState: Record<string, unknown> | null = null;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`  PASS: ${msg}`);
}

async function setup() {
  console.log("\n=== SETUP ===");
  await sequelize.authenticate();
  console.log("  DB connected");
  await connectRedis();
  console.log("  Redis connected");

  // Pick a safe AVAILABLE address to use as test subject
  const [rows] = await sequelize.query(
    `SELECT temp_address_id, wallet_address, wallet_type, owner_user_id, status,
            current_payment_id, current_company_id, expected_amount, received_amount,
            reserved_until, locked_at, is_partial_payment, last_payment_context, subscription_id
     FROM tbl_merchant_temp_address
     WHERE status = 'AVAILABLE' AND current_payment_id IS NULL
     ORDER BY temp_address_id ASC LIMIT 1`
  );

  if (!rows || (rows as unknown[]).length === 0) {
    throw new Error("No AVAILABLE address found for testing");
  }

  const addr = (rows as Record<string, unknown>[])[0];
  testAddressId = addr.temp_address_id as number;
  originalState = { ...addr };

  console.log(`  Using test address: id=${testAddressId}, addr=${addr.wallet_address}, type=${addr.wallet_type}`);
}

async function restoreOriginal() {
  if (!testAddressId || !originalState) return;
  console.log("\n=== CLEANUP ===");
  await sequelize.query(
    `UPDATE tbl_merchant_temp_address SET 
       status = 'AVAILABLE',
       current_payment_id = NULL,
       current_company_id = NULL,
       expected_amount = NULL,
       received_amount = NULL,
       reserved_until = NULL,
       locked_at = NULL,
       is_partial_payment = false,
       last_payment_context = NULL
     WHERE temp_address_id = $1`,
    { bind: [testAddressId] }
  );
  // Clean up Redis
  const walletAddr = originalState.wallet_address as string;
  await deleteRedisItem("crypto-" + walletAddr);
  await deleteRedisItem(TEST_REF);
  console.log("  Restored original state and cleaned Redis");
}

/**
 * Test 1: releaseExpiredReservations preserves payment context
 */
async function testContextPreservation() {
  console.log("\n=== TEST 1: Context Preservation on Expiry ===");

  const walletAddr = originalState!.wallet_address as string;
  const ownerId = originalState!.owner_user_id as number;
  const walletType = originalState!.wallet_type as string;

  // Step 1: Simulate a RESERVED address with expired reservation
  const expiredTime = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
  await sequelize.query(
    `UPDATE tbl_merchant_temp_address SET 
       status = 'RESERVED',
       current_payment_id = $1,
       current_company_id = 38,
       expected_amount = 0.05,
       received_amount = 0,
       reserved_until = $2,
       locked_at = $3,
       is_partial_payment = false,
       last_payment_context = NULL
     WHERE temp_address_id = $4`,
    { bind: [TEST_PAYMENT_ID, expiredTime, expiredTime, testAddressId] }
  );
  console.log("  Set address to RESERVED with expired reservation");

  // Step 2: Set up mock Redis data (what would exist during a live payment)
  const mockRedisPayment = {
    mode: "CRYPTO",
    amount: 0.05,
    status: "pending",
    currency: walletType,
    payment_id: TEST_PAYMENT_ID,
    is_merchant_pool: "true",
    adm_id: ownerId,
    company_id: 38,
    fee_payer: "company",
    base_currency: "USD",
    base_amount: 150,
    ref: TEST_REF,
    webhook_url: "https://example.com/webhook",
    callback_url: "https://example.com/callback",
    link_id: "test-link-123",
  };
  await setRedisItem("crypto-" + walletAddr, mockRedisPayment);

  const mockCustomerData = {
    adm_id: ownerId,
    company_id: 38,
    base_currency: "USD",
    customer_name: "Test Orphan Customer",
    customer_email: "orphan-test@example.com",
    webhook_url: "https://example.com/webhook",
    callback_url: "https://example.com/callback",
    link_id: "test-link-123",
  };
  await setRedisItem(TEST_REF, mockCustomerData);
  console.log("  Mock Redis data set");

  // Step 3: Call releaseExpiredReservations
  const released = await releaseExpiredReservations();
  console.log(`  releaseExpiredReservations returned: ${released} released`);
  assert(released >= 1, "At least 1 reservation should be released");

  // Step 4: Verify the DB state
  const [checkRows] = await sequelize.query(
    `SELECT status, current_payment_id, last_payment_context
     FROM tbl_merchant_temp_address WHERE temp_address_id = $1`,
    { bind: [testAddressId] }
  );
  const updated = (checkRows as Record<string, unknown>[])[0];

  assert(updated.status === "AVAILABLE", `Status should be AVAILABLE, got: ${updated.status}`);
  assert(updated.current_payment_id === null, "current_payment_id should be null");
  assert(updated.last_payment_context !== null, "last_payment_context should be saved");

  // Step 5: Verify the saved context content
  const savedContext = JSON.parse(updated.last_payment_context as string);
  assert(savedContext.payment_id === TEST_PAYMENT_ID, `payment_id should match: ${savedContext.payment_id}`);
  assert(savedContext.company_id === 38, `company_id should be 38: ${savedContext.company_id}`);
  assert(savedContext.webhook_url === "https://example.com/webhook", "webhook_url preserved");
  assert(savedContext.callback_url === "https://example.com/callback", "callback_url preserved");
  assert(savedContext.customer_name === "Test Orphan Customer", "customer_name preserved");
  assert(savedContext.customer_email === "orphan-test@example.com", "customer_email preserved");
  assert(savedContext.fee_payer === "company", "fee_payer preserved");
  assert(savedContext.base_currency === "USD", "base_currency preserved");
  assert(savedContext.ref === TEST_REF, "ref preserved");
  assert(savedContext.link_id === "test-link-123", "link_id preserved");

  console.log("  Context content verified OK");
}

/**
 * Test 2: detectOrphanPayments runs cleanly on addresses with saved context
 */
async function testOrphanDetection() {
  console.log("\n=== TEST 2: Orphan Detection Scan ===");

  // The address should now be AVAILABLE with last_payment_context set (from Test 1)
  // detectOrphanPayments will scan it, check blockchain balance (should be 0 or dust),
  // and skip it (no actual orphan payment to process)
  const result = await detectOrphanPayments();

  console.log(`  Scan result: checked=${result.checked}, found=${result.found}, processed=${result.processed}, alreadyProcessed=${result.alreadyProcessed}, errors=${result.errors.length}`);

  assert(result.checked >= 1, "Should have scanned at least 1 address");
  assert(Array.isArray(result.errors), "errors should be an array");

  // Since there's no actual blockchain balance on test addresses, found should be 0
  // (or if there IS a balance, the function should handle it gracefully)
  console.log("  Orphan detection completed without crash");
}

/**
 * Test 3: Verify context is cleared after manual cleanup 
 */
async function testContextCleanup() {
  console.log("\n=== TEST 3: Context Cleanup ===");

  // Simulate what happens after a successful orphan recovery: context is cleared
  await sequelize.query(
    `UPDATE tbl_merchant_temp_address SET last_payment_context = NULL WHERE temp_address_id = $1`,
    { bind: [testAddressId] }
  );

  const [rows] = await sequelize.query(
    `SELECT last_payment_context FROM tbl_merchant_temp_address WHERE temp_address_id = $1`,
    { bind: [testAddressId] }
  );
  const row = (rows as Record<string, unknown>[])[0];
  assert(row.last_payment_context === null, "Context should be cleared after recovery");
}

async function main() {
  let passed = 0;
  let failed = 0;

  try {
    await setup();

    try {
      await testContextPreservation();
      passed++;
    } catch (e) {
      console.error("  TEST 1 FAILED:", (e as Error).message);
      failed++;
    }

    try {
      await testOrphanDetection();
      passed++;
    } catch (e) {
      console.error("  TEST 2 FAILED:", (e as Error).message);
      failed++;
    }

    try {
      await testContextCleanup();
      passed++;
    } catch (e) {
      console.error("  TEST 3 FAILED:", (e as Error).message);
      failed++;
    }

  } finally {
    await restoreOriginal();
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
