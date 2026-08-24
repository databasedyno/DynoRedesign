import { raw as envRaw } from "../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { IUserType } from "../utils/types";
import { apiLogger } from "../utils/loggers";

const adminAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader?.split(" ")[1];
    
    if (!token) {
      return errorResponseHelper(res, 403, "Your Login has Expired");
    }
    
    const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
    if (!tokenSecret) {
      return errorResponseHelper(res, 500, "Server configuration error. Token secret not set.");
    }
    
    try {
      // Verify token synchronously
      const decoded = jwt.verify(token, tokenSecret) as IUserType;
      
      // Check if decoded token is valid and has required fields
      if (!decoded) {
        return errorResponseHelper(res, 403, "Invalid token format");
      }
      
      // Check if user has admin role
      if (!decoded.role || decoded.role !== "ADMIN") {
        return errorResponseHelper(res, 403, "Admin access required. You do not have permission.");
      }
      
      // Store token in res.locals for use in controllers
      res.locals.token = token;
      res.locals.user = decoded;
      
      next();
    } catch (err: unknown) {
      // Handle JWT-specific errors
      const error = err as { name?: string };
      if (error.name === 'TokenExpiredError') {
        return errorResponseHelper(res, 403, "Your Login has Expired");
      } else if (error.name === 'JsonWebTokenError') {
        return errorResponseHelper(res, 403, "Invalid token. Please login again.");
      } else if (error.name === 'NotBeforeError') {
        return errorResponseHelper(res, 403, "Token not active yet. Please try again later.");
      } else {
        throw err; // Re-throw to be caught by outer catch
      }
    }
  } catch (e: unknown) {
    apiLogger.error("Admin Auth Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default adminAuthMiddleware;
