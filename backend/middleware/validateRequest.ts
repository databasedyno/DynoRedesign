/**
 * Request Validation Middleware using Joi
 *
 * Validates req.body, req.query, or req.params against a Joi schema.
 * Returns 400 with descriptive error on validation failure.
 */
import { Request, Response, NextFunction } from "express";
import Joi from "joi";

type ValidationTarget = "body" | "query" | "params";

/**
 * Factory: returns Express middleware that validates the given target against a Joi schema.
 *
 * Usage:
 *   router.post("/login", validate(loginSchema), controller.login);
 */
export const validate = (schema: Joi.ObjectSchema, target: ValidationTarget = "body") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const details = error.details.map((d) => d.message).join("; ");
      res.status(400).json({
        success: false,
        message: `Validation error: ${details}`,
        statusCode: 400,
      });
      return;
    }

    // Replace with validated (and stripped) value
    req[target] = value;
    next();
  };
};

// ── Reusable schemas ──────────────────────────────────────────────────────────

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(1).required().messages({
    "any.required": "Password is required",
  }),
});

export const registerSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    "any.required": "Name is required",
    "string.max": "Name cannot exceed 100 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).max(128).required().messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 6 characters",
  }),
  referral_code: Joi.string().optional().allow("", null),
});

export const twoFAValidateSchema = Joi.object({
  challenge_token: Joi.string().hex().length(64).required().messages({
    "any.required": "challenge_token is required",
    "string.hex": "challenge_token is invalid",
    "string.length": "challenge_token is invalid",
  }),
  token: Joi.string().trim().min(6).max(20).required().messages({
    "any.required": "token is required",
    "string.min": "Token must be at least 6 characters",
  }),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({ "any.required": "Reset token is required" }),
  email: Joi.string().email().required().messages({ "any.required": "Email is required" }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    "any.required": "New password is required",
    "string.min": "Password must be at least 6 characters",
  }),
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({ "any.required": "Old password is required" }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    "any.required": "New password is required",
    "string.min": "Password must be at least 6 characters",
  }),
});

export const broadcastSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required().messages({
    "any.required": "Message is required",
  }),
  channel: Joi.string().optional(),
  type: Joi.string().optional(),
});

export const pushNotificationSchema = Joi.object({
  userId: Joi.alternatives().try(Joi.number(), Joi.string()).required().messages({
    "any.required": "userId is required",
  }),
  title: Joi.string().min(1).max(200).required().messages({
    "any.required": "Title is required",
  }),
  message: Joi.string().min(1).max(5000).required().messages({
    "any.required": "Message is required",
  }),
  type: Joi.string().optional(),
  data: Joi.object().optional(),
});

export default validate;
