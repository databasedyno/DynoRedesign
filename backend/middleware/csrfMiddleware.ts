/**
 * CSRF Protection Middleware
 * 
 * Implements Double Submit Cookie pattern for state-changing requests.
 * 
 * For JWT-based APIs (Authorization header), CSRF is inherently mitigated
 * because browsers don't auto-send Authorization headers cross-origin.
 * 
 * This middleware adds an extra layer for scenarios where cookies might
 * be used (e.g., refresh tokens via cookies in future).
 * 
 * Behavior:
 * - GET /api/csrf-token → Sets CSRF cookie + returns token
 * - All state-changing requests (POST/PUT/DELETE/PATCH) check:
 *   1. If Bearer token in Authorization header → SKIP (JWT-based, safe)
 *   2. If no Bearer token → Verify CSRF token in header matches cookie
 * 
 * Exemptions:
 * - Webhook endpoints (Tatum, external)
 * - API key-authenticated endpoints (x-api-key header)
 * - Health check
 */
import { raw as envRaw } from "../utils/config";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { apiLogger } from "../utils/loggers";

const CSRF_COOKIE_NAME = "dynopay_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_EXPIRY_HOURS = 24;

// Paths that are exempt from CSRF checks
const EXEMPT_PATHS = [
  "/health",
  "/api/__paytest",
  "/api/v1/webhook",
  "/api/webhook",
  "/api/tatum-webhook",
  "/api/tatum-crypto-webhook",
  "/api/failed_webhook",
  "/api/veriff",
  "/api/kyc/webhook",
  "/api/kb/webhook",
  // Public "Was this article helpful?" feedback — anonymous & fire-and-forget:
  // only inserts a vote row / increments a counter (no auth, no funds, no PII).
  // Same rationale as /api/track/visitor. Covers both the id- and slug-based
  // feedback routes; the only write under /api/kb/articles/ is feedback (admin
  // article writes live under /api/kb/admin/).
  "/api/kb/articles/",
  "/api/support/chat",
  "/api/admin/login",
  "/api/user/login",
  "/api/team/accept",
  "/api/user/registerUser",
  "/api/user/registerPhone",
  "/api/user/registerEmail",
  "/api/user/phone-type-check",
  "/api/user/google-signin",
  "/api/user/github-signin",
  "/api/user/facebook-signin",
  "/api/user/refresh-token",
  "/api/user/forgot-password",
  "/api/user/reset-password",
  "/api/user/generateOTP",
  "/api/user/confirmOTP",
  "/api/user/checkPhone",
  "/api/user/verifyLoginOTP",
  "/api/user/resendLoginOTP",
  "/api/user/verify-login-otp",
  "/api/user/resend-login-otp",
  "/api/user/2fa/validate",
  "/api/events/stream",
  // Public checkout endpoints — called cross-origin by hosted checkout frontend
  // before any auth token is available. Protected by their own auth middleware after getData.
  "/api/pay/getData",
  "/api/pay/startDonation",
  "/api/pay/tip",
  "/api/pay/calculateFees",
  "/api/pay/calculate-payment",
  "/api/pay/network-fees",
  "/api/pay/encrypt-payload",
  // Creator handle reservation — public, IP rate-limited. Called from the landing
  // page before any auth/CSRF cookie exists; only creates a short-lived Redis lock
  // (no user credentials/cookies involved), so there is no CSRF risk.
  "/api/user/creator/reserve-handle",
  // Visitor tracking — public, rate-limited, fire-and-forget from landing page
  "/api/track/visitor",
  // Security: Flag suspicious login — public, uses one-time security token from email
  "/api/user/security/flag-login",
  // Sandbox playground endpoint — public, rate-limited, returns ephemeral in-memory
  // stub responses (never touches DB). Used by the homepage curl snippet.
  "/api/public/sandbox",
  // Product Catalog (Phase 1) — public cart / checkout / order-status endpoints.
  // Same rationale as `/api/pay/getData`: buyers hit these anonymously before
  // any session token exists. Rate-limited via paymentRateLimiter.
  "/api/cart",
  "/api/checkout",
  "/api/order/",
  // Crypto Refund Flow — public checkout capture of the customer's refund
  // destination address (no auth/session yet). Keyed by the unguessable order
  // public_ref / link id; only stores an address (no funds move here).
  "/api/refunds/capture-address",
  // Wallet security "this wasn't me" revert — public, uses a one-time
  // unguessable token from the change-alert email (no session/cookie exists
  // when opened from an inbox). Token itself authenticates the request.
  "/api/wallet-security/revert-change",
  // QA Quality Center — passcode-gated internal tool. Auth is the shared
  // passcode header (x-qa-passcode), not a session cookie, so CSRF does not apply.
  "/api/quality",
];

/**
 * Generate CSRF token
 */
export const generateCsrfToken = (_req: Request, res: Response): void => {
  const token = crypto.randomBytes(32).toString("hex");

  // Set cookie (httpOnly: false so JavaScript can read it)
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: envRaw("NODE_ENV") === "production",
    sameSite: "strict",
    maxAge: CSRF_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    path: "/",
  });

  res.json({ csrf_token: token });
};

/**
 * CSRF verification middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip exempt paths (normalize double-slashes from proxy/baseURL issues)
  const path = req.path.replace(/\/+/g, "/").toLowerCase();
  if (EXEMPT_PATHS.some((exempt) => path.startsWith(exempt.toLowerCase()))) {
    return next();
  }

  // Skip if JWT Bearer token present (browser doesn't auto-send these)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return next();
  }

  // Skip if API key authentication
  if (req.headers["x-api-key"]) {
    return next();
  }

  // Skip if PUBLISHABLE key authentication (Buy Button — cross-origin browser
  // calls that can never carry a CSRF cookie). The pk itself acts as the
  // capability token; origin allow-listing + amount cap enforce the security.
  if (req.headers["x-publishable-key"]) {
    return next();
  }

  // For cookie-based auth — verify CSRF token
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    apiLogger.warn(`[CSRF] Blocked request to ${req.path} from ${req.ip} — token mismatch`);
    res.status(403).json({ error: "CSRF token validation failed" });
    return;
  }

  next();
};

export default { generateCsrfToken, csrfProtection };
