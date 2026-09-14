import express from "express";
import { authMiddleware } from "../middleware";
import stepUpController from "../controller/stepUpController";

/**
 * Unified step-up (sudo mode) — mounted at /api/stepup.
 * Scopes: apikey | wallet | brand_delete | security | payout | team | settlement.
 * Protected routes answer 403 {code:"STEPUP_REQUIRED", scope} until a factor is
 * verified here; the frontend interceptor opens the shared dialog and retries.
 * Abuse controls live in the service (30s per-user code rate limit, 5 attempts).
 */
const stepUpRouter = express.Router();

stepUpRouter.get("/:scope/status", authMiddleware, stepUpController.status);
stepUpRouter.post("/:scope/request-code", authMiddleware, stepUpController.requestCode);
stepUpRouter.post("/:scope/verify", authMiddleware, stepUpController.verify);
stepUpRouter.post("/:scope/revoke", authMiddleware, stepUpController.revoke);

export default stepUpRouter;
