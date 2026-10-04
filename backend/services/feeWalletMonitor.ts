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
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { convertToUSD } from "../utils/currencyUtils";

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

// Redis key holding {chainId: {lastAlertSent, lastAlertLevel}} so a restart or
// redeploy does not forget an alert that is still inside its cooldown window
// (previously every deploy re-emailed within 30 min).
const ALERT_STATE_KEY = "fee_wallet_alert_state";
const ALERT_STATE_TTL_SEC = 7 * 24 * 3600;

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
  usdValue?: number | null; // ≈ USD of `balance` (null when the price feed failed)
}

type AlertLevel = WalletStatus['status'];

// Per-chain state
const lastStatusByChain: Map<string, WalletStatus> = new Map();
const consecutiveEmptyByChain: Map<string, number> = new Map();
let alertStateHydrated = false;

/** Seed per-chain alert memory from Redis (restart/redeploy safe). Runs once. */
async function hydrateAlertState(): Promise<void> {
  if (alertStateHydrated) return;
  alertStateHydrated = true;
  try {
    const saved = (await getRedisItem(ALERT_STATE_KEY)) as
      Record<string, { lastAlertSent?: string; lastAlertLevel?: AlertLevel }> | null;
    if (!saved) return;
    for (const cfg of CHAIN_CONFIGS) {
      const s = saved[cfg.id];
      if (!s?.lastAlertSent || lastStatusByChain.has(cfg.id)) continue;
      lastStatusByChain.set(cfg.id, {
        id: cfg.id,
        chain: cfg.chain,
        balance: -1, // unknown until the first live read
        status: s.lastAlertLevel ?? 'warning',
        lastChecked: new Date(0),
        lastAlertSent: new Date(s.lastAlertSent),
        lastAlertLevel: s.lastAlertLevel,
      });
    }
  } catch (err) {
    cronLogger.warn(`[FeeWalletMonitor] Could not load alert state from Redis: ${safeErrorMsg(err)}`);
  }
}

async function persistAlertState(): Promise<void> {
  const out: Record<string, { lastAlertSent: string; lastAlertLevel?: AlertLevel }> = {};
  for (const [id, s] of lastStatusByChain) {
    if (s.lastAlertSent) out[id] = { lastAlertSent: s.lastAlertSent.toISOString(), lastAlertLevel: s.lastAlertLevel };
  }
  try {
    await setRedisItemWithTTL(ALERT_STATE_KEY, out, ALERT_STATE_TTL_SEC);
  } catch (err) {
    cronLogger.warn(`[FeeWalletMonitor] Could not persist alert state to Redis: ${safeErrorMsg(err)}`);
  }
}

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
 * Check a single chain's fee wallet balance. Returns the fresh status plus
 * whether this chain is due for an alert — the EMAIL itself is sent once, for
 * all chains together, by checkAllFeeWallets (one consolidated message).
 * Never throws — errors are logged and swallowed so a single chain failure
 * doesn't disrupt the overall monitor.
 */
async function checkChainFeeWallet(cfg: ChainConfig): Promise<{ status: WalletStatus; alertDue: boolean } | null> {
  if (!cfg.address) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] address not configured (env ${cfg.envKey}) — skipping`);
    return null;
  }

  const lastStatus = lastStatusByChain.get(cfg.id);
  const lastKnownBalance = lastStatus && lastStatus.balance >= 0 ? lastStatus.balance : undefined;

  // First read
  let bal = await fetchValidatedBalance(cfg);

  // If API failed entirely, fall back to last-known status WITHOUT alerting.
  if (bal === null) {
    const fallbackStatus: WalletStatus = {
      id: cfg.id,
      chain: cfg.chain,
      balance: lastKnownBalance ?? -1,
      liquid: lastStatus?.liquid,
      frozen: lastStatus?.frozen,
      status: lastStatus?.status ?? 'warning',
      lastChecked: new Date(),
      lastAlertSent: lastStatus?.lastAlertSent,
      lastAlertLevel: lastStatus?.lastAlertLevel,
      usdValue: lastStatus?.usdValue ?? null,
    };
    cronLogger.info(`[FeeWalletMonitor][${cfg.id}] ⏭️ Using last known status (${lastKnownBalance !== undefined ? lastKnownBalance.toFixed(6) : 'unknown'} ${cfg.displayName}) due to API error`);
    return { status: fallbackStatus, alertDue: false };
  }

  // Double-check a suspicious 0 after a healthy read (transient blip guard).
  if (bal.total === 0 && lastKnownBalance !== undefined && lastKnownBalance > cfg.criticalThreshold) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] First 0-balance read after a healthy read — re-verifying before firing empty alert`);
    await new Promise((r) => setTimeout(r, 3000));
    const bal2 = await fetchValidatedBalance(cfg);
    if (bal2 === null) {
      cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] Re-verification failed; treating as API error, keeping last status`);
      return { status: { ...(lastStatus as WalletStatus), lastChecked: new Date() }, alertDue: false };
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
    usdValue: await fetchUsdValue(cfg, balance),
  };

  const emoji = { healthy: '✅', warning: '⚠️', critical: '🚨', empty: '❌' }[status];
  const frozenNote = bal.frozen > 0 ? ` (liquid ${toFixedStr(bal.liquid, 6)} + frozen ${toFixedStr(bal.frozen, 6)})` : '';
  const precision = cfg.chain === 'TRX' ? 2 : 6; // TRX values are whole numbers, EVM native is fractional
  const usdNote = currentStatus.usdValue != null ? ` ≈ $${toFixedStr(currentStatus.usdValue, 2)}` : '';
  cronLogger.info(`[FeeWalletMonitor][${cfg.id}] ${emoji} ${cfg.displayName} Fee Wallet: ${toFixedStr(balance, precision)} ${cfg.displayName}${frozenNote}${usdNote} (${status.toUpperCase()})`);

  const alertDue = shouldSendAlert(cfg, currentStatus, lastStatus);
  lastStatusByChain.set(cfg.id, currentStatus);
  return { status: currentStatus, alertDue };
}

/** ≈ USD of a native balance; null (never 0) when the price feed is unavailable. */
async function fetchUsdValue(cfg: ChainConfig, balance: number): Promise<number | null> {
  if (balance <= 0) return 0;
  try {
    const usd = await convertToUSD(cfg.chain, balance);
    return Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch (err) {
    cronLogger.warn(`[FeeWalletMonitor][${cfg.id}] USD conversion failed: ${safeErrorMsg(err)}`);
    return null;
  }
}

function shouldSendAlert(cfg: ChainConfig, current: WalletStatus, last: WalletStatus | undefined): boolean {
  if (current.status === 'healthy') return false;

  // Require TWO consecutive empty reads before firing an empty alert
  if (current.status === 'empty' && (consecutiveEmptyByChain.get(cfg.id) || 0) < 2) {
    cronLogger.info(`[FeeWalletMonitor][${cfg.id}] Empty read #${consecutiveEmptyByChain.get(cfg.id)}/2 — waiting for confirmation before alerting`);
    return false;
  }

  const statusPriority: Record<string, number> = { healthy: 1, warning: 2, critical: 3, empty: 4 };

  // Escalation bypasses cooldown (compared against the level we last ALERTED
  // at, so a restart cannot turn "still critical" into a fresh escalation).
  const lastLevel = last?.lastAlertLevel ?? last?.status;
  if (lastLevel && statusPriority[current.status] > statusPriority[lastLevel]) {
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

  // First non-healthy sighting, or cooldown expired and still non-healthy → alert
  return true;
}

const LEVEL_LABEL: Record<AlertLevel, string> = {
  healthy: 'Healthy',
  warning: 'Low',
  critical: 'Critically low',
  empty: 'EMPTY',
};
const LEVEL_COLOR: Record<AlertLevel, string> = {
  healthy: '#16a34a',
  warning: '#f59e0b',
  critical: '#ea580c',
  empty: '#dc2626',
};
const LEVEL_PRIORITY: Record<AlertLevel, number> = { healthy: 1, warning: 2, critical: 3, empty: 4 };

const fmtUsd = (usd: number | null | undefined): string =>
  usd == null ? 'n/a' : `$${toFixedStr(usd, 2)}`;

/**
 * Build the ONE consolidated gas-funding email (subject + html).
 *
 * Every monitored gas wallet is listed in a single table — balance in native
 * units AND ≈USD, its status, and the exact top-up needed to reach the
 * healthy target — so the operator never has to reconcile two emails that
 * quote different numbers for the same wallet. `dueIds` marks the wallets
 * whose status change triggered this email. Pure + exported for unit rendering.
 */
export function renderFeeWalletDigest(
  statuses: WalletStatus[],
  dueIds: string[],
  configs: ChainConfig[] = CHAIN_CONFIGS,
): { subject: string; html: string } {
  const byId = new Map(configs.map((c) => [c.id, c]));
  const rows = statuses
    .map((s) => ({ s, cfg: byId.get(s.id) }))
    .filter((r): r is { s: WalletStatus; cfg: ChainConfig } => !!r.cfg)
    .sort((a, b) => LEVEL_PRIORITY[b.s.status] - LEVEL_PRIORITY[a.s.status]);

  const due = rows.filter((r) => dueIds.includes(r.s.id));
  const worst = due.reduce<AlertLevel>((acc, r) => (LEVEL_PRIORITY[r.s.status] > LEVEL_PRIORITY[acc] ? r.s.status : acc), 'warning');
  const subjectIcon = worst === 'warning' ? '⚠️' : '🚨';
  const summary = due.map((r) => `${r.cfg.displayName} ${LEVEL_LABEL[r.s.status].toLowerCase()}`).join(', ');
  const subject = `${subjectIcon} Gas wallets need funding — ${summary}`;

  const tr = (r: { s: WalletStatus; cfg: ChainConfig }) => {
    const { s, cfg } = r;
    const precision = cfg.chain === 'TRX' ? 2 : 6;
    const topUp = Math.max(0, cfg.healthyThreshold - Math.max(0, s.balance));
    const price = s.usdValue != null && s.balance > 0 ? s.usdValue / s.balance : null;
    const topUpUsd = price != null ? topUp * price : null;
    const highlight = dueIds.includes(s.id) ? 'background:#fff1e0;' : '';
    const balanceStr = s.balance < 0 ? 'unknown' : `${toFixedStr(s.balance, precision)} ${cfg.displayName}`;
    const frozenNote = s.frozen && s.frozen > 0
      ? `<br/><span style="color:#6b7280;font-size:12px;">${toFixedStr(s.liquid ?? 0, 6)} liquid + ${toFixedStr(s.frozen, 6)} frozen (staked)</span>`
      : '';
    const action = topUp > 0
      ? `<strong>${toFixedStr(topUp, precision)} ${cfg.displayName}</strong>${topUpUsd != null ? ` (≈ ${fmtUsd(topUpUsd)})` : ''}`
      : '—';
    return `
      <tr style="${highlight}">
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <strong>${cfg.displayName}</strong><br/>
          <span style="color:#6b7280;font-size:12px;">${cfg.role}</span>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">
          ${balanceStr}<br/><span style="color:#6b7280;font-size:12px;">≈ ${fmtUsd(s.usdValue)}</span>${frozenNote}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;color:${LEVEL_COLOR[s.status]};font-weight:600;white-space:nowrap;">
          ${LEVEL_LABEL[s.status]}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          ${action}<br/><span style="color:#6b7280;font-size:12px;">target ${toFixedStr(cfg.healthyThreshold, precision)} ${cfg.displayName}</span>
        </td>
      </tr>`;
  };

  const addresses = rows
    .filter((r) => r.s.status !== 'healthy')
    .map((r) => `<p style="margin:4px 0;"><strong>${r.cfg.displayName}</strong>: <code>${r.cfg.address}</code></p>`)
    .join('');

  const impact = due
    .map((r) => `<li><strong>${r.cfg.displayName}</strong>: ${impactLabel(r.cfg, r.s.status === 'healthy' ? 'warning' : r.s.status)}</li>`)
    .join('');

  const message = `
      <p>This is the single status report for ALL Dynopay gas / fee wallets. Rows highlighted in orange changed status and triggered this email; the others are shown for context so you can top up everything in one go.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase;">
            <th style="padding:6px 8px;border-bottom:2px solid #e5e7eb;">Wallet</th>
            <th style="padding:6px 8px;border-bottom:2px solid #e5e7eb;">Balance</th>
            <th style="padding:6px 8px;border-bottom:2px solid #e5e7eb;">Status</th>
            <th style="padding:6px 8px;border-bottom:2px solid #e5e7eb;">Top up to healthy</th>
          </tr>
        </thead>
        <tbody>${rows.map(tr).join('')}</tbody>
      </table>
      <p style="margin-top:16px;"><strong>Impact if not funded:</strong></p>
      <ul style="margin-top:4px;">${impact}</ul>
      <p style="margin-top:16px;"><strong>Send funds to:</strong></p>
      ${addresses}
      <p style="color:#6b7280;font-size:13px;margin-top:16px;">Thresholds (native units): ${configs.map((c) => `${c.displayName} low &lt; ${c.warningThreshold}, critical &lt; ${c.criticalThreshold}, healthy ≥ ${c.healthyThreshold}`).join(' · ')}. USD values are live estimates. Re-checked every 30 min; the same wallet is re-notified at most every 6 h unless it gets worse.</p>
    `;

  return { subject, html: dynoPayGreetingTemplate('Admin', message, subject) };
}

async function sendConsolidatedAlert(statuses: WalletStatus[], dueIds: string[]): Promise<boolean> {
  const { subject, html } = renderFeeWalletDigest(statuses, dueIds);
  try {
    await mailTransporter({
      to: ALERT_EMAIL,
      subject,
      body: html,
      name: 'Admin',
    });
    cronLogger.info(`[FeeWalletMonitor] Consolidated gas alert sent to ${ALERT_EMAIL} (triggered by ${dueIds.join(', ')})`);
    return true;
  } catch (emailError) {
    cronLogger.error(`[FeeWalletMonitor] Failed to send alert email: ${safeErrorMsg(emailError)}`);
    return false;
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
 * Check ALL configured fee wallets and send at most ONE consolidated email per
 * cycle (listing every wallet) when any of them is due for an alert.
 * Backward-compat alias `checkFeeWalletBalance` returns the TRX status.
 */
export async function checkAllFeeWallets(): Promise<WalletStatus[]> {
  await hydrateAlertState();
  const results: WalletStatus[] = [];
  const dueIds: string[] = [];
  for (const cfg of CHAIN_CONFIGS) {
    try {
      const r = await checkChainFeeWallet(cfg);
      if (!r) continue;
      results.push(r.status);
      if (r.alertDue) dueIds.push(cfg.id);
    } catch (err) {
      // Per-chain isolation: never let one failure abort the others.
      cronLogger.error(`[FeeWalletMonitor][${cfg.id}] Uncaught error: ${safeErrorMsg(err)}`);
    }
  }

  if (dueIds.length > 0) {
    const sent = await sendConsolidatedAlert(results, dueIds);
    if (sent) {
      const now = new Date();
      for (const s of results) {
        if (!dueIds.includes(s.id)) continue;
        s.lastAlertSent = now;
        s.lastAlertLevel = s.status;
        lastStatusByChain.set(s.id, s);
      }
      await persistAlertState();
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
// 2026-10-04: this monitor is now the ONLY sender of gas-funding emails — the
// legacy hourly "Low Fee Wallet Balance Alert" in paymentController.checkFeeBalance
// (USD threshold from tbl_admin_fee_wallet) was retired because the two emails
// quoted different thresholds/balances for the same wallet.

export default {
  checkFeeWalletBalance,
  checkAllFeeWallets,
  startFeeWalletMonitoring,
};
