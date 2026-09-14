/**
 * Mandatory second-factor rollout.
 *   - New accounts enrol during onboarding (first wizard step).
 *   - Existing accounts get a 14-day grace window that starts on their first
 *     sign-in after this shipped (tbl_user.mfa_deadline_at); afterwards a hard
 *     wall blocks the app UI and every step-up-gated mutation until enrolled.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { getLoginFactor } from "./twoFactorService";

export const MFA_GRACE_DAYS = 14;

export interface MfaEnforcement {
  enrolled: boolean;
  method: "totp" | "email" | null;
  deadline_at: string | null;
  days_left: number | null;
  hard_wall: boolean;
}

const loadDeadline = async (userId: number): Promise<Date | null> => {
  const rows = await sequelize.query<{ mfa_deadline_at: Date | string | null }>(
    "SELECT mfa_deadline_at FROM tbl_user WHERE user_id = :userId",
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  const v = rows[0]?.mfa_deadline_at;
  return v ? new Date(v) : null;
};

/** Start the grace clock the first time an un-enrolled user signs in (no-op otherwise). */
export const ensureMfaDeadline = async (userId: number): Promise<void> => {
  if (await getLoginFactor(userId)) return;
  await sequelize.query(
    `UPDATE tbl_user SET mfa_deadline_at = NOW() + INTERVAL '${MFA_GRACE_DAYS} days'
      WHERE user_id = :userId AND mfa_deadline_at IS NULL`,
    { replacements: { userId } }
  );
};

export const getMfaEnforcement = async (userId: number): Promise<MfaEnforcement> => {
  const [method, deadline] = await Promise.all([getLoginFactor(userId), loadDeadline(userId)]);
  if (method) return { enrolled: true, method, deadline_at: null, days_left: null, hard_wall: false };
  const now = Date.now();
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - now) / 86_400_000)) : null;
  return {
    enrolled: false,
    method: null,
    deadline_at: deadline ? deadline.toISOString() : null,
    days_left: daysLeft,
    hard_wall: !!deadline && deadline.getTime() <= now,
  };
};

export const isMfaHardWalled = async (userId: number): Promise<boolean> => (await getMfaEnforcement(userId)).hard_wall;

export const mfaEnrollmentRequiredBody = () => ({
  success: false,
  statusCode: 403,
  code: "MFA_ENROLLMENT_REQUIRED",
  message: "Set up two-step verification to continue. It takes about a minute.",
});
