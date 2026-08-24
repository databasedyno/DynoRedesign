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

interface ChainConfig {
  chain: string;          // canonical Tatum currency code (TRX/ETH/POLYGON)
  displayName: string;    // human label used in emails/logs (TRX/ETH/MATIC…)
  address: string;        // fee wallet address
  criticalThreshold: number;  // native units (TRX / ETH / POL)
  warningThreshold: number;
  healthyThreshold: number;
  supportsStaking: boolean;   // true only for TRX (Stake 2.0 frozen counts toward total)
}

// Chain configuration. Thresholds picked to cover ~5-20 sweep/settlement txs
// at typical gas prices (as of 2026-07-11). Tune by tweaking env or this map.
const CHAIN_CONFIGS: ChainConfig[] = [
  {
    chain: 'TRX',
    displayName: 'TRX',
    address: config.str("TRX_FEE_WALLET"),
    criticalThreshold: config.num("TRX_FEE_WALLET_CRITICAL", 30),
    warningThreshold: config.num("TRX_FEE_WALLET_WARNING", 60),
    healthyThreshold: config.num("TRX_FEE_WALLET_HEALTHY", 120),
    supportsStaking: true,
  },
  {
    chain: 'ETH',
    displayName: 'ETH',
    address: config.str("ETH_FEE_WALLET"),
    // ETH mainnet gas: ~50k gas × 20-30 gwei ≈ 0.001-0.0015 ETH per ERC20 tx.
    // Warning at 0.02 ETH ≈ 10-20 operations; critical at 0.01 ≈ 5-10.
    criticalThreshold: config.num("ETH_FEE_WALLET_CRITICAL", 0.01),
    warningThreshold: config.num("ETH_FEE_WALLET_WARNING", 0.02),
    healthyThreshold: config.num("ETH_FEE_WALLET_HEALTHY", 0.05),
    supportsStaking: false,
  },
  {
    chain: 'POLYGON',
    displayName: 'POL',
    address: config.str("POLYGON_FEE_WALLET"),
    // Polygon gas: ~$0.005-0.05/tx. 5 POL comfortably covers weeks.
    criticalThreshold: config.num("POLYGON_FEE_WALLET_CRITICAL", 2),
    warningThreshold: config.num("POLYGON_FEE_WALLET_WARNING", 5),
    healthyThreshold: config.num("POLYGON_FEE_WALLET_HEALTHY", 10),
    supportsStaking: false,
  },
];

interface WalletStatus {
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
      cronLogger.warn(`[FeeWalletMonitor][${cfg.chain}] Tatum returned no balance field — treating as API failure`);
      return null;
    }
    // For TRX we use .total (liquid + frozen). For EVM chains .total is absent so
    // .balance IS the total (no staking-for-gas concept).
    const totalStr = result.total ?? result.balance;
    const total = Number(totalStr);
    const liquid = Number(result.liquid ?? result.balance);
    const frozen = Number(result.frozen ?? 0);
    if (!Number.isFinite(total)) {
      cronLogger.warn(`[FeeWalletMonitor][${cfg.chain}] Balance parsed as non-finite (${totalStr}) — treating as API failure`);
      return null;
    }
    return { total, liquid, frozen };
  } catch (err) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.chain}] Tatum call threw: ${safeErrorMsg(err)}`);
    return null;
  }
}

function computeStatus(cfg: ChainConfig, balance: number): 'healthy' | 'warning' | 'critical' | 'empty' {
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
    cronLogger.warn(`[FeeWalletMonitor][${cfg.chain}] address not configured (env ${cfg.chain}_FEE_WALLET) — skipping`);
    return null;
  }

  const lastStatus = lastStatusByChain.get(cfg.chain);

  // First read
  let bal = await fetchValidatedBalance(cfg);

  // If API failed entirely, fall back to last-known status WITHOUT alerting.
  if (bal === null) {
    const fallbackStatus: WalletStatus = {
      chain: cfg.chain,
      balance: lastStatus?.balance ?? -1,
      liquid: lastStatus?.liquid,
      frozen: lastStatus?.frozen,
      status: lastStatus?.status ?? 'warning',
      lastChecked: new Date(),
      lastAlertSent: lastStatus?.lastAlertSent,
      lastAlertLevel: lastStatus?.lastAlertLevel,
    };
    cronLogger.info(`[FeeWalletMonitor][${cfg.chain}] ⏭️ Using last known status (${lastStatus?.balance?.toFixed(6) ?? 'unknown'} ${cfg.displayName}) due to API error`);
    return fallbackStatus;
  }

  // Double-check a suspicious 0 after a healthy read (transient blip guard).
  if (bal.total === 0 && lastStatus && lastStatus.balance > cfg.criticalThreshold) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.chain}] First 0-balance read after a healthy read — re-verifying before firing empty alert`);
    await new Promise((r) => setTimeout(r, 3000));
    const bal2 = await fetchValidatedBalance(cfg);
    if (bal2 === null) {
      cronLogger.warn(`[FeeWalletMonitor][${cfg.chain}] Re-verification failed; treating as API error, keeping last status`);
      return {
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
    consecutiveEmptyByChain.set(cfg.chain, (consecutiveEmptyByChain.get(cfg.chain) || 0) + 1);
  } else {
    consecutiveEmptyByChain.set(cfg.chain, 0);
  }

  const currentStatus: WalletStatus = {
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
  const frozenNote = bal.frozen > 0 ? ` (liquid ${bal.liquid.toFixed(6)} + frozen ${bal.frozen.toFixed(6)})` : '';
  const precision = cfg.chain === 'TRX' ? 2 : 6; // TRX values are whole numbers, EVM native is fractional
  cronLogger.info(`[FeeWalletMonitor][${cfg.chain}] ${emoji} ${cfg.displayName} Fee Wallet: ${balance.toFixed(precision)} ${cfg.displayName}${frozenNote} (${status.toUpperCase()})`);

  // Alerting
  if (shouldSendAlert(cfg, currentStatus, lastStatus)) {
    await sendAlert(cfg, currentStatus);
    currentStatus.lastAlertSent = new Date();
    currentStatus.lastAlertLevel = status;
  }

  lastStatusByChain.set(cfg.chain, currentStatus);
  return currentStatus;
}

function shouldSendAlert(cfg: ChainConfig, current: WalletStatus, last: WalletStatus | undefined): boolean {
  if (current.status === 'healthy') return false;

  // Require TWO consecutive empty reads before firing an empty alert
  if (current.status === 'empty' && (consecutiveEmptyByChain.get(cfg.chain) || 0) < 2) {
    cronLogger.info(`[FeeWalletMonitor][${cfg.chain}] Empty read #${consecutiveEmptyByChain.get(cfg.chain)}/2 — waiting for confirmation before alerting`);
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
      cronLogger.info(`[FeeWalletMonitor][${cfg.chain}] Alert cooldown active (${Math.round(dt / 60000)}min since last alert)`);
      return false;
    }
  }

  // First non-healthy sighting → alert
  if (!last) return true;
  return true; // cooldown expired and still non-healthy → re-alert
}

async function sendAlert(cfg: ChainConfig, status: WalletStatus): Promise<void> {
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
    ? `<p style="color:#6b7280;font-size:13px;">Breakdown: <strong>${(liquid ?? 0).toFixed(6)} ${label}</strong> liquid + <strong>${frozen.toFixed(6)} ${label}</strong> frozen (staked for energy)</p>`
    : '';

  const precision = cfg.chain === 'TRX' ? 2 : 6;

  const message = {
    empty: `
      <h2 style="color: #dc2626;">🚨 ${label} Fee Wallet is EMPTY!</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(precision)} ${label} (total)</p>
      ${breakdown}
      <p><strong>Impact:</strong> ${impactLabel(cfg, 'empty')}</p>
      <p><strong>Action Required:</strong> Send at least ${cfg.healthyThreshold} ${label} to:<br/>
      <code>${cfg.address}</code></p>
    `,
    critical: `
      <h2 style="color: #ea580c;">🚨 ${label} Fee Wallet Critically Low</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(precision)} ${label} (total)</p>
      ${breakdown}
      <p><strong>Threshold:</strong> &lt; ${cfg.criticalThreshold} ${label}</p>
      <p><strong>Impact:</strong> ${impactLabel(cfg, 'critical')}</p>
      <p><strong>Action Required:</strong> Top up soon to at least ${cfg.healthyThreshold} ${label}:<br/>
      <code>${cfg.address}</code></p>
    `,
    warning: `
      <h2 style="color: #f59e0b;">⚠️ ${label} Fee Wallet Low</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(precision)} ${label} (total)</p>
      ${breakdown}
      <p><strong>Threshold:</strong> &lt; ${cfg.warningThreshold} ${label}</p>
      <p><strong>Recommendation:</strong> Top up to ${cfg.healthyThreshold}+ ${label} soon:<br/>
      <code>${cfg.address}</code></p>
      <p>System is still operational but running low on gas funds.</p>
    `,
    healthy: '',
  }[level];

  try {
    await mailTransporter({
      to: ALERT_EMAIL,
      subject,
      body: dynoPayGreetingTemplate('Admin', message, subject),
      name: 'Admin',
    });
    cronLogger.info(`[FeeWalletMonitor][${cfg.chain}] ${level.toUpperCase()} alert sent to ${ALERT_EMAIL}`);
  } catch (emailError) {
    cronLogger.error(`[FeeWalletMonitor][${cfg.chain}] Failed to send alert email: ${safeErrorMsg(emailError)}`);
  }
}

function impactLabel(cfg: ChainConfig, level: 'empty' | 'critical'): string {
  if (cfg.chain === 'TRX') {
    return level === 'empty'
      ? 'ALL USDT-TRC20 payments will FAIL until topped up!'
      : 'SmartGas may fail, causing USDT-TRC20 payment delays.';
  }
  if (cfg.chain === 'ETH') {
    return level === 'empty'
      ? 'ALL USDT/USDC/RLUSD-ERC20 sweeps and admin-fee transfers will FAIL until topped up!'
      : 'ERC20 sweeps may fail, causing payment delays.';
  }
  if (cfg.chain === 'POLYGON') {
    return level === 'empty'
      ? 'ALL USDT-POLYGON sweeps and admin-fee transfers will FAIL until topped up!'
      : 'Polygon sweeps may fail, causing payment delays.';
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
      cronLogger.error(`[FeeWalletMonitor][${cfg.chain}] Uncaught error: ${safeErrorMsg(err)}`);
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
  const trx = results.find((r) => r.chain === 'TRX');
  if (trx) return trx;
  // If TRX is not configured but other chains are, return the first available.
  if (results[0]) return results[0];
  // Nothing configured
  return {
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
  const configured = CHAIN_CONFIGS.filter((c) => !!c.address).map((c) => c.chain);
  cronLogger.info(`[FeeWalletMonitor] Starting multi-chain fee wallet monitoring for ${configured.join(', ') || 'NONE (no chains configured)'} (every ${intervalMinutes} min)`);

  await checkAllFeeWallets();

  setInterval(async () => {
    await checkAllFeeWallets();
  }, intervalMinutes * 60 * 1000);
}

// Legacy exports for tests / scripts that reference the old constants.
export const CRITICAL_THRESHOLD = CHAIN_CONFIGS.find((c) => c.chain === 'TRX')?.criticalThreshold ?? 50;
export const WARNING_THRESHOLD = CHAIN_CONFIGS.find((c) => c.chain === 'TRX')?.warningThreshold ?? 100;
export const HEALTHY_THRESHOLD = CHAIN_CONFIGS.find((c) => c.chain === 'TRX')?.healthyThreshold ?? 200;

export default {
  checkFeeWalletBalance,
  checkAllFeeWallets,
  startFeeWalletMonitoring,
  CRITICAL_THRESHOLD,
  WARNING_THRESHOLD,
  HEALTHY_THRESHOLD,
};
