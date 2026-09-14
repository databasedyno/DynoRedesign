import { raw as envRaw } from "../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { customerModel, paymentLinkModel } from "../models";
import { apiLogger } from "../utils/loggers";

// Op and IUserType imports removed - not used

const customerAuthMiddleware = async (
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
      const decoded = jwt.verify(token, tokenSecret) as { user_id?: number; customer_id?: string; email?: string; [key: string]: unknown };
      
      // Check if decoded token is valid
      if (!decoded) {
        return errorResponseHelper(res, 403, "Invalid token format");
      }
      
      // For payment link flow - check if this is from Redis payload
      if (decoded?.pathType && decoded?.pathType === "createLink") {
        // Payment link uses transaction_id
        if (!decoded.transaction_id) {
          return errorResponseHelper(res, 403, "Invalid payment link token - missing transaction_id");
        }
        
        const linkExists = await paymentLinkModel.findOne({
          where: {
            transaction_id: decoded.transaction_id,
          },
        });

        if (!linkExists) {
          return errorResponseHelper(res, 403, "Link does not exist or has been deleted");
        }
        
        res.locals.token = token;
        res.locals.user = decoded;
        next();
      } else if (decoded?.customer_id || decoded?.id) {
        // Customer model uses id field (UUID) or customer_id field (integer)
        let whereClause;
        if (decoded.id && typeof decoded.id === 'string') {
          // Use UUID id field
          whereClause = { id: decoded.id };
        } else if (decoded.customer_id) {
          // Use integer customer_id field
          whereClause = { customer_id: decoded.customer_id };
        } else {
          return errorResponseHelper(res, 403, "Invalid token - missing customer identification");
        }
        
        const customerExists = await customerModel.findOne({
          where: whereClause,
        });

        if (!customerExists) {
          return errorResponseHelper(res, 403, "Customer account does not exist");
        }
        
        res.locals.token = token;
        res.locals.user = decoded;
        next();
      } else {
        // Regular user authentication - skip customer/link check
        // This is for regular user JWT tokens (user_id)
        res.locals.token = token;
        res.locals.user = decoded;
        next();
      }
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
    apiLogger.error("Customer Auth Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default customerAuthMiddleware;
