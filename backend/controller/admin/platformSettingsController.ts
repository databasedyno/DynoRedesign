/**
 * Admin → Platform Settings API (Deliverable 2, Phase 1).
 *
 *   GET    /admin/settings            — all settings grouped (effective value + source)
 *   GET    /admin/settings/history    — audit trail (optional ?key=)
 *   PUT    /admin/settings/:key       — change a setting (step-up gated, audited)
 *   POST   /admin/settings/:key/revert — drop the override → env/default (step-up gated)
 */
import express from "express";
import { adminLogger } from "../../utils/loggers";
import platformSettings, { SettingError } from "../../services/platformSettings";

const actorOf = (res: express.Response): string => {
  const u = res.locals.user as { email?: string; admin_id?: number } | undefined;
  return u?.email || (u?.admin_id ? `admin:${u.admin_id}` : "admin");
};

const fail = (res: express.Response, e: unknown) => {
  if (e instanceof SettingError) return res.status(e.status).json({ success: false, message: e.message });
  adminLogger.error(`[PlatformSettings] ${(e as Error).message}`);
  return res.status(500).json({ success: false, message: (e as Error).message });
};

const getAll = async (_req: express.Request, res: express.Response) => {
  try {
    const data = await platformSettings.listGrouped();
    res.status(200).json({ success: true, data });
  } catch (e) {
    fail(res, e);
  }
};

const history = async (req: express.Request, res: express.Response) => {
  try {
    const key = (req.query.key as string) || null;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const rows = await platformSettings.getHistory(key, limit);
    res.status(200).json({ success: true, data: { history: rows } });
  } catch (e) {
    fail(res, e);
  }
};

const put = async (req: express.Request, res: express.Response) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body || {};
    if (value === undefined) return res.status(400).json({ success: false, message: "A value is required." });
    const result = await platformSettings.setSetting(key, value, actorOf(res), reason);
    res.status(200).json({ success: true, message: "Setting updated", data: result });
  } catch (e) {
    fail(res, e);
  }
};

const revert = async (req: express.Request, res: express.Response) => {
  try {
    const { key } = req.params;
    const { reason } = req.body || {};
    const result = await platformSettings.revertSetting(key, actorOf(res), reason);
    res.status(200).json({ success: true, message: "Reverted to environment default", data: result });
  } catch (e) {
    fail(res, e);
  }
};

export default { getAll, history, put, revert };
