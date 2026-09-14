/**
 * E2E Test: Webhook Delivery
 * 
 * Tests the full webhook flow:
 * 1. Creates a webhook.site endpoint for receiving test webhooks
 * 2. Tests callMerchantWebhook with real HTTP delivery
 * 3. Verifies payload arrives at webhook.site
 * 4. Verifies HMAC signature when webhook_secret is set
 * 5. Verifies DB delivery log (tbl_webhook_delivery_log)
 * 
 * Run: cd /app/backend && npx ts-node tests/test_webhook_e2e.ts
 */

import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { callMerchantWebhook, verifyWebhookSignature } from "../webhooks";

let webhookToken: string | null = null;
let webhookUrl: string | null = null;

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
  
  // Create webhook.site endpoint
  const tokenResp = await axios.post("https://webhook.site/token");
  webhookToken = tokenResp.data.uuid;
  webhookUrl = `https://webhook.site/${webhookToken}`;
  console.log(`  webhook.site endpoint: ${webhookUrl}`);
}

async function getReceivedWebhooks(): Promise<Array<Record<string, unknown>>> {
  // Small delay for delivery
  await new Promise(resolve => setTimeout(resolve, 2000));
  const resp = await axios.get(`https://webhook.site/token/${webhookToken}/requests?sorting=newest`);
  return (resp.data.data || []) as Array<Record<string, unknown>>;
}

/**
 * Test 1: Basic webhook delivery (no secret)
 */
async function testBasicDelivery() {
  console.log("\n=== TEST 1: Basic Webhook Delivery (no secret) ===");
  
  const customerData = {
    company_id: 99999,
    webhook_url: webhookUrl,
    adm_id: 1,
  };
  
  const eventData = {
    event: "payment.confirmed",
    payment_id: `test-payment-${Date.now()}`,
    transaction_reference: "0xtest123abc",
    status: "completed",
    amount: 0.05,
    currency: "ETH",
    customer_name: "Test Customer",
    customer_email: "test@example.com",
  };
  
  const result = await callMerchantWebhook(customerData, eventData);
  
  assert(result.success === true, `Webhook delivery should succeed, got: ${JSON.stringify(result)}`);
  
  // Check webhook arrived at webhook.site
  const received = await getReceivedWebhooks();
  assert(received.length >= 1, `Should have received at least 1 webhook, got ${received.length}`);
  
  const latest = received[0];
  const body = JSON.parse(latest.content as string);
  
  assert(body.event === "payment.confirmed", `Event should be payment.confirmed, got: ${body.event}`);
  assert(body.payment_id === eventData.payment_id, "payment_id should match");
  assert(body.amount === 0.05, "amount should be 0.05");
  assert(body.currency === "ETH", "currency should be ETH");
  assert(body.webhook_id !== undefined, "webhook_id should be present");
  assert(body.sent_at !== undefined, "sent_at should be present");
  
  // Check headers (webhook.site stores values as arrays)
  const headers = latest.headers as Record<string, string[]>;
  const getHeader = (h: Record<string, string[]>, key: string) => h[key]?.[0];
  
  assert(getHeader(headers, "x-dynopay-event") === "payment.confirmed", "X-DynoPay-Event header should match");
  assert(getHeader(headers, "x-dynopay-timestamp") !== undefined, "X-DynoPay-Timestamp header should be present");
  assert(getHeader(headers, "x-dynopay-webhook-id") !== undefined, "X-DynoPay-Webhook-Id should be present");
  assert(getHeader(headers, "user-agent") === "Dynopay-Webhook/1.0", "User-Agent should be Dynopay-Webhook/1.0");
  
  // No signature header when no secret
  assert(!getHeader(headers, "x-dynopay-signature"), "No signature header when no secret");
  
  console.log("  Basic delivery verified OK");
}

/**
 * Test 2: Webhook with HMAC signature
 */
async function testSignedWebhook() {
  console.log("\n=== TEST 2: Webhook with HMAC Signature ===");
  
  const testSecret = "test-webhook-secret-12345";
  
  const customerData = {
    company_id: 99999,
    webhook_url: webhookUrl,
    webhook_secret: testSecret,
    adm_id: 1,
  };
  
  const eventData = {
    event: "payment.pending",
    payment_id: `test-signed-${Date.now()}`,
    address: "0xTestAddress123",
    txId: "0xTestTxHash456",
    amount: 100,
    currency: "TRX",
    status: "pending",
  };
  
  const result = await callMerchantWebhook(customerData, eventData);
  assert(result.success === true, "Signed webhook should succeed");
  
  const received = await getReceivedWebhooks();
  const latest = received[0];
  const headers = latest.headers as Record<string, string[]>;
  const getHeader = (h: Record<string, string[]>, key: string) => h[key]?.[0];
  const body = JSON.parse(latest.content as string);
  
  assert(body.event === "payment.pending", "Event should be payment.pending");
  assert(getHeader(headers, "x-dynopay-signature") !== undefined, "Signature header should be present");
  
  // Verify the signature ourselves
  const timestamp = Number(getHeader(headers, "x-dynopay-timestamp"));
  const signaturePayload = { ...body, timestamp };
  const expectedSig = crypto.createHmac("sha256", testSecret)
    .update(JSON.stringify(signaturePayload))
    .digest("hex");
  
  assert(getHeader(headers, "x-dynopay-signature") === expectedSig, "Signature should be valid HMAC-SHA256");
  
  // Test the verifyWebhookSignature helper
  const payloadStr = JSON.stringify(signaturePayload);
  const isValid = verifyWebhookSignature(payloadStr, expectedSig, testSecret);
  assert(isValid === true, "verifyWebhookSignature should validate correctly");
  
  console.log("  Signed webhook verified OK");
}

/**
 * Test 3: Callback + Webhook delivery (both URLs)
 */
async function testCallbackAndWebhook() {
  console.log("\n=== TEST 3: Callback + Webhook Delivery ===");
  
  const customerData = {
    company_id: 99999,
    webhook_url: webhookUrl,
    callback_url: webhookUrl, // Same URL for both in test
    adm_id: 1,
  };
  
  const eventData = {
    event: "payment.confirmed",
    payment_id: `test-dual-${Date.now()}`,
    status: "completed",
    amount: 0.001,
    currency: "BTC",
  };
  
  const result = await callMerchantWebhook(customerData, eventData);
  assert(result.success === true, "Dual delivery should succeed");
  
  // When webhook_url === callback_url, only callback is sent (not both)
  const received = await getReceivedWebhooks();
  assert(received.length >= 1, "Should receive at least 1 delivery");
  
  const latest = received[0];
  const headers = latest.headers as Record<string, string[]>;
  const getHeader = (h: Record<string, string[]>, key: string) => h[key]?.[0];
  assert(getHeader(headers, "x-dynopay-type") === "callback", "Type should be callback when URLs match");
  
  console.log("  Callback delivery verified OK");
}

/**
 * Test 4: DB delivery log
 */
async function testDeliveryLog() {
  console.log("\n=== TEST 4: DB Delivery Log ===");
  
  // Check that delivery logs were created
  const [rows] = await sequelize.query(
    `SELECT webhook_url, event_type, status, response_status, retry_count 
     FROM tbl_webhook_delivery_log 
     WHERE company_id = 99999 
     ORDER BY created_at DESC LIMIT 5`
  );
  
  const logs = rows as Array<Record<string, unknown>>;
  assert(logs.length >= 1, `Should have at least 1 delivery log, got ${logs.length}`);
  
  const latest = logs[0];
  assert(latest.webhook_url === webhookUrl, "Log URL should match webhook.site URL");
  assert(latest.status === "success", `Log status should be success, got: ${latest.status}`);
  assert(latest.response_status === 200, `Response status should be 200, got: ${latest.response_status}`);
  
  console.log("  DB delivery log verified OK");
}

async function cleanup() {
  console.log("\n=== CLEANUP ===");
  // Clean up test delivery logs
  await sequelize.query(
    `DELETE FROM tbl_webhook_delivery_log WHERE company_id = 99999`
  );
  console.log("  Cleaned up test delivery logs");
}

async function main() {
  let passed = 0;
  let failed = 0;
  
  try {
    await setup();
    
    const tests = [
      { name: "Basic Delivery", fn: testBasicDelivery },
      { name: "Signed Webhook", fn: testSignedWebhook },
      { name: "Callback + Webhook", fn: testCallbackAndWebhook },
      { name: "DB Delivery Log", fn: testDeliveryLog },
    ];
    
    for (const test of tests) {
      try {
        await test.fn();
        passed++;
      } catch (e) {
        console.error(`  TEST ${test.name} FAILED:`, (e as Error).message);
        failed++;
      }
    }
    
  } finally {
    await cleanup();
  }
  
  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  console.log(`=== webhook.site dashboard: https://webhook.site/#!/view/${webhookToken} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
