import express from "express";
import { companyModel } from "../models";
import { errorResponseHelper } from "../helper";
import type { PermissionKey } from "./permissions";

/**
 * Validates that the caller may ACCESS a company — either as its owner OR as an
 * ACTIVE team member (RBAC). Returns the company record (whose `user_id` is the
 * OWNER, i.e. the effective data-owner) if allowed, or sends a 403 and returns null.
 *
 * Callers that scope data by user_id should use the returned `user_id` (the owner)
 * so a granted team member sees the OWNER's business data, not their own.
 *
 * `requiredPermission` (optional): when provided, a team MEMBER must hold that
 * granular permission or they get a 403. The OWNER always passes (owner is
 * implicit and holds everything). Pass this on any endpoint that REMAPS scoping
 * to the owner, so a member without the permission can never read/write the
 * owner's data for that resource.
 *
 * Usage:
 *   const company = await validateCompanyOwnership(res, company_id, callerUserId, "view_wallets");
 *   if (!company) return; // 403 already sent
 *   const dataUserId = Number(company.user_id); // owner — scope queries to this
 */
export const validateCompanyOwnership = async (
  res: express.Response,
  companyId: string | number,
  userId: number | string,
  requiredPermission?: PermissionKey
): Promise<Record<string, unknown> | null> => {
  const company = await companyModel.findOne({
    where: { company_id: companyId },
  });

  if (!company) {
    errorResponseHelper(res, 403, "You don't have access to this company");
    return null;
  }

  const ownerId = Number((company.dataValues as { user_id: number }).user_id);

  // Owner fast-path — full access, never gated by a granular permission.
  if (ownerId === Number(userId)) {
    return company.dataValues;
  }

  // Active team member? (require here to avoid a circular import at module load)
  const { resolveMembership, membershipCan } = require("./permissions");
  const membership = await resolveMembership(Number(userId), Number(companyId));
  if (membership) {
    // Gate the member by the granular permission when the caller asked for one.
    if (requiredPermission && !membershipCan(membership, requiredPermission)) {
      errorResponseHelper(res, 403, "You don't have permission to perform this action.");
      return null;
    }
    // Return the company as-is: its user_id is the OWNER, which is exactly the
    // effective data-owner the caller's data queries must scope to.
    return company.dataValues;
  }

  errorResponseHelper(res, 403, "You don't have access to this company");
  return null;
};
