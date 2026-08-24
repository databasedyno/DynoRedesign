/**
 * KYC Controller
 * Handles identity verification using Veriff API
 */

import { raw as envRaw } from "../utils/config";
import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import kycModel from "../models/kycModel";
import { getVeriffService } from "../services/veriffService";
import { isKycExempt } from "../helper/kycEnforcement";
import { createNotification, NOTIFICATION_TYPES } from "./notificationController";
import { IUserType } from "../utils/types";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import {
  sendKYCRequiredEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendKYCStartedEmail,
  sendKYCResubmissionRequiredEmail,
} from "../services/emailService";

/**
 * Get KYC status for authenticated user
 * GET /api/kyc/status
 */
const getKYCStatus = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;
    const companyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;

    // Get user's KYC record
    const whereClause = companyId
      ? { user_id: userId, company_id: companyId }
      : { user_id: userId };

    const kycRecord = await kycModel.findOne({
      where: whereClause,
      order: [["created_at", "DESC"]],
    });

    // Calculate user's total volume
    const volumeQuery = companyId
      ? `SELECT COALESCE(SUM(base_amount), 0) as total_volume
         FROM tbl_user_transaction 
         WHERE user_id = :userId AND company_id = :companyId AND status = 'done'`
      : `SELECT COALESCE(SUM(base_amount), 0) as total_volume
         FROM tbl_user_transaction 
         WHERE user_id = :userId AND status = 'done'`;

    const volumeResult = await sequelize.query<{ total_volume: string }>(volumeQuery, {
      replacements: { userId, companyId },
      type: QueryTypes.SELECT,
    });

    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));
    const volumeThreshold = 10000; // $10,000 USD threshold
    const gracePeriodDays = 90;
    const requiresKYC = totalVolume >= volumeThreshold;

    // Calculate grace period info
    let gracePeriodInfo = null;
    if (requiresKYC && kycRecord?.get("status") !== "approved") {
      // This is simplified - actual grace period calculation happens in payment endpoints
      gracePeriodInfo = {
        grace_period_days: gracePeriodDays,
        message: `You have ${gracePeriodDays} days from when you first exceeded the threshold to complete KYC verification.`
      };
    }

    // Get KYC requirements status
    const needsSubmission = requiresKYC && (!kycRecord || kycRecord.get("status") === "pending" || kycRecord.get("status") === "not_started");
    const canProcess = !requiresKYC || (kycRecord && kycRecord.get("status") === "approved");

    return successResponseHelper(res, 200, "KYC status retrieved successfully", {
      kyc_record: kycRecord || null,
      total_volume: totalVolume,
      volume_threshold: volumeThreshold,
      requires_kyc: requiresKYC,
      needs_submission: needsSubmission,
      can_process_payments: canProcess,
      status: kycRecord ? kycRecord.get("status") : "not_started",
      grace_period: gracePeriodInfo,
    });

  } catch (error: unknown) {
    apiLogger.error("Get KYC status error:", error);
    const message = getErrorMessage(error);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Get KYC requirements/documents needed
 * GET /api/kyc/requirements
 */
const getKYCRequirements = async (_req: express.Request, res: express.Response) => {
  try {
    const requirements = {
      volume_threshold: 10000,
      grace_period_days: 90,
      threshold_description: "KYC verification is required when your transaction volume reaches $10,000. You have 90 days from reaching the threshold to complete verification.",
      required_documents: [
        {
          type: "government_id",
          name: "Government-issued ID",
          description: "Valid passport, driver's license, or national ID card",
          required: true,
        },
        {
          type: "proof_of_address",
          name: "Proof of Address",
          description: "Recent utility bill, bank statement, or government document (within last 3 months)",
          required: true,
        },
        {
          type: "selfie",
          name: "Selfie Verification",
          description: "Live photo verification to confirm identity",
          required: true,
        },
      ],
      verification_process: [
        "Click 'Start Verification' to begin the process",
        "Complete identity verification through our secure partner Veriff",
        "Upload required documents and take a selfie",
        "Wait for verification approval (usually within 24-48 hours)",
        "Receive email notification once approved",
      ],
      estimated_time: "5-10 minutes",
      verification_partner: "Veriff",
    };

    return successResponseHelper(res, 200, "KYC requirements retrieved successfully", {
      requirements,
    });

  } catch (error: unknown) {
    apiLogger.error("Get KYC requirements error:", error);
    const message = getErrorMessage(error);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Start KYC verification session
 * POST /api/kyc/submit
 */
const startKYCVerification = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;
    const { company_id, first_name, last_name } = req.body;

    // Validate company ownership
    if (company_id) {
      const company = await sequelize.query(
        `SELECT company_id FROM tbl_company WHERE company_id = :companyId AND user_id = :userId`,
        {
          replacements: { companyId: company_id, userId },
          type: QueryTypes.SELECT,
        }
      );

      if (company.length === 0) {
        return errorResponseHelper(res, 400, "Invalid company_id or company does not belong to this user");
      }
    }

    // Check if user already has approved KYC
    const existingKYC = await kycModel.findOne({
      where: {
        user_id: userId,
        ...(company_id && { company_id }),
        status: "approved",
      },
    });

    if (existingKYC) {
      return errorResponseHelper(res, 400, "KYC already approved for this user/company");
    }

    // Get user details
    const userResult = await sequelize.query(
      `SELECT name, email FROM tbl_user WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    const user = userResult[0];
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    // Calculate current volume
    const volumeQuery = company_id
      ? `SELECT COALESCE(SUM(base_amount), 0) as total_volume
         FROM tbl_user_transaction 
         WHERE user_id = :userId AND company_id = :companyId AND status = 'done'`
      : `SELECT COALESCE(SUM(base_amount), 0) as total_volume
         FROM tbl_user_transaction 
         WHERE user_id = :userId AND status = 'done'`;

    const volumeResult = await sequelize.query<{ total_volume: string }>(volumeQuery, {
      replacements: { userId, companyId: company_id },
      type: QueryTypes.SELECT,
    });

    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));

    // Initialize Veriff service and create session
    const veriffService = getVeriffService();
    const callbackUrl = `${envRaw("FRONTEND_URL") || envRaw("SERVER_URL")}/kyc/complete`;

    const userName = String((user as unknown as Record<string, unknown>).name || '');
    const session = await veriffService.createSession({
      userId,
      companyId: company_id || null,
      firstName: first_name || userName.split(" ")[0],
      lastName: last_name || userName.split(" ").slice(1).join(" "),
      callbackUrl,
    });

    // Create or update KYC record
    const kycData = {
      user_id: userId,
      company_id: company_id || null,
      status: "submitted",
      volume_threshold: totalVolume,
      submitted_at: new Date(),
      veriff_session_id: session.verification.id,
      veriff_session_url: session.verification.url,
      veriff_verification_id: session.verification.id,
    };

    const [kycRecord, created] = await kycModel.findOrCreate({
      where: {
        user_id: userId,
        ...(company_id && { company_id }),
      },
      defaults: kycData,
    });

    if (!created) {
      await kycRecord.update(kycData);
    }

    // Create notification
    await createNotification(
      userId,
      NOTIFICATION_TYPES.KYC_REQUIRED,
      "KYC Verification Started",
      `Your identity verification session has been created. Please complete the verification process.`,
      {
        volume_threshold: totalVolume,
        session_id: session.verification.id,
      },
      company_id
    );

    // Send KYC started email
    const userEmail = String((user as unknown as Record<string, unknown>).email || '');
    await sendKYCStartedEmail(userEmail, userName, session.verification.url);

    return successResponseHelper(res, 200, "KYC verification session created successfully", {
      verification: {
        session_id: session.verification.id,
        verification_url: session.verification.url,
        status: "submitted",
      },
      kyc_id: kycRecord.get("kyc_id"),
    });

  } catch (error: unknown) {
    apiLogger.error("Start KYC verification error:", error);
    const message = getErrorMessage(error);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Veriff webhook endpoint
 * POST /api/kyc/webhook
 * Receives verification decision from Veriff
 */
const handleVeriffWebhook = async (req: express.Request & { rawBody?: Buffer }, res: express.Response) => {
  try {
    const signature = req.headers["x-hmac-signature"] as string;
    const authClient = req.headers["x-auth-client"] as string;
    // Veriff signs the RAW request body — verify against the exact bytes received,
    // NOT a re-stringified parsed object.
    const raw: Buffer | string = req.rawBody ?? JSON.stringify(req.body ?? {});
    const payload = req.body as Record<string, unknown>;

    // Verify webhook authenticity: X-AUTH-CLIENT must equal our API key AND
    // X-HMAC-SIGNATURE must be a valid HMAC-SHA256 of the raw body.
    const veriffService = getVeriffService();
    const validClient = veriffService.verifyAuthClient(authClient);
    const validSignature = veriffService.verifyWebhookRaw(raw, signature);

    if (!validClient || !validSignature) {
      apiLogger.error("Invalid Veriff webhook auth", { validClient, validSignature });
      return errorResponseHelper(res, 401, "Invalid webhook signature");
    }

    // Parse webhook payload
    const webhookData = veriffService.parseWebhookPayload(payload);
    const { verificationId, status, decision, decisionCode, reason } = webhookData;

    apiLogger.info("Veriff webhook received:", { verificationId, decision, status });

    // Find KYC record
    const kycRecord = await kycModel.findOne({
      where: {
        veriff_verification_id: verificationId,
      },
    });

    if (!kycRecord) {
      apiLogger.warn("Veriff webhook: no KYC record for verification (ack + ignore):", verificationId);
      return successResponseHelper(res, 200, "No matching KYC record — acknowledged", {});
    }

    // Update KYC record with decision
    const kycStatus = veriffService.mapDecisionToStatus(decision);
    
    await kycRecord.update({
      status: kycStatus,
      veriff_decision: decision,
      veriff_decision_code: decisionCode,
      veriff_reason: reason,
      reviewed_at: new Date(),
      ...(decision === "declined" && { rejection_reason: reason }),
    });

    const userId = kycRecord.get("user_id") as number;
    const companyId = kycRecord.get("company_id") as number | null;

    // Get user details for notifications
    const userResult = await sequelize.query<{ name: string; email: string }>(
      `SELECT name, email FROM tbl_user WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    const user = userResult[0];
    const userEmail = user?.email || '';
    const userName = user?.name || '';

    // Send notifications based on decision
    if (decision === "approved") {
      // Create approval notification
      await createNotification(
        userId,
        NOTIFICATION_TYPES.KYC_APPROVED,
        "KYC Verification Approved",
        "Congratulations! Your identity verification has been approved. You can now process payments without restrictions.",
        { verification_id: verificationId },
        companyId
      );

      // Send approval email
      await sendKYCApprovedEmail(userEmail, userName);

    } else if (decision === "declined") {
      // Create rejection notification
      await createNotification(
        userId,
        NOTIFICATION_TYPES.KYC_REJECTED,
        "KYC Verification Unsuccessful",
        `Your identity verification was not approved. Reason: ${reason}. Please resubmit with correct documents.`,
        {
          verification_id: verificationId,
          reason: reason,
        },
        companyId
      );

      // Send rejection email
      await sendKYCRejectedEmail(userEmail, userName, reason);

    } else if (decision === "resubmission_requested") {
      // Create resubmission notification
      await createNotification(
        userId,
        NOTIFICATION_TYPES.KYC_REQUIRED,
        "KYC Resubmission Required",
        `Additional information is needed for your verification. Reason: ${reason}`,
        {
          verification_id: verificationId,
          reason: reason,
        },
        companyId
      );

      // Send resubmission required email
      await sendKYCResubmissionRequiredEmail(userEmail, userName, reason || "Additional documents required for verification");
    }

    return successResponseHelper(res, 200, "Webhook processed successfully", {});

  } catch (error: unknown) {
    apiLogger.error("Veriff webhook error:", error);
    const message = getErrorMessage(error);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Check volume and trigger KYC requirement
 * Called from transaction completion
 */
export const checkVolumeAndTriggerKYC = async (
  userId: number,
  companyId: number | null
): Promise<void> => {
  try {
    // Exempt accounts never trigger KYC requirements.
    if (isKycExempt(userId, companyId)) {
      return;
    }
    // Calculate total volume
    const volumeQuery = companyId
      ? `SELECT COALESCE(SUM(base_amount), 0) as total_volume
         FROM tbl_user_transaction 
         WHERE user_id = :userId AND company_id = :companyId AND status = 'done'`
      : `SELECT COALESCE(SUM(base_amount), 0) as total_volume
         FROM tbl_user_transaction 
         WHERE user_id = :userId AND status = 'done'`;

    const volumeResult = await sequelize.query<{ total_volume: string }>(volumeQuery, {
      replacements: { userId, companyId },
      type: QueryTypes.SELECT,
    });

    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));
    const volumeThreshold = 10000; // $10,000 USD threshold
    const gracePeriodDays = 90; // 90-day grace period

    // Check if KYC is required
    if (totalVolume >= volumeThreshold) {
      // Check if KYC already exists
      const kycRecord = await kycModel.findOne({
        where: {
          user_id: userId,
          ...(companyId && { company_id: companyId }),
        },
      });

      const kycStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
      
      // If KYC not approved, send notifications
      if (kycStatus !== "approved") {
        // Get user details
        const userResult = await sequelize.query<{ name: string; email: string }>(
          `SELECT name, email FROM tbl_user WHERE user_id = :userId`,
          {
            replacements: { userId },
            type: QueryTypes.SELECT,
          }
        );

        const user = userResult[0];
        const userEmail = user?.email || '';
        const userName = user?.name || '';

        // Calculate days since threshold was reached for grace period tracking
        const thresholdReachedQuery = companyId
          ? `SELECT MIN("createdAt") as threshold_date
             FROM (
               SELECT "createdAt", 
                      SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
               FROM tbl_customer_transaction 
               WHERE company_id = :companyId AND status = 'successful'
             ) sub
             WHERE running_total >= :threshold`
          : `SELECT MIN("createdAt") as threshold_date
             FROM (
               SELECT "createdAt", 
                      SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
               FROM tbl_user_transaction 
               WHERE user_id = :userId AND status = 'done'
             ) sub
             WHERE running_total >= :threshold`;
        
        let daysRemaining = gracePeriodDays;
        try {
          const thresholdResult = await sequelize.query<{ threshold_date: string }>(
            thresholdReachedQuery,
            {
              replacements: { userId, companyId, threshold: volumeThreshold },
              type: QueryTypes.SELECT,
            }
          );
          
          const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : new Date();
          const gracePeriodEnd = new Date(thresholdDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
          daysRemaining = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        } catch (e) {
          apiLogger.warn("[KYC] Could not calculate grace period, using default");
        }

        // MONTHLY NOTIFICATION: Send reminder every 30 days until KYC is approved
        // Check for existing notification in the last 30 days (monthly)
        const existingNotification = await sequelize.query(
          `SELECT notification_id FROM tbl_notification 
           WHERE user_id = :userId 
           AND type = :type 
           AND created_at > NOW() - INTERVAL '30 days'`,
          {
            replacements: { userId, type: NOTIFICATION_TYPES.KYC_REQUIRED },
            type: QueryTypes.SELECT,
          }
        );

        if (existingNotification.length === 0) {
          const urgencyMessage = daysRemaining <= 30 
            ? `URGENT: Only ${daysRemaining} days remaining before your account is restricted.`
            : `You have ${daysRemaining} days to complete KYC verification.`;
          
          await createNotification(
            userId,
            NOTIFICATION_TYPES.KYC_REQUIRED,
            "KYC Verification Required - Monthly Reminder",
            `Your transaction volume ($${totalVolume.toFixed(2)}) has exceeded the $${volumeThreshold.toLocaleString()} threshold. ${urgencyMessage} Please complete KYC verification to continue processing payments.`,
            {
              total_volume: totalVolume,
              threshold: volumeThreshold,
              days_remaining: daysRemaining,
              grace_period_days: gracePeriodDays,
            },
            companyId
          );

          // Send KYC required email with urgency based on remaining days
          await sendKYCRequiredEmail(userEmail, userName, totalVolume.toFixed(2));
          
          apiLogger.info(`[KYC NOTIFICATION] Sent monthly reminder to user ${userId}. Volume: $${totalVolume.toFixed(2)}, Days remaining: ${daysRemaining}`);
        }
      }
    }
  } catch (error) {
    apiLogger.error("Check volume and trigger KYC error:", error);
    // Don't throw error to avoid breaking transaction flow
  }
};

/**
 * Resubmit KYC verification
 * POST /api/kyc/resubmit
 * Allows user to restart KYC process after rejection or expiration
 */
const resubmitKYC = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;
    const { company_id, first_name, last_name } = req.body;

    // Find existing KYC record
    const existingKYC = await kycModel.findOne({
      where: {
        user_id: userId,
        ...(company_id && { company_id }),
      },
      order: [["created_at", "DESC"]],
    });

    if (!existingKYC) {
      return errorResponseHelper(res, 404, "No previous KYC record found. Please submit a new KYC application.");
    }

    const currentStatus = existingKYC.get("status") as string;
    const allowedStatuses = ["declined", "resubmission_requested", "abandoned", "expired"];

    if (!allowedStatuses.includes(currentStatus)) {
      return errorResponseHelper(res, 400, `Cannot resubmit KYC with status: ${currentStatus}. Only declined, expired, or resubmission_requested KYC can be resubmitted.`);
    }

    // Get user details
    const userResult = await sequelize.query(
      `SELECT name, email FROM tbl_user WHERE user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    ) as Array<{ name: string; email: string }>;

    if (!userResult || userResult.length === 0) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const user = userResult[0];
    const userName = user?.name || '';
    // userEmail not used in this function

    // Initialize Veriff service and create new session
    const veriffService = getVeriffService();
    const callbackUrl = `${envRaw("FRONTEND_URL") || envRaw("SERVER_URL")}/kyc/complete`;

    const session = await veriffService.createSession({
      userId,
      companyId: company_id || null,
      firstName: first_name || userName.split(" ")[0],
      lastName: last_name || userName.split(" ").slice(1).join(" "),
      callbackUrl,
    });

    // Update existing KYC record with new session
    await existingKYC.update({
      status: "submitted",
      submitted_at: new Date(),
      veriff_session_id: session.verification.id,
      veriff_session_url: session.verification.url,
      veriff_verification_id: session.verification.id,
      veriff_decision: null,
      veriff_decision_code: null,
      veriff_reason: null,
      rejection_reason: null,
      reviewed_at: null,
    });

    // Create notification
    await createNotification(
      userId,
      NOTIFICATION_TYPES.KYC_REQUIRED,
      "KYC Resubmission Started",
      `Your identity verification has been resubmitted. Please complete the verification process.`,
      {
        session_id: session.verification.id,
        resubmission: true,
      },
      company_id
    );

    return successResponseHelper(res, 200, "KYC resubmission started successfully", {
      verification: {
        session_id: session.verification.id,
        verification_url: session.verification.url,
        status: "submitted",
      },
      kyc_id: existingKYC.get("kyc_id"),
      message: "Please complete the verification process using the new session URL",
    });

  } catch (error: unknown) {
    apiLogger.error("Resubmit KYC error:", error);
    const message = getErrorMessage(error);
    return errorResponseHelper(res, 500, message);
  }
};

/**
 * Get KYC history for user
 * GET /api/kyc/history
 */
const getKYCHistory = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;
    const companyId = req.query.company_id ? parseInt(req.query.company_id as string) : null;

    const whereClause = companyId
      ? { user_id: userId, company_id: companyId }
      : { user_id: userId };

    const kycHistory = await kycModel.findAll({
      where: whereClause,
      order: [["created_at", "DESC"]],
    });

    return successResponseHelper(res, 200, "KYC history retrieved successfully", {
      records: kycHistory,
      total: kycHistory.length,
    });

  } catch (error: unknown) {
    apiLogger.error("Get KYC history error:", error);
    const message = getErrorMessage(error);
    return errorResponseHelper(res, 500, message);
  }
};

export default {
  getKYCStatus,
  getKYCRequirements,
  startKYCVerification,
  handleVeriffWebhook,
  checkVolumeAndTriggerKYC,
  resubmitKYC,
  getKYCHistory,
};
