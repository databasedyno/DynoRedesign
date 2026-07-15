/**
 * Session Management Service
 * 
 * Handles session lifecycle: creation, refresh token rotation,
 * revocation, concurrent session limits, and cleanup.
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import UserSession from "../models/securityModels/userSessionModel";
import LoginHistory from "../models/securityModels/loginHistoryModel";
import { userLogger } from "../utils/loggers";
import { Op } from "sequelize";
import { IUserType } from "../utils/types";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

// Configuration
// Login persistence = 7 days. The access token itself lasts 7 days so a user
// stays logged in for a full week even without a refresh round-trip; the refresh
// token window matches, so the session is a clean, predictable 7-day lifetime.
// Both are env-overridable (ACCESS_TOKEN_EXPIRY_SECONDS / REFRESH_TOKEN_EXPIRY_DAYS).
const ACCESS_TOKEN_EXPIRY_SECONDS = parseInt(
  process.env.ACCESS_TOKEN_EXPIRY_SECONDS || String(7 * 24 * 60 * 60),
  10
); // default 7 days
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || "7", 10);
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "10", 10);

/**
 * Parse user-agent string into device info
 */
const parseUserAgent = (ua: string): { device_type: string; browser: string; os: string; device_name: string } => {
  let device_type = "desktop";
  let browser = "Unknown";
  let os = "Unknown";

  if (/mobile|android|iphone|ipad/i.test(ua)) device_type = "mobile";
  else if (/tablet|ipad/i.test(ua)) device_type = "tablet";

  if (/chrome/i.test(ua) && !/edge|opr/i.test(ua)) browser = "Chrome";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/edge/i.test(ua)) browser = "Edge";
  else if (/opr|opera/i.test(ua)) browser = "Opera";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";

  const device_name = `${browser} on ${os}`;
  return { device_type, browser, os, device_name };
};

/**
 * Generate a cryptographically secure refresh token
 */
const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

/**
 * Create a new session with access + refresh tokens
 */
export const createSession = async (
  user: IUserType,
  req: { ip?: string; headers: Record<string, string | string[] | undefined> }
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; session_id: number }> => {
  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
  if (!tokenSecret) throw new Error("ACCESS_TOKEN_SECRET not configured");

  const { password, telegram_id, ...userData } = user;

  // Generate tokens
  const accessToken = jwt.sign(userData, tokenSecret, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS } as jwt.SignOptions);
  const refreshToken = generateRefreshToken();

  // Parse request info
  const rawIp = (req.headers["x-forwarded-for"] as string) || req.ip || "Unknown";
  const ipAddress = rawIp.split(",")[0].trim().substring(0, 45);
  const userAgent = (req.headers["user-agent"] as string) || "Unknown";
  const { device_type, browser, os, device_name } = parseUserAgent(userAgent);

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
    session_token: String(accessToken).substring(String(accessToken).length - 32), // Store last 32 chars as fingerprint
    refresh_token: crypto.createHash("sha256").update(refreshToken).digest("hex"), // Store hashed
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
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS, // 7 days in seconds
    session_id: session.session_id,
  };
};

/**
 * Rotate refresh token — old token invalidated, new pair issued
 */
export const rotateRefreshToken = async (
  oldRefreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> => {
  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
  if (!tokenSecret) throw new Error("ACCESS_TOKEN_SECRET not configured");

  const hashedOldToken = crypto.createHash("sha256").update(oldRefreshToken).digest("hex");

  // Find session with this refresh token
  const session = await UserSession.findOne({
    where: {
      refresh_token: hashedOldToken,
      is_active: true,
      expires_at: { [Op.gt]: new Date() },
    },
  });

  if (!session) {
    userLogger.warn(`[Session] Refresh token rotation failed — token not found or expired`);
    return null;
  }

  // Fetch user data for new JWT
  const users = await sequelize.query<IUserType>(
    "SELECT * FROM tbl_user WHERE user_id = :userId",
    { replacements: { userId: session.user_id }, type: QueryTypes.SELECT }
  );

  if (!users.length) {
    userLogger.warn(`[Session] Refresh token rotation failed — user ${session.user_id} not found`);
    return null;
  }

  const { password, telegram_id, ...userData } = users[0];

  // Generate new tokens
  const newAccessToken = jwt.sign(userData, tokenSecret, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS } as jwt.SignOptions);
  const newRefreshToken = generateRefreshToken();
  const hashedNewRefreshToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

  // Update session with new tokens
  await session.update({
    session_token: String(newAccessToken).substring(String(newAccessToken).length - 32),
    refresh_token: hashedNewRefreshToken,
    last_activity: new Date(),
  });

  userLogger.info(`[Session] Rotated refresh token for user ${session.user_id}, session ${session.session_id}`);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  };
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

  userLogger.info(`[Session] Revoked session ${sessionId} for user ${userId} (reason: ${reason})`);
  return true;
};

/**
 * Revoke all sessions except the current one
 */
export const revokeAllOtherSessions = async (userId: number, currentSessionId?: number): Promise<number> => {
  const whereClause: Record<string, unknown> = {
    user_id: userId,
    is_active: true,
  };
  if (currentSessionId) {
    whereClause.session_id = { [Op.ne]: currentSessionId };
  }

  const [affectedCount] = await UserSession.update(
    {
      is_active: false,
      revoked_at: new Date(),
      revoke_reason: "revoke_all_others",
    },
    { where: whereClause }
  );

  userLogger.info(`[Session] Revoked ${affectedCount} other sessions for user ${userId}`);
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
  getLoginHistory,
  cleanupExpiredSessions,
};
