/**
 * notificationRecipients.ts — central recipient resolver for OUTBOUND emails.
 *
 * DynoPay has two email identities that were previously conflated (everything
 * went to the owner's personal login email):
 *   • ACCOUNT scope  -> the individual user (tbl_user.email): security, login,
 *     OTP, password, KYC. Personal — never fanned out to a team.
 *   • COMPANY scope  -> the business: payments, payouts, orders, config,
 *     digests. Delivered to the company notification address AND (optionally)
 *     to team members who hold the relevant permission.
 *
 * Resolution for the COMPANY primary recipient:
 *   tbl_company.notification_email  ->  tbl_company.email  ->  owner login email
 *
 * De-duplication: recipients are collapsed CASE-INSENSITIVELY, so the very
 * common solo-merchant case (company email == owner login email == a team
 * member's email) results in EXACTLY ONE email, never duplicates.
 *
 * Team fan-out is ON by default and can be disabled per company via
 * tbl_company.notification_prefs.team_fanout === false. A per-category master
 * switch lives at notification_prefs.categories[category] === false.
 */
import { companyModel, userModel, teamMemberModel } from "../models";
import { sanitizePermissions, PermissionKey } from "./permissions";

export type NotificationCategory =
  | "payments"   // payment received/confirming/partial/failed, txn confirmed, large-txn alert
  | "payouts"    // auto-conversion payout, settlement, refunds
  | "orders"     // merchant order receipt, order shipped/expired, invoices, downloads
  | "config"     // webhook-disabled, API key created, wallet reminder, profile changes
  | "digests";   // weekly summary, payout digest, conversion summary

/** Which team permission a member must hold to receive each category. */
export const CATEGORY_PERMISSION: Record<NotificationCategory, PermissionKey> = {
  payments: "view_transactions",
  payouts: "view_transactions",
  orders: "manage_products",
  config: "manage_company_settings",
  digests: "view_dashboard",
};

export interface Recipient {
  email: string;
  name: string;
  userId: number | null;
  /** Where this recipient came from (useful for logging/tests). */
  source: "company" | "owner" | "team";
}

const isEmail = (e?: string | null): e is string =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());

/**
 * Case-insensitive de-dupe, preserving first occurrence. Callers should push
 * the company/owner primary FIRST so it "wins" over a duplicate team entry.
 */
export function dedupeRecipients(list: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const r of list) {
    if (!isEmail(r.email)) continue;
    const key = r.email.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, email: r.email.trim() });
  }
  return out;
}

/** Convenience: unique, lower-safe list of just the email strings. */
export function dedupeEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    if (!isEmail(e)) continue;
    const key = e.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e.trim());
  }
  return out;
}

/**
 * ACCOUNT-scoped recipient (security / login / OTP / KYC) — always the user
 * themselves, never the company address and never fanned out.
 */
export async function resolveAccountRecipient(userId: number): Promise<Recipient | null> {
  if (!userId) return null;
  const u = await userModel.findOne({ where: { user_id: userId } });
  if (!u) return null;
  const d = u.get({ plain: true }) as { user_id: number; email?: string; name?: string };
  if (!isEmail(d.email)) return null;
  return { email: d.email!, name: d.name || "there", userId: d.user_id, source: "owner" };
}

/**
 * COMPANY-scoped recipients (payments / payouts / orders / config / digests).
 * De-duplicated case-insensitively. Returns [] when the category is disabled
 * for the company or nothing resolves to a valid address.
 */
export async function resolveCompanyRecipients(
  companyId: number,
  category?: NotificationCategory,
): Promise<Recipient[]> {
  if (!companyId) return [];
  const c = await companyModel.findOne({ where: { company_id: companyId } });
  if (!c) return [];
  const cd = c.get({ plain: true }) as {
    company_id: number; user_id?: number; email?: string; company_name?: string;
    notification_email?: string | null; notification_prefs?: Record<string, unknown> | null;
  };

  const prefs = (cd.notification_prefs && typeof cd.notification_prefs === "object")
    ? cd.notification_prefs as { team_fanout?: boolean; categories?: Record<string, boolean> }
    : {};

  // Company-level per-category master switch (missing => enabled).
  if (category && prefs.categories && prefs.categories[category] === false) return [];

  const owner = cd.user_id ? await userModel.findOne({ where: { user_id: cd.user_id } }) : null;
  const ownerData = owner ? (owner.get({ plain: true }) as { user_id: number; email?: string; name?: string }) : null;
  const companyName = cd.company_name || ownerData?.name || "there";

  const recipients: Recipient[] = [];

  // Primary company recipient (notification_email -> company.email -> owner email).
  const primaryEmail = [cd.notification_email, cd.email, ownerData?.email].find(isEmail);
  if (primaryEmail) {
    recipients.push({
      email: primaryEmail,
      name: companyName,
      userId: ownerData?.user_id ?? null,
      source: isEmail(cd.notification_email) || isEmail(cd.email) ? "company" : "owner",
    });
  }

  // Team fan-out (default ON; opt-out via notification_prefs.team_fanout === false).
  const fanout = prefs.team_fanout !== false;
  if (fanout) {
    const requiredPerm = category ? CATEGORY_PERMISSION[category] : null;
    const members = await teamMemberModel.findAll({ where: { company_id: companyId, status: "active" } });
    for (const m of members) {
      const md = m.get({ plain: true }) as {
        member_user_id?: number | null; invited_email?: string; role?: string; permissions?: unknown;
      };
      if (!md.member_user_id) continue; // only accepted members with a real account
      const role = md.role || "member";
      const perms = sanitizePermissions(md.permissions);
      const allowed = role === "owner" || role === "admin" || !requiredPerm || perms[requiredPerm] === true;
      if (!allowed) continue;

      let email: string | null = md.invited_email || null;
      let name = "there";
      const mu = await userModel.findOne({ where: { user_id: md.member_user_id } });
      if (mu) {
        const mud = mu.get({ plain: true }) as { email?: string; name?: string };
        if (isEmail(mud.email)) email = mud.email!;
        name = mud.name || name;
      }
      if (isEmail(email)) recipients.push({ email, name, userId: md.member_user_id, source: "team" });
    }
  }

  return dedupeRecipients(recipients);
}

export default {
  resolveAccountRecipient,
  resolveCompanyRecipients,
  dedupeRecipients,
  dedupeEmails,
  CATEGORY_PERMISSION,
};
