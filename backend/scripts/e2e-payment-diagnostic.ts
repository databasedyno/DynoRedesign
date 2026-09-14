#!/usr/bin/env ts-node --transpile-only
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  DynoPay — End-to-End Payment Pipeline Diagnostic Script
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Run:  cd /app/backend && npx ts-node --transpile-only scripts/e2e-payment-diagnostic.ts
 *
 *  Sections:
 *   1. Backend Health (server, DB, Redis, Tatum, Binance)
 *   2. Database Integrity (tables, orphans, duplicates)
 *   3. Redis State (stuck payments, stale locks)
 *   4. Webhook Pipeline (BullMQ queue health, DLQ)
 *   5. Payment State Audit (orphan states, stuck transitions)
 *   6. Merchant Pool Health (address availability, stuck IN_USE)
 *   7. On-Chain Balance Verification (unswept funds in temp wallets)
 *   8. Sweep Pipeline (failed sweeps, energy issues)
 *   9. Fee Wallet & Admin Wallet Health (gas balances)
 *  10. Tatum Subscription Verification
 *  11. Stablecoin Conversion Pipeline
 *  12. Reconciliation Dry Run (Redis vs DB consistency)
 * ═══════════════════════════════════════════════════════════════════════
 */

import dotenv from "dotenv";
dotenv.config();

import { Sequelize } from "sequelize";
import { createClient, RedisClientType } from "redis";
import axios from "axios";

// ── Types & Globals ────────────────────────────────────────────────────────────

interface Issue {
  section: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  details?: string;
}

const issues: Issue[] = [];
const sectionResults: Record<string, { passed: number; failed: number; warnings: number }> = {};
let currentSection = "";
let seq: Sequelize;
let redis: RedisClientType;

const ADMIN_WALLETS: Record<string, string> = {
  BTC: process.env.BTC || "",
  ETH: process.env.ETH || "",
  LTC: process.env.LTC || "",
  DOGE: process.env.DOGE || "",
  BCH: process.env.BCH || "",
  SOL: process.env.SOL || "",
  XRP: process.env.XRP || "",
  TRX: process.env.TRX || "",
  "USDT-TRC20": process.env.USDT_TRC20 || "",
  "USDT-ERC20": process.env.ETH || "",
  "USDC-ERC20": process.env.USDC_ERC20 || "",
  RLUSD: process.env.RLUSD_ADMIN_WALLET || "",
  POLYGON: process.env.POLYGON || "",
  "USDT-POLYGON": process.env.POLYGON || "",
  "RLUSD-ERC20": process.env.RLUSD_ERC20 || "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function startSection(name: string) {
  currentSection = name;
  sectionResults[name] = { passed: 0, failed: 0, warnings: 0 };
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${name}`);
  console.log(`${"=".repeat(70)}`);
}

function pass(msg: string) {
  sectionResults[currentSection].passed++;
  console.log(`  [PASS] ${msg}`);
}

function fail(msg: string, details?: string, severity: "CRITICAL" | "WARNING" = "CRITICAL") {
  if (severity === "CRITICAL") {
    sectionResults[currentSection].failed++;
  } else {
    sectionResults[currentSection].warnings++;
  }
  console.log(`  [${severity}] ${msg}`);
  if (details) console.log(`     > ${details}`);
  issues.push({ section: currentSection, severity, message: msg, details });
}

function info(msg: string) {
  console.log(`  [INFO] ${msg}`);
}

function warn(msg: string, details?: string) {
  fail(msg, details, "WARNING");
}

async function query<T = any>(sql: string): Promise<T[]> {
  const [results] = await seq.query(sql);
  return results as T[];
}

// ── Section 1: Backend Health ──────────────────────────────────────────────────

async function checkBackendHealth() {
  startSection("1. Backend Health");

  // 1a. Database
  try {
    await seq.authenticate();
    const dbTime = await query<{ now: string; version: string }>("SELECT NOW() as now, version() as version");
    pass(`PostgreSQL connected — ${dbTime[0].version?.split(" on")[0]}`);
  } catch (e: any) {
    fail("PostgreSQL connection FAILED", e.message);
  }

  // 1b. Redis
  try {
    await redis.ping();
    const redisInfo = await redis.info("server");
    const version = redisInfo.match(/redis_version:(\S+)/)?.[1] || "unknown";
    pass(`Redis connected — v${version}`);
  } catch (e: any) {
    fail("Redis connection FAILED", e.message);
  }

  // 1c. Tatum API
  try {
    const tatumRes = await axios.get("https://api.tatum.io/v4/blockchain/node/BTC", {
      headers: { "x-api-key": process.env.TATUM_KEY || "" },
      timeout: 10000,
      validateStatus: () => true,
    });
    if (tatumRes.status < 500) {
      pass(`Tatum API reachable (status: ${tatumRes.status})`);
    } else {
      fail("Tatum API returned server error", `Status: ${tatumRes.status}`);
    }
  } catch (e: any) {
    fail("Tatum API unreachable", e.message);
  }

  // 1d. Binance API (for price feeds)
  try {
    const binRes = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { timeout: 10000 });
    if (binRes.data?.price) {
      pass(`Binance API reachable (BTC: $${parseFloat(binRes.data.price).toFixed(0)})`);
    }
  } catch (e: any) {
    warn("Binance API unreachable — price feeds may fail", e.message?.substring(0, 80));
  }
}

// ── Section 2: Database Integrity ──────────────────────────────────────────────

async function checkDatabaseIntegrity() {
  startSection("2. Database Integrity");

  // 2a. Core tables exist
  const requiredTables = [
    "tbl_customer_transaction", "tbl_user", "tbl_user_wallet",
    "tbl_user_temp_address", "tbl_admin_wallet", "tbl_admin_fee_wallet",
    "tbl_merchant_temp_address", "tbl_merchant_pool_transaction", "tbl_merchant_pool_sweep",
    "tbl_stablecoin_conversion", "tbl_payment_link", "tbl_invoice",
    "tbl_admin_fee_transaction", "tbl_admin_fee_transfer",
    "tbl_user_exchange", "tbl_fees", "tbl_company",
  ];

  const existingTables = await query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tableNames = new Set(existingTables.map(t => t.tablename));

  let missingCount = 0;
  for (const table of requiredTables) {
    if (!tableNames.has(table)) {
      warn(`Missing table: ${table}`);
      missingCount++;
    }
  }
  if (missingCount === 0) {
    pass(`All ${requiredTables.length} core tables present`);
  }

  // 2b. Check for transactions with NULL status
  const nullStatus = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM tbl_customer_transaction WHERE status IS NULL`
  );
  if (parseInt(nullStatus[0].count) > 0) {
    fail(`${nullStatus[0].count} transactions with NULL status`);
  } else {
    pass("No transactions with NULL status");
  }

  // 2c. Check for duplicate transaction_id
  const dupeTx = await query<{ transaction_id: string; cnt: string }>(
    `SELECT transaction_id, COUNT(*) as cnt FROM tbl_customer_transaction 
     WHERE transaction_id IS NOT NULL GROUP BY transaction_id HAVING COUNT(*) > 1 LIMIT 5`
  );
  if (dupeTx.length > 0) {
    fail(`${dupeTx.length} duplicate transaction_id(s) found`,
      dupeTx.map(d => `${d.transaction_id} (x${d.cnt})`).join(", "));
  } else {
    pass("No duplicate transaction_ids");
  }

  // 2d. Orphaned merchant pool addresses (IN_USE for >3h)
  const orphanedAddresses = await query<{ temp_address_id: number; wallet_address: string; wallet_type: string; last_used_at: string }>(
    `SELECT temp_address_id, wallet_address, wallet_type, last_used_at
     FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE'
     AND last_used_at < NOW() - INTERVAL '3 hours'
     ORDER BY last_used_at ASC LIMIT 10`
  );
  if (orphanedAddresses.length > 0) {
    warn(`${orphanedAddresses.length} merchant pool addresses IN_USE for >3 hours`,
      orphanedAddresses.map(a => `#${a.temp_address_id} ${a.wallet_type} ${a.wallet_address.substring(0, 16)}... (since ${a.last_used_at})`).join("\n     "));
  } else {
    pass("No stale IN_USE merchant pool addresses (>3h)");
  }

  // 2e. Transaction count summary by status
  const statusCounts = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_customer_transaction GROUP BY status ORDER BY cnt DESC`
  );
  info("Transaction status distribution:");
  for (const s of statusCounts) {
    console.log(`     ${s.status}: ${s.cnt}`);
  }

  // 2f. Transactions stuck in "processing" for >10 min
  const stuckProcessing = await query<{ id: string; transaction_id: string; "updatedAt": string }>(
    `SELECT id, transaction_id, "updatedAt" FROM tbl_customer_transaction 
     WHERE status = 'processing' AND "updatedAt" < NOW() - INTERVAL '10 minutes' LIMIT 10`
  );
  if (stuckProcessing.length > 0) {
    fail(`${stuckProcessing.length} transaction(s) stuck in "processing" for >10 min`,
      stuckProcessing.map(t => `${t.transaction_id} (updated: ${t.updatedAt})`).join(", "));
  } else {
    pass('No transactions stuck in "processing"');
  }

  // 2g. Recent failed transactions (24h)
  const recentFailed = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_customer_transaction 
     WHERE status = 'failed' AND "updatedAt" > NOW() - INTERVAL '24 hours'`
  );
  const failedCount = parseInt(recentFailed[0].cnt);
  if (failedCount > 0) {
    warn(`${failedCount} failed transaction(s) in last 24 hours`);
  } else {
    pass("No failed transactions in last 24 hours");
  }
}

// ── Section 3: Redis State ─────────────────────────────────────────────────────

async function checkRedisState() {
  startSection("3. Redis State");

  // 3a. Active crypto payments
  let activeCryptoPayments = 0;
  let stalePayments: { key: string; data: any }[] = [];
  let cursor = 0;

  do {
    const result = await redis.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      activeCryptoPayments++;
      try {
        const raw = await redis.get(key);
        if (raw) {
          const data = JSON.parse(raw);
          const age = Date.now() - new Date(data.created_at || data.createdAt || 0).getTime();
          if (age > 3 * 60 * 60 * 1000 && (data.status === "pending" || data.status === "processing")) {
            stalePayments.push({ key, data });
          }
        }
      } catch {}
    }
  } while (cursor !== 0);

  info(`Active crypto payment sessions: ${activeCryptoPayments}`);

  if (stalePayments.length > 0) {
    warn(`${stalePayments.length} stale payment(s) in Redis (>3h, pending/processing)`,
      stalePayments.slice(0, 5).map(s =>
        `${s.key} — ${s.data.status}, ${s.data.amount} ${s.data.currency}`
      ).join("\n     "));
  } else {
    pass("No stale pending/processing payments in Redis");
  }

  // 3b. Failed-payment keys
  let failedPaymentKeys = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "failed-payment-*:json", COUNT: 100 });
    cursor = result.cursor;
    failedPaymentKeys += result.keys.length;
  } while (cursor !== 0);

  if (failedPaymentKeys > 0) {
    warn(`${failedPaymentKeys} failed-payment records in Redis`);
  } else {
    pass("No failed-payment records");
  }

  // 3c. Processed-tx count
  let processedTxCount = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "processed-tx-*", COUNT: 200 });
    cursor = result.cursor;
    processedTxCount += result.keys.length;
  } while (cursor !== 0);
  info(`Processed TX markers: ${processedTxCount}`);

  // 3d. Stale locks (no TTL)
  let staleLocks = 0;
  let lockKeys: string[] = [];
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "lock:*", COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        staleLocks++;
        lockKeys.push(key);
      }
    }
  } while (cursor !== 0);

  if (staleLocks > 0) {
    fail(`${staleLocks} permanent lock(s) (no TTL)`, lockKeys.slice(0, 5).join(", "));
  } else {
    pass("No permanent locks");
  }

  // 3e. Outgoing-tx markers
  let outgoingTxCount = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "outgoing-tx-*", COUNT: 100 });
    cursor = result.cursor;
    outgoingTxCount += result.keys.length;
  } while (cursor !== 0);
  info(`Active outgoing-tx markers (sweep-in-progress): ${outgoingTxCount}`);
}

// ── Section 4: Webhook Pipeline ────────────────────────────────────────────────

async function checkWebhookPipeline() {
  startSection("4. Webhook Pipeline (BullMQ)");

  const queueNames = [
    { key: "bull:tatum-webhooks:waiting", label: "waiting" },
    { key: "bull:tatum-webhooks:active", label: "active" },
    { key: "bull:tatum-webhooks:completed", label: "completed" },
    { key: "bull:tatum-webhooks:failed", label: "failed" },
    { key: "bull:tatum-webhooks:delayed", label: "delayed" },
  ];

  for (const q of queueNames) {
    try {
      const type = await redis.type(q.key);
      let count = 0;
      if (type === "list") count = await redis.lLen(q.key);
      else if (type === "zset") count = await redis.zCard(q.key);
      else if (type === "set") count = await redis.sCard(q.key);

      if (q.label === "failed" && count > 0) {
        warn(`Webhook queue: ${count} FAILED jobs`);
      } else if (q.label === "active" && count > 5) {
        warn(`Webhook queue: ${count} ACTIVE jobs — bottleneck?`);
      } else if (q.label === "delayed" && count > 0) {
        warn(`${count} delayed/retrying webhook job(s)`);
      } else {
        info(`Queue [${q.label}]: ${count}`);
      }
    } catch {
      info(`Queue [${q.label}]: N/A`);
    }
  }

  // DLQ
  let dlqTotal = 0;
  for (const key of ["bull:tatum-webhooks-dlq:waiting", "bull:tatum-webhooks-dlq:failed"]) {
    try {
      const type = await redis.type(key);
      if (type === "list") dlqTotal += await redis.lLen(key);
      else if (type === "zset") dlqTotal += await redis.zCard(key);
      else if (type === "set") dlqTotal += await redis.sCard(key);
    } catch {}
  }

  if (dlqTotal > 0) {
    fail(`Dead Letter Queue has ${dlqTotal} item(s) — need manual review`);
  } else {
    pass("Dead Letter Queue empty");
  }
}

// ── Section 5: Payment State Audit ─────────────────────────────────────────────

async function checkPaymentStates() {
  startSection("5. Payment State Machine Audit");

  const validStates = [
    "pending", "detected", "confirming", "confirmed", "underpaid",
    "processing", "converted", "payout_complete", "failed", "expired", "refunded",
    "successful",
  ];

  const allStatuses = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_customer_transaction GROUP BY status`
  );

  const invalidStates = allStatuses.filter(s => s.status && !validStates.includes(s.status));
  if (invalidStates.length > 0) {
    warn(`Unknown payment states in DB`, invalidStates.map(s => `"${s.status}" (x${s.cnt})`).join(", "));
  } else {
    pass("All payment states are valid");
  }

  // Stuck non-terminal states >2h
  const nonTerminal = ["detected", "confirming", "confirmed", "underpaid", "processing"];
  let stuckTotal = 0;
  for (const state of nonTerminal) {
    const stuck = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM tbl_customer_transaction 
       WHERE status = '${state}' AND "updatedAt" < NOW() - INTERVAL '2 hours'`
    );
    const count = parseInt(stuck[0].cnt);
    if (count > 0) {
      const sev = (state === "processing") ? "CRITICAL" as const : "WARNING" as const;
      fail(`${count} transaction(s) stuck in "${state}" for >2h`, undefined, sev);
      stuckTotal += count;
    }
  }
  if (stuckTotal === 0) {
    pass("No transactions stuck in non-terminal states");
  }
}

// ── Section 6: Merchant Pool Health ────────────────────────────────────────────

async function checkMerchantPool() {
  startSection("6. Merchant Pool Health");

  // 6a. Address distribution
  const poolStatus = await query<{ wallet_type: string; status: string; cnt: string }>(
    `SELECT wallet_type, status, COUNT(*) as cnt 
     FROM tbl_merchant_temp_address 
     GROUP BY wallet_type, status 
     ORDER BY wallet_type, status`
  );

  const byType: Record<string, Record<string, number>> = {};
  for (const row of poolStatus) {
    if (!byType[row.wallet_type]) byType[row.wallet_type] = {};
    byType[row.wallet_type][row.status] = parseInt(row.cnt);
  }

  info("Merchant pool distribution:");
  for (const [type, statuses] of Object.entries(byType)) {
    const parts = Object.entries(statuses).map(([s, c]) => `${s}:${c}`);
    console.log(`     ${type}: ${parts.join(", ")}`);
    if (!statuses.AVAILABLE || statuses.AVAILABLE === 0) {
      fail(`No AVAILABLE addresses for ${type} — new payments will fail!`);
    }
  }

  // 6b. Stuck RESERVED >2h
  const stuckReserved = await query<{ temp_address_id: number; wallet_type: string; wallet_address: string }>(
    `SELECT temp_address_id, wallet_type, wallet_address
     FROM tbl_merchant_temp_address 
     WHERE status = 'RESERVED' AND reserved_until < NOW()
     LIMIT 10`
  );
  if (stuckReserved.length > 0) {
    warn(`${stuckReserved.length} address(es) with expired reservation`,
      stuckReserved.map(a => `#${a.temp_address_id} ${a.wallet_type} ${a.wallet_address.substring(0, 16)}...`).join("\n     "));
  } else {
    pass("No expired RESERVED addresses");
  }

  // 6c. AVAILABLE but with significant unswept balance (>$5 worth)
  const unsweptCritical = await query<{ temp_address_id: number; wallet_type: string; admin_fee_balance: string; wallet_address: string }>(
    `SELECT temp_address_id, wallet_type, admin_fee_balance, wallet_address
     FROM tbl_merchant_temp_address 
     WHERE status = 'AVAILABLE' AND CAST(admin_fee_balance AS DECIMAL) > 5
     LIMIT 10`
  );
  const unsweptSmall = await query<{ temp_address_id: number; wallet_type: string; admin_fee_balance: string }>(
    `SELECT temp_address_id, wallet_type, admin_fee_balance
     FROM tbl_merchant_temp_address 
     WHERE status = 'AVAILABLE' AND CAST(admin_fee_balance AS DECIMAL) > 0 AND CAST(admin_fee_balance AS DECIMAL) <= 5
     LIMIT 10`
  );
  if (unsweptCritical.length > 0) {
    fail(`${unsweptCritical.length} AVAILABLE address(es) with significant unswept balance (>$5)!`,
      unsweptCritical.map(a =>
        `#${a.temp_address_id} ${a.wallet_type} bal=${a.admin_fee_balance} ${a.wallet_address.substring(0, 16)}...`
      ).join("\n     "));
  } else {
    pass("No AVAILABLE addresses with significant unswept balances");
  }
  if (unsweptSmall.length > 0) {
    info(`${unsweptSmall.length} AVAILABLE address(es) with small balance (will accumulate until sweep threshold):`);
    for (const a of unsweptSmall) {
      console.log(`     #${a.temp_address_id} ${a.wallet_type} bal=${a.admin_fee_balance}`);
    }
  }

  // 6d. IN_USE with zero balance and no recent activity
  const emptyInUse = await query<{ temp_address_id: number; wallet_type: string; wallet_address: string; last_used_at: string }>(
    `SELECT temp_address_id, wallet_type, wallet_address, last_used_at
     FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE' AND CAST(admin_fee_balance AS DECIMAL) = 0
     AND last_used_at < NOW() - INTERVAL '1 hour'
     LIMIT 10`
  );
  if (emptyInUse.length > 0) {
    warn(`${emptyInUse.length} IN_USE address(es) with zero balance & stale >1h`,
      emptyInUse.map(a => `#${a.temp_address_id} ${a.wallet_type} ${a.wallet_address.substring(0, 16)}...`).join("\n     "));
  } else {
    pass("No empty stale IN_USE addresses");
  }
}

// ── Section 7: On-Chain Balance Verification ───────────────────────────────────

async function checkOnChainBalances() {
  startSection("7. On-Chain Balance Verification");

  const inUseAddresses = await query<{
    temp_address_id: number; wallet_type: string; wallet_address: string;
    admin_fee_balance: string; gas_balance: string;
  }>(
    `SELECT temp_address_id, wallet_type, wallet_address, admin_fee_balance, gas_balance
     FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE' AND CAST(admin_fee_balance AS DECIMAL) > 0
     ORDER BY CAST(admin_fee_balance AS DECIMAL) DESC
     LIMIT 10`
  );

  if (inUseAddresses.length === 0) {
    info("No IN_USE addresses with balances to verify");
    pass("Skipped — no addresses to check");
    return;
  }

  info(`Verifying ${inUseAddresses.length} address(es) against on-chain...`);
  const tatumHeaders = { "x-api-key": process.env.TATUM_KEY || "" };
  let verified = 0;
  let mismatched = 0;

  for (const addr of inUseAddresses) {
    try {
      let onChainBal: number | null = null;
      const wt = addr.wallet_type;

      if (wt === "USDT-TRC20" || wt === "TRX") {
        const res = await axios.get(
          `https://api.tatum.io/v4/tron/account/${addr.wallet_address}`,
          { headers: tatumHeaders, timeout: 10000, validateStatus: () => true }
        );
        if (res.status === 200) {
          if (wt === "USDT-TRC20") {
            const contract = process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
            const trc20 = res.data.trc20 || [];
            const token = trc20.find((t: any) => t[contract]);
            onChainBal = token ? parseFloat(token[contract]) / 1e6 : 0;
          } else {
            onChainBal = (res.data.balance || 0) / 1e6;
          }
        }
      } else if (["BTC", "LTC", "DOGE", "BCH"].includes(wt)) {
        const chainMap: Record<string, string> = { BTC: "bitcoin", LTC: "litecoin", DOGE: "dogecoin", BCH: "bcash" };
        const res = await axios.get(
          `https://api.tatum.io/v4/${chainMap[wt]}/address/balance/${addr.wallet_address}`,
          { headers: tatumHeaders, timeout: 10000, validateStatus: () => true }
        );
        if (res.status === 200) {
          onChainBal = parseFloat(res.data.incoming || "0") - parseFloat(res.data.outgoing || "0");
        }
      } else if (["ETH", "USDT-ERC20", "USDC-ERC20"].includes(wt)) {
        const res = await axios.get(
          `https://api.tatum.io/v4/ethereum/account/balance/${addr.wallet_address}`,
          { headers: tatumHeaders, timeout: 10000, validateStatus: () => true }
        );
        if (res.status === 200) {
          onChainBal = parseFloat(res.data.balance || "0");
        }
      } else if (wt === "SOL") {
        const res = await axios.get(
          `https://api.tatum.io/v4/solana/account/balance/${addr.wallet_address}`,
          { headers: tatumHeaders, timeout: 10000, validateStatus: () => true }
        );
        if (res.status === 200) {
          onChainBal = parseFloat(res.data.balance || "0") / 1e9;
        }
      }

      const dbBal = parseFloat(addr.admin_fee_balance);
      if (onChainBal !== null) {
        if (Math.abs(onChainBal - dbBal) > 0.01) {
          warn(`Balance mismatch #${addr.temp_address_id} (${wt}): DB=${dbBal}, Chain=${onChainBal}`,
            addr.wallet_address);
          mismatched++;
        } else {
          pass(`#${addr.temp_address_id} ${wt}: DB=${dbBal}, Chain=${onChainBal}`);
          verified++;
        }
      } else {
        info(`#${addr.temp_address_id} ${wt}: DB=${dbBal} (could not fetch on-chain)`);
      }

      await new Promise(r => setTimeout(r, 400));
    } catch (e: any) {
      info(`  Error checking #${addr.temp_address_id}: ${e.message?.substring(0, 60)}`);
    }
  }

  if (mismatched === 0 && verified > 0) {
    pass(`All ${verified} on-chain balances match DB`);
  }
}

// ── Section 8: Sweep Pipeline ──────────────────────────────────────────────────

async function checkSweepPipeline() {
  startSection("8. Sweep Pipeline");

  // 8a. Failed sweeps last 48h
  const failedSweeps = await query<{
    sweep_id: number; temp_address_id: number; wallet_type: string;
    amount_swept: string; status: string; error_message: string; created_at: string;
  }>(
    `SELECT sweep_id, temp_address_id, wallet_type, amount_swept, status, error_message, created_at
     FROM tbl_merchant_pool_sweep
     WHERE status = 'failed' AND created_at > NOW() - INTERVAL '48 hours'
     ORDER BY created_at DESC LIMIT 10`
  );

  if (failedSweeps.length > 0) {
    fail(`${failedSweeps.length} failed sweep(s) in last 48h`,
      failedSweeps.map(s =>
        `#${s.sweep_id} ${s.wallet_type} addr#${s.temp_address_id} ${s.amount_swept} — ${(s.error_message || "").substring(0, 80)}`
      ).join("\n     "));
  } else {
    pass("No failed sweeps in last 48h");
  }

  // 8b. Pending/in-progress sweeps
  const pendingSweeps = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_merchant_pool_sweep WHERE status IN ('pending', 'in_progress')`
  );
  if (parseInt(pendingSweeps[0].cnt) > 0) {
    warn(`${pendingSweeps[0].cnt} pending/in-progress sweep(s)`);
  } else {
    pass("No pending sweeps");
  }

  // 8c. Sweep success rate (7 days)
  const sweepStats = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_merchant_pool_sweep 
     WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY status`
  );
  if (sweepStats.length > 0) {
    info("Sweep stats (7 days):");
    let total = 0, completed = 0;
    for (const s of sweepStats) {
      console.log(`     ${s.status}: ${s.cnt}`);
      total += parseInt(s.cnt);
      if (s.status === "completed") completed = parseInt(s.cnt);
    }
    if (total > 0) {
      const rate = ((completed / total) * 100).toFixed(1);
      if (parseFloat(rate) < 90) warn(`Sweep success rate: ${rate}% (below 90%)`);
      else pass(`Sweep success rate: ${rate}%`);
    }
  } else {
    info("No sweeps in last 7 days");
  }

  // 8d. OUT_OF_ENERGY errors
  const energyErrors = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_merchant_pool_sweep 
     WHERE status = 'failed' AND (error_message ILIKE '%OUT_OF_ENERGY%' OR error_message ILIKE '%energy%')
     AND created_at > NOW() - INTERVAL '7 days'`
  );
  if (parseInt(energyErrors[0].cnt) > 0) {
    fail(`${energyErrors[0].cnt} energy-related sweep failure(s) in 7 days`,
      "feeLimit too low for TRC20 transfers — consider raising to 50 TRX");
  } else {
    pass("No energy-related sweep failures");
  }

  // 8e. Sweep thresholds
  const thresholds: Record<string, string | undefined> = {
    "USDT-TRC20": process.env.USDT_TRC20_THRESHOLD,
    BTC: process.env.BTC_THRESHOLD,
    ETH: process.env.ETH_THRESHOLD,
    LTC: process.env.LTC_THRESHOLD,
    SOL: process.env.SOL_THRESHOLD,
    XRP: process.env.XRP_THRESHOLD,
    DOGE: process.env.DOGE_THRESHOLD,
    BCH: process.env.BCH_THRESHOLD,
    "USDC-ERC20": process.env.USDC_ERC20_THRESHOLD,
    RLUSD: process.env.RLUSD_THRESHOLD,
  };

  let missingThresholds = 0;
  for (const [chain, val] of Object.entries(thresholds)) {
    if (!val) { warn(`No sweep threshold for ${chain}`); missingThresholds++; }
  }
  if (missingThresholds === 0) {
    pass(`All ${Object.keys(thresholds).length} sweep thresholds configured`);
  }
}

// ── Section 9: Wallet Health ───────────────────────────────────────────────────

async function checkWalletHealth() {
  startSection("9. Fee Wallet & Admin Wallet Health");

  // 9a. Fee wallets from DB
  const feeWallets = await query<{ fee_wallet_id: number; wallet_type: string; wallet_address: string }>(
    `SELECT fee_wallet_id, wallet_type, wallet_address FROM tbl_admin_fee_wallet`
  );
  info(`Fee wallets: ${feeWallets.length}`);
  for (const fw of feeWallets) {
    console.log(`     ${fw.wallet_type}: ${fw.wallet_address}`);
  }

  // 9b. TRX fee wallet balance
  const trxFW = feeWallets.find(w => w.wallet_type === "TRX");
  if (trxFW) {
    try {
      await new Promise(r => setTimeout(r, 500));
      const res = await axios.get(`https://api.tatum.io/v4/tron/account/${trxFW.wallet_address}`, {
        headers: { "x-api-key": process.env.TATUM_KEY || "" }, timeout: 10000, validateStatus: () => true,
      });
      if (res.status === 200) {
        const bal = (res.data.balance || 0) / 1e6;
        if (bal < 10) fail(`TRX fee wallet LOW: ${bal.toFixed(2)} TRX`, `${trxFW.wallet_address} — need 15-30 TRX per sweep`);
        else if (bal < 50) warn(`TRX fee wallet: ${bal.toFixed(2)} TRX — getting low`);
        else pass(`TRX fee wallet: ${bal.toFixed(2)} TRX`);
      } else {
        warn(`TRX fee wallet check returned status ${res.status}`);
      }
    } catch (e: any) { warn(`Could not check TRX fee wallet: ${e.message?.substring(0, 60)}`); }
  } else {
    warn("No TRX fee wallet found in DB");
  }

  // 9c. ETH fee wallet balance
  const ethFW = feeWallets.find(w => w.wallet_type === "ETH");
  if (ethFW) {
    try {
      const res = await axios.get(`https://api.tatum.io/v4/ethereum/account/balance/${ethFW.wallet_address}`, {
        headers: { "x-api-key": process.env.TATUM_KEY || "" }, timeout: 10000, validateStatus: () => true,
      });
      if (res.status === 200) {
        const bal = parseFloat(res.data.balance || "0");
        if (bal < 0.001) fail(`ETH fee wallet LOW: ${bal} ETH`, ethFW.wallet_address);
        else if (bal < 0.01) warn(`ETH fee wallet: ${bal} ETH — getting low`);
        else pass(`ETH fee wallet: ${bal} ETH`);
      }
    } catch (e: any) { warn(`Could not check ETH fee wallet: ${e.message?.substring(0, 60)}`); }
  }

  // 9d. Admin wallets configured
  let missing = 0;
  for (const [chain, addr] of Object.entries(ADMIN_WALLETS)) {
    if (!addr) { warn(`Admin wallet not configured: ${chain}`); missing++; }
  }
  if (missing === 0) pass(`All ${Object.keys(ADMIN_WALLETS).length} admin wallets configured`);
}

// ── Section 10: Tatum Subscriptions ────────────────────────────────────────────

async function checkTatumSubscriptions() {
  startSection("10. Tatum Subscription Health");

  const active = await query<{ wallet_address: string; wallet_type: string; subscription_id: string }>(
    `SELECT wallet_address, wallet_type, subscription_id
     FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE' LIMIT 5`
  );

  if (active.length === 0) { info("No IN_USE addresses to check"); return; }

  let ok = 0, bad = 0;
  for (const addr of active.slice(0, 3)) {
    if (!addr.subscription_id) {
      fail(`No subscription_id for IN_USE ${addr.wallet_type} ${addr.wallet_address.substring(0, 16)}...`);
      bad++;
      continue;
    }

    try {
      const res = await axios.get(
        `https://api.tatum.io/v4/subscription?pageSize=10&address=${addr.wallet_address}`,
        { headers: { "x-api-key": process.env.TATUM_KEY || "" }, timeout: 10000, validateStatus: () => true }
      );
      if (res.status === 200) {
        const subs = Array.isArray(res.data) ? res.data : [];
        if (subs.length > 0) {
          const activeSub = subs.find((s: any) => s.attr?.url);
          if (activeSub) {
            pass(`Subscription OK: ${addr.wallet_type} ${addr.wallet_address.substring(0, 12)}... (${activeSub.attr.url.substring(0, 40)}...)`);
            ok++;
          } else {
            warn(`Subscription without URL: ${addr.wallet_type} ${addr.wallet_address.substring(0, 12)}...`);
            bad++;
          }
        } else {
          fail(`NO subscription for ${addr.wallet_type} ${addr.wallet_address.substring(0, 12)}...`,
            "Payments will NOT trigger webhooks!");
          bad++;
        }
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      info(`Could not verify: ${e.message?.substring(0, 50)}`);
    }
  }

  if (ok > 0 && bad === 0) pass(`${ok}/${active.slice(0, 3).length} subscriptions verified`);
}

// ── Section 11: Stablecoin Conversion ──────────────────────────────────────────

async function checkStablecoinConversion() {
  startSection("11. Stablecoin Conversion Pipeline");

  // Stuck conversions >1h (using actual enum values)
  const stuck = await query<{ conversion_id: string; status: string; source_currency: string; source_amount: string; "updatedAt": string }>(
    `SELECT conversion_id, status, source_currency, source_amount, "updatedAt"
     FROM tbl_stablecoin_conversion 
     WHERE status IN ('PENDING_DEPOSIT', 'DEPOSIT_CREDITED', 'CONVERTING', 'WITHDRAWING')
     AND "updatedAt" < NOW() - INTERVAL '1 hour'
     ORDER BY "updatedAt" ASC LIMIT 10`
  );

  if (stuck.length > 0) {
    fail(`${stuck.length} stuck conversion(s) (>1h)`,
      stuck.map(c =>
        `${c.conversion_id.substring(0, 8)}... ${c.status} — ${c.source_amount} ${c.source_currency} (${c.updatedAt})`
      ).join("\n     "));
  } else {
    pass("No stuck conversions");
  }

  // Stats 7 days
  const stats = await query<{ status: string; cnt: string }>(
    `SELECT status::text, COUNT(*) as cnt FROM tbl_stablecoin_conversion 
     WHERE "createdAt" > NOW() - INTERVAL '7 days' GROUP BY status`
  );
  if (stats.length > 0) {
    info("Conversion stats (7 days):");
    for (const s of stats) console.log(`     ${s.status}: ${s.cnt}`);
  } else {
    info("No conversions in 7 days");
  }

  // Failed last 48h
  const failed = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_stablecoin_conversion 
     WHERE status = 'FAILED' AND "createdAt" > NOW() - INTERVAL '48 hours'`
  );
  if (parseInt(failed[0].cnt) > 0) {
    warn(`${failed[0].cnt} failed conversion(s) in 48h`);
  } else {
    pass("No failed conversions in 48h");
  }
}

// ── Section 12: Reconciliation ─────────────────────────────────────────────────

async function checkReconciliation() {
  startSection("12. Reconciliation Check");

  // 12a. Redis vs DB consistency for processing payments
  let redisProcessing = 0;
  let mismatched: string[] = [];
  let cursor = 0;

  do {
    const result = await redis.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      try {
        const raw = await redis.get(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.status === "processing") {
          redisProcessing++;
          if (data.payment_id) {
            const dbTx = await query<{ status: string }>(
              `SELECT status FROM tbl_customer_transaction WHERE transaction_id = '${data.payment_id}' LIMIT 1`
            );
            if (dbTx.length > 0 && dbTx[0].status !== data.status) {
              mismatched.push(`${data.payment_id}: Redis=${data.status}, DB=${dbTx[0].status}`);
            }
          }
        }
      } catch {}
    }
  } while (cursor !== 0);

  if (mismatched.length > 0) {
    fail(`${mismatched.length} Redis/DB status mismatch(es)`,
      mismatched.slice(0, 5).join("\n     "));
  } else {
    pass("Redis/DB payment statuses consistent");
  }
  info(`Currently "processing" in Redis: ${redisProcessing}`);

  // 12b. Payments with paid_amount > 0 but still pending
  const missedWebhooks = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_customer_transaction 
     WHERE status = 'pending' AND paid_amount > 0`
  );
  if (parseInt(missedWebhooks[0].cnt) > 0) {
    fail(`${missedWebhooks[0].cnt} pending payment(s) with non-zero paid_amount`,
      "Possible missed webhook — payment received but status not updated");
  } else {
    pass("No pending payments with received funds");
  }

  // 12c. Orphaned pool transactions (non-completed only — completed are normal)
  const orphaned = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_merchant_pool_transaction mpt
     WHERE NOT EXISTS (
       SELECT 1 FROM tbl_customer_transaction ct 
       WHERE ct.transaction_id = mpt.payment_reference
     )
     AND mpt.status != 'completed'
     AND mpt.created_at > NOW() - INTERVAL '7 days'`
  );
  if (parseInt(orphaned[0].cnt) > 0) {
    warn(`${orphaned[0].cnt} orphaned non-completed pool tx(s) — no matching customer transaction (7 days)`);
  } else {
    pass("No orphaned pool transactions needing attention");
  }

  // 12d. Payment links that expired but were never cleaned up
  const expiredLinks = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_payment_link 
     WHERE status = 'pending' AND expires_at < NOW() - INTERVAL '24 hours'`
  );
  if (parseInt(expiredLinks[0].cnt) > 5) {
    info(`${expiredLinks[0].cnt} expired pending payment link(s) — consider cleanup`);
  } else {
    pass("Expired payment links within normal range");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
+======================================================================+
|              DynoPay E2E Payment Pipeline Diagnostic                  |
|              ${new Date().toISOString()}                  |
+======================================================================+`);

  seq = new Sequelize(
    process.env.DB_NAME!,
    process.env.USER_NAME!,
    process.env.PASSWORD!,
    { host: process.env.HOST!, port: Number(process.env.DB_PORT), dialect: "postgres", logging: false }
  );

  redis = createClient({ url: process.env.REDIS_PUBLIC_URL }) as RedisClientType;
  await redis.connect();

  try {
    await checkBackendHealth();
    await checkDatabaseIntegrity();
    await checkRedisState();
    await checkWebhookPipeline();
    await checkPaymentStates();
    await checkMerchantPool();
    await checkOnChainBalances();
    await checkSweepPipeline();
    await checkWalletHealth();
    await checkTatumSubscriptions();
    await checkStablecoinConversion();
    await checkReconciliation();
  } catch (e: any) {
    console.error(`\n  FATAL ERROR in diagnostic: ${e.message}`);
    console.error(e.stack);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("  DIAGNOSTIC SUMMARY");
  console.log(`${"=".repeat(70)}`);

  let totalPassed = 0, totalFailed = 0, totalWarnings = 0;

  for (const [section, r] of Object.entries(sectionResults)) {
    const icon = r.failed > 0 ? "FAIL" : r.warnings > 0 ? "WARN" : "OK  ";
    console.log(`  [${icon}] ${section} — ${r.passed} passed, ${r.failed} critical, ${r.warnings} warnings`);
    totalPassed += r.passed;
    totalFailed += r.failed;
    totalWarnings += r.warnings;
  }

  console.log(`\n  ${"-".repeat(66)}`);
  console.log(`  TOTAL: ${totalPassed} passed, ${totalFailed} critical, ${totalWarnings} warnings`);
  console.log(`  ${"-".repeat(66)}`);

  const criticals = issues.filter(i => i.severity === "CRITICAL");
  if (criticals.length > 0) {
    console.log(`\n  CRITICAL ISSUES:`);
    for (const issue of criticals) {
      console.log(`     * [${issue.section}] ${issue.message}`);
      if (issue.details) console.log(`       > ${issue.details}`);
    }
  }

  const warnings = issues.filter(i => i.severity === "WARNING");
  if (warnings.length > 0) {
    console.log(`\n  WARNINGS:`);
    for (const issue of warnings) {
      console.log(`     * [${issue.section}] ${issue.message}`);
    }
  }

  if (totalFailed === 0 && totalWarnings === 0) {
    console.log(`\n  ALL SYSTEMS HEALTHY — No issues detected!`);
  } else if (totalFailed === 0) {
    console.log(`\n  SYSTEM OPERATIONAL — ${totalWarnings} non-critical warning(s)`);
  } else {
    console.log(`\n  ISSUES DETECTED — ${totalFailed} critical issue(s) need attention`);
  }

  console.log(`\n${"=".repeat(70)}\n`);

  await redis.disconnect();
  await seq.close();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\nDIAGNOSTIC SCRIPT FAILED:", e.message);
  console.error(e.stack);
  try { await redis?.disconnect(); } catch {}
  try { await seq?.close(); } catch {}
  process.exit(2);
});
