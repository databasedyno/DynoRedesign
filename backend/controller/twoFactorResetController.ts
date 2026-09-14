/**
 * Lost-authenticator recovery ("Reset 2FA via email").
 * - POST /2fa/reset/request {challenge_token}  — public; the live sign-in challenge proves the password
 * - POST /2fa/reset/confirm {token}            — public; signed single-use link from the email
 * Confirming: TOTP dropped → email-code baseline, ALL sessions + trusted devices revoked,
 * payout-wallet changes frozen 24h, admin security event + ops email.
 */
import express from "express";
import crypto from "crypto";
import { raw as envRaw } from "../utils/config";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import { redis, getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { userModel } from "../models";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate } from "../services/email/emailShared";
import { p, infoBox, dataRow } from "../utils/emailTemplate";
import mailTransporter from "../utils/mailTransporter";
import { send2FAResetLinkEmail, send2FAResetDoneEmail } from "../services/email/securityEmails";
import { ChallengeError, peekLoginChallenge } from "../services/twoFactorChallenge";
import { resetToEmailFactor } from "../services/twoFactorService";
import { revokeAllUserSessions } from "../services/sessionService";
import { revokeAllTrustedDevices, clearDeviceCookie } from "../services/session/trustedDevices";
import { freezeWalletChanges } from "../services/wallet/walletChangeAlert";
import { recordSecurityEvent } from "../services/securityEventService";
import { requestClientInfo } from "../services/session/tokens";

const RESET_TTL = 30 * 60;
export const WALLET_FREEZE_SECONDS = 24 * 60 * 60;
const resetKey = (hash: string) => `2fa_reset:${hash}`;
const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

const notifyOps = async (user: { user_id: number; email: string; name: string }, ip: string, ua: string, until: Date) => {
  const adminEmail = envRaw("ADMIN_EMAIL");
  if (!adminEmail) return userLogger.warn("[2FA reset] ADMIN_EMAIL not set — ops alert skipped");
  const detail = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${dataRow("User", `${user.name || "—"} &lt;${user.email}&gt; (#${user.user_id})`)}
    ${dataRow("IP", ip || "—")}
    ${dataRow("Browser", ua || "—")}
    ${dataRow("Wallet changes locked until", `${until.toUTCString()}`)}
  </table>`;
  const content = `${p("Hey Dynopay Admin,")}
    ${p("A merchant reset their two-step verification via the email recovery link. All sessions and trusted devices were revoked and payout-wallet changes are locked for 24 hours. Review it under Admin → Security events; you can lift the lock early from there.")}
    ${infoBox(detail, "#F79009")}`;
  await mailTransporter({
    to: adminEmail,
    name: "Dynopay Admin",
    subject: `2FA reset — ${user.email}`,
    body: dynoPayEmailTemplate("Two-step verification reset", content),
  }).catch((e: unknown) => userLogger.error("[2FA reset] ops email failed", e));
};

const request = async (req: express.Request, res: express.Response) => {
  try {
    const challengeToken = String(req.body?.challenge_token || "");
    if (!challengeToken) return errorResponseHelper(res, 400, "challenge_token is required");
    const challenge = await peekLoginChallenge(challengeToken);

    const allowed = await redis.set(`2fa_reset_rate:${challenge.user_id}`, "1", { NX: true, EX: 60 });
    if (allowed !== "OK") return errorResponseHelper(res, 429, "A reset link was sent recently. Please check your inbox.");

    const u = await userModel.findOne({ where: { user_id: challenge.user_id }, attributes: ["email", "name", "language"] });
    const email = u?.dataValues?.email as string | undefined;
    if (!email) return errorResponseHelper(res, 400, "This account has no email address on file. Please contact support.");

    const token = crypto.randomBytes(32).toString("hex");
    await setRedisItemWithTTL(resetKey(sha(token)), { user_id: challenge.user_id, issued_at: Date.now() }, RESET_TTL);
    const link = `${FRONTEND_BASE_URL}/auth/reset-2fa?token=${token}`;
    await send2FAResetLinkEmail(email, u?.dataValues?.name || "", link, u?.dataValues?.language);
    userLogger.warn(`[2FA reset] link requested for user ${challenge.user_id}`);

    successResponseHelper(res, 200, "If the account has an email on file, a reset link is on its way.", {
      masked_email: email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      expires_in: RESET_TTL,
      ...(envRaw("DISABLE_OUTBOUND_EMAIL") === "true" ? { preview_token: token } : {}),
    });
  } catch (e) {
    if (e instanceof ChallengeError) return errorResponseHelper(res, e.status, e.message);
    handleControllerError(res, e, userLogger);
  }
};

const confirm = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.body?.token || "");
    if (!/^[a-f0-9]{64}$/i.test(token)) return errorResponseHelper(res, 400, "This reset link is invalid.");
    const key = resetKey(sha(token));
    const rec = (await getRedisItem(key)) as { user_id?: number } | null;
    const userId = Number(rec?.user_id || 0);
    if (!userId) return errorResponseHelper(res, 400, "This reset link has expired or was already used. Sign in again to request a new one.");
    await deleteRedisItem(key);

    const u = await userModel.findOne({ where: { user_id: userId }, attributes: ["user_id", "email", "name", "language"] });
    if (!u) return errorResponseHelper(res, 404, "User not found");
    const user = { user_id: userId, email: String(u.dataValues.email || ""), name: String(u.dataValues.name || "") };
    const { ipAddress, device_name } = requestClientInfo(req);
    const until = new Date(Date.now() + WALLET_FREEZE_SECONDS * 1000);

    await resetToEmailFactor(userId);
    await revokeAllUserSessions(userId, "2fa_reset");
    await revokeAllTrustedDevices(userId);
    clearDeviceCookie(res);
    await freezeWalletChanges(userId, "Two-step verification was reset via email link", WALLET_FREEZE_SECONDS);
    await recordSecurityEvent({
      user_id: userId,
      type: "2fa_reset",
      severity: "high",
      summary: `2FA reset via email link from ${device_name} (${ipAddress}). Sessions + trusted devices revoked; wallet changes locked 24h.`,
      meta: { ip: ipAddress, device: device_name },
      freeze_until: until,
    });
    if (user.email) {
      void send2FAResetDoneEmail(user.email, user.name, until, u.dataValues.language as string | null);
      void notifyOps(user, ipAddress, device_name, until);
    }
    userLogger.warn(`[2FA reset] COMPLETED for user ${userId} from ${ipAddress}`);

    successResponseHelper(res, 200, "Two-step verification was reset. Sign in with your password and the code we email you.", {
      reset: true,
      method: "email",
      wallet_frozen_until: until.toISOString(),
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default { request, confirm };
