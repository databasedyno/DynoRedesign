/**
 * Admin-console TOTP + backup codes (SEC-002).
 *
 * Mirrors the merchant twoFactorService (otplib v13 functional API) so the admin
 * console shares the exact same crypto conventions. The TOTP secret is stored on
 * tbl_admin.totp_secret; backup codes are stored as sha256 hashes on
 * tbl_admin.totp_backup_codes (same scheme as tbl_user_2fa.backup_codes).
 */
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import { raw as envRaw } from "../utils/config";

const APP_NAME = envRaw("APP_NAME") || "Dynopay";
const BACKUP_CODE_COUNT = parseInt(
  envRaw("ADMIN_BACKUP_CODE_COUNT") || envRaw("BACKUP_CODE_COUNT") || "10",
  10
);

/** Fresh Base32 TOTP secret (kept pending in Redis until the first code verifies). */
export const generateAdminSecret = (): string => generateSecret();

/** otpauth:// URI for the authenticator QR. Never log this — it embeds the secret. */
export const buildOtpauthUri = (email: string, secret: string): string =>
  generateURI({
    secret,
    issuer: APP_NAME,
    label: `${APP_NAME} Admin (${email})`,
    strategy: "totp",
  });

export const buildQrDataUrl = async (otpauth: string): Promise<string> =>
  QRCode.toDataURL(otpauth);

/** Verify a 6-digit TOTP against a secret with a one-step (30s) clock tolerance. */
export const verifyAdminTotp = (
  token: string,
  secret: string | null | undefined
): boolean => {
  if (!secret || !token) return false;
  try {
    const r = verifySync({
      token: String(token).replace(/\s/g, ""),
      secret,
      strategy: "totp",
      epochTolerance: 30,
    });
    return r?.valid === true;
  } catch {
    return false;
  }
};

const normalizeBackup = (s: string) => s.replace(/[-\s]/g, "").toUpperCase();

export const hashBackupCode = (code: string): string =>
  crypto.createHash("sha256").update(normalizeBackup(code)).digest("hex");

/** Ten single-use recovery codes (plaintext shown once, hashes stored). */
export const generateBackupCodes = (): { plain: string[]; hashes: string[] } => {
  const plain: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plain.push(code);
    hashes.push(hashBackupCode(code));
  }
  return { plain, hashes };
};

/** Match + burn a backup code; returns the remaining hashes when matched. */
export const matchBackupCode = (
  input: string,
  hashes: string[] | null | undefined
): { matched: boolean; remaining: string[] } => {
  const list = Array.isArray(hashes) ? hashes : [];
  if (!input || !list.length) return { matched: false, remaining: list };
  const h = hashBackupCode(input);
  if (list.includes(h)) return { matched: true, remaining: list.filter((x) => x !== h) };
  return { matched: false, remaining: list };
};
