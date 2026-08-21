/**
 * Ledger Bootstrap — called once from server.ts on boot (Tier-1 Item #3)
 *
 * Behavior gated by env flags:
 *   ENABLE_LEDGER=true          → create tables + bootstrap accounts on startup
 *   LEDGER_DUAL_WRITE=true      → dual-write to ledger from settlement callsites
 *   LEDGER_INVARIANT_CRON=true  → start the invariant-checker cron
 *
 * Safe defaults (all off) preserve current behavior in prod until operators
 * flip flags intentionally.
 */

import LedgerAccount from "../../models/ledger/ledgerAccountModel";
import LedgerEntry from "../../models/ledger/ledgerEntryModel";
import LedgerInvariantCheck from "../../models/ledger/ledgerInvariantModel";
import { bootstrapStandardAccounts } from "./ledgerAccountsBootstrap";
import { startLedgerInvariantChecker } from "./ledgerInvariantChecker";
import { cronLogger } from "../../utils/loggers";

export function isLedgerEnabled(): boolean {
  return process.env.ENABLE_LEDGER === "true";
}

export function isDualWriteEnabled(): boolean {
  return process.env.LEDGER_DUAL_WRITE === "true";
}

export function isInvariantCronEnabled(): boolean {
  return process.env.LEDGER_INVARIANT_CRON === "true";
}

/**
 * Idempotent bootstrap:
 *   1. Sync ledger tables (if ENABLE_LEDGER=true)
 *   2. Seed standard chart of accounts
 *   3. Optionally start invariant cron
 */
export async function initLedger(): Promise<{ enabled: boolean; dualWrite: boolean; invariantCron: boolean }> {
  const state = {
    enabled: isLedgerEnabled(),
    dualWrite: isDualWriteEnabled(),
    invariantCron: isInvariantCronEnabled(),
  };

  if (!state.enabled) {
    cronLogger.info("[Ledger] Disabled (ENABLE_LEDGER!=true). Skipping bootstrap.");
    return state;
  }

  try {
    await LedgerAccount.sync({ alter: false });
    await LedgerEntry.sync({ alter: false });
    await LedgerInvariantCheck.sync({ alter: false });
    cronLogger.info("[Ledger] Tables synced.");
  } catch (err) {
    cronLogger.error(`[Ledger] Table sync failed: ${(err as Error).message}`);
    throw err;
  }

  try {
    const { created } = await bootstrapStandardAccounts();
    cronLogger.info(`[Ledger] Standard accounts ready (new: ${created.length}).`);
  } catch (err) {
    cronLogger.error(`[Ledger] Account bootstrap failed: ${(err as Error).message}`);
    throw err;
  }

  if (state.invariantCron) {
    startLedgerInvariantChecker();
  }

  cronLogger.info(`[Ledger] Ready — dualWrite=${state.dualWrite} invariantCron=${state.invariantCron}`);
  return state;
}

export default { initLedger, isLedgerEnabled, isDualWriteEnabled, isInvariantCronEnabled };
