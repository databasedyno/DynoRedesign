/**
 * Trusted devices — a browser that completed the second factor gets an HttpOnly
 * `dp_device` cookie. While it is valid (90 rolling days) the 2FA challenge is
 * skipped at sign-in on that browser only; a new browser/device is challenged.
 */
import crypto from "crypto";
import type express from "express";
import { Op } from "sequelize";
import TrustedDevice from "../../models/securityModels/trustedDeviceModel";
import { userLogger } from "../../utils/loggers";
import { requestClientInfo } from "./tokens";

export const TRUSTED_DEVICE_COOKIE = "dp_device";
export const TRUSTED_DEVICE_DAYS = 90;
const COOKIE_PATH = "/api/user";

const hash = (raw: string) => crypto.createHash("sha256").update(String(raw)).digest("hex");
const expiry = () => new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

export const readDeviceCookie = (req: express.Request): string | null => {
  const raw = (req as express.Request & { cookies?: Record<string, string> }).cookies?.[TRUSTED_DEVICE_COOKIE];
  return raw && /^[a-f0-9]{96}$/i.test(raw) ? raw : null;
};

const isHttps = (req: express.Request) =>
  String(req.headers["x-forwarded-proto"] || req.protocol || "").split(",")[0].trim() === "https";

/** Mint + persist a trust token for this browser and set the cookie on the response. */
export const trustDevice = async (userId: number, req: express.Request, res: express.Response): Promise<void> => {
  const raw = crypto.randomBytes(48).toString("hex");
  const { ipAddress, browser, os, device_name } = requestClientInfo(req);
  await TrustedDevice.create({
    user_id: userId,
    token_hash: hash(raw),
    device_name,
    browser,
    os,
    ip_address: ipAddress,
    expires_at: expiry(),
  });
  res.cookie(TRUSTED_DEVICE_COOKIE, raw, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000,
  });
  userLogger.info(`[TrustedDevice] trusted ${device_name} for user ${userId}`);
};

/** True when the request carries a live trust cookie for this user (renews the rolling window). */
export const isTrustedDevice = async (userId: number, req: express.Request): Promise<boolean> => {
  const raw = readDeviceCookie(req);
  if (!raw) return false;
  const row = await TrustedDevice.findOne({
    where: { user_id: userId, token_hash: hash(raw), revoked_at: null, expires_at: { [Op.gt]: new Date() } },
  });
  if (!row) return false;
  await row.update({ last_seen_at: new Date(), expires_at: expiry() });
  return true;
};

export const listTrustedDevices = async (userId: number, req: express.Request) => {
  const raw = readDeviceCookie(req);
  const current = raw ? hash(raw) : null;
  const rows = await TrustedDevice.findAll({
    where: { user_id: userId, revoked_at: null, expires_at: { [Op.gt]: new Date() } },
    order: [["last_seen_at", "DESC"]],
  });
  return rows.map((r) => ({
    id: r.id,
    device_name: r.device_name,
    browser: r.browser,
    os: r.os,
    ip_address: r.ip_address,
    created_at: r.created_at,
    last_seen_at: r.last_seen_at,
    expires_at: r.expires_at,
    is_current: current !== null && r.token_hash === current,
  }));
};

export const revokeTrustedDevice = async (userId: number, id: number): Promise<boolean> => {
  const [n] = await TrustedDevice.update({ revoked_at: new Date() }, { where: { id, user_id: userId, revoked_at: null } });
  return n > 0;
};

export const revokeAllTrustedDevices = async (userId: number): Promise<number> => {
  const [n] = await TrustedDevice.update({ revoked_at: new Date() }, { where: { user_id: userId, revoked_at: null } });
  if (n) userLogger.info(`[TrustedDevice] revoked ${n} device(s) for user ${userId}`);
  return n;
};

export const clearDeviceCookie = (res: express.Response) => {
  res.clearCookie(TRUSTED_DEVICE_COOKIE, { path: COOKIE_PATH });
};
