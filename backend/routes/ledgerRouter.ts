/**
 * Ledger Admin Router (Tier-1 Item #3)
 *
 * All routes are admin-only. Exposed for ops visibility and manual replay.
 *
 *   GET  /api/ledger/health                 → feature-flag + last-invariant status
 *   GET  /api/ledger/balances               → current DR/CR/net per (account, currency)
 *   GET  /api/ledger/payment/:paymentId     → timeline of ledger entries for a payment
 *   GET  /api/ledger/invariants/latest      → most recent invariant check row
 *   POST /api/ledger/invariants/run         → trigger an on-demand invariant check
 *   POST /api/ledger/backfill               → backfill from paymentJournal (dryRun default)
 *
 * Body schemas are minimal (admin-only + narrow endpoints).
 */

import express from "express";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware";
import { cronLogger } from "../utils/loggers";
import {
  isLedgerEnabled,
  isDualWriteEnabled,
  isInvariantCronEnabled,
} from "../services/ledger/ledgerBootstrap";
import { getBalances, getPaymentLedger } from "../services/ledger/ledgerService";
import { runInvariantCheck } from "../services/ledger/ledgerInvariantChecker";
import { backfillLedgerFromJournal } from "../services/ledger/ledgerBackfill";
import LedgerInvariantCheck from "../models/ledger/ledgerInvariantModel";

const router = express.Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.get("/health", adminAuthMiddleware, async (_req, res) => {
  try {
    const latest = await LedgerInvariantCheck.findOne({ order: [["created_at", "DESC"]] });
    res.json({
      success: true,
      enabled: isLedgerEnabled(),
      dualWrite: isDualWriteEnabled(),
      invariantCron: isInvariantCronEnabled(),
      lastCheck: latest
        ? {
            status: latest.status,
            window_start: latest.window_start,
            window_end: latest.window_end,
            rows_scanned: latest.rows_scanned,
            batches_scanned: latest.batches_scanned,
            drift_by_currency: latest.drift_by_currency,
            created_at: latest.created_at,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ── Balances ──────────────────────────────────────────────────────────────────
router.get("/balances", adminAuthMiddleware, async (req, res) => {
  if (!isLedgerEnabled()) return res.status(400).json({ success: false, error: "Ledger disabled" });
  try {
    const balances = await getBalances({
      account_code: (req.query.account_code as string) || undefined,
      currency: (req.query.currency as string) || undefined,
      company_id: req.query.company_id ? Number(req.query.company_id) : undefined,
      payment_id: (req.query.payment_id as string) || undefined,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
    });
    res.json({ success: true, balances });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ── Payment timeline ──────────────────────────────────────────────────────────
router.get("/payment/:paymentId", adminAuthMiddleware, async (req, res) => {
  if (!isLedgerEnabled()) return res.status(400).json({ success: false, error: "Ledger disabled" });
  try {
    const entries = await getPaymentLedger(req.params.paymentId);
    res.json({ success: true, entries: entries.map((e) => e.toJSON()) });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ── Invariants ────────────────────────────────────────────────────────────────
router.get("/invariants/latest", adminAuthMiddleware, async (_req, res) => {
  try {
    const rows = await LedgerInvariantCheck.findAll({
      order: [["created_at", "DESC"]],
      limit: 20,
    });
    res.json({ success: true, checks: rows.map((r) => r.toJSON()) });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post("/invariants/run", adminAuthMiddleware, async (req, res) => {
  if (!isLedgerEnabled()) return res.status(400).json({ success: false, error: "Ledger disabled" });
  try {
    const hours = req.body?.window_hours ? Number(req.body.window_hours) : undefined;
    const result = await runInvariantCheck(hours);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ── Backfill ──────────────────────────────────────────────────────────────────
router.post("/backfill", adminAuthMiddleware, async (req, res) => {
  if (!isLedgerEnabled()) return res.status(400).json({ success: false, error: "Ledger disabled" });
  try {
    const opts = {
      limit: req.body?.limit ? Number(req.body.limit) : undefined,
      since: req.body?.since ? new Date(String(req.body.since)) : undefined,
      dryRun: req.body?.dry_run !== false, // default TRUE — must explicitly send dry_run:false
    };
    cronLogger.info(`[LedgerAdmin] backfill invoked opts=${JSON.stringify(opts)}`);
    const result = await backfillLedgerFromJournal(opts);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
