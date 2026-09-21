#!/usr/bin/env node
/**
 * ONE-OFF DATA REPAIR (user-approved): re-create SafeDeal deal #209 (completed, $30,
 * seller moxxcompany@gmail.com / buyer gidimeter@gmail.com) that was cascade-deleted
 * with the brand-262 test-customer purge. Reconstructed from surviving evidence:
 *   - tbl_customer_transaction 1246  (seller CREDIT 30.00, ref escrow:209:settle:release, 2026-09-20T17:08:03Z)
 *   - tbl_payment_journal payment b80ade7d-ff42-4171-bf99-2f524be273b4 (expected 43.74, received 44.50 USDT-TRC20)
 *   - tbl_merchant_pool_transaction 533 (customer_id 753, tx cded5987…, settlement 887a7b81…)
 *   - tbl_user_transaction 1153 ("SafeDeal deal #209 funding (buyer gidimeter@gmail.com)")
 *   - tbl_customer_withdrawal 46 (parked deal payout 30.00 → TA53tt…fjBE, 2026-09-20T23:07Z)
 * Idempotent: no-op if escrow_id 209 already exists. Does NOT touch ledger rows.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const { randomBytes, randomUUID } = require("crypto");

const COMPANY_ID = 262;
const ESCROW_ID = 209;
const SELLER = { customer_id: 696, email: "moxxcompany@gmail.com" };
const BUYER = { customer_id: 753, email: "gidimeter@gmail.com" };
const PAYMENT_ID = "b80ade7d-ff42-4171-bf99-2f524be273b4";
const DEPOSIT_ADDRESS = "TUwrTaK9z7HTw9QUCfBTKK1vZKTDNXa8M4";
const FUNDING_TX = "cded598780d7d78478a0b801feef3b3f037ce5400fb091acfba0c2003b0a894b";
const SETTLEMENT_TX = "887a7b81c00b15137c3febdd8ee221441777937c26b5b0a742c996826b240814";

const T_DETECTED = "2026-09-20T17:04:13.280Z"; // payment_detected (earliest hard evidence)
const T_SETTLED = "2026-09-20T17:04:25.664Z"; // settlement_sent
const T_FUNDED = "2026-09-20T17:04:26.599Z"; // payment_completed
const T_RELEASED = "2026-09-20T17:08:03.166Z"; // seller release credit
const T_PAYOUT_SENT = "2026-09-20T23:07:01.930Z"; // withdrawal 46 sent

// Fee math as quoted at funding (matches journal expectedAmount 43.74):
// escrow fee max(5% × 30, $10 min) = 10; network USDT-TRC20 2.24; withdrawal USDT-TRON 1.50; no conversion/exchange (stablecoin).
const breakdown = {
  amount: 30, currency: "USD", feePercent: 5, feeMinUsd: 10, feePayer: "buyer",
  escrowFee: 10, exchangeFeePercent: 2, exchangeFeeUsd: 0,
  networkFeeUsd: 2.24, conversionFeeUsd: 0, withdrawalFeeUsd: 1.5, passThroughCosts: 3.74, totalCost: 13.74,
  payoutCoin: "USDT-TRON", costsEstimated: true, quotedFundingCoin: "USDT-TRC20", fundingCoinAssumed: false, nonStableSurchargeUsd: 0,
  buyerPays: 43.74, sellerReceives: 30, platformFee: 10,
};
const amounts = { outcome: "release", sellerAmount: 30, buyerRefund: 0, platformFee: 10 };
const settlementNote = "Release: seller +30 USD, platform fee 10 USD (authorized)";

const restoredAt = new Date().toISOString();
const RESTORE_TAG = "[Restored record]";
const activity = [
  { at: T_DETECTED, type: "created", actor: SELLER.email, role: "seller", note: `Deal created on SafeDeal and the other party invited. ${RESTORE_TAG} Original creation time unknown — set to the first on-chain evidence.` },
  { at: T_DETECTED, type: "accepted", actor: BUYER.email, role: "buyer", note: `Counterparty accepted the terms. ${RESTORE_TAG} Acceptance time approximated.` },
  { at: T_DETECTED, type: "funding_address", actor: "buyer", role: "buyer", note: "Payment address issued: 43.74 USDT-TRC20 (43.74 USD) via Dynopay.", meta: { payment_id: PAYMENT_ID, coin: "USDT-TRC20" } },
  { at: T_FUNDED, type: "funded", actor: "dynopay", role: "buyer", note: `Buyer paid 44.5 USD in USDT-TRC20 (tx ${FUNDING_TX}); 43.74 USDT held securely in escrow.`, meta: { breakdown, paidUsd: 44.5, overpaid_usd: 0.76 } },
  { at: T_RELEASED, type: "outcome_release", actor: BUYER.email, role: "buyer", note: settlementNote, meta: { amounts, entitlement_stablecoin: "USDT" } },
  { at: T_RELEASED, type: "payout_seller", actor: "system", role: "system", note: "30 USD for the seller is held in their SafeDeal balance — their payout address is in its safety hold and will be paid automatically once usable." },
  { at: T_PAYOUT_SENT, type: "payout_sent", actor: "system", role: "system", note: "Payout of 30 USD sent to USDT · Tron (TRC-20) TA53tt…fjBE (withdrawal #46).", meta: { withdrawal_id: 46, exchange_ref: "BINANCE-82493f38e55f4e1c838062c390883c53" } },
  { at: restoredAt, type: "restored", actor: "admin", role: "admin", note: "Deal record restored by SafeDeal support from surviving ledger, payment-journal and payout evidence after an accidental deletion. Timestamps before funding are approximate; money movements are exact.", meta: { evidence: { ledger_tx: 1246, payment_id: PAYMENT_ID, pool_tx: 533, user_tx: 1153, withdrawal_id: 46 } } },
];

const fundingPayment = {
  payment_id: PAYMENT_ID, coin: "USDT-TRC20", address: DEPOSIT_ADDRESS, destination_tag: null,
  crypto_amount: "43.74", base_amount: 43.74, base_currency: "USD", qr_code: null, status: "settled",
  created_at: T_DETECTED, expires_at: "2026-09-20T19:04:13.280Z", seen_tx: FUNDING_TX, received_crypto: 44.5,
  settlement_tx: SETTLEMENT_TX, merchant_amount: 42.26335,
  events: [{ event: "created", at: T_DETECTED }, { event: "payment.confirmed", at: T_FUNDED }, { event: "payment.settled", at: T_FUNDED }, { event: "restored", at: restoredAt }],
};

const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });

(async () => {
  await client.connect();
  const existing = await client.query("SELECT escrow_id, status FROM tbl_escrow_deal WHERE escrow_id=$1", [ESCROW_ID]);
  if (existing.rows.length) {
    console.log("NOOP — deal already present:", JSON.stringify(existing.rows[0]));
  } else {
    await client.query("BEGIN");
    // Buyer's tbl_customer row was purged too (pool tx 533 proves customer_id 753 in brand 262).
    const cust = await client.query("SELECT customer_id FROM tbl_customer WHERE customer_id=$1", [BUYER.customer_id]);
    if (!cust.rows.length) {
      await client.query(
        `INSERT INTO tbl_customer (customer_id, id, company_id, customer_name, email, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$4,$5,NOW())`,
        [BUYER.customer_id, randomUUID(), COMPANY_ID, BUYER.email, T_DETECTED]
      );
      console.log("INSERTED tbl_customer 753 (gidimeter@gmail.com)");
    }
    await client.query(
      `INSERT INTO tbl_escrow_deal (
         escrow_id, deal_token, company_id, creator_user_id, creator_role, creator_email, creator_customer_id,
         counterparty_email, counterparty_customer_id, invite_kind, source,
         title, description, amount, currency, price_currency, price_amount, fx_rate, fx_locked_at,
         fee_percent, fee_min_usd, fee_payer, auto_release_days, status,
         invited_at, accepted_at, funded_at, completed_at, outcome, outcome_authorized_at, dispute_resolution,
         simulated, funding_coin, funding_method, funding_link_transaction_id, funding_crypto_amount, funding_deposit_address,
         funding_tx_hash, funded_amount_usd, funding_settled_at, custody_stablecoin, custody_amount_stable, converted_at,
         seller_entitlement_stable, seller_payout_state, seller_paid_at, seller_payout_tx, seller_signed_in,
         buyer_payout_state, buyer_signed_in, fully_paid_at, needs_admin_review,
         settlement_note, funding_payment, activity_log, dispute_thread, revision_round, created_at, updated_at
       ) VALUES (
         $1,$2,$3,NULL,'seller',$4,$5,
         $6,$7,'email','safedeal',
         '30',NULL,30.00,'USD','USD',30.00,1.00000000,$8,
         5.00,10.00,'buyer',3,'completed',
         $8,$8,$9,$10,'release',$10,'release',
         false,'USDT-TRC20','dynopay_api',$11,43.74,$12,
         $13,43.74,$14,'USDT',43.74,$9,
         30.00,'paid',$10,$15,true,
         'na',true,$10,false,
         $16,$17::jsonb,$18::jsonb,'[]'::jsonb,0,$8,NOW()
       )`,
      [
        ESCROW_ID, randomBytes(24).toString("hex"), COMPANY_ID, SELLER.email, SELLER.customer_id,
        BUYER.email, BUYER.customer_id, T_DETECTED, T_FUNDED, T_RELEASED,
        PAYMENT_ID, DEPOSIT_ADDRESS, FUNDING_TX, T_SETTLED, `WALLET-CREDIT-${ESCROW_ID}`,
        settlementNote, JSON.stringify(fundingPayment), JSON.stringify(activity),
      ]
    );
    await client.query("COMMIT");
    console.log("INSERTED tbl_escrow_deal row escrow_id=209");
  }
  const row = (await client.query(
    `SELECT escrow_id, deal_token, status, amount, fee_payer, creator_email, counterparty_email, creator_customer_id, counterparty_customer_id,
            funding_coin, funded_amount_usd, funding_tx_hash, outcome, seller_entitlement_stable, seller_payout_state, completed_at
       FROM tbl_escrow_deal WHERE escrow_id=$1`, [ESCROW_ID])).rows[0];
  console.log("VERIFY", JSON.stringify(row, null, 2));
  await client.end();
})().catch(async (e) => { console.error("ERR", e.message); try { await client.query("ROLLBACK"); } catch {} client.end(); process.exit(1); });
