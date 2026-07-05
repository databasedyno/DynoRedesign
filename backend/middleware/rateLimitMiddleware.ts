import express from "express";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import { apiLogger } from "../utils/loggers";

/**
 * Rate limiting middleware that enforces API rate limits stored in the database
 * Uses Redis for tracking request counts with sliding window
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

/**
 * Create rate limit key for Redis
 */
const getRateLimitKey = (identifier: string): string => {
  return `ratelimit:${identifier}`;
};

/**
 * Rate limit middleware factory
 * @param getIdentifier - Function to extract identifier from request (API key, IP, user ID)
 * @param getRateLimit - Optional function to get custom rate limit for identifier
 */
export const createRateLimiter = (
  getIdentifier: (req: express.Request) => string,
  getRateLimit?: (req: express.Request) => Promise<RateLimitConfig | null>
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

      // Get rate limit config (custom or default)
      let config = DEFAULT_RATE_LIMIT;
      if (getRateLimit) {
        const customConfig = await getRateLimit(req);
        if (customConfig) {
          config = customConfig;
        }
      }

      const key = getRateLimitKey(identifier);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Get current rate limit data from Redis
      const rateLimitData = await getRedisItem(key);
      
      let requests: number[] = [];
      if (rateLimitData && Array.isArray(rateLimitData.requests)) {
        // Filter out requests outside the current window
        requests = rateLimitData.requests.filter((timestamp: number) => timestamp > windowStart);
      }

      // Check if rate limit exceeded
      if (requests.length >= config.maxRequests) {
        const oldestRequest = Math.min(...requests);
        const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
        
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil((oldestRequest + config.windowMs) / 1000).toString(),
          'Retry-After': retryAfter.toString(),
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
          retryAfter,
        });
      }

      // Add current request timestamp
      requests.push(now);

      // Store updated rate limit data with TTL
      await setRedisItem(key, { requests });

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': (config.maxRequests - requests.length).toString(),
        'X-RateLimit-Reset': Math.ceil((now + config.windowMs) / 1000).toString(),
      });

      next();
    } catch (error) {
      // On Redis error, allow the request but log the error
      apiLogger.error('[RateLimit] Error checking rate limit:', error);
      next();
    }
  };
};

/**
 * API Key rate limiter - uses rate limit from tbl_api table
 */
export const apiKeyRateLimiter = createRateLimiter(
  (req) => {
    // Get API key from header or query
    const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;
    return apiKey ? `api:${apiKey}` : '';
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
export const ipRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.socket.remoteAddress || 
               'unknown';
    return `ip:${ip}`;
  }
);

/**
 * Strict rate limiter for sensitive endpoints (login, password reset, etc.)
 * 20 attempts per 15 minutes
 */
export const strictRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.socket.remoteAddress || 
               'unknown';
    return `strict:${ip}`;
  },
  async () => ({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 20,            // 20 attempts per 15 minutes
  })
);

/**
 * Login-specific rate limiter that tracks by both IP and email
 * This prevents brute force attacks on specific accounts
 */
export const loginRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.socket.remoteAddress || 
               'unknown';
    const email = req.body?.email || req.body?.data?.email || 'no-email';
    return `login:${ip}:${email}`;
  },
  async () => ({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 20,            // 20 login attempts per email per IP per 15 minutes
  })
);

/**
 * Moderate rate limiter for registration and social auth
 * 30 attempts per 15 minutes
 */
export const moderateRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.socket.remoteAddress || 
               'unknown';
    return `moderate:${ip}`;
  },
  async () => ({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 30,            // 30 attempts per 15 minutes
  })
);

/**
 * OTP rate limiter - tracks by phone/email to prevent OTP spam
 */
export const otpRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip || 
               req.headers['x-forwarded-for'] as string || 
               req.socket.remoteAddress || 
               'unknown';
    const contact = req.body?.email || req.body?.phone || req.body?.data?.email || req.body?.data?.phone || 'no-contact';
    return `otp:${ip}:${contact}`;
  },
  async () => ({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 10,            // 10 OTP requests per contact per 15 minutes
  })
);

/**
 * Webhook rate limiter — more lenient than strictRateLimiter because blockchain
 * providers can send bursts of webhooks (e.g., Tatum catching up after downtime).
 * 200 requests per 5 minutes per IP.
 */
export const webhookRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip ||
               req.headers['x-forwarded-for'] as string ||
               req.socket.remoteAddress ||
               'unknown';
    return `webhook:${ip}`;
  },
  async () => ({
    windowMs: 5 * 60 * 1000,   // 5 minutes
    maxRequests: 200,           // 200 webhook events per IP per 5 minutes
  })
);

/**
 * Payment rate limiter — applies to customer-facing payment endpoints
 * (getData, addPayment, createCryptoPayment, getCurrencyRates).
 * 30 requests per minute per customer token.
 */
export const paymentRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip ||
               req.headers['x-forwarded-for'] as string ||
               req.socket.remoteAddress ||
               'unknown';
    return `payment:${ip}`;
  },
  async () => ({
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 30,            // 30 payment-related requests per IP per minute
  })
);

/**
 * Sandbox rate limiter — for the public homepage playground endpoints
 * (POST /api/public/sandbox/*). 10 requests per minute per IP.
 * These endpoints never touch the DB — they return in-memory stub responses.
 */
export const sandboxRateLimiter = createRateLimiter(
  (req) => {
    const ip = req.ip ||
               req.headers['x-forwarded-for'] as string ||
               req.socket.remoteAddress ||
               'unknown';
    return `sandbox:${ip}`;
  },
  async () => ({
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 10,            // 10 sandbox requests per IP per minute
  })
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
