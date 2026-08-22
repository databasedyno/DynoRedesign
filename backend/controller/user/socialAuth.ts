import express from "express";
import {
  downloadUserImage,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import emailService from "../../services/emailService";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel, loginActivityModel } from "../../models";
import { userWalletAddressModel } from "../../models/userModels";
import notificationModel from "../../models/notificationModel";
import notificationPreferencesModel from "../../models/notificationPreferencesModel";
import kycModel from "../../models/kycModel";
import sha256 from "crypto-js/sha256";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../helper/passwordHelper";
import crypto from "crypto";
import sequelize from "../../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import axios from "axios";
import { userLogger } from "../../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../../services/accountLockoutService";
import { createSession } from "../../services/sessionService";
import { finalizeUploadedImage } from "../../services/objectStorage";
import { is2FARequired } from "../../services/twoFactorService";
import { normalizeLang } from "../../utils/emailI18n";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";

export const googleSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      return errorResponseHelper(res, 400, "Google ID token or access token is required");
    }

    let googleUserInfo: {
      email?: string;
      name?: string;
      picture?: string;
      sub?: string;
      email_verified?: boolean | string;
    };

    if (idToken) {
      // Verify ID token with Google
      try {
        const response = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google ID token");
      }
    } else if (accessToken) {
      // Use access token to get user info
      try {
        const response = await axios.get(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google access token");
      }
    }

    if (!googleUserInfo || !googleUserInfo.email) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from Google");
    }

    const { email, name, picture, sub: googleId } = googleUserInfo;

    // Google verifies email ownership as part of OAuth. Honor Google's
    // email_verified claim; treat as verified when the field is absent
    // (only an explicit `false` marks the address as unverified).
    const googleEmailVerified = !(
      googleUserInfo.email_verified === false ||
      googleUserInfo.email_verified === "false"
    );

    // Check if user exists by email or google_id
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { google_id: googleId },
        ],
      },
    });

    if (user) {
      // Update google_id if not set
      if (!user.dataValues.google_id && googleId) {
        await userModel.update(
          { 
            google_id: googleId,
            login_type: "GOOGLE",
          },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      // Update last login IP
      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      const existingUserUpdate: Record<string, unknown> = {
        last_login_ip: typeof ipAddress === "string" ? ipAddress : String(ipAddress),
      };
      // Google verified this email — upgrade previously-unverified accounts so
      // the emailVerifiedMiddleware no longer blocks onboarding. Never downgrade.
      if (googleEmailVerified) existingUserUpdate.email_verified = true;
      await userModel.update(existingUserUpdate, {
        where: { user_id: user.dataValues.user_id },
      });

      // Create session with refresh token (same as OTP login)
      const sessionData = await createSession(user.dataValues, req as any);
      const { password: _pw, telegram_id: _tid, ...userDataClean } = user.dataValues;
      const resData = {
        userData: userDataClean,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        session_id: sessionData.session_id,
        token_type: "Bearer",
      };
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // Create new user
    const photoUrl = picture || process.env.SERVER_URL + (await downloadUserImage());
    
    const createdUser = await userModel.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      photo: photoUrl,
      login_type: "GOOGLE",
      google_id: googleId,
      email_verified: googleEmailVerified, // Google already verified this email
      referral_code: generateReferralCode(),
      language: normalizeLang(req.body?.language),
    });

    // Create default wallets for new user (shared helper — identical across all signup paths)
    await createUserWallets(createdUser.dataValues.user_id);

    const sessionDataNew = await createSession(createdUser.dataValues, req as any);
    const { password: _pw2, telegram_id: _tid2, ...newUserDataClean } = createdUser.dataValues;
    const resData = {
      userData: newUserDataClean,
      accessToken: sessionDataNew.accessToken,
      refreshToken: sessionDataNew.refreshToken,
      expiresIn: sessionDataNew.expiresIn,
      session_id: sessionDataNew.session_id,
      token_type: "Bearer",
    };

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(email.toLowerCase(), name || email.split("@")[0]);
    } catch (emailError) {
      // Log error but don't fail registration
      userLogger.error("Error sending welcome email:", emailError);
    }

    userLogger.info(`New user registered via Google: ${email}`);

    // Notify admin of new user registration (non-blocking)
    emailService.sendNewUserAdminNotification({
      name: name || email.split("@")[0], email: email.toLowerCase(),
      login_type: "Google", user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * GitHub Sign-In - OAuth authorization-code exchange
 * POST /api/user/github-signin
 * Body: { code: string, redirectUri?: string }
 * The client secret never leaves the server — the SPA sends only the temporary code.
 */
export const githubSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return errorResponseHelper(res, 400, "GitHub authorization code is required");
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return errorResponseHelper(res, 503, "GitHub login is not configured");
    }

    // 1. Exchange the authorization code for an access token
    let ghAccessToken: string | undefined;
    try {
      const tokenRes = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          ...(redirectUri ? { redirect_uri: redirectUri } : {}),
        },
        { headers: { Accept: "application/json" }, timeout: 15000 }
      );
      ghAccessToken = tokenRes.data?.access_token;
      if (!ghAccessToken) {
        userLogger.warn(`[GitHub] Token exchange failed: ${JSON.stringify(tokenRes.data?.error || tokenRes.data)}`);
        return errorResponseHelper(res, 401, "Invalid GitHub authorization code");
      }
    } catch (tokenError) {
      return errorResponseHelper(res, 401, "Invalid GitHub authorization code");
    }

    // 2. Fetch the GitHub user profile
    const ghHeaders = {
      Authorization: `Bearer ${ghAccessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DynoPay-Auth",
    };
    let ghUser: { id?: number; login?: string; name?: string; email?: string; avatar_url?: string };
    try {
      const userRes = await axios.get("https://api.github.com/user", { headers: ghHeaders, timeout: 15000 });
      ghUser = userRes.data;
    } catch (profileError) {
      return errorResponseHelper(res, 401, "Could not retrieve user info from GitHub");
    }
    if (!ghUser || !ghUser.id) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from GitHub");
    }

    // 3. Resolve a verified email (profile email may be private/null)
    let email: string | null = ghUser.email || null;
    if (!email) {
      try {
        const emailsRes = await axios.get("https://api.github.com/user/emails", { headers: ghHeaders, timeout: 15000 });
        const emails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
        const best =
          emails.find((e: { primary?: boolean; verified?: boolean; email?: string }) => e.primary && e.verified) ||
          emails.find((e: { verified?: boolean; email?: string }) => e.verified);
        email = best?.email || null;
      } catch {
        /* fall through — handled below */
      }
    }
    if (!email) {
      return errorResponseHelper(res, 400, "Your GitHub account has no verified email address. Please verify an email on GitHub and try again.");
    }

    // Prefixed to avoid clashing with raw Facebook ids that share the external_id column
    const githubId = `github:${ghUser.id}`;
    const name = ghUser.name || ghUser.login || email.split("@")[0];
    const picture = ghUser.avatar_url;

    // 4. Existing user → login
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { external_id: githubId },
        ],
      },
    });

    if (user) {
      // Link the GitHub identity if not linked yet
      if (!user.dataValues.external_id) {
        await userModel.update(
          { external_id: githubId },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      await userModel.update(
        { last_login_ip: typeof ipAddress === "string" ? ipAddress : String(ipAddress) },
        { where: { user_id: user.dataValues.user_id } }
      );

      const sessionData = await createSession(user.dataValues, req as any);
      const { password: _pw, telegram_id: _tid, ...userDataClean } = user.dataValues;
      const resData = {
        userData: userDataClean,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        session_id: sessionData.session_id,
        token_type: "Bearer",
      };
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // 5. New user → register (mirrors googleSignIn)
    const photoUrl = picture || process.env.SERVER_URL + (await downloadUserImage());

    const createdUser = await userModel.create({
      name,
      email: email.toLowerCase(),
      photo: photoUrl,
      login_type: "GITHUB",
      external_id: githubId,
      email_verified: true, // GitHub verified the email for us
      referral_code: generateReferralCode(),
      language: normalizeLang(req.body?.language),
    });

    // Create default wallets for new user (shared helper — identical across all signup paths)
    await createUserWallets(createdUser.dataValues.user_id);

    const sessionDataNew = await createSession(createdUser.dataValues, req as any);
    const { password: _pw2, telegram_id: _tid2, ...newUserDataClean } = createdUser.dataValues;
    const resData = {
      userData: newUserDataClean,
      accessToken: sessionDataNew.accessToken,
      refreshToken: sessionDataNew.refreshToken,
      expiresIn: sessionDataNew.expiresIn,
      session_id: sessionDataNew.session_id,
      token_type: "Bearer",
    };

    // Send welcome email (non-fatal)
    try {
      await emailService.sendWelcomeEmail(email.toLowerCase(), name);
    } catch (emailError) {
      userLogger.error("Error sending welcome email:", emailError);
    }

    userLogger.info(`New user registered via GitHub: ${email}`);

    emailService.sendNewUserAdminNotification({
      name, email: email.toLowerCase(),
      login_type: "GitHub", user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Get User Profile
 * GET /api/user/profile
 */

