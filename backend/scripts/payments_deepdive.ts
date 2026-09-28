#!/usr/bin/env ts-node --transpile-only
/**
 * Deep-dive completion of the reconciliation audit that crashed in
 * e2e-payment-diagnostic.ts, plus stale-Redis-session + fee-wallet profiling.
 * READ-ONLY. Run: cd /app/backend && ./node_modules/.bin/ts-node --transpile-only scripts/payments_deepdive.ts
 */
import dotenv from "dotenv";
dotenv.config();
import { Sequelize, QueryTypes } from "sequelize";
import { createClient, RedisClientType } from "redis";
import axios from "axios";

const seq = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres", logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});
const redis = createClient({ url: process.env.REDIS_PUBLIC_URL }) as RedisClientType;
const q = async <T=any>(sql: string) => (await seq.query(sql, { type: QueryTypes.SELECT })) as T[];

async function main() {
  await seq.authenticate();
  await redis.connect();

  // ---- Column types (why the diagnostic crashed) ----
  console.log("=== COLUMN TYPES ===");
  const types = await q<{ table_name: string; column_name: string; data_type: string }>(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE (table_name='tbl_customer_transaction' AND column_name='transaction_id')
        OR (table_name='tbl_merchant_pool_transaction' AND column_name IN ('payment_reference','status','created_at'))
     ORDER BY table_name, column_name`
  );
  for (const t of types) console.log(`  ${t.table_name}.${t.column_name} -> ${t.data_type}`);

  // ---- 12c orphan pool tx (with cast) ----
  console.log("\n=== ORPHAN POOL TRANSACTIONS (received on-chain, no matching customer tx, 30d) ===");
  const orphan = await q<any>(
    `SELECT mpt.*, mpt.created_at FROM tbl_merchant_pool_transaction mpt
     WHERE NOT EXISTS (SELECT 1 FROM tbl_customer_transaction ct WHERE ct.transaction_id::text = mpt.payment_reference)
       AND mpt.status != 'completed'
       AND mpt.created_at > NOW() - INTERVAL '30 days'
     ORDER BY mpt.created_at DESC LIMIT 25`
  );
  if (orphan.length === 0) console.log("  ✅ none — every pool receipt maps to a customer transaction");
  else {
    console.log(`  ⚠️  ${orphan.length} orphan(s):`);
    for (const o of orphan) console.log("   - " + JSON.stringify(o));
  }
  // pool tx status distribution 30d
  const mptStatus = await q<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) cnt FROM tbl_merchant_pool_transaction WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY status ORDER BY cnt DESC`
  );
  console.log("  pool tx status (30d): " + mptStatus.map(s => `${s.status}:${s.cnt}`).join(", "));

  // ---- expired payment links ----
  console.log("\n=== EXPIRED-BUT-PENDING PAYMENT LINKS ===");
  const links = await q<{ cnt: string }>(
    `SELECT COUNT(*) cnt FROM tbl_payment_link WHERE status='pending' AND expires_at < NOW() - INTERVAL '24 hours'`
  );
  console.log(`  ${links[0].cnt} pending link(s) expired >24h ago`);

  // ---- Stale Redis checkout sessions ----
  console.log("\n=== STALE REDIS CHECKOUT SESSIONS (crypto-*:json) ===");
  let cursor = 0; const sessions: any[] = [];
  do {
    const r = await redis.scan(cursor, { MATCH: "crypto-*:json", COUNT: 200 });
    cursor = r.cursor;
    for (const key of r.keys) {
      const raw = await redis.get(key); if (!raw) continue;
      try { const d = JSON.parse(raw); const ttl = await redis.ttl(key);
        sessions.push({ key, status: d.status, cur: d.currency || d.paid_currency, amt: d.amount,
          created: d.created_at || d.createdAt, addr: (key.match(/crypto-(.+):json/)||[])[1], ttl }); } catch {}
    }
  } while (cursor !== 0);

  const now = Date.now();
  const buckets: Record<string, number> = { "no-ttl": 0, "<3h": 0, "3-24h": 0, "1-7d": 0, ">7d": 0 };
  let noTtl = 0;
  for (const s of sessions) {
    if (s.ttl === -1) { buckets["no-ttl"]++; noTtl++; }
    const age = s.created ? (now - new Date(s.created).getTime()) : 0;
    const h = age / 3600000;
    if (h < 3) buckets["<3h"]++; else if (h < 24) buckets["3-24h"]++; else if (h < 168) buckets["1-7d"]++; else buckets[">7d"]++;
  }
  console.log(`  total sessions: ${sessions.length}`);
  console.log(`  by age: ` + Object.entries(buckets).map(([k,v])=>`${k}:${v}`).join(", "));
  console.log(`  sessions with NO TTL (never auto-expire): ${noTtl}`);
  const statusB: Record<string, number> = {};
  for (const s of sessions) statusB[s.status] = (statusB[s.status]||0)+1;
  console.log(`  by status: ` + Object.entries(statusB).map(([k,v])=>`${k}:${v}`).join(", "));

  // Do stale sessions tie up pool addresses (RESERVED/IN_USE)?
  const addrs = sessions.map(s => s.addr).filter(Boolean);
  if (addrs.length) {
    const inList = addrs.map(a => `'${a}'`).join(",");
    const held = await q<{ status: string; cnt: string }>(
      `SELECT status, COUNT(*) cnt FROM tbl_merchant_temp_address WHERE wallet_address IN (${inList}) GROUP BY status`
    );
    console.log(`  pool addresses matching stale sessions: ` + (held.length? held.map(h=>`${h.status}:${h.cnt}`).join(", ") : "none matched (self-custody/HD?)"));
  }

  // ---- Fee wallet balances via Tatum v3 (v4 tron 404'd) ----
  console.log("\n=== FEE WALLET BALANCES (Tatum v3) ===");
  const fw = await q<{ wallet_type: string; wallet_address: string }>(`SELECT wallet_type, wallet_address FROM tbl_admin_fee_wallet`);
  const H = { "x-api-key": process.env.TATUM_KEY || "" };
  for (const w of fw) {
    try {
      if (w.wallet_type === "TRX") {
        const r = await axios.get(`https://api.tatum.io/v3/tron/account/${w.wallet_address}`, { headers: H, timeout: 12000, validateStatus: ()=>true });
        const bal = r.status===200 ? (parseFloat(r.data.balance||"0")) : null;
        console.log(`  TRX  ${w.wallet_address} -> ${r.status===200 ? bal+" TRX" : "HTTP "+r.status}`);
      } else if (w.wallet_type === "ETH") {
        const r = await axios.get(`https://api.tatum.io/v3/ethereum/account/balance/${w.wallet_address}`, { headers: H, timeout: 12000, validateStatus: ()=>true });
        console.log(`  ETH  ${w.wallet_address} -> ${r.status===200 ? r.data.balance+" ETH" : "HTTP "+r.status}`);
      } else if (w.wallet_type === "POLYGON") {
        const r = await axios.get(`https://api.tatum.io/v3/polygon/account/balance/${w.wallet_address}`, { headers: H, timeout: 12000, validateStatus: ()=>true });
        console.log(`  POLY ${w.wallet_address} -> ${r.status===200 ? JSON.stringify(r.data) : "HTTP "+r.status}`);
      } else {
        console.log(`  ${w.wallet_type} ${w.wallet_address} (not checked)`);
      }
      await new Promise(r=>setTimeout(r,400));
    } catch(e:any){ console.log(`  ${w.wallet_type} check error: ${e.message?.substring(0,60)}`); }
  }

  await redis.disconnect(); await seq.close();
}
main().catch(async e => { console.error("DEEPDIVE FAILED:", e.message); try{await redis.disconnect();}catch{} try{await seq.close();}catch{} process.exit(1); });
