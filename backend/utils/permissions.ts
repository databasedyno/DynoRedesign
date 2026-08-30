/**
 * Team Members / RBAC — permission catalogue + role presets + membership
 * resolver. Single source of truth for what a teammate can do within a company.
 *
 * Owner is IMPLICIT (tbl_company.user_id) and always has EVERYTHING, including
 * the OWNER-ONLY sensitive actions below (never grantable to Admin/Member).
 */
import { companyModel, teamMemberModel } from "../models";

export type TeamRole = "owner" | "admin" | "member";

/**
 * Grantable, non-sensitive permission keys.
 * NOTE: there is intentionally NO "withdraw funds" key — Dynopay auto-settles to
 * the merchant's payout wallet; there is no manual withdraw action. Changing the
 * payout wallet itself is an OWNER-ONLY action (see OWNER_ONLY_ACTIONS).
 */
export const PERMISSION_KEYS = [
  "view_dashboard",
  "view_transactions",
  "manage_payment_links",
  "manage_customers",
  "manage_invoices",
  "view_wallets",
  "manage_products",
  "manage_api_keys",
  "manage_company_settings",
  "manage_team",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Human labels for the team-management UI. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  view_dashboard: "View dashboard & analytics",
  view_transactions: "View transactions",
  manage_payment_links: "Create & manage payment links",
  manage_customers: "Manage customers",
  manage_invoices: "Create & manage invoices",
  view_wallets: "View wallet balances",
  manage_products: "Manage products & storefront",
  manage_api_keys: "Create & view API keys",
  manage_company_settings: "Manage company profile & settings",
  manage_team: "Invite & manage team members",
};

/**
 * OWNER-ONLY sensitive actions — hard-gated to role='owner', NEVER expressible
 * as a grantable toggle (product decision, 2026-08):
 *   - change payout / settlement wallet address
 *   - delete an API key
 *   - manage billing / delete company / transfer or remove the Owner
 */
export const OWNER_ONLY_ACTIONS = [
  "change_payout_wallet",
  "delete_api_key",
  "manage_billing",
  "delete_company",
  "transfer_ownership",
] as const;
export type OwnerOnlyAction = (typeof OWNER_ONLY_ACTIONS)[number];

type PermMap = Record<PermissionKey, boolean>;

const allFalse = (): PermMap =>
  PERMISSION_KEYS.reduce((acc, k) => {
    acc[k] = false;
    return acc;
  }, {} as PermMap);

const allTrue = (): PermMap =>
  PERMISSION_KEYS.reduce((acc, k) => {
    acc[k] = true;
    return acc;
  }, {} as PermMap);

/** Default permission map for a role (owner customizes per-member afterwards). */
export const defaultPermissionsForRole = (role: TeamRole): PermMap => {
  if (role === "owner" || role === "admin") return allTrue();
  // Member: sensible read-first defaults.
  const base = allFalse();
  base.view_dashboard = true;
  base.view_transactions = true;
  return base;
};

/** Normalize an arbitrary permissions object to the known keys (drops unknowns). */
export const sanitizePermissions = (input: unknown): PermMap => {
  const out = allFalse();
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    for (const k of PERMISSION_KEYS) {
      if (obj[k] === true) out[k] = true;
    }
  }
  return out;
};

export interface Membership {
  isOwner: boolean;
  role: TeamRole;
  permissions: PermMap;
  companyId: number;
  userId: number;
}

/**
 * Resolve a user's membership for a company.
 *   - Owner (tbl_company.user_id === userId) -> full access.
 *   - Active team member                     -> stored role + permissions.
 *   - Otherwise                              -> null (no access).
 */
export const resolveMembership = async (
  userId: number,
  companyId: number
): Promise<Membership | null> => {
  if (!userId || !companyId) return null;

  const company = await companyModel.findOne({ where: { company_id: companyId } });
  if (!company) return null;

  const ownerId = Number((company as unknown as { dataValues: { user_id: number } }).dataValues.user_id);
  if (ownerId === Number(userId)) {
    return { isOwner: true, role: "owner", permissions: allTrue(), companyId, userId };
  }

  const row = await teamMemberModel.findOne({
    where: { company_id: companyId, member_user_id: userId, status: "active" },
  });
  if (!row) return null;

  const dv = (row as unknown as { dataValues: { role?: string; permissions?: unknown } }).dataValues;
  const role = (dv.role as TeamRole) || "member";
  return {
    isOwner: false,
    role,
    permissions: sanitizePermissions(dv.permissions),
    companyId,
    userId,
  };
};

/** Does this membership grant a specific permission? (Owner always true.) */
export const membershipCan = (m: Membership | null, key: PermissionKey): boolean => {
  if (!m) return false;
  if (m.isOwner) return true;
  return !!m.permissions[key];
};
