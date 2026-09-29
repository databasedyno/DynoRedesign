/**
 * Throwaway integration test for the SafeDeal AML velocity cap + 24h cashout hold + mixer alert.
 * Drives the REAL requestWithdrawal() so every gate runs against the live schema. Every test
 * cashout is forced to pending_approval (velocity/hold) so NO dispatch/Binance call happens.
 * Run: ts-node scripts/sd_sectest_withdraw.ts <customer_id>
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { CustomerRow } from "../services/customerWalletService";
import { applyEntry, getBalances, simulatedCreditsUsd } from "../services/safedeal/safedealWallet";
import { addAddress, requestWithdrawal } from "../services/safedeal/safedealWithdrawals";

async function main() {
  const cid = Number(process.argv[2]);
  if (!cid) throw new Error("usage: sd_sectest_withdraw.ts <customer_id>");
  const [customer] = await sequelize.query<CustomerRow>(
    `SELECT customer_id, company_id, customer_name, email FROM tbl_customer WHERE customer_id = :cid LIMIT 1`,
    { replacements: { cid }, type: QueryTypes.SELECT }
  );
  if (!customer) throw new Error("customer not found");

  const addr = await addAddress(customer, { payout_key: "USDT-TRON", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", label: "sectest" });

  await sequelize.transaction(async (t) => {
    await applyEntry(
      { customer, type: "CREDIT", amount: 2000, kind: "topup", description: "sectest seed (real money, non-simulated)", reference: `sectest:seed:${Date.now()}`, source: "TOPUP", meta: { test: true } },
      t
    );
  });

  const bal = await getBalances(cid);
  const sim = await simulatedCreditsUsd(cid);
  const out: any = { seeded_available: bal.available, simulated_credits: sim, steps: [] };

  // A) $600 → under caps → queued; but ZERO funded deals → AML mixer alert should log/email.
  const w1 = await requestWithdrawal(customer, { address_id: addr.address_id, amount: 600, source: "manual" });
  out.steps.push({ label: "A $600 (expect queued, AML alert fires)", status: w1.status, approval_reason: w1.approval_reason ?? null });

  // B) another $600 → rolling 24h = 1200 > $1000 cap → pending_approval (velocity).
  const w2 = await requestWithdrawal(customer, { address_id: addr.address_id, amount: 600, source: "manual" });
  out.steps.push({ label: "B $600 (expect pending_approval: velocity)", status: w2.status, approval_reason: w2.approval_reason ?? null });

  // C) activate a 24h email-change hold, then any cashout → pending_approval (hold).
  await sequelize.query(`UPDATE tbl_safedeal_profile SET cashout_hold_until = NOW() + INTERVAL '24 hours', updated_at = NOW() WHERE customer_id = :cid`, { replacements: { cid }, type: QueryTypes.UPDATE });
  const w3 = await requestWithdrawal(customer, { address_id: addr.address_id, amount: 20, source: "manual" });
  out.steps.push({ label: "C $20 under 24h hold (expect pending_approval: hold)", status: w3.status, approval_reason: w3.approval_reason ?? null });

  // D) settlement payout during the hold → also gated (per user choice: ALL sources).
  const w4 = await requestWithdrawal(customer, { address_id: addr.address_id, amount: 15, source: "settlement" });
  out.steps.push({ label: "D $15 settlement under hold (expect pending_approval)", status: w4.status, approval_reason: w4.approval_reason ?? null });

  console.log(JSON.stringify(out, null, 2));
  await sequelize.close();
}

main().catch(async (e) => { console.error("ERROR:", e.message); try { await sequelize.close(); } catch {} process.exit(1); });
