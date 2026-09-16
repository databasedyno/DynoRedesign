/**
 * Account soft-delete predicate + constants (pure, no heavy imports so the hot
 * auth path can import it freely). The actual soft-delete / restore / purge
 * operations live in services/accountPurgeService.ts.
 */

/** Days a soft-deleted account is retained before the cron permanently purges it.
 *  AML/KYC compliance: financial + identity records must be retained ~10 years.
 *  The account is LOCKED (sign-in blocked, sessions revoked) immediately on
 *  delete; the irreversible data purge only happens after this window. */
export const ACCOUNT_DELETE_GRACE_DAYS = 3650;

/** 403 shown at every login entry point when the account is scheduled for deletion. */
export const ACCOUNT_DELETED_LOGIN_MESSAGE =
  "This account has been deactivated at your request. For compliance reasons some records are retained securely and are no longer accessible to you. Contact support if you'd like it restored.";

/** True when a user row (model instance or plain row) has been soft-deleted. */
export const isUserSoftDeleted = (row: unknown): boolean => {
  const r = row as { deleted_at?: unknown; dataValues?: { deleted_at?: unknown } } | null | undefined;
  return Boolean(r?.deleted_at ?? r?.dataValues?.deleted_at);
};
