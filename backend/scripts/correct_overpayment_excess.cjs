#!/usr/bin/env node
// Ops tool (one-off): credit merchants the overpayment excess that the OLD settlement
// policy kept as "platform fee" on auto-converted payments (tx 940 / 942 on The Dev Store).
//   dry run (default):  node correct_overpayment_excess.cjs 940 942
//   execute:            node correct_overpayment_excess.cjs --execute 940 942
// Runs against the COMPILED backend (dist/) — copy next to dist/ inside the prod container.
// What --execute does, per transaction:
//   1. ONE Binance withdrawal of the summed excess (USDT, merchant's settlement chain/address)
//   2. tbl_user_transaction: base_amount += excess, transaction_fee = true fee, usd_value += excess USD
//   3. tbl_stablecoin_conversion: conversion_fee = true fee (USD), merchant_payout_usd += excess USD
//   4. tbl_payment_journal: event 'overpayment_credited' (idempotency marker) + in-app notification
const path = require("path");

const DIST = process.env.DIST || path.join(__dirname, "dist");
const args = process.argv.slice(2);
const execute = args.includes("--execute");
const txIds = args.filter((a) => /^\d+$/.test(a)).map(Number);
if (txIds.length === 0) {
  console.error("usage: node correct_overpayment_excess.cjs [--execute] <transaction_id> ...");
  process.exit(2);
}

const r8 = (n) => Math.round(Number(n) * 1e8) / 1e8;
const floor2 = (n) => Math.floor(Number(n) * 100) / 100;

(async () => {
  const sequelize = require(`${DIST}/utils/dbInstance`).default;
  const { QueryTypes } = require("sequelize");
  const binance = require(`${DIST}/services/binanceService`);
  const q = (sql, bind, t) => sequelize.query(sql, { bind, type: QueryTypes.SELECT, transaction: t });

  const plans = [];
  for (const txId of txIds) {
    console.log(`\n=== transaction ${txId} ===`);
    const [tx] = await q(`SELECT transaction_id, id, user_id, company_id, crypto_currency, crypto_amount, base_amount, transaction_fee, usd_value, incoming_tx_hash FROM tbl_user_transaction WHERE transaction_id = $1`, [txId]);
    if (!tx) { console.error("tx missing — skipping"); continue; }
    const [conv] = await q(`SELECT conversion_id, status, conversion_rate, conversion_fee, merchant_payout_usd, target_currency, settlement_chain, settlement_wallet_address FROM tbl_stablecoin_conversion WHERE transaction_id = $1 ORDER BY conversion_id DESC LIMIT 1`, [txId]);
    const [det] = await q(`SELECT metadata FROM tbl_payment_journal WHERE (payment_id = $1 OR tx_id = $2) AND event = 'payment_detected' ORDER BY id DESC LIMIT 1`, [tx.id, tx.incoming_tx_hash || ""]);
    const [done] = await q(`SELECT id FROM tbl_payment_journal WHERE (payment_id = $1 OR tx_id = $2) AND event = 'overpayment_credited' LIMIT 1`, [tx.id, tx.incoming_tx_hash || ""]);
    const expected = Number(det && det.metadata && det.metadata.expectedAmount);
    console.log("tx:", tx);
    console.log("conversion:", conv);
    console.log("expected (journal):", expected);
    if (done) { console.error(`already corrected (journal row ${done.id}) — skipping`); continue; }
    if (!conv || conv.status !== "COMPLETED") { console.error("conversion not COMPLETED — skipping"); continue; }
    if (!(expected > 0)) { console.error("no expectedAmount in journal — skipping"); continue; }

    const received = Number(tx.crypto_amount);
    const excess = r8(received - expected);
    const fee = Number(tx.transaction_fee);
    if (!(excess > 0)) { console.error("not overpaid — skipping"); continue; }
    if (excess > fee) { console.error(`excess ${excess} > recorded fee ${fee} — refusing (fee did not include the excess?)`); continue; }
    const rate = Number(conv.conversion_rate);
    const trueFee = r8(fee - excess);
    const excessUsd = floor2(excess * rate);
    const trueFeeUsd = Math.round(trueFee * rate * 1e8) / 1e8;
    const plan = { tx, conv, expected, received, excess, trueFee, excessUsd, trueFeeUsd, rate };
    console.log(`PLAN: excess ${excess} ${tx.crypto_currency} (= $${excessUsd} @ ${rate}) → merchant; true fee ${trueFee} ${tx.crypto_currency} ($${trueFeeUsd.toFixed(4)}, was ${fee})`);
    plans.push(plan);
  }
  if (plans.length === 0) { console.log("\nnothing to do"); process.exit(0); }

  const byDest = new Map();
  for (const p of plans) {
    const key = `${p.conv.target_currency}|${p.conv.settlement_chain}|${p.conv.settlement_wallet_address}`;
    byDest.set(key, (byDest.get(key) || []).concat(p));
  }
  for (const [key, group] of byDest) {
    const [coin, network, address] = key.split("|");
    const total = floor2(group.reduce((s, p) => s + p.excessUsd, 0));
    console.log(`\n>>> ${execute ? "WITHDRAWING" : "[dry] would withdraw"} ${total} ${coin} (${network}) to ${address} for tx ${group.map((p) => p.tx.transaction_id).join(", ")}`);
    if (!execute) continue;

    const bal = await binance.getAssetBalance(coin);
    if (bal.free < total) { console.error(`insufficient ${coin}: have ${bal.free}, need ${total} — aborting this group`); continue; }
    const withdrawOrderId = `opfix-${group.map((p) => p.tx.transaction_id).join("-")}`;
    const w = await binance.submitWithdrawal({ coin, address, amount: total, network, withdrawOrderId });
    console.log("withdrawal id:", w.id);

    const t = await sequelize.transaction();
    try {
      for (const p of group) {
        await sequelize.query(
          `UPDATE tbl_user_transaction SET base_amount = base_amount + $1, transaction_fee = $2, usd_value = usd_value + $3 WHERE transaction_id = $4`,
          { bind: [p.excess, p.trueFee, p.excessUsd, p.tx.transaction_id], transaction: t }
        );
        await sequelize.query(
          `UPDATE tbl_stablecoin_conversion SET conversion_fee = $1, merchant_payout_usd = COALESCE(merchant_payout_usd, 0) + $2, error_message = NULL WHERE conversion_id = $3`,
          { bind: [p.trueFeeUsd, p.excessUsd, p.conv.conversion_id], transaction: t }
        );
        await sequelize.query(
          `INSERT INTO tbl_payment_journal (payment_id, tx_id, address, currency, event, from_state, to_state, amount, company_id, metadata, created_at)
           VALUES ($1, $7, $2, $3, 'overpayment_credited', 'payout_complete', 'payout_complete', $4, $5, $6::jsonb, NOW())`,
          {
            bind: [p.tx.id, address, p.tx.crypto_currency, p.excess, p.tx.company_id, JSON.stringify({
              correction: true, withdrawal_id: w.id, withdraw_order_id: withdrawOrderId, expected: p.expected, received: p.received,
              excess_base: p.excessUsd, base_currency: "USD", rate: p.rate, conversion_id: p.conv.conversion_id, credited_to: "merchant",
            }), p.tx.incoming_tx_hash || null],
            transaction: t,
          }
        );
      }
      await t.commit();
    } catch (e) {
      await t.rollback();
      console.error(`DB update failed AFTER withdrawal ${w.id} was submitted — fix rows manually:`, e && e.message ? e.message : e);
      continue;
    }

    try {
      const { createNotification } = require(`${DIST}/controller/notificationController`);
      for (const p of group) {
        await createNotification(
          Number(p.tx.user_id), "payment_overpaid", "Overpayment credited",
          `A buyer overpaid ${p.excess} ${p.tx.crypto_currency} (≈ $${p.excessUsd}) on transaction #${p.tx.transaction_id}. The excess has now been paid out to your ${coin} (${network}) wallet.`,
          { transaction_id: p.tx.transaction_id, excess_amount: p.excess, excess_amount_usd: p.excessUsd, currency: p.tx.crypto_currency, withdrawal_id: w.id, correction: true },
          Number(p.tx.company_id)
        );
      }
    } catch (e) {
      console.error("notification failed (non-fatal):", e && e.message ? e.message : e);
    }
    console.log(`done: ${group.length} row(s) corrected, withdrawal ${w.id}`);
  }
  process.exit(0);
})().catch((e) => { console.error("FATAL", e && e.message ? e.message : e); process.exit(1); });
