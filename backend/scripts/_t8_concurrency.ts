/**
 * T8 concurrency test - throwaway example.com customer only.
 * Verifies:
 *  - 5 parallel applyEntries with IDENTICAL reference -> exactly 1 ledger row
 *  - UNHOLD is capped at held amount
 *  - Final DEBIT drains available back to 0 (no fake balance leftover)
 *
 * Usage: node -r ts-node/register scripts/_t8_concurrency.ts <ts>
 */
import "dotenv/config";
import axios from "axios";
import { applyEntries } from "../services/safedeal/safedealWallet";
import { Client } from "pg";

const BASE = "https://vault-katiekendra.preview.emergentagent.com/api/safedeal";
const TS = process.argv[2] || String(Date.now());
const EMAIL = `sd-sec-t8-${TS}@example.com`;

async function main() {
  // 1. Create SafeDeal customer via send-code + verify-code
  const s = await axios.post(`${BASE}/auth/send-code`, { email: EMAIL });
  const code = s.data.data.preview_code;
  console.log("preview_code=", code);
  const v = await axios.post(`${BASE}/auth/verify-code`, { email: EMAIL, code });
  const token = v.data.data.token;
  console.log("signed in, token len=", token.length);

  // 2. Lookup customer row
  const pg = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pg.connect();
  const cq = await pg.query(
    "SELECT customer_id, company_id, email FROM tbl_customer WHERE email=$1",
    [EMAIL]
  );
  if (!cq.rows.length) throw new Error("no customer row");
  const customer: any = cq.rows[0];
  console.log("customer=", customer);

  const REF_CREDIT = `qa:sec:${TS}:credit`;
  const REF_HOLD = `qa:sec:${TS}:hold`;
  const REF_UNHOLD = `qa:sec:${TS}:unhold`;
  const REF_DEBIT = `qa:sec:${TS}:debit`;

  // 3. Fire 5 parallel CREDIT applyEntries with IDENTICAL reference
  const mk = (type: any, amount: number, ref: string, kind: string, source: any) => ({
    customer,
    type,
    amount,
    kind,
    description: "sec T8",
    reference: ref,
    source,
  });

  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      applyEntries([mk("CREDIT", 12.34, REF_CREDIT, "adjustment_credit", "ADJUSTMENT")])
    )
  );
  console.log(
    "credit results:",
    results.map((r) => (r.status === "fulfilled" ? `ok:${r.value}` : `err:${(r as any).reason?.message}`))
  );

  // 4. Verify exactly ONE row with that reference
  const dup = await pg.query(
    "SELECT count(*)::int AS c FROM tbl_customer_transaction WHERE transaction_reference=$1",
    [REF_CREDIT]
  );
  console.log("rows with credit ref =", dup.rows[0].c, "(expect 1)");

  // 5. Wallet balance
  const w1 = await axios.get(`${BASE}/wallet`, { headers: { "x-safedeal-token": token } });
  const avail1 = w1.data?.data?.wallet?.available_usd ?? w1.data?.data?.available;
  console.log("available after credit =", avail1, "(expect 12.34)");

  // 6. HOLD 5.00
  await applyEntries([mk("HOLD", 5.0, REF_HOLD, "escrow_hold", "ESCROW")]);
  // 7. UNHOLD 50.00 - MUST cap at held (5.00), NOT unhold 50
  await applyEntries([mk("UNHOLD", 50.0, REF_UNHOLD, "escrow_unhold", "ESCROW")]);
  const w2 = await axios.get(`${BASE}/wallet`, { headers: { "x-safedeal-token": token } });
  const avail2 = w2.data?.data?.wallet?.available_usd ?? w2.data?.data?.available;
  const held2 = w2.data?.data?.wallet?.held_usd ?? w2.data?.data?.held;
  console.log("after HOLD 5 + UNHOLD 50: available=", avail2, "held=", held2, "(expect 12.34, 0)");

  // 8. DEBIT drain to 0
  const drain = Number(avail2);
  if (drain > 0) {
    await applyEntries([mk("DEBIT", drain, REF_DEBIT, "adjustment_debit", "ADJUSTMENT")]);
  }
  const w3 = await axios.get(`${BASE}/wallet`, { headers: { "x-safedeal-token": token } });
  const avail3 = w3.data?.data?.wallet?.available_usd ?? w3.data?.data?.available;
  console.log("final available =", avail3, "(expect 0)");

  console.log("T8_RESULT_customer_id=", customer.customer_id);
  await pg.end();
}

main().catch((e) => {
  console.error("T8 ERR", e);
  process.exit(1);
});
