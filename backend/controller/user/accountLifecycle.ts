import express from "express";
import {
  errorResponseHelper,
  successResponseHelper,
} from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { userModel } from "../../models";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import { userLogger } from "../../utils/loggers";
import { _formatAttribution } from "./userShared";
import { sendAccountSoftDeletedEmail } from "../../services/email/securityEmails";
import { sendAccountDeletedAdminEmail } from "../../services/email/adminNotificationEmails";
import { softDeleteAccount } from "../../services/accountPurgeService";
import { ownsSafeDealBrand } from "../../helper/protectedEntities";
import { ACCOUNT_DELETE_GRACE_DAYS } from "../../helper/accountDeletion";
import { revokeStepUp } from "../../services/stepUpService";

/**
 * DELETE /api/user/account
 * Soft-delete the whole account. Fresh verification is enforced by
 * requireStepUp("account_delete") on the route (authenticator when enrolled,
 * else an emailed code) — no separate OTP round-trip here.
 * The account is hidden + the user is signed out everywhere immediately; the
 * irreversible data purge only happens after the AML/KYC retention window
 * (~10 years, services/accountPurgeService), or when an admin manually purges it.
 * Only support/admin can restore it.
 */
export const deleteAccount = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["name", "email", "language"] });
    if (!user) return errorResponseHelper(res, 404, "Account not found");

    // The SafeDeal operator brand's owner can't be deleted — purging it would
    // cascade-wipe every SafeDeal escrow deal (helper/protectedEntities).
    if (await ownsSafeDealBrand(userData.user_id)) {
      return errorResponseHelper(res, 403, "This account owns the SafeDeal brand and can't be deleted. Contact support if you need to transfer ownership first.");
    }

    const { ok, scheduledPurgeAt } = await softDeleteAccount(userData.user_id, userData.user_id);
    if (!ok) {
      return errorResponseHelper(res, 400, "Your account is already scheduled for deletion.");
    }
    // One-shot: the elevated session must not outlive the action it unlocked.
    void revokeStepUp(userData.user_id, "account_delete").catch(() => {});

    const purgeDateStr = scheduledPurgeAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const email = user.dataValues.email;
    if (email) {
      void sendAccountSoftDeletedEmail(email, user.dataValues.name || "", purgeDateStr);
    }
    void sendAccountDeletedAdminEmail({
      userId: userData.user_id,
      ownerName: user.dataValues.name,
      ownerEmail: email || null,
      deletedAtStr: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC",
      purgeDateStr,
    });

    userLogger.info(`User account ${userData.user_id} soft-deleted (${email}) — purge ${scheduledPurgeAt.toISOString()}`);

    return successResponseHelper(res, 200, "Your account has been deactivated and you've been signed out of every device. For legal/compliance reasons some records are retained securely and are no longer accessible to you. Contact support if this was a mistake.", {
      scheduled_purge_at: scheduledPurgeAt.toISOString(),
      restore_before: purgeDateStr,
      grace_days: ACCOUNT_DELETE_GRACE_DAYS,
      logout: true,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Unsubscribe from referee code reminder emails
 * No authentication required - uses unsubscribe token
 */
export const unsubscribeFromReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { refereeCodeModel } = await import("../../models");
    
    // Find the referee code with this unsubscribe token
    const refereeCode = await refereeCodeModel.findOne({
      where: { unsubscribe_token: token },
    });
    
    if (!refereeCode) {
      return errorResponseHelper(res, 404, "Invalid unsubscribe token");
    }
    
    const codeData = refereeCode.dataValues;
    
    // Check if already unsubscribed
    if (codeData.unsubscribed_at) {
      return successResponseHelper(res, 200, "You have already unsubscribed from reminder emails", {
        email: codeData.customer_email,
        unsubscribed_at: codeData.unsubscribed_at,
      });
    }
    
    // Mark as unsubscribed
    await refereeCodeModel.update(
      { unsubscribed_at: new Date() },
      { where: { code_id: codeData.code_id } }
    );
    
    userLogger.info(`[Unsubscribe] ${codeData.customer_email} unsubscribed from referee code reminders`);
    
    return successResponseHelper(res, 200, "Successfully unsubscribed from reminder emails", {
      email: codeData.customer_email,
      message: "You will no longer receive reminder emails about your discount code. Note: Your discount code is still valid if you decide to sign up.",
    });
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Unsubscribe from payment link reminder emails
 * No authentication required - uses unsubscribe token
 */
export const unsubscribeFromPaymentReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { paymentLinkModel } = await import("../../models");
    
    // Find the payment link with this unsubscribe token
    const paymentLink = await paymentLinkModel.findOne({
      where: { unsubscribe_token: token },
    });
    
    if (!paymentLink) {
      return errorResponseHelper(res, 404, "Invalid unsubscribe token");
    }
    
    const linkData = paymentLink.dataValues;
    
    // Check if already unsubscribed
    if (linkData.unsubscribed_at) {
      return successResponseHelper(res, 200, "You have already unsubscribed from payment reminder emails", {
        email: linkData.email,
        unsubscribed_at: linkData.unsubscribed_at,
      });
    }
    
    // Mark as unsubscribed
    await paymentLinkModel.update(
      { unsubscribed_at: new Date() },
      { where: { link_id: linkData.link_id } }
    );
    
    userLogger.info(`[Unsubscribe] ${linkData.email} unsubscribed from payment link reminders (link_id: ${linkData.link_id})`);
    
    return successResponseHelper(res, 200, "Successfully unsubscribed from payment reminder emails", {
      email: linkData.email,
      message: "You will no longer receive reminder emails about this payment. You can still complete the payment using your original link.",
    });
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Get onboarding status for authenticated user
 * GET /api/user/onboarding-status
 * 
 * Returns a comprehensive status of user's setup progress including:
 * - Wallet setup status
 * - KYC status
 * - API key status
 * - Company setup status
 * - Next steps for incomplete setup
 */

