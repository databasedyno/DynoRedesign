/**
 * scripts/loadtest_money_path.ts — CONCURRENCY CORRECTNESS harness.
 *
 * Drives the REAL settlement / reservation / sweep code against an ISOLATED
 * staging DB + Redis with LOADTEST_NO_BROADCAST=true (no on-chain broadcast,
 * no KMS). Because it shares the same staging Redis as the running staging
 * backend, the Redis SETNX idempotency locks are exercised across processes —
 * i.e. real multi-worker concurrency.
 *
 * Asserts the invariants the user cares about:
 *   A. No DOUBLE SETTLEMENT — N concurrent settlement attempts on one payment
 *      produce exactly ONE settlement + ONE ledger settlement_sent batch.
 *   B. Ledger stays BALANCED — global sum(DR) === sum(CR) per currency.
 *   C. No OVER-RESERVATION — concurrent reservations never hand the same pool
 *      address to two different payments.
 *   D. No DOUBLE SWEEP — concurrent sweeps of one address let exactly one win.
 *
 * SAFETY: refuses to run unless LOADTEST_NO_BROADCAST=true AND the DB host is
 * NOT the production host (roundhouse). Never run against prod.
 *
 * Usage (env exported by the caller):
 *   ts-node --transpile-only scripts/loadtest_money_path.ts [--settle-payments N]
 *     [--settle-concurrency C] [--reserve N] [--reserve-pool P]
 *     [--sweep N] [--sweep-concurrency C]
 */
import dotenv from "dotenv";
dotenv.config();

import sequelize from "../utils/dbInstance";
import { connectRedis } from "../utils/redisInstance";
import { userModel, companyModel, merchantTempAddressModel } from "../models";
import { settleCryptoTransaction } from "../controller/payment/settlement/settleTransaction";
import { reserveAddress } from "../services/merchantPool/merchantPoolReservation";
import { sweepPoolAddress } from "../services/merchantPool/merchantPoolSweep";

// ── safety gates ────────────────────────────────────────────────────────────
if (process.env.LOADTEST_NO_BROADCAST !== "true") {
  console.error("❌ REFUSING: LOADTEST_NO_BROADCAST must be 'true'.");
  process.exit(2);
}
const dbUrl = process.env.DATABASE_URL || "";
if (dbUrl.includes("roundhouse")) {
  console.error("❌ REFUSING: DATABASE_URL points at the PRODUCTION host (roundhouse).");
  process.exit(2);
}

// ── args ──────────────────────────────────────────────────────────────────
const arg = (name: string, def: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
};
const SETTLE_PAYMENTS = arg("settle-payments", 50);
const SETTLE_CONCURRENCY = arg("settle-concurrency", 20);
const RESERVE_N = arg("reserve", 80);
const RESERVE_MERCHANTS = arg("reserve-merchants", 20);
const SWEEP_N = arg("sweep", 10);
const SWEEP_CONCURRENCY = arg("sweep-concurrency", 8);

const RUN = `LT${Date.now().toString(36)}`;
const failures: string[] = [];
const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const amax = (arr: number[]) => arr.reduce((m, v) => (v > m ? v : m), 0);

async function seedMerchant() {
  const user = await userModel.create({
    name: "LoadTest Merchant",
    email: `loadtest-${RUN}@example.com`,
    login_type: "EMAIL",
    status: "active",
  } as never);
  const uid = (user as any).user_id as number;
  const company = await companyModel.create({ user_id: uid, name: "LoadTest Co" } as never);
  const cid = (company as any).company_id as number;
  console.log(`   seeded merchant user_id=${uid} company_id=${cid}`);
  return { uid, cid };
}

async function seedTempAddress(uid: number, cid: number, walletType: string, opts: {
  status: string; paymentId?: string | null; adminFee?: number;
}) {
  const rand = Math.random().toString(36).slice(2, 10);
  const row = await merchantTempAddressModel.create({
    owner_user_id: uid,
    wallet_type: walletType,
    wallet_address: `LOADTEST-${walletType}-${RUN}-${rand}`,
    private_key: `LOADTEST-ENC-PK-${rand}`,
    status: opts.status,
    admin_fee_balance: opts.adminFee ?? 0,
    current_company_id: cid,
    current_payment_id: opts.paymentId ?? null,
    expected_amount: 0,
    received_amount: 0,
    derivation_index: Math.floor(Math.random() * 1e6),
  } as never);
  return row as any;
}

// ── TEST A: concurrent settlement idempotency + ledger balance ──────────────
async function testSettlement(uid: number, cid: number) {
  console.log(`\n── TEST A: ${SETTLE_PAYMENTS} payments × ${SETTLE_CONCURRENCY} concurrent settlements (${SETTLE_PAYMENTS * SETTLE_CONCURRENCY} total) ──`);
  const latencies: number[] = [];
  let settledOk = 0, dupBlocked = 0, errored = 0;
  const perPaymentSettledCount: Record<string, number> = {};
  const t0 = Date.now();

  const paymentIds: string[] = [];
  for (let i = 0; i < SETTLE_PAYMENTS; i++) paymentIds.push(`${RUN}-PAY-${i}`);

  // Seed one temp address per payment (holds the funds to settle)
  const addrByPayment: Record<string, any> = {};
  await Promise.all(paymentIds.map(async (pid) => {
    addrByPayment[pid] = await seedTempAddress(uid, cid, "BTC", { status: "IN_USE", paymentId: pid, adminFee: 0 });
  }));

  // Fire all settlement attempts concurrently (across ALL payments at once)
  const jobs: Promise<void>[] = [];
  for (const pid of paymentIds) {
    const addr = addrByPayment[pid];
    for (let c = 0; c < SETTLE_CONCURRENCY; c++) {
      jobs.push((async () => {
        const s = Date.now();
        try {
          const res: any = await settleCryptoTransaction({
            tempAddressData: {
              address: addr.dataValues.wallet_address,
              wallet_address: addr.dataValues.wallet_address,
              private_key: addr.dataValues.private_key,
              payment_id: pid,
              wallet_type: "BTC",
              is_merchant_pool: true,
              // @ts-expect-error extra field consumed via (tempAddressData as any)
              current_company_id: cid,
            },
            receivedAmount: 0.5,      // admin fee (BTC)
            currency: "BTC",
            transactionId: `${pid}-incoming-${c}`,
            userAmount: 1.5,          // merchant amount (BTC)
            userAddress: "LOADTEST-MERCHANT-WALLET",
            isMerchantPool: true,
          } as never);
          latencies.push(Date.now() - s);
          if (res && (res.status === "loadtest_settled")) {
            settledOk++;
            perPaymentSettledCount[pid] = (perPaymentSettledCount[pid] || 0) + 1;
          } else {
            dupBlocked++;  // already_settled / settlement_in_progress
          }
        } catch (e) {
          errored++;
        }
      })());
    }
  }
  await Promise.all(jobs);
  const dur = (Date.now() - t0) / 1000;

  // Assert exactly ONE fresh settlement per payment
  let multiSettled = 0, neverSettled = 0;
  for (const pid of paymentIds) {
    const n = perPaymentSettledCount[pid] || 0;
    if (n > 1) multiSettled++;
    else if (n === 0) neverSettled++;
  }
  console.log(`   done in ${dur.toFixed(1)}s — freshSettled=${settledOk} dupBlocked=${dupBlocked} errored=${errored}`);
  console.log(`   latency ms: p50=${pct(latencies,50)} p95=${pct(latencies,95)} p99=${pct(latencies,99)} max=${amax(latencies)}`);
  console.log(`   throughput: ${((SETTLE_PAYMENTS*SETTLE_CONCURRENCY)/dur).toFixed(0)} settlement-calls/sec`);

  if (multiSettled > 0) failures.push(`TEST A: ${multiSettled} payment(s) settled fresh more than once (DOUBLE SETTLEMENT)`);
  else console.log(`   ✅ exactly one fresh settlement per payment (no double-settlement)`);
  if (neverSettled > 0) failures.push(`TEST A: ${neverSettled} payment(s) were NEVER settled (expected 1 each) — infra/logic gap`);

  // Ledger: settlement_sent batches per payment == 1
  const [ledgerPerPayment]: any = await sequelize.query(
    `select payment_id, count(distinct batch_id) as batches
       from tbl_ledger_entries
      where journal_event='settlement_sent' and payment_id like :like
      group by payment_id`,
    { replacements: { like: `${RUN}-PAY-%` } }
  );
  const badLedger = (ledgerPerPayment as any[]).filter(r => Number(r.batches) !== 1);
  console.log(`   ledger settlement_sent rows: ${ (ledgerPerPayment as any[]).length } payments, ${badLedger.length} with !=1 batch`);
  if (badLedger.length > 0) failures.push(`TEST A: ${badLedger.length} payment(s) have !=1 ledger settlement batch`);
  else if ((ledgerPerPayment as any[]).length === SETTLE_PAYMENTS) console.log(`   ✅ exactly one ledger settlement batch per payment`);

  // Global ledger balance per currency (DR - CR == 0)
  const [bal]: any = await sequelize.query(
    `select currency,
            sum(case when direction='DR' then amount else 0 end) as dr,
            sum(case when direction='CR' then amount else 0 end) as cr
       from tbl_ledger_entries group by currency`
  );
  let imbalanced = 0;
  for (const r of bal as any[]) {
    const delta = Number(r.dr) - Number(r.cr);
    console.log(`   ledger ${r.currency}: DR=${r.dr} CR=${r.cr} delta=${delta}`);
    if (Math.abs(delta) > 1e-9) imbalanced++;
  }
  if (imbalanced > 0) failures.push(`TEST A: ledger imbalanced in ${imbalanced} currency(ies)`);
  else console.log(`   ✅ ledger balanced (DR==CR) in all currencies`);
}

// ── TEST C: concurrent reservation (no over-reservation) ────────────────────
async function testReservation(seed: { uid: number; cid: number }) {
  console.log(`\n── TEST C: ${RESERVE_N} concurrent reservations across ${RESERVE_MERCHANTS} merchants (pre-warmed fast path) ──`);
  const walletType = "BTC";

  // Spread load across several merchants so the per-merchant reservation lock
  // is not the sole bottleneck (mirrors real traffic: many merchants at once).
  const merchants: { uid: number; cid: number }[] = [seed];
  for (let m = 1; m < RESERVE_MERCHANTS; m++) merchants.push(await seedMerchant());

  // Pre-warm each merchant with PRE_RESERVED addresses (the lock-free fast path)
  // plus a few AVAILABLE as fallback.
  const perMerchant = Math.ceil(RESERVE_N / RESERVE_MERCHANTS) + 3;
  for (const mrec of merchants) {
    await Promise.all(Array.from({ length: perMerchant }).map((_, k) =>
      seedTempAddress(mrec.uid, mrec.cid, walletType, {
        status: k < perMerchant - 2 ? "PRE_RESERVED" : "AVAILABLE",
      })));
  }

  const latencies: number[] = [];
  const assigned: { pid: string; addrId: number | null }[] = [];
  let busy = 0, errored = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: RESERVE_N }).map((_, i) => (async () => {
    const mrec = merchants[i % merchants.length];
    const pid = `${RUN}-RSV-${i}`;
    const s = Date.now();
    try {
      const res: any = await reserveAddress(walletType, pid, mrec.uid, mrec.cid, 100);
      latencies.push(Date.now() - s);
      const addrId = res?.dataValues?.temp_address_id ?? null;
      assigned.push({ pid, addrId });
    } catch (e) {
      const msg = (e as Error).message || "";
      if (/busy|try again/i.test(msg)) busy++;   // expected same-merchant backpressure
      else errored++;
    }
  })()));
  const dur = (Date.now() - t0) / 1000;

  const addrIds = assigned.map(a => a.addrId).filter(Boolean) as number[];
  const uniqueAddrs = new Set(addrIds);
  console.log(`   done in ${dur.toFixed(1)}s — reserved=${assigned.length} busy(expected backpressure)=${busy} errored=${errored} uniqueAddrs=${uniqueAddrs.size}`);
  console.log(`   latency ms: p50=${pct(latencies,50)} p95=${pct(latencies,95)} p99=${pct(latencies,99)}`);
  console.log(`   throughput: ${(assigned.length/dur).toFixed(0)} successful reservations/sec`);

  if (uniqueAddrs.size !== addrIds.length) {
    failures.push(`TEST C: DOUBLE RESERVATION — ${addrIds.length} reservations but only ${uniqueAddrs.size} unique addresses`);
  } else {
    console.log(`   ✅ every successful reservation got a UNIQUE address (no over-reservation)`);
  }
  if (errored > 0) failures.push(`TEST C: ${errored} UNEXPECTED reservation error(s) (non-backpressure)`);

  // DB cross-check: no address mapped to >1 of our payments
  const [dbRows]: any = await sequelize.query(
    `select current_payment_id, count(*) c
       from tbl_merchant_temp_address
      where current_payment_id like :like group by current_payment_id having count(*) > 1`,
    { replacements: { like: `${RUN}-RSV-%` } }
  );
  if ((dbRows as any[]).length > 0) failures.push(`TEST C: ${(dbRows as any[]).length} payment(s) mapped to >1 address in DB`);
}

// ── TEST D: concurrent sweep (no double sweep) ──────────────────────────────
async function testSweep(uid: number, cid: number) {
  console.log(`\n── TEST D: ${SWEEP_N} addresses × ${SWEEP_CONCURRENCY} concurrent sweeps each ──`);
  const walletType = "BTC";
  const addrs: any[] = [];
  for (let i = 0; i < SWEEP_N; i++) {
    addrs.push(await seedTempAddress(uid, cid, walletType, { status: "AVAILABLE", adminFee: 1 }));
  }
  const t0 = Date.now();
  let doubleSweep = 0;
  const latencies: number[] = [];
  await Promise.all(addrs.map(async (addr) => {
    const id = addr.dataValues.temp_address_id;
    let successes = 0;
    await Promise.all(Array.from({ length: SWEEP_CONCURRENCY }).map(() => (async () => {
      const s = Date.now();
      try {
        const res: any = await sweepPoolAddress(id);
        latencies.push(Date.now() - s);
        if (res && res.success && !res.skipped && (res.txId || res.amount > 0 || res.message === undefined)) successes++;
      } catch (_e) { /* status-guard rejections expected */ }
    })()));
    if (successes > 1) doubleSweep++;
  }));
  const dur = (Date.now() - t0) / 1000;
  console.log(`   done in ${dur.toFixed(1)}s — addresses=${SWEEP_N}, addresses swept>once=${doubleSweep}`);
  console.log(`   latency ms: p50=${pct(latencies,50)} p95=${pct(latencies,95)} p99=${pct(latencies,99)}`);
  if (doubleSweep > 0) failures.push(`TEST D: ${doubleSweep} address(es) were swept more than once (DOUBLE SWEEP)`);
  else console.log(`   ✅ no address swept more than once (concurrent sweep guard holds)`);
}

(async () => {
  console.log(`\n================ MONEY-PATH CONCURRENCY LOAD TEST (${RUN}) ================`);
  console.log(`DB host: ${dbUrl.replace(/:[^:@]+@/, ":****@")}`);
  try {
    await sequelize.authenticate();
    await connectRedis();
    const { uid, cid } = await seedMerchant();
    await testSettlement(uid, cid);
    await testReservation({ uid, cid });
    await testSweep(uid, cid);
  } catch (e) {
    console.error("HARNESS ERROR:", (e as Error).stack || e);
    failures.push(`harness crashed: ${(e as Error).message}`);
  }

  console.log(`\n================ RESULT ================`);
  if (failures.length === 0) {
    console.log("✅ ALL CONCURRENCY INVARIANTS HELD (no double-settle, ledger balanced, no over-reserve, no double-sweep)");
  } else {
    console.log(`❌ ${failures.length} INVARIANT VIOLATION(S):`);
    failures.forEach(f => console.log("   - " + f));
  }
  await sequelize.close().catch(() => {});
  process.exit(failures.length === 0 ? 0 : 1);
})();
