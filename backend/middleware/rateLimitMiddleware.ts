import express from "express";
import { createHash } from "crypto";
import { redis } from "../utils/redisInstance";
import { apiLogger } from "../utils/loggers";
import { notifySuspiciousActivity } from "../services/securityAlertService";

/**
 * Redis sliding-window rate limiter.
 *
 * One atomic Lua round-trip per request: prune expired hits, count, and (if
 * under the limit) record the hit. The key always carries a TTL equal to the
 * window, so idle identifiers expire on their own instead of accumulating
 * forever (the previous GET/SET implementation left every key permanent and
 * was racy under concurrent bursts).
 */

interface RateLimitConfig {
  windowMs: number;       // Time window in milliseconds
  maxRequests: number;    // Max requests per window
}

// Default rate limits (can be overridden per API key)
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 60,        // 60 requests per minute
};

// KEYS[1]=zset  ARGV[1]=now(ms) ARGV[2]=windowMs ARGV[3]=max ARGV[4]=member
// Returns { allowed(1|0), count, oldestHitMs }
const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local max = tonumber(ARGV[3])
  redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
  local count = redis.call("ZCARD", key)
  local allowed = 0
  if count < max then
    redis.call("ZADD", key, now, ARGV[4])
    count = count + 1
    allowed = 1
  end
  redis.call("PEXPIRE", key, window)
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local oldestScore = now
  if oldest[2] then oldestScore = tonumber(oldest[2]) end
  return { allowed, count, oldestScore }
`;

/** Best-effort client IP (trust proxy is enabled in server.ts so req.ip is the real client). */
export const clientIp = (req: express.Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return req.ip || first?.trim() || req.socket.remoteAddress || "unknown";
};

/** Never place raw secrets (API keys) in Redis key names. */
const fingerprint = (secret: string) => createHash("sha256").update(secret).digest("hex").slice(0, 24);

let hitSeq = 0;
const getRateLimitKey = (identifier: string): string => `ratelimit:${identifier}`;

/**
 * Rate limit middleware factory
 * @param getIdentifier - Function to extract identifier from request (API key, IP, user ID)
 * @param getRateLimit - Optional function to get custom rate limit for identifier
 */
export const createRateLimiter = (
  getIdentifier: (req: express.Request) => string,
  getRateLimit?: (req: express.Request) => Promise<RateLimitConfig | null>,
  onLimited?: (req: express.Request, config: RateLimitConfig) => void
) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const identifier = getIdentifier(req);
      if (!identifier) {
        return next(); // Skip rate limiting if no identifier
      }

      const config = (getRateLimit && (await getRateLimit(req))) || DEFAULT_RATE_LIMIT;
      const now = Date.now();
      hitSeq = (hitSeq + 1) % 1_000_000;

      const [allowed, count, oldest] = (await redis.eval(SLIDING_WINDOW_SCRIPT, {
        keys: [getRateLimitKey(identifier)],
        arguments: [String(now), String(config.windowMs), String(config.maxRequests), `${now}-${process.pid}-${hitSeq}`],
      })) as [number, number, number];

      const resetAt = Math.ceil((Number(oldest) + config.windowMs) / 1000);

      if (allowed !== 1) {
        if (onLimited) onLimited(req, config); // consumer dedups (one alert per account per hour)
        const retryAfter = Math.max(1, Math.ceil((Number(oldest) + config.windowMs - now) / 1000));
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toString(),
          'Retry-After': retryAfter.toString(),
        });
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          retryAfter,
        });
      }

      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, config.maxRequests - Number(count)).toString(),
        'X-RateLimit-Reset': resetAt.toString(),
      });
      next();
    } catch (error) {
      // On Redis error, allow the request but log the error
      apiLogger.error('[RateLimit] Error checking rate limit:', error);
      next();
    }
  };
};

const fixedWindow = (windowMs: number, maxRequests: number) => async () => ({ windowMs, maxRequests });

/**
 * API Key rate limiter - uses rate limit from tbl_api table
 */
export const apiKeyRateLimiter = createRateLimiter(
  (req) => {
    // Get API key from header or query
    const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;
    return apiKey ? `api:${fingerprint(apiKey)}` : '';
  },
  async (req) => {
    // This can be enhanced to fetch rate limit from database
    // For now, use default or header-provided limit
    const customLimit = req.headers['x-rate-limit'] as string;
    if (customLimit) {
      const limit = parseInt(customLimit, 10);
      if (!isNaN(limit) && limit > 0) {
        return { windowMs: 60 * 1000, maxRequests: limit };
      }
    }
    return null;
  }
);

/**
 * IP-based rate limiter for public endpoints
 */
export const ipRateLimiter = createRateLimiter((req) => `ip:${clientIp(req)}`);

/**
 * Strict rate limiter for sensitive endpoints (login, password reset, etc.)
 * 20 attempts per 15 minutes
 */
export const strictRateLimiter = createRateLimiter(
  (req) => `strict:${clientIp(req)}`,
  fixedWindow(15 * 60 * 1000, 20)
);

/**
 * Login-specific rate limiter that tracks by both IP and email
 * This prevents brute force attacks on specific accounts
 */
const loginEmail = (req: express.Request) => String(req.body?.email || req.body?.data?.email || '').toLowerCase();

export const loginRateLimiter = createRateLimiter(
  (req) => `login:${clientIp(req)}:${loginEmail(req) || 'no-email'}`,
  fixedWindow(15 * 60 * 1000, 20),
  (req, config) => {
    const email = loginEmail(req);
    if (email) void notifySuspiciousActivity({ email, event: "login_rate_limit", ip: clientIp(req), attempts: config.maxRequests });
  }
);

/**
 * Moderate rate limiter for registration and social auth
 * 30 attempts per 15 minutes
 */
export const moderateRateLimiter = createRateLimiter(
  (req) => `moderate:${clientIp(req)}`,
  fixedWindow(15 * 60 * 1000, 30)
);

/**
 * OTP rate limiter - tracks by phone/email to prevent OTP spam
 */
export const otpRateLimiter = createRateLimiter(
  (req) => {
    const contact = String(req.body?.email || req.body?.phone || req.body?.data?.email || req.body?.data?.phone || 'no-contact').toLowerCase();
    return `otp:${clientIp(req)}:${contact}`;
  },
  fixedWindow(15 * 60 * 1000, 10)
);

/**
 * Webhook rate limiter — more lenient than strictRateLimiter because blockchain
 * providers can send bursts of webhooks (e.g., Tatum catching up after downtime).
 * 200 requests per 5 minutes per IP.
 */
export const webhookRateLimiter = createRateLimiter(
  (req) => `webhook:${clientIp(req)}`,
  fixedWindow(5 * 60 * 1000, 200)
);

/**
 * Payment rate limiter — applies to customer-facing payment endpoints
 * (getData, addPayment, createCryptoPayment, getCurrencyRates).
 * 30 requests per minute per IP.
 */
export const paymentRateLimiter = createRateLimiter(
  (req) => `payment:${clientIp(req)}`,
  fixedWindow(60 * 1000, 30)
);

/**
 * Sandbox rate limiter — for the public homepage playground endpoints
 * (POST /api/public/sandbox/*). 10 requests per minute per IP.
 * These endpoints never touch the DB — they return in-memory stub responses.
 */
export const sandboxRateLimiter = createRateLimiter(
  (req) => `sandbox:${clientIp(req)}`,
  fixedWindow(60 * 1000, 10)
);

export default {
  createRateLimiter,
  apiKeyRateLimiter,
  ipRateLimiter,
  strictRateLimiter,
  loginRateLimiter,
  moderateRateLimiter,
  otpRateLimiter,
  webhookRateLimiter,
  paymentRateLimiter,
  sandboxRateLimiter,
};
