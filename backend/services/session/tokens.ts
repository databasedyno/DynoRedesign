/**
 * Session tokens — config, JWT/refresh-token minting and request fingerprinting.
 * Extracted from sessionService.ts to keep that module under the 500-line budget (R2).
 */
import { raw as envRaw } from "../../utils/config";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import UserSession from "../../models/securityModels/userSessionModel";
import { IUserType } from "../../utils/types";

// Login persistence = 7 days. The access token itself lasts 7 days so a user
// stays logged in for a full week even without a refresh round-trip; the refresh
// token window matches, so the session is a clean, predictable 7-day lifetime.
// Both are env-overridable (ACCESS_TOKEN_EXPIRY_SECONDS / REFRESH_TOKEN_EXPIRY_DAYS).
export const ACCESS_TOKEN_EXPIRY_SECONDS = parseInt(
  envRaw("ACCESS_TOKEN_EXPIRY_SECONDS") || String(7 * 24 * 60 * 60),
  10
);
export const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(envRaw("REFRESH_TOKEN_EXPIRY_DAYS") || "7", 10);
export const MAX_CONCURRENT_SESSIONS = parseInt(envRaw("MAX_CONCURRENT_SESSIONS") || "10", 10);

export type RequestInfo = { ip?: string; headers: Record<string, string | string[] | undefined> };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Parse user-agent string into device info */
export const parseUserAgent = (ua: string): { device_type: string; browser: string; os: string; device_name: string } => {
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

export const requestClientInfo = (req: RequestInfo) => {
  const rawIp = (req.headers["x-forwarded-for"] as string) || req.ip || "Unknown";
  const ipAddress = rawIp.split(",")[0].trim().substring(0, 45);
  const userAgent = (req.headers["user-agent"] as string) || "Unknown";
  return { ipAddress, userAgent, ...parseUserAgent(userAgent) };
};

/** Cryptographically secure refresh token */
export const generateRefreshToken = (): string => crypto.randomBytes(64).toString("hex");

/** Refresh tokens are stored hashed. */
export const hashRefreshToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/** Last 32 chars of the access token — what tbl_user_session.session_token stores. */
export const tokenFingerprint = (accessToken: string): string =>
  String(accessToken).substring(String(accessToken).length - 32);

export const signAccessToken = (user: IUserType): string => {
  const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
  if (!tokenSecret) throw new Error("ACCESS_TOKEN_SECRET not configured");
  const { password, telegram_id, ...userData } = user;
  return jwt.sign(userData, tokenSecret, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS } as jwt.SignOptions);
};

export const loadUserRow = async (userId: number | string): Promise<IUserType | null> => {
  const users = await sequelize.query<IUserType>(
    "SELECT * FROM tbl_user WHERE user_id = :userId",
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  return users[0] ?? null;
};

/** Mint a fresh access + refresh token pair for an existing session row (in place). */
export const rotateSessionTokens = async (session: UserSession, user: IUserType): Promise<TokenPair> => {
  const accessToken = signAccessToken(user);
  const refreshToken = generateRefreshToken();

  await session.update({
    session_token: tokenFingerprint(accessToken),
    refresh_token: hashRefreshToken(refreshToken),
    last_activity: new Date(),
  });

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
};
