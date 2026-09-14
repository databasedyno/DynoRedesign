import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper } from "../helper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";

/**
 * Middleware that gates routes behind email verification.
 * Must be placed AFTER authMiddleware in the middleware chain.
 *
 * Returns 403 if the user's email is not verified.
 */
const emailVerifiedMiddleware = async (
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const token = res.locals.token;
    if (!token) {
      return errorResponseHelper(res, 401, "Authentication required.");
    }

    // B2: authMiddleware (which runs first) has already resolved the user from
    // its Redis-cached entry and stashed email/email_verified on
    // res.locals.authUser — so we gate from that instead of a fresh per-request
    // userModel.findOne. Falls back to a DB read only in the unexpected case
    // this middleware is mounted without authMiddleware ahead of it.
    let email: string | null;
    let email_verified: boolean;

    const authUser = res.locals.authUser as
      | { email: string | null; email_verified: boolean }
      | undefined;

    if (authUser) {
      email = authUser.email;
      email_verified = authUser.email_verified;
    } else {
      const decoded = jwt.decode(token) as IUserType;
      if (!decoded || !decoded.user_id) {
        return errorResponseHelper(res, 401, "Invalid token.");
      }
      const user = await userModel.findOne({
        where: { user_id: decoded.user_id },
        attributes: ["email", "email_verified"],
      });
      if (!user) {
        return errorResponseHelper(res, 404, "User not found.");
      }
      email = (user.dataValues.email ?? null) as string | null;
      email_verified = user.dataValues.email_verified === true;
    }

    // Phone/SMS-only accounts have no email on file — there is nothing to
    // verify, so they must NOT be gated by this middleware (otherwise they get
    // locked out of /company, /wallet and /dashboard with a confusing
    // "check your inbox" message). Only enforce verification for accounts that
    // actually registered with an email address.
    if (email && !email_verified) {
      return errorResponseHelper(
        res,
        403,
        "Please verify your email address before accessing this feature. Check your inbox for a verification code."
      );
    }

    next();
  } catch (err) {
    return errorResponseHelper(res, 500, "Email verification check failed.");
  }
};

export default emailVerifiedMiddleware;
