/**
 * Fee Wallet Monitor Service — Multi-Chain
 *
 * Monitors native-token fee wallets across TRX, ETH and POLYGON and alerts admin
 * when any of them approaches empty. Guards SmartGas / EVM transfers / TRX energy
 * from stalling out.
 *
 * 2026-07-11 refactor (extends previous fee-wallet-balance-incorrect hardening):
 * - Multi-chain: TRX + ETH + POLYGON (was TRX only).
 * - Per-chain thresholds (native units, not USD — matches the semantic of a
 *   "we need at least X native to sign the next N transactions" check).
 * - Per-chain state (lastStatus, cooldown, consecutive-empty counter).
 * - Reuses the same anti-false-alert safeguards for every chain:
 *     • Reject broken Tatum responses (upstream `tatum.*.invalidResponse`).
 *     • Require 2 consecutive empty reads before firing an "empty" alert.
 *     • Apply cooldown to all non-healthy states (including empty).
 *     • Skip a single chain on transient failure, keep checking the others.
 * - Frozen (staked) TRX still counted for TRX only (via .total field). EVM chains
 *   have no staking-for-gas concept so `.balance === .liquid === .total`.
 */

import tatumApi from "../apis/tatumApi";
import { cronLogger } from "../utils/loggers";
import { dynoPayGreetingTemplate } from "./emailService";
import mailTransporter from "../utils/mailTransporter";
import config from "../utils/config";
import { toFixedStr } from "../utils/money";

const ALERT_EMAIL =
  config.adminEmail || config.str("BREVO_SENDER_EMAIL") || "admin@dynopay.com";

// Cooldown between alert emails for the SAME chain in the SAME status level.
// Escalation (worse → worst) still bypasses this so a wallet going empty right
// after a warning alert doesn't get suppressed.
// Session 74: widened 1h → 6h. Chronic-empty wallets (e.g. POL fee wallet ran
// dry Jul 15-17) were pumping 24 alerts/day per chain × multiple chains,
// contributing to the Jul-17 Brevo spike (4497 emails). 6h keeps ops signal
// while capping worst-case at 4 emails/chain/day even when nobody tops up.
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface ChainConfig {
  id: string;             // unique key for per-wallet state (TRX/ETH/POLYGON/XRP_MASTER)
  chain: string;          // canonical Tatum currency code used for the balance lookup (TRX/ETH/POLYGON/XRP)
  displayName: string;    // human label used in emails/logs (TRX/ETH/POL/XRP)
  envKey: string;         // env var that holds the address
  address: string;        // fee wallet address
  role: string;           // what this wallet pays for (shown in alerts + admin readiness)
  criticalThreshold: number;  // native units (TRX / ETH / POL / XRP)
  warningThreshold: number;
  healthyThreshold: number;
  supportsStaking: boolean;   // true only for TRX (Stake 2.0 frozen counts toward total)
}

// Chain configuration. Thresholds picked to cover ~5-20 sweep/settlement txs
// at typical gas prices (as of 2026-07-11). Tune by tweaking env or this map.
export const FEE_WALLET_CONFIGS: ChainConfig[] = [
  {
    id: 'TRX',
    chain: 'TRX',
    displayName: 'TRX',
    envKey: 'TRX_FEE_WALLET',
    address: config.str("TRX_FEE_WALLET"),
    role: 'Gas for USDT-TRC20 payouts and fee sweeps',
    criticalThreshold: config.num("TRX_FEE_WALLET_CRITICAL", 30),
    warningThreshold: config.num("TRX_FEE_WALLET_WARNING", 60),
    healthyThreshold: config.num("TRX_FEE_WALLET_HEALTHY", 120),
    supportsStaking: true,
  },
  {
    id: 'ETH',
    chain: 'ETH',
    displayName: 'ETH',
    envKey: 'ETH_FEE_WALLET',
    address: config.str("ETH_FEE_WALLET"),
    role: 'Gas for USDT-ERC20, USDC-ERC20 and RLUSD-ERC20 payouts and fee sweeps',
    // ETH mainnet gas: ~50k gas × 20-30 gwei ≈ 0.001-0.0015 ETH per ERC20 tx.
    // Warning at 0.02 ETH ≈ 10-20 operations; critical at 0.01 ≈ 5-10.
    criticalThreshold: config.num("ETH_FEE_WALLET_CRITICAL", 0.01),
    warningThreshold: config.num("ETH_FEE_WALLET_WARNING", 0.02),
    healthyThreshold: config.num("ETH_FEE_WALLET_HEALTHY", 0.05),
    supportsStaking: false,
  },
  {
    id: 'POLYGON',
    chain: 'POLYGON',
    displayName: 'POL',
    envKey: 'POLYGON_FEE_WALLET',
    address: config.str("POLYGON_FEE_WALLET"),
    role: 'Gas for USDT-POLYGON payouts and fee sweeps',
    // Polygon gas: ~$0.005-0.05/tx. 5 POL comfortably covers weeks.
    criticalThreshold: config.num("POLYGON_FEE_WALLET_CRITICAL", 2),
    warningThreshold: config.num("POLYGON_FEE_WALLET_WARNING", 5),
    healthyThreshold: config.num("POLYGON_FEE_WALLET_HEALTHY", 10),
    supportsStaking: false,
  },
  {
    id: 'XRP_MASTER',
    chain: 'XRP',
    displayName: 'XRP',
    envKey: 'XRP_MASTER_WALLET',
    address: config.str("XRP_MASTER_WALLET"),
    role: 'Receives all XRP / RLUSD payments (destination tags); must stay above the XRPL reserve (1 XRP + 0.2 per trust line) to sweep',
    // Reserve is ~1.2 XRP (1 base + 1 RLUSD trust line); sweeps cost ~0.00001 XRP.
    criticalThreshold: config.num("XRP_MASTER_WALLET_CRITICAL", 2),
    warningThreshold: config.num("XRP_MASTER_WALLET_WARNING", 3),
    healthyThreshold: config.num("XRP_MASTER_WALLET_HEALTHY", 5),
    supportsStaking: false,
  },
];

const CHAIN_CONFIGS = FEE_WALLET_CONFIGS;

export interface WalletStatus {
  id: string;
  chain: string;
  balance: number;         // TOTAL (liquid + frozen where applicable)
  liquid?: number;         // spendable
  frozen?: number;         // staked (TRX only; else 0)
  status: 'healthy' | 'warning' | 'critical' | 'empty';
  lastChecked: Date;
  lastAlertSent?: Date;
  lastAlertLevel?: 'healthy' | 'warning' | 'critical' | 'empty';
}

// Per-chain state
const lastStatusByChain: Map<string, WalletStatus> = new Map();
const consecutiveEmptyByChain: Map<string, number> = new Map();

/** Safely extract a human-readable message from any thrown value */
const safeErrorMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  const axiosMsg = (err as Record<string, unknown>)?.response
    && ((err as Record<string, Record<string, unknown>>).response?.data as Record<string, unknown>)?.message;
  if (typeof axiosMsg === 'string') return axiosMsg;
  try { return JSON.stringify(err); } catch { return String(err); }
};

/**
 * Fetch a validated native balance. Returns null on ANY api failure so caller
 * can skip this cycle without firing a false alert. Never returns 0 for a
 * broken/empty Tatum response.
 */
async function fetchValidatedBalance(cfg: ChainConfig): Promise<{ total: number; liquid: number; frozen: number } | null> {
  try {
    const result = await tatumApi.getAddressBalance(cfg.address, cfg.chain, true) as
      { balance?: string; liquid?: string; frozen?: string; total?: string } | null | undefined;
    if (!result || result.balance === undefined || result.balance === null) {
      cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] Tatum returned no balance field — treating as API failure`);
      return null;
    }
    // For TRX we use .total (liquid + frozen). For EVM chains .total is absent so
    // .balance IS the total (no staking-for-gas concept).
    const totalStr = result.total ?? result.balance;
    const total = Number(totalStr);
    const liquid = Number(result.liquid ?? result.balance);
    const frozen = Number(result.frozen ?? 0);
    if (!Number.isFinite(total)) {
      cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] Balance parsed as non-finite (${totalStr}) — treating as API failure`);
      return null;
    }
    return { total, liquid, frozen };
  } catch (err) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] Tatum call threw: ${safeErrorMsg(err)}`);
    return null;
  }
}

export function computeStatus(cfg: Pick<ChainConfig, 'criticalThreshold' | 'warningThreshold'>, balance: number): 'healthy' | 'warning' | 'critical' | 'empty' {
  if (balance === 0) return 'empty';
  if (balance < cfg.criticalThreshold) return 'critical';
  if (balance < cfg.warningThreshold) return 'warning';
  return 'healthy';
}

/**
 * Check a single chain's fee wallet balance and (if applicable) send an alert.
 * Never throws — errors are logged and swallowed so a single chain failure
 * doesn't disrupt the overall monitor.
 */
async function checkChainFeeWallet(cfg: ChainConfig): Promise<WalletStatus | null> {
  if (!cfg.address) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] address not configured (env ${cfg.envKey}) — skipping`);
    return null;
  }

  const lastStatus = lastStatusByChain.get(cfg.id);

  // First read
  let bal = await fetchValidatedBalance(cfg);

  // If API failed entirely, fall back to last-known status WITHOUT alerting.
  if (bal === null) {
    const fallbackStatus: WalletStatus = {
      id: cfg.id,
      chain: cfg.chain,
      balance: lastStatus?.balance ?? -1,
      liquid: lastStatus?.liquid,
      frozen: lastStatus?.frozen,
      status: lastStatus?.status ?? 'warning',
      lastChecked: new Date(),
      lastAlertSent: lastStatus?.lastAlertSent,
      lastAlertLevel: lastStatus?.lastAlertLevel,
    };
    cronLogger.info(`[FeeWalletMonitor][${cfg.id}] ⏭️ Using last known status (${lastStatus?.balance?.toFixed(6) ?? 'unknown'} ${cfg.displayName}) due to API error`);
    return fallbackStatus;
  }

  // Double-check a suspicious 0 after a healthy read (transient blip guard).
  if (bal.total === 0 && lastStatus && lastStatus.balance > cfg.criticalThreshold) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] First 0-balance read after a healthy read — re-verifying before firing empty alert`);
    await new Promise((r) => setTimeout(r, 3000));
    const bal2 = await fetchValidatedBalance(cfg);
    if (bal2 === null) {
      cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] Re-verification failed; treating as API error, keeping last status`);
      return {
        id: cfg.id,
        chain: cfg.chain,
        balance: lastStatus.balance,
        liquid: lastStatus.liquid,
        frozen: lastStatus.frozen,
        status: lastStatus.status,
        lastChecked: new Date(),
        lastAlertSent: lastStatus.lastAlertSent,
        lastAlertLevel: lastStatus.lastAlertLevel,
      };
    }
    bal = bal2;
  }

  const balance = bal.total;
  const status = computeStatus(cfg, balance);

  // Track consecutive empties
  if (status === 'empty') {
    consecutiveEmptyByChain.set(cfg.id, (consecutiveEmptyByChain.get(cfg.id) || 0) + 1);
  } else {
    consecutiveEmptyByChain.set(cfg.id, 0);
  }

  const currentStatus: WalletStatus = {
    id: cfg.id,
    chain: cfg.chain,
    balance,
    liquid: bal.liquid,
    frozen: bal.frozen,
    status,
    lastChecked: new Date(),
    lastAlertSent: lastStatus?.lastAlertSent,
    lastAlertLevel: lastStatus?.lastAlertLevel,
  };

  const emoji = { healthy: '✅', warning: '⚠️', critical: '🚨', empty: '❌' }[status];
  const frozenNote = bal.frozen > 0 ? ` (liquid ${toFixedStr(bal.liquid, 6)} + frozen ${toFixedStr(bal.frozen, 6)})` : '';
  const precision = cfg.chain === 'TRX' ? 2 : 6; // TRX values are whole numbers, EVM native is fractional
  cronLogger.info(`[FeeWalletMonitor][${cfg.id}] ${emoji} ${cfg.displayName} Fee Wallet: ${toFixedStr(balance, precision)} ${cfg.displayName}${frozenNote} (${status.toUpperCase()})`);

  // Alerting
  if (shouldSendAlert(cfg, currentStatus, lastStatus)) {
    await sendAlert(cfg, currentStatus);
    currentStatus.lastAlertSent = new Date();
    currentStatus.lastAlertLevel = status;
  }

  lastStatusByChain.set(cfg.id, currentStatus);
  return currentStatus;
}

function shouldSendAlert(cfg: ChainConfig, current: WalletStatus, last: WalletStatus | undefined): boolean {
  if (current.status === 'healthy') return false;

  // Require TWO consecutive empty reads before firing an empty alert
  if (current.status === 'empty' && (consecutiveEmptyByChain.get(cfg.id) || 0) < 2) {
    cronLogger.info(`[FeeWalletMonitor][${cfg.id}] Empty read #${consecutiveEmptyByChain.get(cfg.id)}/2 — waiting for confirmation before alerting`);
    return false;
  }

  const statusPriority: Record<string, number> = { healthy: 1, warning: 2, critical: 3, empty: 4 };

  // Escalation bypasses cooldown
  if (last && statusPriority[current.status] > statusPriority[last.status]) {
    return true;
  }

  // Cooldown check (applies uniformly to warning/critical/empty; escalations already bypassed above)
  if (last?.lastAlertSent) {
    const dt = Date.now() - last.lastAlertSent.getTime();
    if (dt < ALERT_COOLDOWN_MS) {
      cronLogger.info(`[FeeWalletMonitor][${cfg.id}] Alert cooldown active (${Math.round(dt / 60000)}min since last alert)`);
      return false;
    }
  }

  // First non-healthy sighting → alert
  if (!last) return true;
  return true; // cooldown expired and still non-healthy → re-alert
}

/**
 * Build the gas-funding alert email (subject + html) for one wallet status.
 * Pure + exported so it can be unit-rendered/verified without sending.
 *
 * UNIFIED MESSAGING: every severity (warning/critical/empty) quotes the SAME
 * single number to act on — "top up to reach the healthy balance" — sourced
 * from cfg.healthyThreshold. The tier trigger is shown only as grey context.
 */
export function renderFeeWalletAlert(cfg: ChainConfig, status: WalletStatus): { subject: string; html: string } {
  const { balance, status: level, liquid, frozen } = status;
  const label = cfg.displayName;

  const subject = {
    empty: `🚨 URGENT: ${label} Fee Wallet Empty!`,
    critical: `🚨 CRITICAL: ${label} Fee Wallet Very Low`,
    warning: `⚠️ WARNING: ${label} Fee Wallet Low`,
    healthy: `✅ ${label} Fee Wallet Healthy`,
  }[level];

  // Show liquid/frozen breakdown when the wallet has staked funds (TRX Stake 2.0).
  // Eliminates "the alert says X but TronScan shows Y" confusion.
  const breakdown = (frozen && frozen > 0)
    ? `<p style="color:#6b7280;font-size:13px;">Breakdown: <strong>${toFixedStr((liquid ?? 0), 6)} ${label}</strong> liquid + <strong>${toFixedStr(frozen, 6)} ${label}</strong> frozen (staked for energy)</p>`
    : '';

  const precision = cfg.chain === 'TRX' ? 2 : 6;
  const roleLine = `<p style="color:#6b7280;font-size:13px;">Wallet role: ${cfg.role}</p>`;

  // ── UNIFIED gas-funding ask ───────────────────────────────────────────────
  // Every severity quotes the SAME single number to act on: top up to the
  // HEALTHY threshold (one source of truth = cfg.healthyThreshold). The tier
  // trigger (warning/critical) is shown ONLY as secondary grey context, so an
  // operator never sees conflicting "limits" again (the old emails headlined
  // "< 60 TRX" / "< 30 TRX" / "reach 120 TRX" — 3 numbers for one wallet).
  const topUp = Math.max(0, cfg.healthyThreshold - balance);
  const topUpStr = toFixedStr(topUp, precision);
  const targetStr = toFixedStr(cfg.healthyThreshold, precision);
  const sev = (level === 'healthy' ? 'warning' : level) as 'empty' | 'critical' | 'warning';
  const triggerContext = {
    empty: `the wallet is empty`,
    critical: `the balance fell below the critical level (${toFixedStr(cfg.criticalThreshold, precision)} ${label})`,
    warning: `the balance fell below the warning level (${toFixedStr(cfg.warningThreshold, precision)} ${label})`,
  }[sev];

  // Identical action block across ALL tiers — one target, one top-up amount.
  const actionBlock = `
      <p><strong>Action required:</strong> top up <strong>${topUpStr} ${label}</strong> to reach the recommended balance of <strong>${targetStr} ${label}</strong>:<br/>
      <code>${cfg.address}</code></p>
      <p style="color:#6b7280;font-size:13px;">Why you're seeing this: ${triggerContext}. Target (healthy) balance for ${label}: ${targetStr} ${label}.</p>`;

  const heading = {
    empty: `<h2 style="color: #dc2626;">🚨 ${label} Fee Wallet is EMPTY</h2>`,
    critical: `<h2 style="color: #ea580c;">🚨 ${label} Fee Wallet Critically Low</h2>`,
    warning: `<h2 style="color: #f59e0b;">⚠️ ${label} Fee Wallet Low</h2>`,
    healthy: '',
  }[level];

  const tail = level === 'warning'
    ? `<p>The system is still operational but running low on gas funds.</p>`
    : '';

  const message = level === 'healthy' ? '' : `
      ${heading}
      <p><strong>Current balance:</strong> ${toFixedStr(balance, precision)} ${label} (total)</p>
      ${breakdown}${roleLine}
      <p><strong>Impact:</strong> ${impactLabel(cfg, sev)}</p>
      ${actionBlock}
      ${tail}
    `;

  return { subject, html: dynoPayGreetingTemplate('Admin', message, subject) };
}

async function sendAlert(cfg: ChainConfig, status: WalletStatus): Promise<void> {
  const { subject, html } = renderFeeWalletAlert(cfg, status);
  try {
    await mailTransporter({
      to: ALERT_EMAIL,
      subject,
      body: html,
      name: 'Admin',
    });
    cronLogger.info(`[FeeWalletMonitor][${cfg.id}] ${status.status.toUpperCase()} alert sent to ${ALERT_EMAIL}`);
  } catch (emailError) {
    cronLogger.error(`[FeeWalletMonitor][${cfg.id}] Failed to send alert email: ${safeErrorMsg(emailError)}`);
  }
}

export function impactLabel(cfg: Pick<ChainConfig, 'id'>, level: 'empty' | 'critical' | 'warning'): string {
  if (cfg.id === 'TRX') {
    return level === 'empty'
      ? 'ALL USDT-TRC20 payments will FAIL until topped up!'
      : 'SmartGas may fail, causing USDT-TRC20 payment delays.';
  }
  if (cfg.id === 'ETH') {
    return level === 'empty'
      ? 'ALL USDT/USDC/RLUSD-ERC20 sweeps and admin-fee transfers will FAIL until topped up!'
      : 'ERC20 sweeps may fail, causing payment delays.';
  }
  if (cfg.id === 'POLYGON') {
    return level === 'empty'
      ? 'ALL USDT-POLYGON sweeps and admin-fee transfers will FAIL until topped up!'
      : 'Polygon sweeps may fail, causing payment delays.';
  }
  if (cfg.id === 'XRP_MASTER') {
    return level === 'empty'
      ? 'XRP / RLUSD master account is below the XRPL reserve — payouts and sweeps from it will FAIL!'
      : 'XRP / RLUSD sweeps may fail once the balance drops under the 1.2 XRP reserve.';
  }
  return 'Gas-dependent operations may fail.';
}

/**
 * Check ALL configured fee wallets. Backward-compat alias
 * `checkFeeWalletBalance` returns the TRX status for existing callers/tests.
 */
export async function checkAllFeeWallets(): Promise<WalletStatus[]> {
  const results: WalletStatus[] = [];
  for (const cfg of CHAIN_CONFIGS) {
    try {
      const s = await checkChainFeeWallet(cfg);
      if (s) results.push(s);
    } catch (err) {
      // Per-chain isolation: never let one failure abort the others.
      cronLogger.error(`[FeeWalletMonitor][${cfg.id}] Uncaught error: ${safeErrorMsg(err)}`);
    }
  }
  return results;
}

/**
 * Backward-compat: returns the TRX status (which was the only chain monitored
 * previously). Also runs the ETH + POLYGON checks as a side-effect so existing
 * callers automatically get multi-chain coverage without any code changes.
 */
export async function checkFeeWalletBalance(): Promise<WalletStatus> {
  const results = await checkAllFeeWallets();
  const trx = results.find((r) => r.id === 'TRX');
  if (trx) return trx;
  // If TRX is not configured but other chains are, return the first available.
  if (results[0]) return results[0];
  // Nothing configured
  return {
    id: 'TRX',
    chain: 'TRX',
    balance: 0,
    status: 'empty',
    lastChecked: new Date(),
  };
}

/**
 * Start monitoring (called from server.ts on the primary DO instance).
 * Runs an initial check immediately, then repeats every `intervalMinutes`.
 */
export async function startFeeWalletMonitoring(intervalMinutes: number = 60): Promise<void> {
  const configured = CHAIN_CONFIGS.filter((c) => !!c.address).map((c) => c.id);
  cronLogger.info(`[FeeWalletMonitor] Starting multi-chain fee wallet monitoring for ${configured.join(', ') || 'NONE (no chains configured)'} (every ${intervalMinutes} min)`);

  await checkAllFeeWallets();

  setInterval(async () => {
    await checkAllFeeWallets();
  }, intervalMinutes * 60 * 1000);
}

// NOTE: the legacy TRX-only exports CRITICAL_THRESHOLD / WARNING_THRESHOLD /
// HEALTHY_THRESHOLD were removed (2026-10) — they were unused and their 50/100/200
// fallbacks contradicted the real TRX config (30/60/120), which made the gas-funding
// alerts look inconsistent. The single source of truth is FEE_WALLET_CONFIGS above.

export default {
  checkFeeWalletBalance,
  checkAllFeeWallets,
  startFeeWalletMonitoring,
};
