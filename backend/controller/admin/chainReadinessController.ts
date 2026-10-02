import express from "express";
import { adminLogger } from "../../utils/loggers";
import { getChainReadiness } from "../../services/chainReadiness";

/** GET /admin/chain-readiness?refresh=1 — per-currency end-to-end readiness + gas wallet funding needs. */
export const getReport = async (req: express.Request, res: express.Response) => {
  try {
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const data = await getChainReadiness({ refresh });
    res.status(200).json({ success: true, data });
  } catch (err) {
    adminLogger.error(`[ChainReadiness] report failed: ${(err as Error).message}`);
    res.status(500).json({ success: false, message: (err as Error).message });
  }
};

export default { getReport };
