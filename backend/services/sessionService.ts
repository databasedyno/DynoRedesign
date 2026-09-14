/**
 * Session Management Service
 *
 * Handles session lifecycle: creation, refresh token rotation,
 * revocation, concurrent session limits, and cleanup.
 * Token minting lives in ./session/tokens.ts; revocation enforcement
 * (Redis markers + account-wide cutoff) in ./session/revocation.ts.
 */
import { Op } from "sequelize";
import UserSession from "../models/securityModels/userSessionModel";
import LoginHistory from "../models/securityModels/loginHistoryModel";
import { userLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import {
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_DAYS,
  MAX_CONCURRENT_SESSIONS,
  RequestInfo,
  TokenPair,
  requestClientInfo,
  generateRefreshToken,
  hashRefreshToken,
  tokenFingerprint,
  signAccessToken,
  loadUserRow,
  rotateSessionTokens,
} from "./session/tokens";
import {
  markSessionRevokedInRedis,
  setTokensValidAfterNow,
  isSessionRevoked,
  isKeptSession,
  revokedSessionKey,
} from "./session/revocation";

export { isSessionRevoked, isKeptSession, revokedSessionKey };

/**
 * Create a new session with access + refresh tokens
 */
export const createSession = async (
  user: IUserType,
  req: RequestInfo,
): Promise<TokenPair & { session_id: number }> => {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  const { ipAddress, userAgent, device_type, browser, os, device_name } = requestClientInfo(req);

  // Enforce concurrent session limit — evict oldest
  const activeSessions = await UserSession.count({
    where: { user_id: user.user_id, is_active: true },
  });

  if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
    const oldestSession = await UserSession.findOne({
      where: { user_id: user.user_id, is_active: true },
      order: [["last_activity", "ASC"]],
    });
    if (oldestSession) {
      await oldestSession.update({
        is_active: false,
        revoked_at: new Date(),
        revoke_reason: "concurrent_session_limit",
      });
      userLogger.info(`[Session] Evicted oldest session ${oldestSession.session_id} for user ${user.user_id} (limit: ${MAX_CONCURRENT_SESSIONS})`);
    }
  }

  // Compute expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  // Create session record
  const session = await UserSession.create({
    user_id: user.user_id,
    session_token: tokenFingerprint(accessToken),
    refresh_token: hashRefreshToken(refreshToken),
    ip_address: ipAddress,
    user_agent: userAgent,
    device_type,
    device_name,
    browser,
    os,
    is_active: true,
    last_activity: new Date(),
    expires_at: expiresAt,
  });

  // Log login history
  try {
    await LoginHistory.create({
      user_id: user.user_id,
      email: user.email,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type,
      browser,
      os,
      login_method: "password",
      status: "success",
    });
  } catch (err) {
    userLogger.error("[Session] Failed to log login history:", err);
  }

  userLogger.info(`[Session] Created session ${session.session_id} for user ${user.user_id} from ${device_name} (${ipAddress})`);

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    session_id: session.session_id,
  };
};

/**
 * Rotate refresh token — old token invalidated, new pair issued
 */
export const rotateRefreshToken = async (oldRefreshToken: string): Promise<TokenPair | null> => {
  const session = await UserSession.findOne({
    where: {
      refresh_token: hashRefreshToken(oldRefreshToken),
      is_active: true,
      expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!session) {
    userLogger.warn(`[Session] Refresh token rotation failed — token not found or expired`);
    return null;
  }

  const user = await loadUserRow(session.user_id);
  if (!user) {
    userLogger.warn(`[Session] Refresh token rotation failed — user ${session.user_id} not found`);
    return null;
  }

  const tokens = await rotateSessionTokens(session, user);
  userLogger.info(`[Session] Rotated refresh token for user ${session.user_id}, session ${session.session_id}`);
  return tokens;
};

/**
 * Get all active sessions for a user.
 * When `currentTokenSuffix` (the last 32 chars of the caller's access token) is
 * provided, each session is tagged with `is_current` so the UI can mark "This device".
 * The stored session_token is used only for the match and is never returned.
 */
export const getUserSessions = async (
  userId: number,
  currentTokenSuffix?: string | null
): Promise<Record<string, unknown>[]> => {
  const sessions = await UserSession.findAll({
    where: { user_id: userId, is_active: true },
    attributes: ["session_id", "session_token", "ip_address", "device_type", "device_name", "browser", "os", "location", "last_activity", "created_at", "expires_at"],
    order: [["last_activity", "DESC"]],
  });
  return sessions.map((s) => {
    const { session_token, ...rest } = s.dataValues as unknown as Record<string, unknown>;
    return {
      ...rest,
      is_current: currentTokenSuffix ? session_token === currentTokenSuffix : false,
    };
  });
};

/**
 * Revoke a specific session
 */
export const revokeSession = async (sessionId: number, userId: number, reason: string = "user_revoked"): Promise<boolean> => {
  const session = await UserSession.findOne({
    where: { session_id: sessionId, user_id: userId, is_active: true },
  });

  if (!session) return false;

  await session.update({
    is_active: false,
    revoked_at: new Date(),
    revoke_reason: reason,
  });

  // Enforce immediately: the revoked device's token stops working on its next request.
  await markSessionRevokedInRedis(
    userId,
    session.dataValues.session_token as string | undefined,
    session.dataValues.expires_at as Date | undefined,
  );

  userLogger.info(`[Session] Revoked session ${sessionId} for user ${userId} (reason: ${reason})`);
  return true;
};

/** Deactivate every active session matching `where` and write the Redis markers. */
const deactivateSessions = async (userId: number, where: Record<string, unknown>, reason: string): Promise<number> => {
  // Capture the fingerprints BEFORE flipping is_active so we can write the
  // Redis revocation markers (each device stops working on its next request).
  const affected = await UserSession.findAll({
    where,
    attributes: ["session_id", "session_token", "expires_at"],
  });

  const [affectedCount] = await UserSession.update(
    { is_active: false, revoked_at: new Date(), revoke_reason: reason },
    { where }
  );

  await Promise.all(
    affected.map((s) =>
      markSessionRevokedInRedis(
        userId,
        s.dataValues.session_token as string | undefined,
        s.dataValues.expires_at as Date | undefined,
      ),
    ),
  );
  return affectedCount;
};

/** What we know about the caller's own access token (so it can survive the cutoff). */
export interface CurrentTokenContext extends RequestInfo {
  tokenSuffix?: string | null;
  /** JWT `exp` (seconds) — bounds the adopted session row's lifetime. */
  tokenExp?: number;
}

/**
 * The caller's token was minted without a session row (auto-login after
 * signup, pre-tracking login...). Adopt it into tbl_user_session so the
 * kept-session exemption recognises it and this device stays signed in.
 */
const adoptUntrackedSession = async (userId: number, ctx: CurrentTokenContext): Promise<UserSession> => {
  const { ipAddress, userAgent, device_type, browser, os, device_name } = requestClientInfo(ctx);
  const expiresAt = ctx.tokenExp
    ? new Date(ctx.tokenExp * 1000)
    : new Date(Date.now() + ACCESS_TOKEN_EXPIRY_SECONDS * 1000);
  const session = await UserSession.create({
    user_id: userId,
    session_token: ctx.tokenSuffix as string,
    ip_address: ipAddress,
    user_agent: userAgent,
    device_type,
    device_name,
    browser,
    os,
    is_active: true,
    last_activity: new Date(),
    expires_at: expiresAt,
  });
  userLogger.info(`[Session] Adopted untracked token into session ${session.session_id} for user ${userId}`);
  return session;
};

/**
 * Sign out every device except the caller's.
 *
 * 1. Every OTHER tracked session row is deactivated (+ Redis marker).
 * 2. The user's account-wide token cutoff moves to NOW, so every previously
 *    issued token dies — including tokens that never had a session row
 *    (auto-login after signup, pre-tracking logins, social edge paths).
 * 3. The caller's own session stays ACTIVE and is therefore exempt from the
 *    cutoff (isKeptSession), so THIS device keeps working with its current
 *    token — no client-side token swap, no race with in-flight requests.
 *
 * The current session is resolved SERVER-SIDE from the access-token fingerprint
 * so a client can never trick us into keeping someone else's session.
 */
export const revokeAllOtherSessions = async (
  userId: number,
  ctx: CurrentTokenContext,
): Promise<number> => {
  let current: UserSession | null = null;
  if (ctx.tokenSuffix) {
    current = await UserSession.findOne({
      where: { user_id: userId, session_token: ctx.tokenSuffix, is_active: true },
      attributes: ["session_id"],
    });
    if (!current) current = await adoptUntrackedSession(userId, ctx);
  }
  const keepSessionId = current?.dataValues.session_id as number | undefined;

  const where: Record<string, unknown> = { user_id: userId, is_active: true };
  if (keepSessionId) {
    where.session_id = { [Op.ne]: keepSessionId };
  }

  const affectedCount = await deactivateSessions(userId, where, "revoke_all_others");
  await setTokensValidAfterNow(userId);

  userLogger.info(`[Session] Revoked ${affectedCount} other sessions for user ${userId} (kept ${keepSessionId ?? "none"}, token cutoff moved)`);
  return affectedCount;
};

/**
 * Revoke EVERY active session for a user — used by the emailed one-tap
 * "sign out everywhere" link. Every device, including the one that just
 * signed in, is signed out on its next request (Redis markers + the
 * account-wide token cutoff, which also catches untracked tokens).
 */
export const revokeAllUserSessions = async (
  userId: number,
  reason: string = "signout_everywhere",
): Promise<number> => {
  const affectedCount = await deactivateSessions(userId, { user_id: userId, is_active: true }, reason);
  await setTokensValidAfterNow(userId);
  userLogger.info(`[Session] Revoked ALL ${affectedCount} sessions for user ${userId} (reason: ${reason}, token cutoff moved)`);
  return affectedCount;
};

/**
 * Get login history for a user
 */
export const getLoginHistory = async (userId: number, limit: number = 20): Promise<Record<string, unknown>[]> => {
  const history = await LoginHistory.findAll({
    where: { user_id: userId },
    order: [["login_at", "DESC"]],
    limit,
    attributes: ["history_id", "ip_address", "device_type", "browser", "os", "location", "login_method", "status", "login_at"],
  });
  return history.map((h) => h.dataValues as unknown as Record<string, unknown>);
};

/**
 * Cleanup expired sessions (run periodically)
 */
export const cleanupExpiredSessions = async (): Promise<number> => {
  const [affectedCount] = await UserSession.update(
    {
      is_active: false,
      revoked_at: new Date(),
      revoke_reason: "expired",
    },
    {
      where: {
        is_active: true,
        expires_at: { [Op.lt]: new Date() },
      },
    }
  );

  if (affectedCount > 0) {
    userLogger.info(`[Session] Cleaned up ${affectedCount} expired sessions`);
  }
  return affectedCount;
};

export default {
  createSession,
  rotateRefreshToken,
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions,
  revokeAllUserSessions,
  getLoginHistory,
  cleanupExpiredSessions,
  isSessionRevoked,
  isKeptSession,
};
