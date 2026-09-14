/**
 * Two-Factor Authentication Controller
 * 
 * Endpoints:
 * - POST /2fa/setup — Initiate 2FA setup (returns QR + backup codes)
 * - POST /2fa/verify-setup — Verify and enable 2FA
 * - POST /2fa/validate — Validate 2FA token during login
 * - POST /2fa/disable — Disable 2FA
 * - POST /2fa/regenerate-backup-codes — Get new backup codes
 * - GET /2fa/status — Get 2FA status
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import {
  setup2FA,
  verify2FASetup,
  validate2FAToken,
  disable2FA,
  regenerateBackupCodes,
  get2FAStatus,
  twoFAChallengeKey,
} from "../services/twoFactorService";
import { verifyPassword } from "../helper/passwordHelper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";
import { createSession } from "../services/sessionService";
import { send2FAEnabledEmail, send2FADisabledEmail, send2FABackupCodesRegeneratedEmail } from "../services/email/securityEmails";
import { getRedisItem, deleteRedisItem } from "../utils/redisInstance";

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

    successResponseHelper(res, 200, "2FA has been enabled successfully.", {
      enabled: true,
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
 * Used during login when 2FA is required. The challenge token is minted by the
 * first factor (password / email code / SMS / social) and is single-use.
 * On success, creates a session and returns JWT + refresh token (same as login).
 */
const validateEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const { challenge_token, token } = req.body;

    if (!challenge_token || !token) {
      return errorResponseHelper(res, 400, "challenge_token and token are required");
    }

    const challengeKey = twoFAChallengeKey(String(challenge_token));
    const challenge = await getRedisItem(challengeKey);
    const userId = Number(challenge && typeof challenge === "object" ? (challenge as { user_id?: number }).user_id : 0);
    if (!userId) {
      return errorResponseHelper(res, 400, "Your sign-in session expired. Please log in again.");
    }

    const result = await validate2FAToken(userId, String(token).trim());

    // A challenge only exists for accounts with TOTP enabled — never let a
    // "not enabled" record turn into a free session.
    if (!result.valid || result.method === "none") {
      return errorResponseHelper(res, 401, "Invalid 2FA code. Please try again.");
    }

    await deleteRedisItem(challengeKey);

    // Fetch user to create a full session (same as login flow)
    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    // Create session with JWT + refresh token
    const sessionData = await createSession(user.dataValues, req as any);

    const { password: _pw, telegram_id: _tid, ...userDataClean } = user.dataValues;
    userLogger.info(`[2FA] Login completed via ${result.method} for user ${userId}`);

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
    if ((e as Error).message.includes("locked")) {
      return errorResponseHelper(res, 429, (e as Error).message);
    }
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Re-authentication for sensitive 2FA changes: the current password, or — for
 * accounts without a password (social / passwordless) — a current TOTP/backup code.
 * Returns the user row on success, or null after responding with the error.
 */
const reauthenticate = async (req: express.Request, res: express.Response) => {
  const userData = res.locals.user as IUserType;
  const { password, token } = req.body;

  const user = await userModel.findOne({ where: { user_id: userData.user_id } });
  if (!user) {
    errorResponseHelper(res, 404, "User not found");
    return null;
  }

  if (password) {
    if (!user.dataValues.password) {
      errorResponseHelper(res, 400, "This account has no password. Confirm with a code from your authenticator app instead.");
      return null;
    }
    const isValid = await verifyPassword(password, user.dataValues.password, userData.user_id);
    if (!isValid) {
      errorResponseHelper(res, 401, "Invalid password");
      return null;
    }
    return user;
  }

  if (token) {
    const result = await validate2FAToken(userData.user_id, String(token).trim());
    if (!result.valid || result.method === "none") {
      errorResponseHelper(res, 401, "Invalid 2FA code. Please try again.");
      return null;
    }
    return user;
  }

  errorResponseHelper(res, 400, "Your password (or a current authenticator code) is required");
  return null;
};

/**
 * POST /api/user/2fa/disable
 * Body: { password: "current_password" } | { token: "123456" }
 */
const disableEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const user = await reauthenticate(req, res);
    if (!user) return;

    await disable2FA(user.dataValues.user_id);
    notify(user.dataValues as IUserType, send2FADisabledEmail);

    successResponseHelper(res, 200, "2FA has been disabled.", { enabled: false });
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
 * POST /api/user/2fa/regenerate-backup-codes
 * Body: { password: "current_password" } | { token: "123456" }
 */
const regenerateBackupCodesEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const user = await reauthenticate(req, res);
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
