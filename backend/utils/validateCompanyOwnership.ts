import express from "express";
import { companyModel } from "../models";
import { errorResponseHelper } from "../helper";

/**
 * Validates that the caller may ACCESS a company — either as its owner OR as an
 * ACTIVE team member (RBAC). Returns the company record (whose `user_id` is the
 * OWNER, i.e. the effective data-owner) if allowed, or sends a 403 and returns null.
 *
 * Callers that scope data by user_id should use the returned `user_id` (the owner)
 * so a granted team member sees the OWNER's business data, not their own.
 *
 * Usage:
 *   const company = await validateCompanyOwnership(res, company_id, callerUserId);
 *   if (!company) return; // 403 already sent
 *   const dataUserId = Number(company.user_id); // owner
 */
export const validateCompanyOwnership = async (
  res: express.Response,
  companyId: string | number,
  userId: number | string
): Promise<Record<string, unknown> | null> => {
  const company = await companyModel.findOne({
    where: { company_id: companyId },
  });

  if (!company) {
    errorResponseHelper(res, 403, "You don't have access to this company");
    return null;
  }

  const ownerId = Number((company.dataValues as { user_id: number }).user_id);

  // Owner fast-path.
  if (ownerId === Number(userId)) {
    return company.dataValues;
  }

  // Active team member? (require here to avoid a circular import at module load)
  const { resolveMembership } = require("./permissions");
  const membership = await resolveMembership(Number(userId), Number(companyId));
  if (membership) {
    // Return the company as-is: its user_id is the OWNER, which is exactly the
    // effective data-owner the caller's data queries must scope to.
    return company.dataValues;
  }

  errorResponseHelper(res, 403, "You don't have access to this company");
  return null;
};
