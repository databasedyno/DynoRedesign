/**
 * Two-Factor Authentication Controller
 * 
 * Endpoints:
 * - POST /2fa/setup — Initiate 2FA setup (returns QR + backup codes)
 * - POST /2fa/verify-setup — Verify and enable 2FA
 * - POST /2fa/validate — Validate 2FA token during login
 * - POST /2fa/disable — Turn the authenticator off → email-code baseline (step-up gated)
 * - POST /2fa/regenerate-backup-codes — Get new backup codes (step-up gated)
 * - GET /2fa/status — Get 2FA status
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import {
  setup2FA,
  verify2FASetup,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
} from "../services/twoFactorService";
import { ChallengeError, verifyLoginChallenge } from "../services/twoFactorChallenge";
import { trustDevice } from "../services/session/trustedDevices";
import { userModel } from "../models";
import { IUserType } from "../utils/types";
import { createSession } from "../services/sessionService";
import { send2FAEnabledEmail, send2FADisabledEmail, send2FABackupCodesRegeneratedEmail } from "../services/email/securityEmails";

const notify = (userData: IUserType, fn: (email: string, name: string, lang?: string | null) => Promise<void>) => {
  if (userData?.email) void fn(userData.email, userData.name || "", (userData as any).language);
};

/**
 * POST /api/user/2fa/setup
 */
const setupEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const result = await setup2FA(userData.user_id, userData.email);

    successResponseHelper(res, 200, "2FA setup initiated. Scan QR code with your authenticator app, then verify with a code.", {
      qr_code: result.qr_code,
      secret: result.secret, // For manual entry
      backup_codes: result.backup_codes, // SHOW ONCE
      important: "Save your backup codes securely. They will not be shown again.",
    });
  } catch (e) {
    if ((e as Error).message.includes("already enabled")) {
      return errorResponseHelper(res, 409, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/verify-setup
 * Body: { token: "123456" }
 */
const verifySetupEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const { token } = req.body;

    if (!token) {
      return errorResponseHelper(res, 400, "Verification token is required");
    }

    await verify2FASetup(userData.user_id, token);
    notify(userData, send2FAEnabledEmail);
    // The browser that just enrolled has proven the factor — trust it.
    await trustDevice(userData.user_id, req, res).catch((e) => userLogger.warn("[2FA] trustDevice after setup failed", e));

    successResponseHelper(res, 200, "2FA has been enabled successfully.", {
      enabled: true,
      method: "totp",
    });
  } catch (e) {
    if ((e as Error).message.includes("Invalid verification")) {
      return errorResponseHelper(res, 400, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/validate
 * Body: { challenge_token: "<hex>", token: "123456" | "XXXX-XXXX" }
 * Used during login when a second factor is required. The challenge token is
 * minted by the first factor (password / email code / SMS / social), is
 * single-use and method-aware (authenticator/backup code OR emailed code).
 * On success, creates a session, TRUSTS this browser (90 days) and returns the
 * same JWT + refresh token payload as login.
 */
const validateEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const { challenge_token, token } = req.body;

    if (!challenge_token || !token) {
      return errorResponseHelper(res, 400, "challenge_token and token are required");
    }

    const result = await verifyLoginChallenge(String(challenge_token), String(token));

    const user = await userModel.findOne({ where: { user_id: result.user_id } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const sessionData = await createSession(user.dataValues, req as any);
    await trustDevice(result.user_id, req, res).catch((e) => userLogger.warn("[2FA] trustDevice after login failed", e));

    const { password: _pw, telegram_id: _tid, ...userDataClean } = user.dataValues;
    userLogger.info(`[2FA] Login completed via ${result.method} for user ${result.user_id}`);

    successResponseHelper(res, 200, "2FA verification successful. Login complete.", {
      valid: true,
      method: result.method,
      userData: userDataClean,
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      expiresIn: sessionData.expiresIn,
      session_id: sessionData.session_id,
      token_type: "Bearer",
    });
  } catch (e) {
    if (e instanceof ChallengeError) return errorResponseHelper(res, e.status, e.message);
    if ((e as Error).message.includes("locked")) {
      return errorResponseHelper(res, 429, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Sensitive 2FA changes (disable / regenerate backup codes) are protected by the
 * `security` step-up session (requireStepUp at the router) — the fresh factor is
 * verified there, so these handlers only need the authenticated user row.
 */
const loadUser = async (res: express.Response) => {
  const userData = res.locals.user as IUserType;
  const user = await userModel.findOne({ where: { user_id: userData.user_id } });
  if (!user) errorResponseHelper(res, 404, "User not found");
  return user;
};

/**
 * POST /api/user/2fa/disable  (step-up gated)
 */
const disableEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const user = await loadUser(res);
    if (!user) return;

    await disable2FA(user.dataValues.user_id);
    notify(user.dataValues as IUserType, send2FADisabledEmail);

    // A second factor is mandatory: the account now uses email codes at sign-in.
    successResponseHelper(res, 200, "Authenticator app turned off. You'll receive email codes at sign-in instead.", { enabled: true, method: "email" });
  } catch (e) {
    if ((e as Error).message.includes("not currently enabled")) {
      return errorResponseHelper(res, 400, (e as Error).message);
    }
    if ((e as Error).message.includes("locked")) {
      return errorResponseHelper(res, 429, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/2fa/regenerate-backup-codes  (step-up gated)
 */
const regenerateBackupCodesEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const user = await loadUser(res);
    if (!user) return;

    const codes = await regenerateBackupCodes(user.dataValues.user_id);
    notify(user.dataValues as IUserType, send2FABackupCodesRegeneratedEmail);

    successResponseHelper(res, 200, "New backup codes generated. Save them securely.", {
      backup_codes: codes,
      important: "Your old backup codes are now invalid. Save these new codes securely.",
    });
  } catch (e) {
    if ((e as Error).message.includes("must be enabled")) {
      return errorResponseHelper(res, 400, (e as Error).message);
    }
    if ((e as Error).message.includes("locked")) {
      return errorResponseHelper(res, 429, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/2fa/status
 */
const statusEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const status = await get2FAStatus(userData.user_id);

    successResponseHelper(res, 200, "2FA status retrieved", status);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default {
  setupEndpoint,
  verifySetupEndpoint,
  validateEndpoint,
  disableEndpoint,
  regenerateBackupCodesEndpoint,
  statusEndpoint,
};
