/**
 * Admin trusted devices — a browser that completed the admin TOTP step gets an
 * HttpOnly `dp_admin_device` cookie. While it is valid (30 rolling days) the
 * TOTP challenge is skipped at admin sign-in ON THAT BROWSER ONLY — the admin
 * PASSWORD is still required every time. A new/unknown browser is always
 * challenged for TOTP. Mirrors the merchant trusted-device flow (services/
 * session/trustedDevices.ts) but scoped to the admin console.
 */
import crypto from "crypto";
import type express from "express";
import { Op } from "sequelize";
import AdminTrustedDevice from "../models/adminTrustedDeviceModel";
import { adminLogger } from "../utils/loggers";
import { requestClientInfo } from "./session/tokens";
import { num } from "../utils/config";

export const ADMIN_TRUSTED_DEVICE_COOKIE = "dp_admin_device";
export const ADMIN_TRUSTED_DEVICE_DAYS = num("ADMIN_TRUSTED_DEVICE_DAYS", 30);
const COOKIE_PATH = "/api/admin";

const hash = (raw: string) => crypto.createHash("sha256").update(String(raw)).digest("hex");
const expiry = () => new Date(Date.now() + ADMIN_TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

export const readAdminDeviceCookie = (req: express.Request): string | null => {
  const raw = (req as express.Request & { cookies?: Record<string, string> }).cookies?.[ADMIN_TRUSTED_DEVICE_COOKIE];
  return raw && /^[a-f0-9]{96}$/i.test(raw) ? raw : null;
};

const isHttps = (req: express.Request) =>
  String(req.headers["x-forwarded-proto"] || req.protocol || "").split(",")[0].trim() === "https";

/** Mint + persist a trust token for this admin browser and set the cookie on the response. */
export const trustAdminDevice = async (adminId: number, req: express.Request, res: express.Response): Promise<void> => {
  const raw = crypto.randomBytes(48).toString("hex");
  const { ipAddress, browser, os, device_name } = requestClientInfo(req);
  await AdminTrustedDevice.create({
    admin_id: adminId,
    token_hash: hash(raw),
    device_name,
    browser,
    os,
    ip_address: ipAddress,
    expires_at: expiry(),
  });
  res.cookie(ADMIN_TRUSTED_DEVICE_COOKIE, raw, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: ADMIN_TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000,
  });
  adminLogger.info(`[AdminTrustedDevice] trusted ${device_name} for admin ${adminId}`);
};

/** True when the request carries a live trust cookie for this admin (renews the rolling window). */
export const isAdminTrustedDevice = async (adminId: number, req: express.Request): Promise<boolean> => {
  const raw = readAdminDeviceCookie(req);
  if (!raw) return false;
  const row = await AdminTrustedDevice.findOne({
    where: { admin_id: adminId, token_hash: hash(raw), revoked_at: null, expires_at: { [Op.gt]: new Date() } },
  });
  if (!row) return false;
  await row.update({ last_seen_at: new Date(), expires_at: expiry() });
  return true;
};

/** Untrust every browser for this admin (used by "sign out everywhere"). */
export const revokeAllAdminTrustedDevices = async (adminId: number): Promise<number> => {
  const [n] = await AdminTrustedDevice.update(
    { revoked_at: new Date() },
    { where: { admin_id: adminId, revoked_at: null } }
  );
  if (n) adminLogger.info(`[AdminTrustedDevice] revoked ${n} device(s) for admin ${adminId}`);
  return n;
};

export const clearAdminDeviceCookie = (res: express.Response) => {
  res.clearCookie(ADMIN_TRUSTED_DEVICE_COOKIE, { path: COOKIE_PATH });
};
