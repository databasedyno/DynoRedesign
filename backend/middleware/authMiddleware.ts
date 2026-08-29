import { raw as envRaw } from "../utils/config";
import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";

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
}

const resolveAuthUser = async (userId: number | string): Promise<AuthUserInfo | null> => {
  const key = authCacheKey(userId);
  try {
    const cached = await getRedisItem(key);
    // Only trust the cache if it carries the newer shape (has the `email`
    // field). Legacy `{ exists: true }` entries are re-fetched so a verified
    // user is never wrongly gated right after deploy.
    if (cached && cached.exists && "email" in cached) {
      return {
        exists: true,
        email: cached.email ?? null,
        email_verified: cached.email_verified === true || cached.email_verified === "true",
      };
    }
  } catch {
    // Redis unavailable — fall through to DB so auth never depends on cache.
  }

  const user = await userModel.findOne({
    where: { user_id: userId },
    attributes: ["user_id", "email", "email_verified"],
  });
  if (!user) return null;

  const info: AuthUserInfo = {
    exists: true,
    email: (user.dataValues.email ?? null) as string | null,
    email_verified: user.dataValues.email_verified === true,
  };

  try {
    await setRedisItemWithTTL(key, info, AUTH_CACHE_TTL_SECONDS);
  } catch {
    // Non-critical — proceed without caching.
  }
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
    
    // Import companyModel here to avoid circular dependency
    const { companyModel } = require("../models");
    
    // Verify the user owns this company
    const company = await companyModel.findOne({
      where: {
        company_id: parsedCompanyId,
        user_id: userData.user_id,
      },
    });
    
    if (!company) {
      apiLogger.info(`[CompanyOwnership] ❌ User ${userData.user_id} does not own company ${parsedCompanyId}`);
      return errorResponseHelper(res, 403, "You do not have access to this company");
    }
    
    // Store validated company in res.locals for use in controllers
    res.locals.validatedCompany = company.dataValues;
    
    next();
  } catch (e: unknown) {
    apiLogger.info("Company Ownership Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default authMiddleware;
export { companyOwnershipMiddleware };
