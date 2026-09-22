/**
 * Payout gas audit — records what we estimated / charged for network gas on each merchant
 * payout, later reads the REAL fee the forward transaction burned on-chain, and serves the
 * /admin/fee-reconciliation report (estimated vs actual, over/under-charge).
 */
import { Op, QueryTypes } from "sequelize";
import { ethers } from "ethers";
import axios from "../utils/tatumHttp";
import sequelize from "../utils/dbInstance";
import { payoutGasAuditModel, GAS_TOKEN_MAPPING } from "../models";
import { cronLogger } from "../utils/loggers";
import { getErrorMessage } from "../helper";
import { toNumber } from "../utils/money";
import { getCryptoPrice } from "./blockchainFeeService";
import { getTronTxActualFeeTRX } from "./tronEnergyService";
import { getRpcUrls } from "./merchantPool/directEvmTransfer";
import { explorerTxUrl } from "./receiptLinkService";

const LOG = "[PayoutGasAudit]";
const UTXO = ["BTC", "LTC", "DOGE", "BCH"];
const FIXED_FEES: Record<string, number> = { XRP: 0.000012, RLUSD: 0.000012, SOL: 0.000005 };
const MAX_ATTEMPTS = 12;

export const gasTokenFor = (walletType: string): string => GAS_TOKEN_MAPPING[walletType] || walletType;
const priceSymbolFor = (gasToken: string): string => (gasToken === "POLYGON" ? "POL" : gasToken);
const isStable = (walletType: string): boolean => /^(USDT|USDC|RLUSD)/i.test(walletType);

/** USD price of a payout asset. Stablecoins are 1:1; otherwise live price. */
const assetPriceUsd = async (walletType: string): Promise<number> =>
  isStable(walletType) ? 1 : (Number(await getCryptoPrice(priceSymbolFor(gasTokenFor(walletType)))) || 0);

export interface RecordPayoutGasAuditInput {
  poolTxId?: number | null;
  transactionId?: number | null;
  companyId?: number | null;
  userId?: number | null;
  walletType: string;
  payoutTxHash?: string | null;
  payoutAmount?: number | null;
  estimatedGasNative?: number | null;
  gasFundedNative?: number | null;
  chargedFeeAsset?: number | null;
  /** Optional: already known real fee (TRON settlement reads the receipt inline). */
  actualGasNative?: number | null;
  source?: "settlement" | "backfill";
  settledAt?: Date;
}

/** Insert one audit row (idempotent on pool_tx_id). Never throws. */
export const recordPayoutGasAudit = async (input: RecordPayoutGasAuditInput): Promise<void> => {
  try {
    if (input.poolTxId) {
      const existing = await payoutGasAuditModel.findOne({ where: { pool_tx_id: input.poolTxId }, attributes: ["audit_id"] });
      if (existing) return;
    }
    const gasToken = gasTokenFor(input.walletType);
    const chargedAsset = Number(input.chargedFeeAsset) || 0;
    const chargedUsd = chargedAsset > 0 ? toNumber(chargedAsset * (await assetPriceUsd(input.walletType)), 6) : 0;
    await payoutGasAuditModel.create({
      pool_tx_id: input.poolTxId ?? null,
      transaction_id: input.transactionId ?? null,
      company_id: input.companyId ?? null,
      user_id: input.userId ?? null,
      wallet_type: input.walletType,
      gas_token: gasToken,
      payout_tx_hash: input.payoutTxHash || null,
      payout_amount: input.payoutAmount ?? null,
      estimated_gas_native: input.estimatedGasNative ?? null,
      gas_funded_native: input.gasFundedNative ?? null,
      charged_fee_asset: chargedAsset,
      charged_fee_usd: chargedUsd,
      source: input.source || "settlement",
      status: input.payoutTxHash ? "pending" : "unavailable",
      settled_at: input.settledAt || new Date(),
    });
    // Try the chain right away when the settlement already knows the real fee.
    if (input.actualGasNative && input.actualGasNative > 0 && input.poolTxId) {
      const row = await payoutGasAuditModel.findOne({ where: { pool_tx_id: input.poolTxId } });
      if (row) await applyActual(row, input.actualGasNative, "settlement-receipt");
    }
  } catch (e) {
    cronLogger.warn(`${LOG} record failed (non-critical): ${getErrorMessage(e)}`);
  }
};

/** Real fee burned by a payout tx, in gas-token units. null = not yet available. */
export const fetchActualGasNative = async (
  txHash: string,
  walletType: string
): Promise<{ fee: number; source: string } | null> => {
  const gasToken = gasTokenFor(walletType);
  if (gasToken === "TRX") {
    const info = await getTronTxActualFeeTRX(txHash);
    return info ? { fee: info.feeTRX, source: "trongrid-receipt" } : null;
  }
  if (gasToken === "ETH" || gasToken === "POLYGON") {
    const chain = gasToken === "POLYGON" ? "POLYGON" : "ETH";
    for (const url of getRpcUrls(chain)) {
      try {
        const network = ethers.Network.from(chain === "POLYGON" ? 137 : 1);
        const provider = new ethers.JsonRpcProvider(url, network, { staticNetwork: network });
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) return null;
        const wei = receipt.gasUsed * (receipt.gasPrice ?? 0n);
        return { fee: Number(ethers.formatEther(wei)), source: "evm-receipt" };
      } catch (e) {
        cronLogger.warn(`${LOG} ${chain} receipt via ${url.slice(0, 40)} failed: ${getErrorMessage(e)}`);
      }
    }
    return null;
  }
  if (gasToken === "BTC") {
    const res = await axios.get(`https://mempool.space/api/tx/${txHash}`, { timeout: 8000, idempotent: true } as any);
    const sats = Number(res.data?.fee);
    return Number.isFinite(sats) && sats > 0 ? { fee: sats / 1e8, source: "mempool.space" } : null;
  }
  if (FIXED_FEES[gasToken] !== undefined) return { fee: FIXED_FEES[gasToken], source: "fixed-network-fee" };
  return null;
};

const applyActual = async (row: any, actualNative: number, source: string): Promise<void> => {
  const gasToken: string = row.dataValues.gas_token;
  const price = Number(await getCryptoPrice(priceSymbolFor(gasToken))) || 0;
  const actualUsd = toNumber(actualNative * price, 6);
  const chargedUsd = Number(row.dataValues.charged_fee_usd) || 0;
  await row.update({
    actual_gas_native: actualNative,
    actual_gas_usd: actualUsd,
    gas_token_price_usd: price,
    variance_usd: toNumber(chargedUsd - actualUsd, 6),
    actual_source: source,
    status: "reconciled",
    reconciled_at: new Date(),
  });
};

/** Fill in on-chain fees for pending rows. Returns how many were reconciled. */
export const reconcilePendingAudits = async (limit = 50): Promise<{ reconciled: number; pending: number; unavailable: number }> => {
  const rows = await payoutGasAuditModel.findAll({
    where: { status: "pending", payout_tx_hash: { [Op.ne]: null } },
    order: [["settled_at", "DESC"]],
    limit,
  });
  let reconciled = 0, unavailable = 0;
  for (const row of rows) {
    const d = row.dataValues;
    try {
      // UTXO chains (except BTC, which mempool.space serves) set the fee explicitly at
      // broadcast — the estimate IS the on-chain fee.
      const utxoExact = UTXO.includes(d.wallet_type) && d.wallet_type !== "BTC";
      const actual = utxoExact && Number(d.estimated_gas_native) > 0
        ? { fee: Number(d.estimated_gas_native), source: "utxo-explicit-fee" }
        : await fetchActualGasNative(d.payout_tx_hash, d.wallet_type);
      if (actual && actual.fee > 0) {
        await applyActual(row, actual.fee, actual.source);
        reconciled++;
      } else {
        const attempts = (Number(d.attempts) || 0) + 1;
        await row.update({ attempts, ...(attempts >= MAX_ATTEMPTS ? { status: "unavailable" } : {}) });
        if (attempts >= MAX_ATTEMPTS) unavailable++;
      }
    } catch (e) {
      cronLogger.warn(`${LOG} reconcile #${d.audit_id} failed: ${getErrorMessage(e)}`);
      await row.update({ attempts: (Number(d.attempts) || 0) + 1 }).catch(() => undefined);
    }
  }
  const pending = await payoutGasAuditModel.count({ where: { status: "pending" } });
  if (rows.length > 0) cronLogger.info(`${LOG} reconciled ${reconciled}/${rows.length} (unavailable ${unavailable}, still pending ${pending})`);
  return { reconciled, pending, unavailable };
};

/**
 * Backfill from tbl_merchant_pool_transaction (completed payouts with a forward tx) for the
 * last N days. Charged fee is derived: payment − merchant − admin fee + referral credit
 * (the credit refunds the platform fee, never the gas).
 */
export const backfillPayoutGasAudit = async (days = 90): Promise<{ scanned: number; inserted: number }> => {
  const rows = (await sequelize.query(
    `SELECT pt.pool_tx_id, pt.owner_user_id, pt.company_id, pt.wallet_type, pt.payment_amount, pt.merchant_amount,
            pt.admin_fee_amount, pt.gas_funded, pt.gas_used, pt.merchant_tx_id, pt.created_at,
            ut.transaction_id, ut.usd_value, ut.crypto_amount, ut.referral_credit_applied_usd
       FROM tbl_merchant_pool_transaction pt
       LEFT JOIN LATERAL (
         SELECT transaction_id, usd_value, crypto_amount, referral_credit_applied_usd
           FROM tbl_user_transaction u
          WHERE u.incoming_tx_hash = pt.payment_reference OR u.incoming_tx_hash = pt.incoming_tx_id
          ORDER BY transaction_id DESC LIMIT 1
       ) ut ON TRUE
      WHERE pt.status = 'completed' AND pt.merchant_tx_id IS NOT NULL
        AND pt.created_at > NOW() - ($1 || ' days')::interval
        AND NOT EXISTS (SELECT 1 FROM tbl_payout_gas_audit a WHERE a.pool_tx_id = pt.pool_tx_id)
      ORDER BY pt.created_at ASC`,
    { bind: [String(days)], type: QueryTypes.SELECT }
  )) as Array<Record<string, any>>;

  let inserted = 0;
  for (const r of rows) {
    const payment = Number(r.payment_amount) || 0;
    const merchant = Number(r.merchant_amount) || 0;
    const admin = Number(r.admin_fee_amount) || 0;
    const usdValue = Number(r.usd_value) || 0;
    const cryptoAmount = Number(r.crypto_amount) || 0;
    const impliedPrice = isStable(r.wallet_type) ? 1 : (usdValue > 0 && cryptoAmount > 0 ? usdValue / cryptoAmount : 0);
    const creditAsset = impliedPrice > 0 ? (Number(r.referral_credit_applied_usd) || 0) / impliedPrice : 0;
    const charged = Math.max(0, toNumber(payment - merchant - admin + creditAsset, 10));
    await recordPayoutGasAudit({
      poolTxId: r.pool_tx_id,
      transactionId: r.transaction_id ?? null,
      companyId: r.company_id ?? null,
      userId: r.owner_user_id ?? null,
      walletType: r.wallet_type,
      payoutTxHash: r.merchant_tx_id,
      payoutAmount: merchant,
      estimatedGasNative: Number(r.gas_used) || null,
      gasFundedNative: Number(r.gas_funded) || null,
      chargedFeeAsset: charged,
      source: "backfill",
      settledAt: new Date(r.created_at),
    });
    inserted++;
  }
  cronLogger.info(`${LOG} backfill ${days}d: scanned ${rows.length}, inserted ${inserted}`);
  return { scanned: rows.length, inserted };
};

export interface ReconciliationQuery {
  from?: string;
  to?: string;
  chain?: string;
  status?: string;
  verdict?: "over" | "under" | "ok";
  page?: number;
  limit?: number;
}

/** Variance band (USD) inside which a payout counts as "ok". */
export const OK_BAND_USD = 0.05;

export const verdictOf = (varianceUsd: number | null): "over" | "under" | "ok" | "pending" => {
  if (varianceUsd === null || varianceUsd === undefined) return "pending";
  if (varianceUsd > OK_BAND_USD) return "over";
  if (varianceUsd < -OK_BAND_USD) return "under";
  return "ok";
};

export const getFeeReconciliation = async (q: ReconciliationQuery) => {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
  const where: Record<string, unknown> = {};
  if (q.chain) where.wallet_type = q.chain;
  if (q.status) where.status = q.status;
  if (q.from || q.to) {
    where.settled_at = {
      ...(q.from ? { [Op.gte]: new Date(q.from) } : {}),
      ...(q.to ? { [Op.lte]: new Date(`${q.to}T23:59:59.999Z`) } : {}),
    };
  }
  if (q.verdict === "over") where.variance_usd = { [Op.gt]: OK_BAND_USD };
  else if (q.verdict === "under") where.variance_usd = { [Op.lt]: -OK_BAND_USD };
  else if (q.verdict === "ok") where.variance_usd = { [Op.between]: [-OK_BAND_USD, OK_BAND_USD] };

  const { rows, count } = await payoutGasAuditModel.findAndCountAll({
    where,
    order: [["settled_at", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  const summaryWhere = { ...where };
  delete summaryWhere.variance_usd;
  const all = await payoutGasAuditModel.findAll({
    where: summaryWhere,
    attributes: ["wallet_type", "gas_token", "status", "charged_fee_usd", "actual_gas_usd", "variance_usd", "gas_funded_native", "actual_gas_native"],
  });
  const summary = {
    payouts: all.length,
    reconciled: 0,
    pending: 0,
    unavailable: 0,
    charged_usd: 0,
    actual_usd: 0,
    variance_usd: 0,
    over: 0,
    under: 0,
    ok: 0,
    by_chain: {} as Record<string, { payouts: number; reconciled: number; charged_usd: number; actual_usd: number; variance_usd: number; gas_token: string; gas_funded_native: number; actual_gas_native: number }>,
  };
  for (const r of all) {
    const d = r.dataValues;
    const chain = summary.by_chain[d.wallet_type] ||= { payouts: 0, reconciled: 0, charged_usd: 0, actual_usd: 0, variance_usd: 0, gas_token: d.gas_token, gas_funded_native: 0, actual_gas_native: 0 };
    chain.payouts++;
    chain.gas_funded_native = toNumber(chain.gas_funded_native + (Number(d.gas_funded_native) || 0), 8);
    if (d.status === "reconciled") {
      summary.reconciled++;
      chain.reconciled++;
      const charged = Number(d.charged_fee_usd) || 0;
      const actual = Number(d.actual_gas_usd) || 0;
      const variance = Number(d.variance_usd) || 0;
      summary.charged_usd = toNumber(summary.charged_usd + charged, 6);
      summary.actual_usd = toNumber(summary.actual_usd + actual, 6);
      summary.variance_usd = toNumber(summary.variance_usd + variance, 6);
      chain.charged_usd = toNumber(chain.charged_usd + charged, 6);
      chain.actual_usd = toNumber(chain.actual_usd + actual, 6);
      chain.variance_usd = toNumber(chain.variance_usd + variance, 6);
      chain.actual_gas_native = toNumber(chain.actual_gas_native + (Number(d.actual_gas_native) || 0), 8);
      summary[verdictOf(variance)]++;
    } else if (d.status === "pending") summary.pending++;
    else summary.unavailable++;
  }

  return {
    summary,
    page,
    limit,
    total: count,
    rows: rows.map((r) => {
      const d = r.dataValues;
      const variance = d.variance_usd === null ? null : Number(d.variance_usd);
      return {
        audit_id: d.audit_id,
        pool_tx_id: d.pool_tx_id,
        transaction_id: d.transaction_id,
        company_id: d.company_id,
        wallet_type: d.wallet_type,
        gas_token: d.gas_token,
        payout_tx_hash: d.payout_tx_hash,
        explorer_url: explorerTxUrl(d.wallet_type, d.payout_tx_hash),
        payout_amount: d.payout_amount === null ? null : Number(d.payout_amount),
        estimated_gas_native: d.estimated_gas_native === null ? null : Number(d.estimated_gas_native),
        gas_funded_native: d.gas_funded_native === null ? null : Number(d.gas_funded_native),
        charged_fee_asset: Number(d.charged_fee_asset) || 0,
        charged_fee_usd: Number(d.charged_fee_usd) || 0,
        actual_gas_native: d.actual_gas_native === null ? null : Number(d.actual_gas_native),
        actual_gas_usd: d.actual_gas_usd === null ? null : Number(d.actual_gas_usd),
        variance_usd: variance,
        verdict: d.status === "reconciled" ? verdictOf(variance) : d.status,
        source: d.source,
        actual_source: d.actual_source,
        status: d.status,
        settled_at: d.settled_at,
        reconciled_at: d.reconciled_at,
      };
    }),
  };
};
