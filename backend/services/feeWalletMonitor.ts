/**
 * Fee Wallet Monitor Service
 *
 * Monitors TRX fee wallet balance and alerts when low
 * Prevents SmartGas failures due to insufficient fee wallet balance
 *
 * 2026-07-11 HARDENING (fee-wallet-balance-incorrect bug):
 * - Ignore silent Tatum failures that previously masqueraded as "balance = 0"
 *   → no more false "🚨 URGENT: TRX Fee Wallet Empty!" when the wallet is fine.
 * - Report TOTAL balance = liquid + frozen (staked TRX for energy) so operators who
 *   correctly stake for energy don't get spammed with false-low alerts.
 * - Apply the 1-hour cooldown to the "empty" state too (previously bypassed).
 * - Require TWO consecutive empty reads before firing an "empty" alert.
 */

import tatumApi from "../apis/tatumApi";
import { cronLogger } from "../utils/loggers";
import { dynoPayGreetingTemplate } from "./emailService";
import mailTransporter from "../utils/mailTransporter";

const FEE_WALLET_ADDRESS = process.env.TRX_FEE_WALLET || "";
const ALERT_EMAIL = process.env.ADMIN_EMAIL || process.env.BREVO_SENDER_EMAIL || "admin@dynopay.com";

// Alert thresholds (in TRX). Applied to TOTAL balance (liquid + frozen for energy).
const CRITICAL_THRESHOLD = 50; // TRX
const WARNING_THRESHOLD = 100; // TRX
const HEALTHY_THRESHOLD = 200; // TRX

interface WalletStatus {
  balance: number;         // TOTAL (liquid + frozen)
  liquid?: number;         // spendable
  frozen?: number;         // staked (Stake 1.0 + Stake 2.0)
  status: 'healthy' | 'warning' | 'critical' | 'empty';
  lastChecked: Date;
  lastAlertSent?: Date;
}

let lastStatus: WalletStatus | null = null;
// Track consecutive empty reads to guard against transient Tatum blips.
// Only fire an "empty wallet" alert after we've seen 0 twice in a row.
let consecutiveEmptyReads = 0;
const ALERT_COOLDOWN_MS = 3600000; // 1 hour - don't spam alerts (applies to ALL states including empty)

/** Safely extract a human-readable message from any thrown value */
const safeErrorMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  // AxiosError / HTTP errors with nested response
  const axiosMsg = (err as Record<string, unknown>)?.response
    && ((err as Record<string, Record<string, unknown>>).response?.data as Record<string, unknown>)?.message;
  if (typeof axiosMsg === 'string') return axiosMsg;
  try { return JSON.stringify(err); } catch { return String(err); }
};

/**
 * Fetch a validated TRX balance. Returns null on any API failure so caller can
 * degrade gracefully. Never returns "0" for a broken/empty Tatum response —
 * that scenario is what caused the historical false-empty alerts.
 */
async function fetchValidatedTrxBalance(address: string): Promise<{ total: number; liquid: number; frozen: number } | null> {
  try {
    // skipCache=true: monitoring MUST be real-time, no 10-min stale reads.
    const result = await tatumApi.getAddressBalance(address, 'TRX', true) as
      { balance?: string; liquid?: string; frozen?: string; total?: string } | null | undefined;
    if (!result || result.balance === undefined || result.balance === null) {
      cronLogger.warn('[FeeWalletMonitor] Tatum returned no balance field — treating as API failure');
      return null;
    }
    // Prefer `total` (liquid + frozen) for monitoring — staked TRX still counts
    // toward wallet health (provides free energy). Fall back to `balance` for
    // backward compat if the field isn't present.
    const totalStr = result.total ?? result.balance;
    const total = Number(totalStr);
    const liquid = Number(result.liquid ?? result.balance);
    const frozen = Number(result.frozen ?? 0);
    if (!Number.isFinite(total)) {
      cronLogger.warn(`[FeeWalletMonitor] Balance parsed as non-finite (${totalStr}) — treating as API failure`);
      return null;
    }
    return { total, liquid, frozen };
  } catch (err) {
    cronLogger.warn(`[FeeWalletMonitor] Tatum call threw: ${safeErrorMsg(err)}`);
    return null;
  }
}

/**
 * Check fee wallet balance and send alerts if needed
 */
export async function checkFeeWalletBalance(): Promise<WalletStatus> {
  try {
    if (!FEE_WALLET_ADDRESS) {
      cronLogger.warn('[FeeWalletMonitor] TRX_FEE_WALLET not configured - skipping check');
      return {
        balance: 0,
        status: 'empty',
        lastChecked: new Date(),
      };
    }

    // First read
    let bal = await fetchValidatedTrxBalance(FEE_WALLET_ADDRESS);

    // If API failed entirely, fall back to last-known status WITHOUT alerting.
    if (bal === null) {
      const fallbackStatus: WalletStatus = {
        balance: lastStatus?.balance ?? -1,
        liquid: lastStatus?.liquid,
        frozen: lastStatus?.frozen,
        status: lastStatus?.status ?? 'warning',
        lastChecked: new Date(),
      };
      cronLogger.info(`[FeeWalletMonitor] ⏭️ Using last known status (${lastStatus?.balance?.toFixed(2) ?? 'unknown'} TRX) due to API error`);
      return fallbackStatus;
    }

    // If we see 0, DOUBLE-CHECK. A single 0-read can be a transient Tatum blip
    // (rate limit, empty response). Two consecutive 0-reads is a strong signal.
    if (bal.total === 0 && lastStatus && lastStatus.balance > CRITICAL_THRESHOLD) {
      cronLogger.warn('[FeeWalletMonitor] First 0-balance read after a healthy read — re-verifying before firing empty alert');
      // small delay then re-fetch
      await new Promise((r) => setTimeout(r, 3000));
      const bal2 = await fetchValidatedTrxBalance(FEE_WALLET_ADDRESS);
      if (bal2 === null) {
        // Second read failed too — this is an API issue, not an empty wallet. Skip.
        cronLogger.warn('[FeeWalletMonitor] Re-verification failed; treating as API error, keeping last status');
        return {
          balance: lastStatus.balance,
          liquid: lastStatus.liquid,
          frozen: lastStatus.frozen,
          status: lastStatus.status,
          lastChecked: new Date(),
        };
      }
      bal = bal2;
    }

    const balance = bal.total;

    // Determine status. Uses TOTAL (liquid + frozen). Frozen TRX auto-generates
    // energy so it correctly counts toward wallet health.
    let status: 'healthy' | 'warning' | 'critical' | 'empty';
    if (balance === 0) {
      status = 'empty';
    } else if (balance < CRITICAL_THRESHOLD) {
      status = 'critical';
    } else if (balance < WARNING_THRESHOLD) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    // Track consecutive empties: require 2 in a row to fire "empty" alert
    if (status === 'empty') {
      consecutiveEmptyReads += 1;
    } else {
      consecutiveEmptyReads = 0;
    }

    const currentStatus: WalletStatus = {
      balance,
      liquid: bal.liquid,
      frozen: bal.frozen,
      status,
      lastChecked: new Date(),
    };

    // Log status
    const emoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨',
      empty: '❌',
    }[status];

    const frozenNote = bal.frozen > 0 ? ` (liquid ${bal.liquid.toFixed(2)} + frozen ${bal.frozen.toFixed(2)})` : '';
    cronLogger.info(`[FeeWalletMonitor] ${emoji} TRX Fee Wallet: ${balance.toFixed(2)} TRX${frozenNote} (${status.toUpperCase()})`);

    // Send alert if needed
    const shouldAlert = shouldSendAlert(currentStatus);
    if (shouldAlert) {
      await sendAlert(currentStatus);
      currentStatus.lastAlertSent = new Date();
    }

    lastStatus = currentStatus;
    return currentStatus;

  } catch (error) {
    cronLogger.error(`[FeeWalletMonitor] Error checking fee wallet: ${safeErrorMsg(error)}`);
    throw error;
  }
}

/**
 * Determine if we should send an alert
 */
function shouldSendAlert(currentStatus: WalletStatus): boolean {
  // Don't alert if healthy
  if (currentStatus.status === 'healthy') {
    return false;
  }

  // Empty state: require TWO consecutive empty reads before alerting (guards
  // against transient Tatum blips that momentarily return balance:0).
  if (currentStatus.status === 'empty' && consecutiveEmptyReads < 2) {
    cronLogger.info(`[FeeWalletMonitor] Empty read #${consecutiveEmptyReads}/2 — waiting for confirmation before alerting`);
    return false;
  }

  // Cooldown applies to ALL non-healthy states now (previously bypassed for 'empty',
  // which caused spam once the false-empty bug triggered).
  if (lastStatus?.lastAlertSent) {
    const timeSinceLastAlert = Date.now() - lastStatus.lastAlertSent.getTime();
    if (timeSinceLastAlert < ALERT_COOLDOWN_MS) {
      // Exception: escalation (worse status) resets cooldown so we don't miss
      // a wallet going empty right after a warning alert.
      if (lastStatus) {
        const statusPriority = { empty: 4, critical: 3, warning: 2, healthy: 1 };
        if (statusPriority[currentStatus.status] > statusPriority[lastStatus.status]) {
          return true; // escalated — bypass cooldown
        }
      }
      cronLogger.info(`[FeeWalletMonitor] Alert cooldown active (${Math.round(timeSinceLastAlert / 60000)}min since last alert)`);
      return false;
    }
  }

  // Status worsened → alert
  if (lastStatus) {
    const statusPriority = { empty: 4, critical: 3, warning: 2, healthy: 1 };
    if (statusPriority[currentStatus.status] > statusPriority[lastStatus.status]) {
      return true;
    }
  }

  // First time seeing this status
  if (!lastStatus) {
    return true;
  }

  return false;
}

/**
 * Send alert email to admin
 */
async function sendAlert(status: WalletStatus): Promise<void> {
  const { balance, status: statusLevel, liquid, frozen } = status;

  const subject = {
    empty: '🚨 URGENT: TRX Fee Wallet Empty!',
    critical: '🚨 CRITICAL: TRX Fee Wallet Very Low',
    warning: '⚠️ WARNING: TRX Fee Wallet Low',
    healthy: '✅ TRX Fee Wallet Healthy',
  }[statusLevel];

  // If the wallet has staked (frozen) TRX, always show a breakdown so the admin
  // can reconcile the alert against what they see on TronScan (which shows
  // liquid + frozen separately). This eliminates the "balance appears incorrect"
  // confusion: the alert now shows exactly what the admin sees on-chain.
  const breakdown = (frozen && frozen > 0)
    ? `<p style="color:#6b7280;font-size:13px;">Breakdown: <strong>${(liquid ?? 0).toFixed(2)} TRX</strong> liquid + <strong>${frozen.toFixed(2)} TRX</strong> frozen (staked for energy)</p>`
    : '';

  const message = {
    empty: `
      <h2 style="color: #dc2626;">🚨 TRX Fee Wallet is EMPTY!</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(2)} TRX (total)</p>
      ${breakdown}
      <p><strong>Impact:</strong> ALL USDT-TRC20 payments will FAIL until topped up!</p>
      <p><strong>Action Required:</strong> Send at least ${HEALTHY_THRESHOLD} TRX to:<br/>
      <code>${FEE_WALLET_ADDRESS}</code></p>
    `,
    critical: `
      <h2 style="color: #ea580c;">🚨 TRX Fee Wallet Critically Low</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(2)} TRX (total)</p>
      ${breakdown}
      <p><strong>Threshold:</strong> &lt; ${CRITICAL_THRESHOLD} TRX</p>
      <p><strong>Impact:</strong> SmartGas may fail, causing payment delays.</p>
      <p><strong>Action Required:</strong> Top up soon to at least ${HEALTHY_THRESHOLD} TRX:<br/>
      <code>${FEE_WALLET_ADDRESS}</code></p>
    `,
    warning: `
      <h2 style="color: #f59e0b;">⚠️ TRX Fee Wallet Low</h2>
      <p><strong>Current Balance:</strong> ${balance.toFixed(2)} TRX (total)</p>
      ${breakdown}
      <p><strong>Threshold:</strong> &lt; ${WARNING_THRESHOLD} TRX</p>
      <p><strong>Recommendation:</strong> Top up to ${HEALTHY_THRESHOLD}+ TRX soon:<br/>
      <code>${FEE_WALLET_ADDRESS}</code></p>
      <p>System is still operational but running low on gas funds.</p>
    `,
    healthy: '',
  }[statusLevel];

  try {
    await mailTransporter({
      to: ALERT_EMAIL,
      subject,
      body: dynoPayGreetingTemplate('Admin', message, subject),
      name: 'Admin',
    });

    cronLogger.info(`[FeeWalletMonitor] ${statusLevel.toUpperCase()} alert sent to ${ALERT_EMAIL}`);
  } catch (emailError) {
    cronLogger.error(`[FeeWalletMonitor] Failed to send alert email: ${safeErrorMsg(emailError)}`);
  }
}

/**
 * Start monitoring (call this from cron or startup)
 * TATUM CREDIT OPTIMIZATION: Increased default from 30 min to 60 min
 */
export async function startFeeWalletMonitoring(intervalMinutes: number = 60): Promise<void> {
  cronLogger.info(`[FeeWalletMonitor] Starting fee wallet monitoring (every ${intervalMinutes} min)`);

  // Initial check
  await checkFeeWalletBalance();

  // Schedule periodic checks
  setInterval(async () => {
    await checkFeeWalletBalance();
  }, intervalMinutes * 60 * 1000);
}

export default {
  checkFeeWalletBalance,
  startFeeWalletMonitoring,
  CRITICAL_THRESHOLD,
  WARNING_THRESHOLD,
  HEALTHY_THRESHOLD,
};
