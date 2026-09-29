/**
 * Admin-console authentication service (SEC-002 remediation).
 *
 * Replaces the legacy password-only 30-day admin JWT with:
 *   1. Mandatory TOTP — enroll on first login, verify on every login.
 *   2. Short-lived (<=12h), server-side, revocable sessions (tbl_admin_session)
 *      + per-admin tokens_valid_after cutoff ("sign out everywhere").
 *   3. Step-up (reason-bound, one-use) re-verification for sensitive writes.
 *   4. Account lockout on repeated failures.
 *
 * tbl_admin is read/written via parameterized raw SQL (the table predates the
 * Sequelize timestamps convention); tbl_admin_session uses its Sequelize model.
 */
import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import sha256 from "crypto-js/sha256";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { raw as envRaw, num } from "../utils/config";
import { redis } from "../utils/redisInstance";
import adminSessionModel from "../models/adminSessionModel";
import { adminLogger } from "../utils/loggers";
import {
  generateAdminSecret,
  buildOtpauthUri,
  buildQrDataUrl,
  verifyAdminTotp,
  generateBackupCodes,
  matchBackupCode,
} from "./adminTotpService";

const BCRYPT_ROUNDS = 12;
const ADMIN_ISSUER = envRaw("ADMIN_ISSUER") || "dynopay-admin";
const ADMIN_AUDIENCE = envRaw("ADMIN_AUDIENCE") || "dynopay-admin-console";
const TOKEN_TTL_HOURS = num("ADMIN_TOKEN_TTL_HOURS", 12);
const MAX_FAILED = num("ADMIN_LOCKOUT_MAX_ATTEMPTS", 5);
const LOCKOUT_MINUTES = num("ADMIN_LOCKOUT_DURATION_MINUTES", 15);

const CHALLENGE_TTL = 300; // 5 min — password->TOTP handoff
const ENROLL_TTL = 600; // 10 min — enrollment window
const STEPUP_TTL = 300; // 5 min — one sensitive write

export const ADMIN_STEPUP_REASONS = [
  "platform-settings",
  "fund-transfer",
  "payout",
  "security",
] as const;
export type AdminStepUpReason = (typeof ADMIN_STEPUP_REASONS)[number];

export class AdminAuthError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const adminSecret = (): string => {
  const s = envRaw("ADMIN_JWT_SECRET") || envRaw("ACCESS_TOKEN_SECRET");
  if (!s) throw new AdminAuthError(500, "Server configuration error. Token secret not set.");
  return s;
};

export interface AdminRow {
  admin_id: number;
  name: string | null;
  email: string;
  password: string;
  role: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  totp_backup_codes: string[] | null;
  tokens_valid_after: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
}

const clientIp = (req: express.Request): string =>
  String((req.headers["x-forwarded-for"] as string) || req.ip || "")
    .split(",")[0]
    .trim();

const rand = () => crypto.randomBytes(32).toString("base64url");
const challengeKey = (t: string) => `admin:login-challenge:${t}`;
const enrollKey = (t: string) => `admin:enroll:${t}`;
const stepUpKey = (sid: string, reason: string) => `admin:stepup:${sid}:${reason}`;

const getAdminByEmail = async (email: string): Promise<AdminRow | null> => {
  const rows = await sequelize.query<AdminRow>(
    `SELECT * FROM tbl_admin WHERE email = :email`,
    { replacements: { email: String(email || "").trim() }, type: QueryTypes.SELECT }
  );
  return rows[0] || null;
};

const getAdminById = async (adminId: number): Promise<AdminRow | null> => {
  const rows = await sequelize.query<AdminRow>(
    `SELECT * FROM tbl_admin WHERE admin_id = :id`,
    { replacements: { id: adminId }, type: QueryTypes.SELECT }
  );
  return rows[0] || null;
};

const recordFailure = async (adminId: number) => {
  await sequelize.query(
    `UPDATE tbl_admin
        SET failed_login_count = COALESCE(failed_login_count,0) + 1,
            locked_until = CASE
              WHEN COALESCE(failed_login_count,0) + 1 >= :max
              THEN NOW() + (:mins || ' minutes')::interval
              ELSE locked_until END
      WHERE admin_id = :id`,
    { replacements: { id: adminId, max: MAX_FAILED, mins: LOCKOUT_MINUTES }, type: QueryTypes.UPDATE }
  );
};

const resetFailures = async (adminId: number) => {
  await sequelize.query(
    `UPDATE tbl_admin SET failed_login_count = 0, locked_until = NULL WHERE admin_id = :id`,
    { replacements: { id: adminId }, type: QueryTypes.UPDATE }
  );
};

const isLocked = (admin: AdminRow): number => {
  if (!admin.locked_until) return 0;
  const until = new Date(admin.locked_until).getTime();
  if (until <= Date.now()) return 0;
  return Math.ceil((until - Date.now()) / 60000);
};

/** bcrypt verify with transparent legacy SHA-256 -> bcrypt migration (preserves prior behaviour). */
const verifyPassword = async (admin: AdminRow, password: string): Promise<boolean> => {
  const stored = admin.password || "";
  if (/^\$2[aby]?\$/.test(stored)) return bcrypt.compareSync(password, stored);
  // Legacy SHA-256
  if (sha256(password).toString() === stored) {
    try {
      const bcryptHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
      await sequelize.query(`UPDATE tbl_admin SET password = :p WHERE admin_id = :id`, {
        replacements: { p: bcryptHash, id: admin.admin_id },
        type: QueryTypes.UPDATE,
      });
      adminLogger.info(`[adminAuth] password migrated to bcrypt for admin ${admin.admin_id}`);
    } catch {
      /* non-fatal */
    }
    return true;
  }
  return false;
};

const issueSession = async (
  admin: AdminRow,
  req: express.Request
): Promise<{ accessToken: string; expiresAt: string }> => {
  const sid = crypto.randomUUID();
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
  await adminSessionModel.create({
    session_id: sid,
    admin_id: admin.admin_id,
    jti,
    expires_at: expiresAt,
    last_seen_at: new Date(),
    ip: clientIp(req),
    user_agent: String(req.headers["user-agent"] || "").slice(0, 400),
  });
  const accessToken = jwt.sign(
    { sub: String(admin.admin_id), email: admin.email, role: "ADMIN", sid, jti },
    adminSecret(),
    {
      algorithm: "HS256",
      expiresIn: `${TOKEN_TTL_HOURS}h`,
      issuer: ADMIN_ISSUER,
      audience: ADMIN_AUDIENCE,
    }
  );
  adminLogger.info(`[adminAuth] session issued admin=${admin.admin_id} sid=${sid} ip=${clientIp(req)}`);
  return { accessToken, expiresAt: expiresAt.toISOString() };
};

export type PasswordPhaseResult =
  | { status: "TOTP_REQUIRED"; challengeToken: string }
  | { status: "ENROLL_REQUIRED"; enrollToken: string };

/** Step 1: verify email + password. Never issues a token here. */
export const passwordPhase = async (
  email: string,
  password: string,
  req: express.Request
): Promise<PasswordPhaseResult> => {
  const admin = await getAdminByEmail(email);
  const ok = admin ? await verifyPassword(admin, String(password || "")) : false;
  if (!admin || !ok) {
    if (admin) await recordFailure(admin.admin_id);
    adminLogger.warn(`[adminAuth] failed password login for "${email}" ip=${clientIp(req)}`);
    throw new AdminAuthError(401, "Invalid username or password!");
  }
  const lockedMins = isLocked(admin);
  if (lockedMins > 0) {
    throw new AdminAuthError(429, `Too many attempts. Try again in ${lockedMins} minute(s).`);
  }
  await resetFailures(admin.admin_id);

  if (!admin.totp_secret || !admin.totp_enabled) {
    const enrollToken = rand();
    await redis.set(enrollKey(enrollToken), JSON.stringify({ admin_id: admin.admin_id }), {
      EX: ENROLL_TTL,
    });
    adminLogger.info(`[adminAuth] enrollment required admin=${admin.admin_id}`);
    return { status: "ENROLL_REQUIRED", enrollToken };
  }

  const challengeToken = rand();
  await redis.set(challengeKey(challengeToken), JSON.stringify({ admin_id: admin.admin_id }), {
    EX: CHALLENGE_TTL,
  });
  return { status: "TOTP_REQUIRED", challengeToken };
};

/** Enrollment step A: mint a pending secret + QR (stored in Redis, not the DB yet). */
export const beginEnrollment = async (
  enrollToken: string
): Promise<{ secret: string; otpauth: string; qr: string }> => {
  const raw = await redis.get(enrollKey(enrollToken));
  if (!raw) throw new AdminAuthError(400, "Enrollment session expired. Please sign in again.");
  const { admin_id } = JSON.parse(raw) as { admin_id: number };
  const admin = await getAdminById(admin_id);
  if (!admin) throw new AdminAuthError(400, "Admin not found.");

  const secret = generateAdminSecret();
  const otpauth = buildOtpauthUri(admin.email, secret);
  const qr = await buildQrDataUrl(otpauth);
  await redis.set(enrollKey(enrollToken), JSON.stringify({ admin_id, secret }), { EX: ENROLL_TTL });
  return { secret, otpauth, qr };
};

/** Enrollment step B: verify the first code, persist secret + backup codes, auto-login. */
export const completeEnrollment = async (
  enrollToken: string,
  code: string,
  req: express.Request
): Promise<{ accessToken: string; expiresAt: string; backupCodes: string[] }> => {
  const raw = await redis.get(enrollKey(enrollToken));
  if (!raw) throw new AdminAuthError(400, "Enrollment session expired. Please sign in again.");
  const parsed = JSON.parse(raw) as { admin_id: number; secret?: string };
  if (!parsed.secret) throw new AdminAuthError(400, "Please scan the QR code first.");
  if (!verifyAdminTotp(String(code || ""), parsed.secret)) {
    throw new AdminAuthError(400, "Invalid code. Enter a fresh 6-digit code from your authenticator app.");
  }
  const { plain, hashes } = generateBackupCodes();
  await sequelize.query(
    `UPDATE tbl_admin
        SET totp_secret = :secret, totp_enabled = true, totp_enrolled_at = NOW(),
            totp_backup_codes = :codes::jsonb, failed_login_count = 0, locked_until = NULL
      WHERE admin_id = :id`,
    {
      replacements: { secret: parsed.secret, codes: JSON.stringify(hashes), id: parsed.admin_id },
      type: QueryTypes.UPDATE,
    }
  );
  await redis.del(enrollKey(enrollToken));
  const admin = await getAdminById(parsed.admin_id);
  adminLogger.info(`[adminAuth] TOTP enrolled admin=${parsed.admin_id}`);
  const session = await issueSession(admin!, req);
  return { ...session, backupCodes: plain };
};

/** Step 2: verify the TOTP (or a backup code) and issue a session. */
export const totpPhase = async (
  challengeToken: string,
  code: string,
  req: express.Request
): Promise<{ accessToken: string; expiresAt: string; usedBackupCode?: boolean }> => {
  const raw = await redis.getDel(challengeKey(challengeToken)); // one-use
  if (!raw) throw new AdminAuthError(400, "Verification expired. Please sign in again.");
  const { admin_id } = JSON.parse(raw) as { admin_id: number };
  const admin = await getAdminById(admin_id);
  if (!admin) throw new AdminAuthError(400, "Admin not found.");

  const input = String(code || "").trim();
  if (verifyAdminTotp(input, admin.totp_secret)) {
    await resetFailures(admin.admin_id);
    const session = await issueSession(admin, req);
    return session;
  }
  const backup = matchBackupCode(input, admin.totp_backup_codes);
  if (backup.matched) {
    await sequelize.query(
      `UPDATE tbl_admin SET totp_backup_codes = :codes::jsonb, failed_login_count = 0, locked_until = NULL WHERE admin_id = :id`,
      { replacements: { codes: JSON.stringify(backup.remaining), id: admin.admin_id }, type: QueryTypes.UPDATE }
    );
    adminLogger.warn(`[adminAuth] backup code used admin=${admin.admin_id} remaining=${backup.remaining.length}`);
    const session = await issueSession(admin, req);
    return { ...session, usedBackupCode: true };
  }
  await recordFailure(admin.admin_id);
  adminLogger.warn(`[adminAuth] failed TOTP admin=${admin.admin_id}`);
  throw new AdminAuthError(400, "Invalid verification code.");
};

/** Revoke the current session (logout). */
export const revokeSession = async (sessionId: string, reason = "logout") => {
  await adminSessionModel.update(
    { revoked_at: new Date(), revoke_reason: reason },
    { where: { session_id: sessionId, revoked_at: null } }
  );
};

/** Sign out everywhere: revoke all sessions + move the token cutoff to now. */
export const revokeAllSessions = async (adminId: number, reason = "logout_all") => {
  await adminSessionModel.update(
    { revoked_at: new Date(), revoke_reason: reason },
    { where: { admin_id: adminId, revoked_at: null } }
  );
  await sequelize.query(`UPDATE tbl_admin SET tokens_valid_after = NOW() WHERE admin_id = :id`, {
    replacements: { id: adminId },
    type: QueryTypes.UPDATE,
  });
  adminLogger.info(`[adminAuth] all sessions revoked admin=${adminId}`);
};

export interface VerifiedAdmin {
  admin_id: number;
  email: string;
  role: string;
  sid: string;
}

/** adminAuthMiddleware core: verify JWT + live session state. Throws AdminAuthError. */
export const verifyAccessToken = async (token: string): Promise<VerifiedAdmin> => {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, adminSecret(), {
      algorithms: ["HS256"],
      issuer: ADMIN_ISSUER,
      audience: ADMIN_AUDIENCE,
    }) as jwt.JwtPayload;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "TokenExpiredError") throw new AdminAuthError(403, "Your session has expired. Please sign in again.");
    throw new AdminAuthError(403, "Invalid session. Please sign in again.");
  }
  if (payload.role !== "ADMIN" || !payload.sid || !payload.jti) {
    throw new AdminAuthError(403, "Admin access required.");
  }
  const session = await adminSessionModel.findOne({ where: { session_id: String(payload.sid) } });
  const now = new Date();
  if (
    !session ||
    session.getDataValue("jti") !== payload.jti ||
    session.getDataValue("revoked_at") ||
    new Date(session.getDataValue("expires_at")) <= now
  ) {
    throw new AdminAuthError(403, "Session revoked or expired. Please sign in again.");
  }
  const admin = await getAdminById(Number(payload.sub));
  if (!admin) throw new AdminAuthError(403, "Admin not found.");
  if (admin.tokens_valid_after && payload.iat && new Date(admin.tokens_valid_after).getTime() > payload.iat * 1000) {
    throw new AdminAuthError(403, "Session revoked. Please sign in again.");
  }
  // Best-effort activity stamp (never block the request on it).
  adminSessionModel
    .update({ last_seen_at: now }, { where: { session_id: String(payload.sid) } })
    .catch(() => undefined);

  return { admin_id: admin.admin_id, email: admin.email, role: "ADMIN", sid: String(payload.sid) };
};

/** List active (non-revoked, unexpired) sessions for the admin console. */
export const listSessions = async (adminId: number, currentSid?: string) => {
  const rows = await adminSessionModel.findAll({
    where: { admin_id: adminId, revoked_at: null },
    order: [["last_seen_at", "DESC"]],
  });
  return rows
    .filter((r) => new Date(r.getDataValue("expires_at")) > new Date())
    .map((r) => ({
      session_id: r.getDataValue("session_id"),
      ip: r.getDataValue("ip"),
      user_agent: r.getDataValue("user_agent"),
      last_seen_at: r.getDataValue("last_seen_at"),
      created_at: r.getDataValue("created_at"),
      expires_at: r.getDataValue("expires_at"),
      is_current: r.getDataValue("session_id") === currentSid,
    }));
};

/** Step-up: verify TOTP/backup then mint a one-use, reason-bound grant bound to the session. */
export const verifyStepUp = async (
  adminId: number,
  sessionId: string,
  reason: string,
  code: string
): Promise<{ stepUpToken: string; expiresIn: number }> => {
  if (!ADMIN_STEPUP_REASONS.includes(reason as AdminStepUpReason)) {
    throw new AdminAuthError(400, "Invalid step-up reason.");
  }
  const admin = await getAdminById(adminId);
  if (!admin) throw new AdminAuthError(400, "Admin not found.");
  const input = String(code || "").trim();
  let ok = verifyAdminTotp(input, admin.totp_secret);
  if (!ok) {
    const backup = matchBackupCode(input, admin.totp_backup_codes);
    if (backup.matched) {
      ok = true;
      await sequelize.query(
        `UPDATE tbl_admin SET totp_backup_codes = :codes::jsonb WHERE admin_id = :id`,
        { replacements: { codes: JSON.stringify(backup.remaining), id: adminId }, type: QueryTypes.UPDATE }
      );
    }
  }
  if (!ok) {
    adminLogger.warn(`[adminAuth] step-up failed admin=${adminId} reason=${reason}`);
    throw new AdminAuthError(401, "Invalid verification code.");
  }
  const token = rand();
  await redis.set(stepUpKey(sessionId, reason), token, { EX: STEPUP_TTL });
  adminLogger.info(`[adminAuth] step-up granted admin=${adminId} reason=${reason}`);
  return { stepUpToken: token, expiresIn: STEPUP_TTL };
};

/** requireAdminStepUp middleware: consume a one-use grant for a given reason. */
export const consumeStepUp = async (
  sessionId: string,
  reason: string,
  token: string
): Promise<boolean> => {
  const key = stepUpKey(sessionId, reason);
  const stored = await redis.get(key);
  if (!stored || !token) return false;
  const a = Buffer.from(String(stored));
  const b = Buffer.from(String(token));
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return false;
  await redis.del(key);
  return true;
};

export const getAdminStatus = async (adminId: number) => {
  const admin = await getAdminById(adminId);
  return {
    email: admin?.email || null,
    name: admin?.name || null,
    totp_enabled: !!admin?.totp_enabled,
    backup_codes_remaining: Array.isArray(admin?.totp_backup_codes)
      ? admin!.totp_backup_codes!.length
      : 0,
  };
};
