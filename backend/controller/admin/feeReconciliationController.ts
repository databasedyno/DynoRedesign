import express from "express";
import { cronLogger } from "../../utils/loggers";
import {
  backfillPayoutGasAudit,
  getFeeReconciliation,
  reconcilePendingAudits,
} from "../../services/payoutGasAudit";
import {
  consolidatePoolCrumbs,
  getLastCrumbReport,
  isCrumbSweepRunning,
} from "../../services/merchantPool/poolCrumbSweeper";

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** GET /admin/fee-reconciliation?from&to&chain&status&verdict&page&limit */
export const getReport = async (req: express.Request, res: express.Response) => {
  try {
    const verdict = str(req.query.verdict);
    const data = await getFeeReconciliation({
      from: str(req.query.from),
      to: str(req.query.to),
      chain: str(req.query.chain),
      status: str(req.query.status),
      verdict: verdict === "over" || verdict === "under" || verdict === "ok" ? verdict : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

/** POST /admin/fee-reconciliation/backfill { days } */
export const backfill = async (req: express.Request, res: express.Response) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.body?.days) || 90));
    const result = await backfillPayoutGasAudit(days);
    const reconciled = await reconcilePendingAudits(100);
    res.status(200).json({ success: true, data: { days, ...result, ...reconciled } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

/** POST /admin/fee-reconciliation/reconcile { limit } */
export const reconcile = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.body?.limit) || 100));
    res.status(200).json({ success: true, data: await reconcilePendingAudits(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

/** POST /admin/pool/consolidate-crumbs { dry_run } — background; poll GET /admin/pool/crumbs-report */
export const startCrumbSweep = async (req: express.Request, res: express.Response) => {
  try {
    if (await isCrumbSweepRunning()) {
      res.status(409).json({ success: false, message: "A crumb consolidation is already running" });
      return;
    }
    const dryRun = req.body?.dry_run === true || req.body?.dry_run === "true";
    consolidatePoolCrumbs({ dryRun }).catch((e) => cronLogger.error(`[CrumbSweeper] admin run failed: ${(e as Error).message}`));
    res.status(202).json({ success: true, data: { started: true, dry_run: dryRun } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export const crumbReport = async (_req: express.Request, res: express.Response) => {
  try {
    res.status(200).json({ success: true, data: { running: await isCrumbSweepRunning(), report: await getLastCrumbReport() } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export default { getReport, backfill, reconcile, startCrumbSweep, crumbReport };
