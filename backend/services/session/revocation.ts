/**
 * Session revocation enforcement (bugs #7/#8 + cross-device sign-out).
 *
 * A session's access token = a self-contained 7-day JWT that authMiddleware can't
 * "un-sign". Two complementary mechanisms make a signed-out device stop working
 * on its NEXT request:
 *
 *  1. Per-token Redis marker keyed by the token fingerprint (last 32 chars, the
 *     same value stored in tbl_user_session.session_token) — single-device revoke.
 *  2. Account-wide cutoff tbl_user.tokens_valid_after — any JWT with `iat` before
 *     it is rejected regardless of how it was minted, UNLESS it still maps to an
 *     ACTIVE session row (the device that clicked "sign out all others").
 *
 * Extracted from sessionService.ts to keep that module under the 500-line budget (R2).
 */
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import UserSession from "../../models/securityModels/userSessionModel";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../../utils/redisInstance";
import { ACCESS_TOKEN_EXPIRY_SECONDS } from "./tokens";

export const revokedSessionKey = (userId: number | string, tokenSuffix: string) =>
  `sess-revoked:${userId}:${tokenSuffix}`;

/**
 * Short-lived cache for "this pre-cutoff token belongs to a still-active
 * session" (see isKeptSession). Short TTL so a later revoke propagates within
 * a minute even if the Redis marker write failed at revoke time.
 */
const keptSessionKey = (userId: number | string, tokenSuffix: string) =>
  `sess-kept:${userId}:${tokenSuffix}`;
const KEPT_CACHE_TTL_SECONDS = 60;

export const markSessionRevokedInRedis = async (
  userId: number | string,
  tokenSuffix?: string | null,
  expiresAt?: Date | string | null,
): Promise<void> => {
  if (!tokenSuffix) return;
  try {
    const now = Date.now();
    const expMs = expiresAt ? new Date(expiresAt).getTime() : now + ACCESS_TOKEN_EXPIRY_SECONDS * 1000;
    const ttl = Math.max(1, Math.min(ACCESS_TOKEN_EXPIRY_SECONDS, Math.floor((expMs - now) / 1000)));
    await setRedisItemWithTTL(revokedSessionKey(userId, tokenSuffix), { revoked: true }, ttl);
    await deleteRedisItem(keptSessionKey(userId, tokenSuffix));
  } catch {
    // Non-critical: isSessionRevoked also treats a matching inactive row as revoked.
  }
};

/**
 * True when the token fingerprint has been explicitly revoked. On a Redis
 * outage falls back to the session table (a matching INACTIVE row = revoked)
 * so revocation never silently stops working on infra hiccups.
 */
export const isSessionRevoked = async (
  userId: number | string,
  tokenSuffix?: string | null,
): Promise<boolean> => {
  if (!tokenSuffix) return false;
  try {
    const v = await getRedisItem(revokedSessionKey(userId, tokenSuffix));
    return !!(v && (v.revoked === true || v.revoked === "true"));
  } catch {
    try {
      const row = await UserSession.findOne({
        where: { user_id: userId, session_token: tokenSuffix },
        attributes: ["is_active"],
      });
      return !!row && row.dataValues.is_active === false;
    } catch {
      return false;
    }
  }
};

/**
 * A token issued BEFORE the user's account-wide cutoff is still honoured when
 * it belongs to an ACTIVE session row — that is how the device that clicked
 * "sign out all others" stays signed in. Everything else pre-cutoff is dead.
 */
export const isKeptSession = async (
  userId: number | string,
  tokenSuffix?: string | null,
): Promise<boolean> => {
  if (!tokenSuffix) return false;
  const key = keptSessionKey(userId, tokenSuffix);
  try {
    const v = await getRedisItem(key);
    if (v && (v.kept === true || v.kept === "true")) return true;
  } catch {
    // Redis unavailable — DB below is authoritative.
  }
  const row = await UserSession.findOne({
    where: { user_id: userId, session_token: tokenSuffix, is_active: true },
    attributes: ["session_id"],
  });
  if (!row) return false;
  try {
    await setRedisItemWithTTL(key, { kept: true }, KEPT_CACHE_TTL_SECONDS);
  } catch {
    // Non-critical.
  }
  return true;
};

/**
 * Move the user's account-wide token cutoff to NOW (whole-second so it lines up
 * with the JWT `iat` check in authMiddleware). Every access token issued before
 * this instant — by ANY login path, with or without a session row — is rejected
 * on its next request unless it is a kept session (isKeptSession). The auth
 * cache is invalidated so it takes effect immediately.
 */
export const setTokensValidAfterNow = async (userId: number | string): Promise<Date> => {
  const cutoff = new Date(Math.floor(Date.now() / 1000) * 1000);
  await sequelize.query(
    "UPDATE tbl_user SET tokens_valid_after = :cutoff WHERE user_id = :userId",
    { replacements: { cutoff, userId }, type: QueryTypes.UPDATE },
  );
  const { invalidateUserAuthCache } = await import("../../middleware/authMiddleware");
  await invalidateUserAuthCache(userId);
  return cutoff;
};
