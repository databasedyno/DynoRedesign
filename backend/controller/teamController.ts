import express from "express";
import crypto from "crypto";
import { companyModel, teamMemberModel, userModel } from "../models";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { hashPassword, validatePasswordStrength } from "../helper/passwordHelper";
import { getAccessToken, generateReferralCode } from "./user/userShared";
import { notifyInviteAccepted } from "./team/teamNotifications";
import { config } from "../utils/config";
import {
  resolveMembership,
  membershipCan,
  sanitizePermissions,
  defaultPermissionsForRole,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  TeamRole,
} from "../utils/permissions";

/**
 * Team Members / RBAC — Phase 2 APIs (/api/team/*).
 *
 * Management endpoints (invite/list/update/revoke/catalogue) require
 * authMiddleware AND that the caller is the company Owner or holds the
 * `manage_team` permission for the target company. The invite-accept endpoints
 * are PUBLIC (the invitee is not logged in yet).
 */

const INVITE_TTL_HOURS = 72;
const ROLES: TeamRole[] = ["admin", "member"]; // Owner is implicit, never invited.

const normEmail = (e: unknown): string => String(e || "").trim().toLowerCase();
const isEmail = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const getCallerId = (res: express.Response): number =>
  Number((res.locals.user as { user_id?: number } | undefined)?.user_id) || 0;

type Dv<T = Record<string, unknown>> = { dataValues: T };
const dv = (row: unknown): Record<string, unknown> =>
  (row as Dv).dataValues || (row as Record<string, unknown>);

/** Caller must be Owner OR hold manage_team for the company. */
async function assertCanManageTeam(callerId: number, companyId: number) {
  const m = await resolveMembership(callerId, companyId);
  if (!m) return { ok: false as const, code: 403, msg: "You do not have access to this company." };
  if (!m.isOwner && !membershipCan(m, "manage_team")) {
    return { ok: false as const, code: 403, msg: "You don't have permission to manage the team." };
  }
  return { ok: true as const, membership: m };
}

/**
 * ESCALATION GUARD (C2): a NON-OWNER manager (a member/admin who holds
 * manage_team) must not be able to hand out access above their own.
 *   - only the OWNER may grant the "admin" role (admins get every permission);
 *   - a manager may only grant permissions they themselves hold (subset rule).
 * The OWNER is unrestricted. Returns an error string, or null when allowed.
 */
function assertGrantAllowed(
  manager: { isOwner: boolean; permissions: Record<string, boolean> },
  role: TeamRole,
  permissions: Record<string, boolean>
): string | null {
  if (manager.isOwner) return null;
  if (role === "admin") return "Only the account owner can grant the Admin role.";
  for (const k of PERMISSION_KEYS) {
    if (permissions[k] && !manager.permissions[k]) {
      return "You can only grant permissions that you hold yourself.";
    }
  }
  return null;
}

/**
 * ESCALATION GUARD (C2): which member ROWS a non-owner manager may act on.
 * They may never modify their OWN row (self-escalation), an ADMIN's row, or the
 * account OWNER. The OWNER may act on anyone. Returns an error string or null.
 */
async function assertCanTargetRow(
  manager: { isOwner: boolean },
  targetRow: Record<string, unknown>,
  callerId: number,
  companyId: number
): Promise<string | null> {
  if (manager.isOwner) return null;
  const targetUserId = Number(targetRow.member_user_id) || 0;
  if (targetUserId && targetUserId === callerId) return "You cannot modify your own access.";
  if (String(targetRow.role) === "admin") return "Only the account owner can manage an Admin.";
  const company = await companyModel.findOne({ where: { company_id: companyId } });
  const ownerId = Number((dv(company) as { user_id?: number }).user_id) || 0;
  if (targetUserId && targetUserId === ownerId) return "You cannot modify the account owner.";
  return null;
}

function buildInviteLink(token: string): string {
  const base = (config.frontendUrl || config.serverUrl || "").replace(/\/+$/, "");
  return `${base}/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

/**
 * POST /api/team/invite
 * body: { email, role, company_ids?: number[], company_id?: number, permissions?: {} }
 * Creates/refreshes one invited membership row per company (all sharing ONE
 * token so a single accept activates them together).
 */
export const inviteMembers = async (req: express.Request, res: express.Response) => {
  try {
    const callerId = getCallerId(res);
    if (!callerId) return errorResponseHelper(res, 401, "Authentication required.");

    const email = normEmail(req.body?.email);
    const role = (String(req.body?.role || "member").toLowerCase() as TeamRole);
    const rawIds = req.body?.company_ids ?? req.body?.company_id;
    const companyIds = (Array.isArray(rawIds) ? rawIds : [rawIds])
      .map((x: unknown) => parseInt(String(x), 10))
      .filter((n: number) => !Number.isNaN(n));

    if (!email || !isEmail(email)) return errorResponseHelper(res, 400, "A valid email is required.");
    if (!ROLES.includes(role)) return errorResponseHelper(res, 400, "Role must be 'admin' or 'member'.");
    if (companyIds.length === 0) return errorResponseHelper(res, 400, "Select at least one company.");

    const permissions =
      req.body?.permissions && typeof req.body.permissions === "object"
        ? sanitizePermissions(req.body.permissions)
        : defaultPermissionsForRole(role);

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    const created: Array<Record<string, unknown>> = [];
    const skipped: Array<{ company_id: number; reason: string }> = [];

    for (const companyId of companyIds) {
      const perm = await assertCanManageTeam(callerId, companyId);
      if (!perm.ok) { skipped.push({ company_id: companyId, reason: perm.msg }); continue; }

      // C2 escalation guard: a non-owner manager can't invite an Admin or grant
      // permissions they don't hold themselves.
      const grantErr = assertGrantAllowed(perm.membership, role, permissions);
      if (grantErr) { skipped.push({ company_id: companyId, reason: grantErr }); continue; }

      // Can't invite the company owner as a teammate.
      const company = await companyModel.findOne({ where: { company_id: companyId } });
      const ownerId = Number((dv(company) as { user_id?: number }).user_id);
      const ownerUser = await userModel.findOne({ where: { user_id: ownerId } });
      if (ownerUser && normEmail((dv(ownerUser) as { email?: string }).email) === email) {
        skipped.push({ company_id: companyId, reason: "This email already owns the company." });
        continue;
      }

      // Upsert by (company_id, invited_email) — refreshes a prior/revoked invite.
      const existing = await teamMemberModel.findOne({
        where: { company_id: companyId, invited_email: email },
      });
      const linkedUser = await userModel.findOne({ where: { email } });
      const memberUserId = linkedUser ? Number((dv(linkedUser) as { user_id?: number }).user_id) : null;

      if (existing) {
        await teamMemberModel.update(
          {
            role,
            permissions,
            status: "invited",
            invited_by_user_id: callerId,
            invite_token: token,
            invite_expires_at: expiresAt,
            member_user_id: memberUserId,
            accepted_at: null,
          },
          { where: { id: (dv(existing) as { id: number }).id } }
        );
        created.push({ company_id: companyId, role, status: "invited", refreshed: true });
      } else {
        await teamMemberModel.create({
          company_id: companyId,
          invited_email: email,
          role,
          permissions,
          status: "invited",
          invited_by_user_id: callerId,
          invite_token: token,
          invite_expires_at: expiresAt,
          member_user_id: memberUserId,
        });
        created.push({ company_id: companyId, role, status: "invited", refreshed: false });
      }
    }

    if (created.length === 0) {
      return errorResponseHelper(res, 403, skipped[0]?.reason || "Could not create the invite.");
    }

    const inviteLink = buildInviteLink(token);
    // Email is gated OFF in preview (DISABLE_OUTBOUND_EMAIL). Return the link so
    // the owner can share it directly; also log it for visibility.
    apiLogger.info(`[Team] Invite created for ${email} (role=${role}) -> ${inviteLink}`);

    return successResponseHelper(res, 200, "Invitation created.", {
      email,
      role,
      invited_companies: created,
      skipped,
      invite_link: inviteLink,
      expires_at: expiresAt,
    });
  } catch (e) {
    apiLogger.error("[Team] inviteMembers error:", e);
    return errorResponseHelper(res, 500, "Failed to create invitation.");
  }
};

/** GET /api/team/members?company_id= — list members for a company. */
export const listMembers = async (req: express.Request, res: express.Response) => {
  try {
    const callerId = getCallerId(res);
    const companyId = parseInt(String(req.query?.company_id ?? req.headers["x-company-id"] ?? ""), 10);
    if (!callerId) return errorResponseHelper(res, 401, "Authentication required.");
    if (Number.isNaN(companyId)) return errorResponseHelper(res, 400, "company_id is required.");

    const perm = await assertCanManageTeam(callerId, companyId);
    if (!perm.ok) return errorResponseHelper(res, perm.code, perm.msg);

    const rows = await teamMemberModel.findAll({
      where: { company_id: companyId },
      order: [["created_at", "DESC"]],
    });

    const members = await Promise.all(
      rows.map(async (r) => {
        const d = dv(r) as Record<string, unknown>;
        let name: string | null = null;
        if (d.member_user_id) {
          const u = await userModel.findOne({ where: { user_id: d.member_user_id } });
          if (u) name = ((dv(u) as { name?: string }).name as string) || null;
        }
        return {
          id: d.id,
          company_id: d.company_id,
          email: d.invited_email,
          name,
          role: d.role,
          permissions: sanitizePermissions(d.permissions),
          status: d.status,
          invited_at: d.created_at,
          accepted_at: d.accepted_at,
          expires_at: d.invite_expires_at ?? null,
        };
      })
    );

    return successResponseHelper(res, 200, "Team members fetched.", { members });
  } catch (e) {
    apiLogger.error("[Team] listMembers error:", e);
    return errorResponseHelper(res, 500, "Failed to fetch team members.");
  }
};

/** PATCH /api/team/members/:id — update a member's role and/or permissions. */
export const updateMember = async (req: express.Request, res: express.Response) => {
  try {
    const callerId = getCallerId(res);
    const id = parseInt(String(req.params?.id), 10);
    if (!callerId) return errorResponseHelper(res, 401, "Authentication required.");
    if (Number.isNaN(id)) return errorResponseHelper(res, 400, "Invalid member id.");

    const row = await teamMemberModel.findOne({ where: { id } });
    if (!row) return errorResponseHelper(res, 404, "Team member not found.");
    const d = dv(row) as Record<string, unknown>;

    const perm = await assertCanManageTeam(callerId, Number(d.company_id));
    if (!perm.ok) return errorResponseHelper(res, perm.code, perm.msg);

    // C2 escalation guard: which rows a non-owner manager may touch.
    const targetErr = await assertCanTargetRow(perm.membership, d, callerId, Number(d.company_id));
    if (targetErr) return errorResponseHelper(res, 403, targetErr);

    const patch: Record<string, unknown> = {};
    if (req.body?.role !== undefined) {
      const role = String(req.body.role).toLowerCase() as TeamRole;
      if (!ROLES.includes(role)) return errorResponseHelper(res, 400, "Role must be 'admin' or 'member'.");
      patch.role = role;
    }
    if (req.body?.permissions !== undefined) {
      patch.permissions = sanitizePermissions(req.body.permissions);
    }
    if (Object.keys(patch).length === 0) return errorResponseHelper(res, 400, "Nothing to update.");

    // C2 escalation guard: the RESULTING role/permissions must not exceed the
    // non-owner manager's own (owner is unrestricted).
    const finalRole = (patch.role as TeamRole) ?? (String(d.role || "member") as TeamRole);
    const finalPerms = (patch.permissions as Record<string, boolean>) ?? sanitizePermissions(d.permissions);
    const grantErr = assertGrantAllowed(perm.membership, finalRole, finalPerms);
    if (grantErr) return errorResponseHelper(res, 403, grantErr);

    await teamMemberModel.update(patch, { where: { id } });
    return successResponseHelper(res, 200, "Team member updated.", { id, ...patch });
  } catch (e) {
    apiLogger.error("[Team] updateMember error:", e);
    return errorResponseHelper(res, 500, "Failed to update team member.");
  }
};

/** DELETE /api/team/members/:id — revoke a member's access (soft). */
export const revokeMember = async (req: express.Request, res: express.Response) => {
  try {
    const callerId = getCallerId(res);
    const id = parseInt(String(req.params?.id), 10);
    if (!callerId) return errorResponseHelper(res, 401, "Authentication required.");
    if (Number.isNaN(id)) return errorResponseHelper(res, 400, "Invalid member id.");

    const row = await teamMemberModel.findOne({ where: { id } });
    if (!row) return errorResponseHelper(res, 404, "Team member not found.");
    const d = dv(row) as Record<string, unknown>;

    const perm = await assertCanManageTeam(callerId, Number(d.company_id));
    if (!perm.ok) return errorResponseHelper(res, perm.code, perm.msg);

    // C2 escalation guard: a non-owner manager can't revoke themselves, an Admin,
    // or the account owner.
    const targetErr = await assertCanTargetRow(perm.membership, d, callerId, Number(d.company_id));
    if (targetErr) return errorResponseHelper(res, 403, targetErr);

    await teamMemberModel.update(
      { status: "revoked", invite_token: null, invite_expires_at: null },
      { where: { id } }
    );
    return successResponseHelper(res, 200, "Team member access revoked.", { id });
  } catch (e) {
    apiLogger.error("[Team] revokeMember error:", e);
    return errorResponseHelper(res, 500, "Failed to revoke team member.");
  }
};

/** GET /api/team/permissions/catalogue — keys + labels + role presets (for the UI). */
export const permissionCatalogue = async (_req: express.Request, res: express.Response) => {
  return successResponseHelper(res, 200, "Permission catalogue.", {
    keys: PERMISSION_KEYS,
    labels: PERMISSION_LABELS,
    roles: ["admin", "member"],
    defaults: {
      admin: defaultPermissionsForRole("admin"),
      member: defaultPermissionsForRole("member"),
    },
  });
};

/** GET /api/team/invite/:token — PUBLIC: validate an invite for the accept page. */
export const getInvite = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.params?.token || "");
    if (!token) return errorResponseHelper(res, 400, "Invalid invite.");

    const rows = await teamMemberModel.findAll({ where: { invite_token: token, status: "invited" } });
    if (rows.length === 0) return errorResponseHelper(res, 404, "This invite is invalid or has already been used.");

    const first = dv(rows[0]) as Record<string, unknown>;
    if (first.invite_expires_at && new Date(first.invite_expires_at as string) < new Date()) {
      return errorResponseHelper(res, 410, "This invite has expired. Ask for a new one.");
    }

    const email = normEmail(first.invited_email);
    const existingUser = await userModel.findOne({ where: { email } });
    const inviter = await userModel.findOne({ where: { user_id: first.invited_by_user_id } });

    const companies = await Promise.all(
      rows.map(async (r) => {
        const d = dv(r) as Record<string, unknown>;
        const c = await companyModel.findOne({ where: { company_id: d.company_id } });
        const cd = c ? (dv(c) as Record<string, unknown>) : {};
        return { company_id: d.company_id, company_name: cd.company_name || cd.name || null, role: d.role };
      })
    );

    return successResponseHelper(res, 200, "Invite valid.", {
      email,
      email_has_account: !!existingUser,
      invited_by: inviter ? (dv(inviter) as { name?: string; email?: string }).name || (dv(inviter) as { email?: string }).email : null,
      companies,
      expires_at: first.invite_expires_at,
    });
  } catch (e) {
    apiLogger.error("[Team] getInvite error:", e);
    return errorResponseHelper(res, 500, "Failed to validate invite.");
  }
};

/**
 * POST /api/team/accept — PUBLIC: accept an invite.
 * body: { token, name?, password? }
 *  - New email  -> create a user (email_verified, hashed password) + log them in.
 *  - Existing email -> just link + activate memberships; they log in normally.
 */
export const acceptInvite = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.body?.token || "");
    if (!token) return errorResponseHelper(res, 400, "Invalid invite.");

    const rows = await teamMemberModel.findAll({ where: { invite_token: token, status: "invited" } });
    if (rows.length === 0) return errorResponseHelper(res, 404, "This invite is invalid or has already been used.");

    const first = dv(rows[0]) as Record<string, unknown>;
    if (first.invite_expires_at && new Date(first.invite_expires_at as string) < new Date()) {
      return errorResponseHelper(res, 410, "This invite has expired. Ask for a new one.");
    }

    const email = normEmail(first.invited_email);
    let user = await userModel.findOne({ where: { email } });
    let createdNew = false;

    if (!user) {
      const password = String(req.body?.password || "");
      const strengthError = validatePasswordStrength(password);
      if (strengthError) {
        return errorResponseHelper(res, 400, strengthError);
      }
      user = await userModel.create({
        name: (req.body?.name && String(req.body.name).trim()) || null,
        email,
        password: hashPassword(password),
        email_verified: true, // invite proves email ownership
        referral_code: generateReferralCode(),
        login_type: "EMAIL",
      }, {
        // A teammate joins an EXISTING business — do not auto-create a personal
        // company for them (see accountProvisioning afterCreate hook).
        skipAccountProvisioning: true,
      } as unknown as Parameters<typeof userModel.create>[1]);
      createdNew = true;
    }

    const memberUserId = Number((dv(user) as { user_id: number }).user_id);
    await teamMemberModel.update(
      { status: "active", member_user_id: memberUserId, accepted_at: new Date(), invite_token: null, invite_expires_at: null },
      { where: { invite_token: token } }
    );

    apiLogger.info(`[Team] Invite accepted by ${email} (user_id=${memberUserId}, new=${createdNew}) for ${rows.length} company(ies)`);

    // Alert each business owner that their teammate joined (best-effort).
    const joinedCompanyIds = rows.map((r) => Number((dv(r) as { company_id: number }).company_id));
    const memberName = ((dv(user) as { name?: string }).name as string) || null;
    await notifyInviteAccepted(joinedCompanyIds, memberUserId, email, memberName);

    if (createdNew) {
      const resData = await getAccessToken(memberUserId);
      return successResponseHelper(res, 200, "Welcome! Your account is ready.", {
        ...resData,
        email_verified: true,
        team_member: true,
      });
    }

    return successResponseHelper(res, 200, "Invite accepted. Please log in to access the shared business.", {
      needs_login: true,
      email,
      team_member: true,
    });
  } catch (e) {
    apiLogger.error("[Team] acceptInvite error:", e);
    return errorResponseHelper(res, 500, "Failed to accept invite.");
  }
};
