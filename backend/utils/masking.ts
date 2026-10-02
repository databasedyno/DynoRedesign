import crypto from "crypto";
import { raw as envRaw } from "./config";

/** "jo***@example.com" — the 2FA / step-up mask. */
export const maskEmail = (e?: string | null): string => (e ? e.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "");

/** "0x12345678…abcdef" for payout addresses in emails/UI. */
export const maskAddress = (a?: string | null): string => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a || "");

/** One-way hash for OTP / step-up codes stored in Redis (never store the raw code). */
export const hashCode = (code: string): string =>
  crypto.createHmac("sha256", String(envRaw("API_SECRET") || "dynopay")).update(String(code)).digest("hex");
