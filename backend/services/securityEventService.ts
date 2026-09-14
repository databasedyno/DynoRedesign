/**
 * Security events — admin-facing timeline for account-security incidents
 * (2FA reset, wallet freeze/unfreeze). Feeds the Admin › Security events panel.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import SecurityEvent, { SecurityEventType } from "../models/securityModels/securityEventModel";
import { isWalletFrozen } from "./wallet/walletChangeAlert";
import { userLogger } from "../utils/loggers";

export const recordSecurityEvent = async (input: {
  user_id: number;
  type: SecurityEventType;
  severity?: "info" | "high";
  summary: string;
  meta?: Record<string, unknown>;
  freeze_until?: Date | null;
}) => {
  try {
    return await SecurityEvent.create({
      user_id: input.user_id,
      type: input.type,
      severity: input.severity ?? "info",
      summary: input.summary,
      meta: input.meta ?? null,
      freeze_until: input.freeze_until ?? null,
    });
  } catch (e) {
    userLogger.error("[securityEvent] failed to record", e);
    return null;
  }
};

export interface SecurityEventRow {
  id: number;
  user_id: number;
  email: string | null;
  name: string | null;
  type: SecurityEventType;
  severity: string;
  summary: string;
  meta: Record<string, unknown> | null;
  freeze_until: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  wallet_frozen: boolean;
}

export const listSecurityEvents = async (limit = 50): Promise<SecurityEventRow[]> => {
  const rows = await sequelize.query<Omit<SecurityEventRow, "wallet_frozen">>(
    `SELECT e.id, e.user_id, u.email, u.name, e.type, e.severity, e.summary, e.meta,
            e.freeze_until, e.resolved_at, e.resolved_by, e.created_at
       FROM tbl_security_event e
       LEFT JOIN tbl_user u ON u.user_id = e.user_id
      ORDER BY e.created_at DESC
      LIMIT :limit`,
    { replacements: { limit }, type: QueryTypes.SELECT }
  );
  const frozen = new Map<number, boolean>();
  for (const uid of new Set(rows.map((r) => r.user_id))) {
    frozen.set(uid, (await isWalletFrozen(uid)).frozen);
  }
  return rows.map((r) => ({ ...r, wallet_frozen: frozen.get(r.user_id) ?? false }));
};

export const resolveSecurityEvents = async (userId: number, resolvedBy: string): Promise<number> => {
  const [n] = await SecurityEvent.update(
    { resolved_at: new Date(), resolved_by: resolvedBy },
    { where: { user_id: userId, resolved_at: null } }
  );
  return n;
};
