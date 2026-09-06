import axios from "axios";
import express from "express";
import sequelize from "./dbInstance";
import { apiLogger } from "./loggers";

/**
 * Extract the REAL client IP from a request.
 *
 * Behind the k8s ingress / proxy chain, `x-forwarded-for` is a comma-separated
 * list "client, proxy1, proxy2". The FIRST entry is the originating client, so
 * we must never store the whole chain (that was the last_login_ip bug). This
 * matches the parsing already used by the password + OTP login paths
 * (controller/user/authLogin.ts, userShared.ts).
 */
export const getClientIp = (req: express.Request): string => {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff)
    ? xff[0]
    : typeof xff === "string"
      ? xff.split(",")[0]
      : "";
  const ip = (first || req.ip || req.socket?.remoteAddress || "Unknown").toString().trim();
  return ip.substring(0, 45) || "Unknown";
};

// Loopback / RFC1918 / CGNAT / link-local / IPv6 ULA — can't be geo-located.
const INTERNAL_IP_RE =
  /^(::1$|::ffff:127\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fc|fd|fe[89ab])/i;

/** Is this an internal / loopback / private IP that can't be geo-located? */
export const isInternalIp = (ip: string): boolean =>
  !ip || ip === "Unknown" || INTERNAL_IP_RE.test(ip);

/**
 * Best-effort country lookup via the free ip-api.com endpoint (no API key —
 * the same provider already used by the login geo-locator). Returns the
 * country NAME (e.g. "United States") or null on any failure. Never throws.
 */
export const lookupCountry = async (ip: string): Promise<string | null> => {
  if (isInternalIp(ip)) return null;
  try {
    const res = await axios.get(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country`,
      { timeout: 3000 },
    );
    if (res.data && res.data.status === "success" && res.data.country) {
      return String(res.data.country).substring(0, 64);
    }
  } catch (e) {
    apiLogger.info(`[clientContext] country lookup failed for ${ip}: ${(e as Error).message}`);
  }
  return null;
};

/**
 * Capture signup IP + country on tbl_user, NON-BLOCKING.
 *
 * Fire-and-forget: the IP is parsed synchronously and both fields are written
 * after the response is flushed (setImmediate), so signup latency is unchanged
 * and a slow / unreachable geo provider can never hold up account creation.
 * Only fills the columns when they are still empty, so a later login can never
 * overwrite the original signup fingerprint.
 */
export const captureSignupContext = (userId: number, req: express.Request): void => {
  const ip = getClientIp(req);
  setImmediate(async () => {
    try {
      const country = await lookupCountry(ip);
      await sequelize.query(
        `UPDATE tbl_user
            SET signup_ip = :ip,
                signup_country = :country
          WHERE user_id = :userId
            AND (signup_ip IS NULL OR signup_ip = '')`,
        { replacements: { ip, country, userId } },
      );
      apiLogger.info(
        `[clientContext] signup context captured for user_id=${userId} ip=${ip} country=${country || "unknown"}`,
      );
    } catch (e) {
      apiLogger.error(
        `[clientContext] failed to capture signup context for user_id=${userId}: ${(e as Error).message}`,
      );
    }
  });
};
