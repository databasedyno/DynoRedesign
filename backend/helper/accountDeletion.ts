/**
 * Account soft-delete predicate + constants (pure, no heavy imports so the hot
 * auth path can import it freely). The actual soft-delete / restore / purge
 * operations live in services/accountPurgeService.ts.
 */

/** Days a soft-deleted account is retained before the cron permanently purges it. */
export const ACCOUNT_DELETE_GRACE_DAYS = 7;

/** 403 shown at every login entry point when the account is scheduled for deletion. */
export const ACCOUNT_DELETED_LOGIN_MESSAGE =
  "This account is scheduled for deletion. Contact support within your 7-day recovery window to restore it.";

/** True when a user row (model instance or plain row) has been soft-deleted. */
export const isUserSoftDeleted = (row: unknown): boolean => {
  const r = row as { deleted_at?: unknown; dataValues?: { deleted_at?: unknown } } | null | undefined;
  return Boolean(r?.deleted_at ?? r?.dataValues?.deleted_at);
};
