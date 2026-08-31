import { raw as envRaw } from "../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { IUserType } from "../utils/types";
import { apiLogger } from "../utils/loggers";
import { validateApiKey } from "./legacyApiAuthMiddleware";

/**
 * Combined middleware that supports both admin JWT auth and API key auth
 * Used for endpoints that should be accessible from both admin dashboard and merchant API
 */
const adminOrApiKeyMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const apiKey = req.headers["x-api-key"] as string;

    // Try API key first
    if (apiKey) {
      try {
        const apiKeyData = await validateApiKey(apiKey);
        if (apiKeyData) {
          res.locals.apiKeyData = apiKeyData;
          res.locals.authType = "api_key";
          res.locals.company_id = apiKeyData.company_id;
          res.locals.user_id = apiKeyData.adm_id;
          return next();
        }
      } catch (err) {
        apiLogger.error("API key validation error:", err);
      }
    }

    // Try admin JWT
    const token = authHeader && authHeader?.split(" ")[1];
    if (!token) {
      return errorResponseHelper(res, 401, "Authentication required. Provide either x-api-key header or admin JWT token.");
    }

    const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
    if (!tokenSecret) {
      return errorResponseHelper(res, 500, "Server configuration error. Token secret not set.");
    }

    try {
      const decoded = jwt.verify(token, tokenSecret) as IUserType;
      
      if (!decoded) {
        return errorResponseHelper(res, 401, "Invalid token format");
      }

      // Check if user has admin role
      if (!decoded.role || decoded.role !== "ADMIN") {
        return errorResponseHelper(res, 403, "Admin access required. You do not have permission.");
      }

      res.locals.token = token;
      res.locals.user = decoded;
      res.locals.authType = "admin_jwt";
      
      next();
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error.name === 'TokenExpiredError') {
        return errorResponseHelper(res, 401, "Your Login has Expired");
      } else if (error.name === 'JsonWebTokenError') {
        return errorResponseHelper(res, 401, "Invalid token. Please login again.");
      } else if (error.name === 'NotBeforeError') {
        return errorResponseHelper(res, 401, "Token not active yet. Please try again later.");
      } else {
        throw err;
      }
    }
  } catch (e: unknown) {
    apiLogger.error("adminOrApiKeyMiddleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default adminOrApiKeyMiddleware;
