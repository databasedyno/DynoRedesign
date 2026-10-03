/**
 * Recipient-address health, shared by the email worker, the Brevo webhook,
 * the company recipient resolver and the dashboard "Needs attention" feed.
 *
 *   email:suppressed:<addr>   hard bounce / invalid / blocked / spam (30d)
 *                             → worker SKIPS non-OTP mail to it
 *   email:unreachable:<addr>  soft bounce (mailbox full, "550 Sender IP
 *                             rejected", …) (7d) → still attempted, but the
 *                             company owner also receives a copy
 *
 * Both flags clear themselves on the next Brevo `delivered` event.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { deleteRedisItem, getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";

export const SUPPRESSED_KEY = (email: string) => `email:suppressed:${email.trim().toLowerCase()}`;
export const UNREACHABLE_KEY = (email: string) => `email:unreachable:${email.trim().toLowerCase()}`;
export const UNREACHABLE_TTL_SEC = 7 * 24 * 3600;

export interface DeliveryBlock {
  kind: "suppressed" | "unreachable";
  event: string;
  reason: string | null;
  at: string;
}

const isEmail = (e?: string | null): e is string =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());

const readFlag = async (key: string) => {
  try {
    const v = (await getRedisItem(key)) as Record<string, unknown> | null;
    return v && Object.keys(v).length > 0 ? v : null;
  } catch {
    return null;
  }
};

export const isSuppressed = async (email: string): Promise<boolean> => !!(await readFlag(SUPPRESSED_KEY(email)));

/** Suppressed wins over unreachable. null = address is healthy as far as we know. */
export const getDeliveryBlock = async (email: string): Promise<DeliveryBlock | null> => {
  if (!isEmail(email)) return null;
  const hard = await readFlag(SUPPRESSED_KEY(email));
  if (hard) return { kind: "suppressed", event: String(hard.event || "hard_bounce"), reason: (hard.reason as string) || null, at: String(hard.at || "") };
  const soft = await readFlag(UNREACHABLE_KEY(email));
  if (soft) return { kind: "unreachable", event: String(soft.event || "soft_bounce"), reason: (soft.reason as string) || null, at: String(soft.at || "") };
  return null;
};

export const markUnreachable = async (email: string, event: string, reason: string | undefined): Promise<void> => {
  await setRedisItemWithTTL(UNREACHABLE_KEY(email), { event, reason: reason || null, at: new Date().toISOString() }, UNREACHABLE_TTL_SEC);
};

export const clearUnreachable = async (email: string): Promise<void> => {
  await deleteRedisItem(UNREACHABLE_KEY(email)).catch(() => {});
};

export interface CompanyEmailHealth {
  primary_email: string;
  owner_email: string | null;
  /** Owner login email when it differs from the primary (where copies go while blocked). */
  fallback_email: string | null;
  block: DeliveryBlock | null;
}

/** Health of the address a company's operational emails are routed to. */
export const getCompanyEmailHealth = async (companyId: number): Promise<CompanyEmailHealth | null> => {
  if (!companyId) return null;
  const rows = await sequelize.query<{ notification_email: string | null; company_email: string | null; owner_email: string | null }>(
    `SELECT c.notification_email, c.email AS company_email, u.email AS owner_email
       FROM tbl_company c LEFT JOIN tbl_user u ON u.user_id = c.user_id
      WHERE c.company_id = :companyId`,
    { replacements: { companyId }, type: QueryTypes.SELECT },
  );
  const r = rows[0];
  if (!r) return null;
  const primary = [r.notification_email, r.company_email, r.owner_email].find(isEmail);
  if (!primary) return null;
  const owner = isEmail(r.owner_email) ? r.owner_email!.trim() : null;
  const fallback = owner && owner.toLowerCase() !== primary.trim().toLowerCase() ? owner : null;
  return { primary_email: primary.trim(), owner_email: owner, fallback_email: fallback, block: await getDeliveryBlock(primary) };
};
