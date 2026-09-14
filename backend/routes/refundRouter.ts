/**
 * Refund routes — Crypto Refund Flow.
 *
 * The whole feature is gated behind ENABLE_CRYPTO_REFUNDS: when off, every
 * route replies 404 so the feature is invisible until explicitly switched on.
 *
 * Mount: app.use("/api/refunds", refundRouter)
 */
import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  previewRefund,
  postRefund,
  getRefundById,
  getRefunds,
  postCancelRefund,
  postSimulateRefund,
  captureRefundAddress,
} from "../controller/refund/refundController";
import { isRefundsEnabled } from "../services/refund/refundService";

const refundRouter = express.Router();

// Feature-flag gate — invisible (404) unless ENABLE_CRYPTO_REFUNDS is on.
refundRouter.use((_req, res, next) => {
  if (!isRefundsEnabled()) {
    return res.status(404).json({ status: false, message: "Not found" });
  }
  next();
});

// Public (checkout) — capture the customer's refund destination address.
refundRouter.post("/capture-address", captureRefundAddress);

// Merchant (authenticated).
refundRouter.get("/preview", authMiddleware, previewRefund);
refundRouter.get("/", authMiddleware, getRefunds);
refundRouter.post("/", authMiddleware, postRefund);
refundRouter.get("/:refundId", authMiddleware, getRefundById);
refundRouter.post("/:refundId/cancel", authMiddleware, postCancelRefund);
refundRouter.post("/:refundId/simulate", authMiddleware, postSimulateRefund);

export default refundRouter;
