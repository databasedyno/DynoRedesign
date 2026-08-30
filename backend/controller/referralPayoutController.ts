import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { apiLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import {
  getPayoutOverview,
  sendPayoutOtp,
  optInPayout,
  requestPayout,
} from "../services/referralPayoutService";

const getUserId = (res: Response): number | null => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  return userData?.user_id || null;
};

/** GET /api/referral/payout/overview — mode, verified address, reusable wallets, balance. */
export const payoutOverview = async (_req: Request, res: Response) => {
  try {
    const userId = getUserId(res);
    if (!userId) return res.status(401).json({ message: "Unauthorized. Please login." });
    const data = await getPayoutOverview(userId);
    return res.status(200).json({ message: "Payout overview retrieved", data });
  } catch (error) {
    apiLogger.error("Error in payoutOverview:", error);
    return res.status(500).json({ message: "Internal server error", error: (error as Error).message });
  }
};

/** POST /api/referral/payout/otp — email a one-time code (for a new address or a payout request). */
export const payoutOtp = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(res);
    if (!userId) return res.status(401).json({ message: "Unauthorized. Please login." });
    const { address } = req.body || {};
    const result = await sendPayoutOtp(userId, address);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    apiLogger.error("Error in payoutOtp:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: (error as Error).message });
  }
};

/** POST /api/referral/payout/opt-in — set payout mode (credit or cash+address). */
export const payoutOptIn = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(res);
    if (!userId) return res.status(401).json({ message: "Unauthorized. Please login." });
    const { mode, address, otp } = req.body || {};
    if (mode !== "credit" && mode !== "cash") {
      return res.status(400).json({ success: false, message: "mode must be 'credit' or 'cash'" });
    }
    const result = await optInPayout({ userId, mode, address, otp });
    const { statusCode, ...body } = result;
    return res.status(statusCode || 200).json(body);
  } catch (error) {
    apiLogger.error("Error in payoutOptIn:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: (error as Error).message });
  }
};

/** POST /api/referral/payout/request — OTP-gated cash-out request (no funds move here). */
export const payoutRequest = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(res);
    if (!userId) return res.status(401).json({ message: "Unauthorized. Please login." });
    const { otp, idempotency_key } = req.body || {};
    const result = await requestPayout({ userId, otp, idempotencyKey: idempotency_key });
    const { statusCode, ...body } = result;
    return res.status(statusCode || 200).json(body);
  } catch (error) {
    apiLogger.error("Error in payoutRequest:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: (error as Error).message });
  }
};

export default { payoutOverview, payoutOtp, payoutOptIn, payoutRequest };
