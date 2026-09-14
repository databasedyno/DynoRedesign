import { raw as envRaw } from "../utils/config";
import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { isSessionRevoked, isKeptSession } from "../services/sessionService";

// P1 perf: cache the per-request user lookup in Redis (60s TTL) so authenticated
// requests skip a userModel.findOne DB round-trip. Stores existence PLUS the
// email / email_verified fields so emailVerifiedMiddleware can gate routes from
// the SAME cache entry instead of its own per-request DB query (see B2).
// Invalidated on account deletion AND whenever email/email_verified changes.
const AUTH_CACHE_TTL_SECONDS = 60;
const authCacheKey = (userId: number | string) => `auth:user:${userId}`;

export interface AuthUserInfo {
  exists: true;
  email: string | null;
  email_verified: boolean;
  /** ISO instant; access tokens with `iat` before it are rejected (sign-out-all-devices). */
  tokens_valid_after: string | null;
}

/** True when the JWT was issued before the user's account-wide token cutoff. */
export const isTokenIssuedBeforeCutoff = (iat?: number, cutoff?: string | null): boolean => {
  if (!iat || !cutoff) return false;
  const cutoffSec = Math.floor(new Date(cutoff).getTime() / 1000);
  return Number.isFinite(cutoffSec) && iat < cutoffSec;
};

const resolveAuthUser = async (userId: number | string): Promise<AuthUserInfo | null> => {
  const key = authCacheKey(userId);
  try {
    const cached = await getRedisItem(key);
    // Only trust the cache if it carries the newest shape (has the `email` and
    // `tokens_valid_after` fields). Older entries are re-fetched so a verified
    // user is never wrongly gated right after deploy.
    if (cached && cached.exists && "email" in cached && "tokens_valid_after" in cached && "deleted" in cached) {
      // A soft-deleted account is treated as "gone" for all authenticated
      // requests — the live JWT is rejected on the next call (they're logged out).
      if (cached.deleted === true || cached.deleted === "true") return null;
      return {
        exists: true,
        email: cached.email ?? null,
        email_verified: cached.email_verified === true || cached.email_verified === "true",
        tokens_valid_after: cached.tokens_valid_after ?? null,
      };
    }
  } catch {
    // Redis unavailable — fall through to DB so auth never depends on cache.
  }

  const user = await userModel.findOne({
    where: { user_id: userId },
    attributes: ["user_id", "email", "email_verified", "tokens_valid_after", "deleted_at"],
  });
  if (!user) return null;

  const cutoff = user.dataValues.tokens_valid_after as Date | string | null | undefined;
  const deleted = Boolean(user.dataValues.deleted_at);
  const info: AuthUserInfo = {
    exists: true,
    email: (user.dataValues.email ?? null) as string | null,
    email_verified: user.dataValues.email_verified === true,
    tokens_valid_after: cutoff ? new Date(cutoff).toISOString() : null,
  };

  try {
    await setRedisItemWithTTL(key, { ...info, deleted }, AUTH_CACHE_TTL_SECONDS);
  } catch {
    // Non-critical — proceed without caching.
  }
  // Soft-deleted accounts must not resolve — the caller gets a 401 and is
  // effectively signed out until an admin restores the account.
  if (deleted) return null;
  return info;
};

/**
 * Invalidate the cached auth entry. Call on account deletion AND whenever a
 * user's email or email_verified flag changes so the emailVerifiedMiddleware
 * gate reflects the change immediately.
 */
export const invalidateUserAuthCache = async (userId: number | string): Promise<void> => {
  try {
    await deleteRedisItem(authCacheKey(userId));
  } catch {
    // Non-critical.
  }
};

const authMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader?.split(" ")[1];
    
    if (!token) {
      return errorResponseHelper(res, 401, "Authentication required. Please provide a valid token.");
    }
    
    const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
    if (!tokenSecret) {
      return errorResponseHelper(res, 500, "Server configuration error. Token secret not set.");
    }
    
    try {
      // Verify token synchronously or using promisified version
      const decoded = jwt.verify(token, tokenSecret) as IUserType & { exp?: number; iat?: number; type?: string };
      
      // Debug logging (redacted — no sensitive data)
      // apiLogger.info("Auth Middleware - Token validated for user_id:", decoded.user_id);
      
      // Check token type - customer tokens have 'id', user tokens have 'user_id'
      if (decoded.id && !decoded.user_id) {
        return errorResponseHelper(res, 401, "This endpoint requires user authentication. Please login with a user account, not a customer account.");
      }
      
      // Check if decoded token has user_id
      if (!decoded || !decoded.user_id) {
        return errorResponseHelper(res, 401, "Invalid token format. Please login again.");
      }
      
      // Resolve the user (Redis-cached, 60s TTL — see resolveAuthUser). Carries
      // existence + email/email_verified so downstream middleware/controllers
      // don't need their own DB round-trip.
      const authUser = await resolveAuthUser(decoded.user_id);

      if (!authUser) {
        return errorResponseHelper(res, 401, "User account does not exist. Please login again.");
      }

      // Account-wide cutoff ("sign out all other devices" / "sign out
      // everywhere"): any token issued before it is dead — no matter which
      // login path minted it or whether a session row exists — UNLESS it is
      // the caller's own still-active session (the device that clicked the
      // button). DB-backed via resolveAuthUser (cache invalidated on change).
      const tokenSuffix = token.length >= 32 ? token.slice(-32) : token;
      if (
        isTokenIssuedBeforeCutoff(decoded.iat, authUser.tokens_valid_after) &&
        !(await isKeptSession(decoded.user_id, tokenSuffix))
      ) {
        return errorResponseHelper(res, 401, "Your session was signed out. Please login again.");
      }

      // Session revocation enforcement (bugs #7/#8): if THIS device's session
      // was signed out ("Sign out" / "Sign out all others"), reject on the next
      // request. Matched by the token fingerprint (last 32 chars). Tokens with
      // no matching revoked marker are allowed (backward-compatible for tokens
      // issued before session tracking, and for the caller's own kept session).
      if (await isSessionRevoked(decoded.user_id, tokenSuffix)) {
        return errorResponseHelper(res, 401, "Your session was signed out. Please login again.");
      }

      // Store token in res.locals for use in controllers
      res.locals.token = token;
      res.locals.user = decoded;
      res.locals.authUser = authUser;
      
      next();
    } catch (err: unknown) {
      // Handle JWT-specific errors
      const error = err as { name?: string };
      if (error.name === 'TokenExpiredError') {
        return errorResponseHelper(res, 401, "Token has expired. Please login again.");
      } else if (error.name === 'JsonWebTokenError') {
        return errorResponseHelper(res, 401, "Invalid token. Please login again.");
      } else if (error.name === 'NotBeforeError') {
        return errorResponseHelper(res, 401, "Token not active yet. Please try again later.");
      } else {
        throw err; // Re-throw to be caught by outer catch
      }
    }
  } catch (e: unknown) {
    apiLogger.info("Auth Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Middleware to validate company ownership
 * Ensures the authenticated user owns the company_id in request params/body/query
 */
const companyOwnershipMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const userData = res.locals.user as IUserType;
    
    // Get company_id from various sources
    const companyId = req.params.id || req.params.company_id || 
                      req.body.company_id || req.query.company_id;
    
    // If no company_id provided, skip validation (some endpoints don't need it)
    if (!companyId) {
      return next();
    }
    
    const parsedCompanyId = parseInt(companyId as string);
    if (isNaN(parsedCompanyId)) {
      return errorResponseHelper(res, 400, "Invalid company_id format");
    }
    
    // Import here to avoid circular dependency
    const { companyModel } = require("../models");
    const { resolveMembership, defaultPermissionsForRole } = require("../utils/permissions");
    
    const company = await companyModel.findOne({
      where: {
        company_id: parsedCompanyId,
      },
    });
    
    // No such company -> no access (preserves the prior 403 semantics).
    if (!company) {
      apiLogger.info(`[CompanyOwnership] ❌ User ${userData.user_id} does not have access to company ${parsedCompanyId}`);
      return errorResponseHelper(res, 403, "You do not have access to this brand");
    }
    
    const uid = Number(userData.user_id);
    const ownerId = Number(company.dataValues.user_id);
    
    // Owner fast-path — behaviour identical to before (full access, no gating).
    if (ownerId === uid) {
      res.locals.validatedCompany = company.dataValues;
      res.locals.membership = {
        isOwner: true,
        role: "owner",
        permissions: defaultPermissionsForRole("owner"),
        companyId: parsedCompanyId,
        userId: uid,
        ownerUserId: uid,
      };
      return next();
    }
    
    // RBAC Phase 3: active team members get company ACCESS here; what they may
    // actually DO is enforced downstream by requirePermission / requireCompanyOwner.
    const membership = await resolveMembership(uid, parsedCompanyId);
    if (membership) {
      res.locals.validatedCompany = company.dataValues;
      res.locals.membership = membership;
      return next();
    }
    
    apiLogger.info(`[CompanyOwnership] ❌ User ${uid} does not have access to company ${parsedCompanyId}`);
    return errorResponseHelper(res, 403, "You do not have access to this brand");
    
  } catch (e: unknown) {
    apiLogger.info("Company Ownership Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default authMiddleware;
export { companyOwnershipMiddleware };
