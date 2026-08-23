/**
 * Safe, side-effect-FREE integration test for notifyOverpayment.
 *
 * We cannot trigger a real overpayment in SAFE MODE (it would send LIVE emails
 * via Brevo and write dedup keys to the shared prod Redis), so we stub the mail
 * transport, dedup guard, in-app notification and the Sequelize model lookups
 * BEFORE importing the notifier, then assert it produces BOTH the merchant and
 * admin emails + the in-app notification with the correct amounts.
 *
 * Run: cd /app/backend && npx ts-node --transpile-only tests/test_overpayment_notifier.ts
 */

process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin-test@dynopay.com";

type Captured = { to: string; name: string; subject: string; body: string };
const sentEmails: Captured[] = [];
const notifications: any[] = [];

// ── Stub mail transport (default export) ────────────────────────────────
const mailMod = require("../utils/mailTransporter");
mailMod.default = async (args: Captured) => {
  sentEmails.push(args);
  return { messageId: "stub" };
};

// ── Stub dedup guard so we don't touch prod Redis ───────────────────────
const webhookEvents = require("../services/webhookEvents");
let dedupCalls = 0;
webhookEvents.claimEmitOnce = async (_key: string) => {
  dedupCalls += 1;
  return dedupCalls === 1; // first call wins, subsequent are duplicates
};

// ── Stub in-app notification ────────────────────────────────────────────
const notifCtrl = require("../controller/notificationController");
notifCtrl.createNotification = async (
  userId: number,
  type: string,
  title: string,
  message: string,
) => {
  notifications.push({ userId, type, title, message });
  return { id: 1 };
};

// ── Stub model lookups ──────────────────────────────────────────────────
const models = require("../models");
models.companyModel.findOne = async () => ({
  dataValues: { company_id: 42, company_name: "Acme Store", user_id: 7, email: "contact@acme.test" },
});
models.userModel.findOne = async () => ({
  dataValues: { email: "owner@acme.test", name: "Alex Owner" },
});

// Import AFTER stubs are in place.
const { notifyOverpayment } = require("../services/overpaymentNotifier");

async function run() {
  let failures = 0;
  const assert = (cond: boolean, msg: string) => {
    if (cond) {
      console.log(`  PASS: ${msg}`);
    } else {
      failures += 1;
      console.log(`  FAIL: ${msg}`);
    }
  };

  const info = {
    paymentId: "pay_test_123",
    companyId: 42,
    txId: "0xabc123",
    currency: "BTC",
    amountReceived: 0.0016,
    amountExpected: 0.001,
    excessAmount: 0.0006,
    excessAmountUsd: 60,
    baseCurrency: "USD",
    linkId: 99,
  };

  console.log("Test 1 — first call sends both emails + notification");
  await notifyOverpayment(info);

  const merchant = sentEmails.find((e) => e.to === "owner@acme.test");
  const admin = sentEmails.find((e) => e.to === process.env.ADMIN_EMAIL);

  assert(sentEmails.length === 2, `exactly 2 emails sent (got ${sentEmails.length})`);
  assert(!!merchant, "merchant email sent to account-holder address");
  assert(!!admin, "admin email sent to ADMIN_EMAIL");
  assert(!!merchant && /0\.0006 BTC/.test(merchant.body), "merchant email shows excess 0.0006 BTC");
  assert(!!merchant && /60\.00 USD/.test(merchant.body), "merchant email shows fiat ≈ 60.00 USD");
  assert(!!merchant && /Acme Store/.test(merchant.body), "merchant email names the company");
  assert(!!admin && /routed to the admin wallet/i.test(admin.body), "admin email states excess routed to admin");
  assert(!!admin && /0\.0006 BTC/.test(admin.body), "admin email shows excess 0.0006 BTC");
  assert(notifications.length === 1, `exactly 1 in-app notification created (got ${notifications.length})`);
  assert(notifications[0]?.type === "payment_overpaid", "notification type is payment_overpaid");

  console.log("Test 2 — duplicate call is deduped (no extra sends)");
  await notifyOverpayment(info);
  assert(sentEmails.length === 2, `still 2 emails after duplicate call (got ${sentEmails.length})`);
  assert(notifications.length === 1, `still 1 notification after duplicate call (got ${notifications.length})`);

  console.log("");
  if (failures === 0) {
    console.log("ALL OVERPAYMENT NOTIFIER TESTS PASSED ✅");
    process.exit(0);
  } else {
    console.log(`${failures} ASSERTION(S) FAILED ❌`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("TEST RUNNER ERROR:", e);
  process.exit(1);
});
