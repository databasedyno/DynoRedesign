import express from "express";
import { errorResponseHelper } from "../helper";
import { IUserType } from "../utils/types";
import { apiLogger } from "../utils/loggers";
import {
  resolveMembership,
  membershipCan,
  Membership,
  PermissionKey,
} from "../utils/permissions";

/**
 * Team Members / RBAC middleware (Phase 1 — additive, not yet mounted on any
 * existing route). Requires authMiddleware to have run first so that
 * res.locals.user.user_id is populated.
 */

/** Pull the target company id from the request (header, body, query, or params). */
export const getRequestCompanyId = (req: express.Request): number | null => {
  const raw =
    (req.headers["x-company-id"] as string | undefined) ??
    (req.body && (req.body.company_id as unknown)) ??
    (req.query && (req.query.company_id as unknown)) ??
    (req.params && (req.params.company_id as unknown)) ??
    (req.params && (req.params.id as unknown));
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isNaN(n) ? null : n;
};

/** Resolve (and cache on res.locals) the caller's membership for the company. */
const ensureMembership = async (
  req: express.Request,
  res: express.Response
): Promise<Membership | null> => {
  const existing = res.locals.membership as Membership | undefined;
  if (existing) return existing;

  const user = res.locals.user as IUserType | undefined;
  const userId = Number((user as unknown as { user_id?: number })?.user_id);
  const companyId = getRequestCompanyId(req);
  if (!userId || !companyId) return null;

  const membership = await resolveMembership(userId, companyId);
  if (membership) res.locals.membership = membership;
  return membership;
};

/**
 * Resolve the caller's membership for the target company and attach it to
 * res.locals.membership. 403 when the user has no access to the company.
 */
export const resolveCompanyMembership = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const user = res.locals.user as IUserType | undefined;
    const userId = Number((user as unknown as { user_id?: number })?.user_id);
    const companyId = getRequestCompanyId(req);
    if (!userId) return errorResponseHelper(res, 401, "Authentication required.");
    if (!companyId) return errorResponseHelper(res, 400, "company_id is required.");

    const membership = await ensureMembership(req, res);
    if (!membership) {
      return errorResponseHelper(res, 403, "You do not have access to this company.");
    }
    next();
  } catch (e) {
    apiLogger.error("[teamPermission] resolveCompanyMembership error:", e);
    return errorResponseHelper(res, 500, "Failed to resolve company access.");
  }
};

/** Require a specific granular permission (Owner always passes). */
export const requirePermission =
  (key: PermissionKey) =>
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const membership = await ensureMembership(req, res);
      if (!membership) {
        return errorResponseHelper(res, 403, "You do not have access to this company.");
      }
      if (!membershipCan(membership, key)) {
        return errorResponseHelper(
          res,
          403,
          "You don't have permission to perform this action."
        );
      }
      next();
    } catch (e) {
      apiLogger.error("[teamPermission] requirePermission error:", e);
      return errorResponseHelper(res, 500, "Permission check failed.");
    }
  };

/** Owner-only gate for sensitive actions (payout wallet, delete API key, billing...). */
export const requireCompanyOwner = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const membership = await ensureMembership(req, res);
    if (!membership || !membership.isOwner) {
      return errorResponseHelper(
        res,
        403,
        "Only the account owner can perform this action."
      );
    }
    next();
  } catch (e) {
    apiLogger.error("[teamPermission] requireCompanyOwner error:", e);
    return errorResponseHelper(res, 500, "Owner check failed.");
  }
};
