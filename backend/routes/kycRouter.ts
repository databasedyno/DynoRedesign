/**
 * KYC Routes
 */

import { Router } from "express";
import { authMiddleware } from "../middleware";
import kycController from "../controller/kycController";

const router = Router();

/**
 * @route   GET /api/kyc/status
 * @desc    Get KYC status for authenticated user
 * @access  Private (requires JWT)
 */
router.get("/status", authMiddleware, kycController.getKYCStatus);

/**
 * @route   GET /api/kyc/requirements
 * @desc    Get KYC requirements and document list
 * @access  Private (requires JWT)
 */
router.get("/requirements", authMiddleware, kycController.getKYCRequirements);

/**
 * @route   GET /api/kyc/history
 * @desc    Get KYC verification history for user
 * @access  Private (requires JWT)
 */
router.get("/history", authMiddleware, kycController.getKYCHistory);

/**
 * @route   POST /api/kyc/submit
 * @desc    Start KYC verification session with Veriff
 * @access  Private (requires JWT)
 */
router.post("/submit", authMiddleware, kycController.startKYCVerification);

/**
 * @route   POST /api/kyc/resubmit
 * @desc    Resubmit KYC verification after rejection/expiration
 * @access  Private (requires JWT)
 */
router.post("/resubmit", authMiddleware, kycController.resubmitKYC);

/**
 * @route   POST /api/kyc/webhook
 * @desc    Webhook endpoint for Veriff verification decisions
 * @access  Public (verified by HMAC signature)
 */
router.post("/webhook", kycController.handleVeriffWebhook);

export default router;
