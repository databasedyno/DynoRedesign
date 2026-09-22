/**
 * Pool Crumb Sweeper — consolidates leftover USDT-TRC20 platform fees ("crumbs")
 * stranded on merchant-pool addresses, paying for the sweep with the TRX already
 * sitting on those addresses, then reclaims the leftover TRX to the fee wallet and
 * reconciles DB admin_fee_balance counters to the on-chain truth.
 */

import axios from "../../utils/tatumHttp";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { merchantTempAddressModel } from "../../models";
import { cronLogger } from "../../utils/loggers";
import { getErrorMessage } from "../../helper";
import { convertToUSD } from "../../utils/currencyUtils";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../../utils/redisInstance";
import { toFixedStr, toNumber } from "../../utils/money";
import { raw as envRaw } from "../../utils/config";
import { tronGridHeaders, estimateTrc20TransferCost, getTronTxActualFeeTRX, DEFAULT_TRC20_CONTRACT } from "../tronEnergyService";
import { ADMIN_WALLETS, TOKEN_CONTRACTS } from "./merchantPoolConfig";
import { sweepPoolAddress, reclaimExcessGas } from "./merchantPoolSweep";

const LOG = "[CrumbSweeper]";
const TRONGRID_API = envRaw("TRONGRID_API_URL") || "https://api.trongrid.io";
const WALLET_TYPE = "USDT-TRC20";
const REPORT_KEY = "pool:crumbs:last_report";
const RUNNING_KEY = "pool:crumbs:running";
const MIN_TRX_RECLAIM = 2; // reclaimExcessGas leaves 1.1 TRX dust; below 2 there is nothing worth moving

export interface CrumbAddress {
  id: number;
  address: string;
  status: string;
  usdt: number;
  trx: number;
  dbFee: number;
}

export interface CrumbSweepOptions {
  dryRun?: boolean;
  /** Absolute USD floor per address (default 5). */
  minUsd?: number;
  /** Multiplier on the live gas cost an address must exceed (default 1.2). */
  gasMultiple?: number;
  /** Cap on how many addresses get swept in one run (default 20). */
  maxSweeps?: number;
}

export interface CrumbSweepReport {
  startedAt: string;
  finishedAt?: string;
  dryRun: boolean;
  walletType: string;
  adminWallet: string;
  scanned: number;
  scanErrors: number;
  holders: CrumbAddress[];
  gas: { estimateTrx: number; estimateUsd: number; trxUsd: number; source: string };
  thresholdUsd: number;
  swept: Array<{ id: number; address: string; amount: number; txId: string; gasUsedTrx: number | null }>;
  skipped: Array<{ id: number; address: string; usdt: number; reason: string }>;
  reclaimed: Array<{ id: number; address: string; amount: number; txId: string }>;
  reconciled: { zeroed: number; corrected: number };
  totals: { sweptUsdt: number; reclaimedTrx: number; strandedUsdt: number; strandedTrx: number };
  errors: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Live USDT + TRX balance of one TRON address (TronGrid /v1/accounts). */
export const readTronAccount = async (address: string, contract = DEFAULT_TRC20_CONTRACT): Promise<{ usdt: number; trx: number }> => {
  const res = await axios.get(`${TRONGRID_API}/v1/accounts/${address}`, { headers: tronGridHeaders(), timeout: 10000, idempotent: true } as any);
  const d = res.data?.data?.[0] || {};
  const trc = (d.trc20 || []).find((t: Record<string, string>) => t[contract]);
  return { usdt: trc ? Number(trc[contract]) / 1e6 : 0, trx: (Number(d.balance) || 0) / 1e6 };
};

/** Scan every sweepable USDT-TRC20 pool address on-chain. */
export const scanPoolCrumbs = async (): Promise<{ rows: CrumbAddress[]; errors: number }> => {
  const contract = TOKEN_CONTRACTS[WALLET_TYPE] || DEFAULT_TRC20_CONTRACT;
  const pool = (await sequelize.query(
    `SELECT temp_address_id, wallet_address, status, admin_fee_balance
       FROM tbl_merchant_temp_address
      WHERE wallet_type = $1 AND status IN ('AVAILABLE','IN_USE','PRE_RESERVED') AND current_payment_id IS NULL
      ORDER BY temp_address_id`,
    { bind: [WALLET_TYPE], type: QueryTypes.SELECT }
  )) as Array<{ temp_address_id: number; wallet_address: string; status: string; admin_fee_balance: string }>;

  const rows: CrumbAddress[] = [];
  let errors = 0;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    try {
      const bal = await readTronAccount(p.wallet_address, contract);
      rows.push({ id: p.temp_address_id, address: p.wallet_address, status: p.status, usdt: bal.usdt, trx: bal.trx, dbFee: Number(p.admin_fee_balance) || 0 });
    } catch (e) {
      errors++;
      cronLogger.warn(`${LOG} scan failed for ${p.wallet_address}: ${getErrorMessage(e)}`);
    }
    if (i % 8 === 7) await sleep(500); // stay under TronGrid free-tier QPS
  }
  return { rows, errors };
};

// getRedisItem returns {} for a missing key — treat an empty object as "nothing stored".
const readRedis = async <T,>(key: string): Promise<T | null> => {
  const v = (await getRedisItem(key)) as T | Record<string, never> | null;
  return v && Object.keys(v).length > 0 ? (v as T) : null;
};

export const getLastCrumbReport = async (): Promise<CrumbSweepReport | null> => readRedis<CrumbSweepReport>(REPORT_KEY);

export const isCrumbSweepRunning = async (): Promise<boolean> => (await readRedis(RUNNING_KEY)) !== null;

/**
 * One consolidation pass. Safe to re-run: every step is idempotent against the
 * live chain state (balances are re-read before any transfer).
 */
export const consolidatePoolCrumbs = async (opts: CrumbSweepOptions = {}): Promise<CrumbSweepReport> => {
  const dryRun = Boolean(opts.dryRun);
  const minUsd = opts.minUsd ?? 5;
  const gasMultiple = opts.gasMultiple ?? 1.2;
  const maxSweeps = opts.maxSweeps ?? 20;
  const adminWallet = ADMIN_WALLETS[WALLET_TYPE];
  if (!adminWallet) throw new Error(`${LOG} no admin wallet configured for ${WALLET_TYPE}`);

  const report: CrumbSweepReport = {
    startedAt: new Date().toISOString(),
    dryRun,
    walletType: WALLET_TYPE,
    adminWallet,
    scanned: 0,
    scanErrors: 0,
    holders: [],
    gas: { estimateTrx: 0, estimateUsd: 0, trxUsd: 0, source: "static" },
    thresholdUsd: minUsd,
    swept: [],
    skipped: [],
    reclaimed: [],
    reconciled: { zeroed: 0, corrected: 0 },
    totals: { sweptUsdt: 0, reclaimedTrx: 0, strandedUsdt: 0, strandedTrx: 0 },
    errors: [],
  };

  await setRedisItemWithTTL(RUNNING_KEY, { startedAt: report.startedAt, dryRun }, 1800);
  try {
    // 1. On-chain scan
    const { rows, errors } = await scanPoolCrumbs();
    report.scanned = rows.length;
    report.scanErrors = errors;
    report.holders = rows.filter((r) => r.usdt > 0).sort((a, b) => b.usdt - a.usdt);
    cronLogger.info(`${LOG} scanned ${rows.length} ${WALLET_TYPE} addresses — ${report.holders.length} hold USDT (${toFixedStr(report.holders.reduce((s, r) => s + r.usdt, 0), 2)} total), ${errors} scan errors`);

    // 2. Live gas cost of ONE transfer to the (activated) admin wallet
    const sample = report.holders[0];
    const cost = await estimateTrc20TransferCost({
      senderAddress: sample?.address,
      recipientAddress: adminWallet,
      contractAddress: TOKEN_CONTRACTS[WALLET_TYPE],
      amountBaseUnits: sample ? BigInt(Math.floor(sample.usdt * 1e6)) : undefined,
    });
    const trxUsd = await convertToUSD("TRX", 1).catch(() => 0);
    report.gas = { estimateTrx: cost.totalTRX, estimateUsd: toNumber(cost.totalTRX * trxUsd, 4), trxUsd, source: cost.source };
    report.thresholdUsd = Math.max(minUsd, toNumber(report.gas.estimateUsd * gasMultiple, 2));
    cronLogger.info(`${LOG} live gas ≈ ${cost.totalTRX} TRX ($${toFixedStr(report.gas.estimateUsd, 2)}) → sweep threshold $${report.thresholdUsd}`);

    // 3. Sweep the profitable holders using the TRX already on them
    let sweeps = 0;
    for (const h of report.holders) {
      if (h.usdt < report.thresholdUsd) {
        report.skipped.push({ id: h.id, address: h.address, usdt: h.usdt, reason: `below threshold $${report.thresholdUsd}` });
        continue;
      }
      if (sweeps >= maxSweeps) {
        report.skipped.push({ id: h.id, address: h.address, usdt: h.usdt, reason: `maxSweeps ${maxSweeps} reached` });
        continue;
      }
      if (dryRun) {
        report.skipped.push({ id: h.id, address: h.address, usdt: h.usdt, reason: "dry run" });
        continue;
      }
      try {
        // Reconcile the counter to chain first so sweepPoolAddress sees a sweepable balance.
        await merchantTempAddressModel.update({ admin_fee_balance: h.usdt }, { where: { temp_address_id: h.id, current_payment_id: null } });
        const res = await sweepPoolAddress(h.id, { force: true, skipProfitabilityCheck: true });
        if (res.success && res.txId && (res.amount || 0) > 0) {
          sweeps++;
          let gasUsedTrx: number | null = null;
          // Never reclaim TRX before the TRC20 transfer has executed (its energy fee is charged at execution).
          for (let i = 0; i < 20 && gasUsedTrx === null; i++) {
            await sleep(3000);
            const fee = await getTronTxActualFeeTRX(res.txId);
            if (fee) gasUsedTrx = fee.feeTRX;
          }
          report.swept.push({ id: h.id, address: h.address, amount: res.amount || 0, txId: res.txId, gasUsedTrx });
          report.totals.sweptUsdt = toNumber(report.totals.sweptUsdt + (res.amount || 0), 6);
          cronLogger.info(`${LOG} ✅ swept ${res.amount} USDT from ${h.address} → ${adminWallet} (tx ${res.txId}, gas ${gasUsedTrx ?? "?"} TRX)`);
        } else {
          report.skipped.push({ id: h.id, address: h.address, usdt: h.usdt, reason: res.reason || res.message || "sweep returned no tx" });
        }
      } catch (e) {
        const msg = getErrorMessage(e);
        report.errors.push(`sweep ${h.address}: ${msg}`);
        report.skipped.push({ id: h.id, address: h.address, usdt: h.usdt, reason: `error: ${msg}` });
      }
    }

    // 4. Reclaim leftover TRX — from swept addresses and from zero-USDT addresses.
    //    Addresses still holding sub-threshold USDT keep their TRX (it pays for a later sweep).
    const sweptIds = new Set(report.swept.map((s) => s.id));
    const keepGas = new Set(report.skipped.filter((s) => s.usdt > 0 && !sweptIds.has(s.id)).map((s) => s.id));
    for (const r of rows) {
      if (keepGas.has(r.id) || r.trx < MIN_TRX_RECLAIM) continue;
      if (dryRun) { report.totals.reclaimedTrx = toNumber(report.totals.reclaimedTrx + Math.max(0, r.trx - 1.1), 6); continue; }
      try {
        const rc = await reclaimExcessGas(r.address, WALLET_TYPE, 1);
        if (rc.reclaimed && rc.txId) {
          report.reclaimed.push({ id: r.id, address: r.address, amount: rc.amount, txId: rc.txId });
          report.totals.reclaimedTrx = toNumber(report.totals.reclaimedTrx + rc.amount, 6);
        }
        await sleep(400);
      } catch (e) {
        report.errors.push(`reclaim ${r.address}: ${getErrorMessage(e)}`);
      }
    }

    // 5. Reconcile DB counters to chain (skip anything that changed status meanwhile)
    if (!dryRun) {
      for (const r of rows) {
        const onChain = sweptIds.has(r.id) ? 0 : r.usdt;
        if (Math.abs(onChain - r.dbFee) < 0.000001) continue;
        const [affected] = await merchantTempAddressModel.update(
          { admin_fee_balance: onChain },
          { where: { temp_address_id: r.id, current_payment_id: null, status: { [Op.in]: ["AVAILABLE", "IN_USE", "PRE_RESERVED"] } } }
        );
        if (affected > 0) {
          if (onChain === 0) report.reconciled.zeroed++;
          else report.reconciled.corrected++;
        }
      }
    }

    report.totals.strandedUsdt = toNumber(report.skipped.filter((s) => !sweptIds.has(s.id)).reduce((s, x) => s + x.usdt, 0), 6);
    report.totals.strandedTrx = toNumber(rows.filter((r) => keepGas.has(r.id)).reduce((s, r) => s + r.trx, 0), 6);
    report.finishedAt = new Date().toISOString();
    cronLogger.info(`${LOG} done — swept ${report.totals.sweptUsdt} USDT (${report.swept.length} tx), reclaimed ${report.totals.reclaimedTrx} TRX (${report.reclaimed.length} tx), zeroed ${report.reconciled.zeroed} / corrected ${report.reconciled.corrected} counters, stranded ${report.totals.strandedUsdt} USDT, ${report.errors.length} errors`);
    await setRedisItemWithTTL(REPORT_KEY, report, 60 * 86400);
    return report;
  } finally {
    await deleteRedisItem(RUNNING_KEY);
  }
};
