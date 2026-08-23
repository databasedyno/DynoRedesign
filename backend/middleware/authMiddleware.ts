import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";

// P1 perf: cache the per-request "does this user still exist?" check in Redis
// (60s TTL) so authenticated requests skip a userModel.findOne DB round-trip.
// Existence-only (matches the check below); invalidated on account deletion.
const AUTH_CACHE_TTL_SECONDS = 60;
const authCacheKey = (userId: number | string) => `auth:user:${userId}`;

const userAccountExists = async (userId: number | string): Promise<boolean> => {
  const key = authCacheKey(userId);
  try {
    const cached = await getRedisItem(key);
    if (cached && cached.exists) return true;
  } catch {
    // Redis unavailable — fall through to DB so auth never depends on cache.
  }

  const userExists = await userModel.findOne({ where: { user_id: userId } });
  if (!userExists) return false;

  try {
    await setRedisItemWithTTL(key, { exists: true }, AUTH_CACHE_TTL_SECONDS);
  } catch {
    // Non-critical — proceed without caching.
  }
  return true;
};

/** Invalidate the cached existence entry (call on account deletion). */
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
    
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
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
      
      // Check if user exists (Redis-cached, 60s TTL — see userAccountExists)
      const userExists = await userAccountExists(decoded.user_id);

      if (!userExists) {
        return errorResponseHelper(res, 401, "User account does not exist. Please login again.");
      }
      
      // Store token in res.locals for use in controllers
      res.locals.token = token;
      res.locals.user = decoded;
      
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
