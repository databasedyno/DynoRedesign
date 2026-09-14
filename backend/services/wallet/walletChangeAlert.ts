/**
 * Wallet change-alert + revert service (Feature: Wallet Change Alerts, 1a).
 *
 * On any payout ADDRESS add/change we:
 *   1. email the merchant a friendly confirmation with a one-tap
 *      "this wasn't me" revert link, and
 *   2. drop an in-app notification (always shown — not preference-gated).
 *
 * Clicking the link (public endpoint -> performRevert) undoes the change and
 * FREEZES further wallet edits until support unlocks the account.
 */
import crypto from "crypto";
import type { Response } from "express";
import config from "../../utils/config";
import {
  getRedisItem,
  setRedisItem,
  setRedisItemWithTTL,
  deleteRedisItem,
} from "../../utils/redisInstance";
import { userWalletModel, companyModel, notificationModel } from "../../models";
import { userModel } from "../../models/userModels";
import { walletLogger } from "../../utils/loggers";
import { invalidateWalletCache } from "../../controller/wallet/walletShared";
import {
  sendWalletChangeAlertEmail,
  sendWalletSecuredEmail,
  WalletChangeRow,
} from "../email/walletSecurityEmails";
import { sendEmail } from "../email/emailShared";

const REVERT_TTL_SECONDS = 7 * 24 * 3600; // link valid for 7 days

const freezeKey = (uid: number | string) => `wallet_freeze_${uid}`;
const revertKey = (token: string) => `wallet_revert_${token}`;
const sudoSessionKey = (uid: number | string) => `wallet_sudo_session_${uid}`;

export interface WalletChange {
  wallet_id: number;
  currency: string;
  action: "add" | "edit";
  previous_address: string | null;
  previous_name: string | null;
  previous_tag: number | null;
  new_address: string | null;
}

export const maskWalletAddr = (a?: string | null): string =>
  a ? `${a.substring(0, 8)}…${a.substring(a.length - 6)}` : "";

const genToken = () => crypto.randomBytes(24).toString("hex");

// ── Freeze state ─────────────────────────────────────────────
export async function isWalletFrozen(
  user_id: number,
): Promise<{ frozen: boolean; reason?: string; since?: string; until?: string | null }> {
  try {
    const s = await getRedisItem(freezeKey(user_id));
    if (s && String(s.frozen) === "true") {
      return { frozen: true, reason: s.reason, since: s.since, until: s.until ?? null };
    }
  } catch (e) {
    walletLogger.warn(`[walletFreeze] read failed for ${user_id}: ${(e as Error).message}`);
  }
  return { frozen: false };
}

/** Guard for controllers: sends a 403 and returns true when wallet edits are frozen. */
export async function assertWalletNotFrozen(res: Response, user_id: number): Promise<boolean> {
  const s = await isWalletFrozen(user_id);
  if (s.frozen) {
    const until = s.until ? new Date(s.until) : null;
    res.status(403).json({
      success: false,
      statusCode: 403,
      code: "WALLET_FROZEN",
      until: s.until ?? null,
      message: until
        ? `Wallet changes are locked until ${until.toUTCString()} following a two-step verification reset. Contact support to unlock sooner.`
        : "Wallet changes are locked for your security. Please contact support to unlock.",
    });
    return true;
  }
  return false;
}

/** Freeze payout-wallet edits. With `ttlSeconds` the lock auto-lifts (e.g. 24h after a 2FA reset). */
export async function freezeWalletChanges(user_id: number, reason: string, ttlSeconds?: number): Promise<void> {
  const until = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  const state = { frozen: true, reason, since: new Date().toISOString(), until };
  if (ttlSeconds) await setRedisItemWithTTL(freezeKey(user_id), state, ttlSeconds);
  else await setRedisItem(freezeKey(user_id), state);
  // Kill any active elevated session so an attacker can't keep editing.
  await deleteRedisItem(sudoSessionKey(user_id)).catch(() => undefined);
  walletLogger.warn(`[walletFreeze] wallet changes FROZEN for user ${user_id}: ${reason}`);
}

export async function clearWalletFreeze(user_id: number): Promise<void> {
  await deleteRedisItem(freezeKey(user_id));
  walletLogger.info(`[walletFreeze] freeze cleared for user ${user_id}`);
}

// ── Change alert ─────────────────────────────────────────────
export async function notifyWalletChanges(params: {
  user_id: number;
  company_id: number | null;
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
  changes: WalletChange[];
  lang?: string | null;
}): Promise<void> {
  try {
    const addressChanges = (params.changes || []).filter(
      (c) => c.new_address && (c.action === "add" || c.new_address !== c.previous_address),
    );
    if (addressChanges.length === 0) return;

    const token = genToken();
    await setRedisItemWithTTL(
      revertKey(token),
      {
        user_id: params.user_id,
        company_id: params.company_id,
        company_name: params.companyName || null,
        changes: JSON.stringify(addressChanges),
        created_at: new Date().toISOString(),
      },
      REVERT_TTL_SECONDS,
    );

    const revertUrl = `${(config.frontendUrl || "https://dynopay.com").replace(/\/$/, "")}/wallet-security?token=${token}`;
    const rows: WalletChangeRow[] = addressChanges.map((c) => ({
      network: c.currency,
      address: maskWalletAddr(c.new_address),
      actionLabel: c.action === "add" ? "added" : "updated",
    }));

    if (params.email) {
      await sendWalletChangeAlertEmail(
        params.email,
        params.name || "",
        { companyName: params.companyName, rows, revertUrl },
        params.lang,
      );
    }

    const networks = addressChanges.map((c) => c.currency).join(", ");
    await notificationModel
      .create({
        user_id: params.user_id,
        company_id: params.company_id || null,
        type: "wallet_changed",
        title: rows.length > 1 ? "Payout wallets changed" : `${addressChanges[0].currency} payout wallet changed`,
        message: `Your payout ${rows.length > 1 ? "wallets were" : "wallet was"} updated (${networks}). If this wasn't you, secure your account now.`,
        data: { revert_url: revertUrl, networks: addressChanges.map((c) => c.currency), action: "wallet_changed" },
        is_read: false,
      })
      .catch((e: Error) => walletLogger.warn(`[walletAlert] notification skipped: ${e.message}`));
  } catch (e) {
    walletLogger.warn(`[walletAlert] notifyWalletChanges skipped: ${(e as Error).message}`);
  }
}

// ── Revert (public "this wasn't me") ─────────────────────────
export async function performRevert(
  token: string,
): Promise<{ ok: boolean; reason?: string; companyName?: string | null; networks?: string[] }> {
  const record = await getRedisItem(revertKey(token));
  if (!record || Object.keys(record).length === 0) {
    return { ok: false, reason: "expired" };
  }

  const user_id = Number(record.user_id);
  const company_id = record.company_id != null ? Number(record.company_id) : null;
  let changes: WalletChange[] = [];
  try {
    changes = JSON.parse(record.changes || "[]");
  } catch {
    changes = [];
  }
  if (!user_id || changes.length === 0) {
    await deleteRedisItem(revertKey(token));
    return { ok: false, reason: "invalid" };
  }

  const networks: string[] = [];
  for (const c of changes) {
    try {
      if (c.action === "add") {
        // Undo the add — clear the slot (mirrors delete behaviour).
        await userWalletModel.update(
          { wallet_address: null, wallet_name: null, company_id: null, destination_tag: null },
          { where: { wallet_id: c.wallet_id, user_id } },
        );
      } else {
        // Restore the previous address / name / tag.
        await userWalletModel.update(
          {
            wallet_address: c.previous_address,
            wallet_name: c.previous_name,
            destination_tag: c.previous_tag,
          },
          { where: { wallet_id: c.wallet_id, user_id } },
        );
      }
      networks.push(c.currency);
    } catch (e) {
      walletLogger.error(`[walletRevert] failed wallet ${c.wallet_id}: ${(e as Error).message}`);
    }
  }

  await freezeWalletChanges(user_id, "Reverted via 'this wasn't me' link");
  await invalidateWalletCache(user_id).catch(() => undefined);
  await deleteRedisItem(revertKey(token));

  // Follow-up notices (best-effort).
  let companyName: string | null = record.company_name || null;
  try {
    const acct = await userModel.findOne({
      where: { user_id },
      attributes: ["email", "name", "language"],
    });
    if (!companyName && company_id) {
      const co = await companyModel.findOne({ where: { company_id } });
      companyName = co?.dataValues?.company_name || null;
    }
    if (acct?.dataValues?.email) {
      await sendWalletSecuredEmail(
        acct.dataValues.email,
        acct.dataValues.name,
        { companyName, networks },
        acct.dataValues.language,
      );
    }
    await notificationModel
      .create({
        user_id,
        company_id: company_id || null,
        type: "wallet_security_lock",
        title: "Account secured",
        message: `We undid the recent payout wallet change${networks.length > 1 ? "s" : ""} and locked wallet changes. Contact support to unlock.`,
        data: { networks, action: "wallet_locked" },
        is_read: false,
      })
      .catch(() => undefined);
  } catch (e) {
    walletLogger.warn(`[walletRevert] follow-up notice skipped: ${(e as Error).message}`);
  }

  // Alert the ops inbox (suppressed in preview via DISABLE_OUTBOUND_EMAIL).
  try {
    if (config.adminEmail) {
      await sendEmail(
        config.adminEmail,
        "DynoPay Security",
        "[Security] Merchant reverted a payout wallet change",
        `User ${user_id} clicked "this wasn't me". Reverted networks: ${networks.join(", ") || "none"}. Wallet changes are now frozen pending manual unlock.`,
      );
    }
  } catch {
    /* non-fatal */
  }

  return { ok: true, companyName, networks };
}
