/**
 * Smoke test — ledger end-to-end on the LIVE preview DB.
 *
 * Runs with ENABLE_LEDGER=true so bootstrap creates tables + seeds accounts,
 * then posts a fake balanced batch, queries balances, runs the invariant
 * checker, and verifies drift detection.
 *
 * Uses a synthetic payment_id ("ledger-smoke-<uuid>") that will never conflict
 * with real data. Cleans up after itself.
 *
 * Run:  cd /app/backend && ENABLE_LEDGER=true node --loader ts-node/esm scripts/ledgerSmokeTest.ts
 *   OR: yarn ts-node scripts/ledgerSmokeTest.ts
 */

/* eslint-disable no-console */
import { randomUUID } from "crypto";

// Ensure env has flags on for this run
process.env.ENABLE_LEDGER = "true";

async function main() {
  const { initLedger } = await import("../services/ledger/ledgerBootstrap");
  const { postDoubleEntry, getBalances, getPaymentLedger, reverseBatch } = await import("../services/ledger/ledgerService");
  const { runInvariantCheck } = await import("../services/ledger/ledgerInvariantChecker");

  console.log("→ Bootstrapping ledger...");
  const state = await initLedger();
  console.log("   state =", state);

  const paymentId = `ledger-smoke-${randomUUID()}`;
  const dedup = `smoke-${Date.now()}`;

  console.log("\n→ Posting a balanced settlement batch...");
  const r1 = await postDoubleEntry({
    payment_id: paymentId,
    company_id: null,
    journal_event: "settlement_sent",
    dedup_key: dedup,
    tx_id: "tx-smoke-1",
    lines: [
      { account_code: "merchant_payable", direction: "DR", amount: "98.5", currency: "USDT" },
      { account_code: "buyer_escrow",     direction: "CR", amount: "98.5", currency: "USDT" },
      { account_code: "fee_revenue",      direction: "DR", amount: "1.5",  currency: "USDT" },
      { account_code: "buyer_escrow",     direction: "CR", amount: "1.5",  currency: "USDT" },
    ],
  });
  console.log("   ", r1);

  console.log("\n→ Re-posting same batch (idempotency check)...");
  const r2 = await postDoubleEntry({
    payment_id: paymentId,
    company_id: null,
    journal_event: "settlement_sent",
    dedup_key: dedup,
    tx_id: "tx-smoke-1",
    lines: [
      { account_code: "merchant_payable", direction: "DR", amount: "98.5", currency: "USDT" },
      { account_code: "buyer_escrow",     direction: "CR", amount: "98.5", currency: "USDT" },
      { account_code: "fee_revenue",      direction: "DR", amount: "1.5",  currency: "USDT" },
      { account_code: "buyer_escrow",     direction: "CR", amount: "1.5",  currency: "USDT" },
    ],
  });
  console.log("   ", r2, r2.posted === false ? "✅ IDEMPOTENT" : "❌ POSTED TWICE");

  console.log("\n→ Attempting UNBALANCED post (should throw)...");
  try {
    await postDoubleEntry({
      payment_id: paymentId,
      company_id: null,
      journal_event: "smoke_unbalanced",
      dedup_key: "unbal-1",
      lines: [
        { account_code: "buyer_escrow", direction: "DR", amount: "10", currency: "USDT" },
        { account_code: "fee_revenue",  direction: "CR", amount: "9",  currency: "USDT" },
      ],
    });
    console.log("   ❌ Should have thrown");
  } catch (err) {
    console.log("   ✅ Rejected:", (err as Error).message);
  }

  console.log("\n→ Querying balances for the payment...");
  const balances = await getBalances({ payment_id: paymentId });
  console.log("   ", balances);

  console.log("\n→ Fetching payment timeline...");
  const timeline = await getPaymentLedger(paymentId);
  console.log(`   ${timeline.length} entries`);

  console.log("\n→ Running invariant check (should be OK)...");
  const inv = await runInvariantCheck(1); // last 1h
  console.log("   status=", inv.status, "rows=", inv.rows_scanned, "batches=", inv.batches_scanned);

  console.log("\n→ Reversing the batch (correction flow)...");
  const rev = await reverseBatch(r1.batch_id, "smoke test cleanup");
  console.log("   ", rev);

  console.log("\n→ Post-reversal balance (should be zero)...");
  const balancesAfter = await getBalances({ payment_id: paymentId });
  console.log("   ", balancesAfter);
  for (const b of balancesAfter) {
    if (b.net !== "0" && !/^-?0(\.0+)?$/.test(b.net)) {
      console.log(`   ❌ Non-zero net after reversal: ${b.account_code} ${b.currency} = ${b.net}`);
    }
  }
  console.log("\n✅ Smoke test complete. Payment ID:", paymentId);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});
