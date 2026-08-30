import { raw as envRaw } from "../utils/config";
import { apiLogger, cronLogger } from "../utils/loggers";
import { QueryTypes, Op } from "sequelize";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import ReferralPayout from "../models/referralModels/referralPayoutModel";
import { tatumClient } from "../integrations/tatum/TatumClient";
import { redis, acquireLock, releaseLock } from "../utils/redisInstance";
import { sendWithdrawalOTPEmail, sendWithdrawalSuccessEmail } from "./emailService";
import { getReferrerCommissionSummary } from "./referralService";
import binanceService from "./binanceService";

/**
 * Referral revenue-share CASH-OUT (Phase 2). Reward accrues at the ACCOUNT level
 * (tbl_user) but wallets live at the COMPANY level (tbl_user_wallet): aggregate
 * every TRON address across all the account's companies for reuse, opt into cash
 * (saved address = no OTP; new = emailed OTP), OTP-gated payout REQUEST (no funds
 * move — API only writes a row), and execute via Binance USDT-TRC20 on the
 * LEADER/PROD cron only (submitWithdrawal is NEVER called from an API request).
 */

export const MIN_PAYOUT_USDT: number = (() => {
  const v = Number(envRaw("REFERRAL_MIN_PAYOUT_USDT"));
  return Number.isFinite(v) && v > 0 ? v : 25;
})();

const OTP_TTL_SECONDS = 300;
const OTP_KEY = (userId: number) => `referral-payout-otp:${userId}`;

const isValidTronAddress = (address: string): boolean => {
  if (!address || typeof address !== "string") return false;
  try {
    return !!tatumClient.validateTronAddress(address.trim());
  } catch {
    return false;
  }
};

const maskAddress = (a: string): string =>
  a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

// Cross-company reusable TRON wallets

export interface ReusableWallet {
  wallet_id: number;
  wallet_name: string | null;
  wallet_type: string;
  company_name: string | null;
  address: string;
  address_masked: string;
  label: string;
}

export const getReusableTrc20Wallets = async (userId: number): Promise<ReusableWallet[]> => {
  const rows = await sequelize.query<{
    wallet_id: number;
    wallet_name: string | null;
    wallet_type: string;
    wallet_address: string;
    company_id: number | null;
    company_name: string | null;
  }>(
    `SELECT w.wallet_id, w.wallet_name, w.wallet_type, w.wallet_address,
            w.company_id, c.company_name
       FROM tbl_user_wallet w
       LEFT JOIN tbl_company c ON c.company_id = w.company_id
      WHERE w.user_id = :userId
        AND w.wallet_type IN ('USDT-TRC20','TRX')
        AND w.wallet_address IS NOT NULL
      ORDER BY w.wallet_id ASC`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  const seen = new Set<string>();
  const wallets: ReusableWallet[] = [];
  for (const r of rows) {
    const addr = (r.wallet_address || "").trim();
    if (!addr || seen.has(addr)) continue;
    if (!isValidTronAddress(addr)) continue;
    seen.add(addr);
    wallets.push({
      wallet_id: r.wallet_id,
      wallet_name: r.wallet_name || null,
      wallet_type: r.wallet_type,
      company_name: r.company_name || null,
      address: addr,
      address_masked: maskAddress(addr),
      label: [r.wallet_name, r.company_name].filter(Boolean).join(" · ") || maskAddress(addr),
    });
  }
  return wallets;
};

// Overview (read-only)

export const getPayoutOverview = async (userId: number) => {
  const user = await User.findByPk(userId, {
    attributes: [
      "user_id",
      "email",
      "name",
      "referral_payout_mode",
      "referral_payout_trc20_address",
      "referral_payout_address_verified_at",
    ],
  });
  if (!user) throw new Error("User not found");
  const u = user as unknown as Record<string, unknown>;

  const commission = await getReferrerCommissionSummary(userId);
  const unpaid = round2(commission.unpaid_balance_usd || 0);

  const wallets = await getReusableTrc20Wallets(userId);

  const pending = await ReferralPayout.findOne({
    where: { user_id: userId, status: { [Op.in]: ["pending", "processing"] } },
    order: [["payout_id", "DESC"]],
  });

  const mode = (u.referral_payout_mode as string) || "credit";
  const address = (u.referral_payout_trc20_address as string) || null;
  const verifiedAt = (u.referral_payout_address_verified_at as Date) || null;
  const hasVerifiedAddress = !!(address && verifiedAt);

  return {
    mode,
    trc20_address: address,
    trc20_address_masked: address ? maskAddress(address) : null,
    address_verified_at: verifiedAt,
    min_payout_usd: MIN_PAYOUT_USDT,
    unpaid_balance_usd: unpaid,
    has_verified_address: hasVerifiedAddress,
    can_withdraw: mode === "cash" && hasVerifiedAddress && unpaid >= MIN_PAYOUT_USDT && !pending,
    pending_payout: pending
      ? {
          payout_id: pending.payout_id,
          amount_usd: Number(pending.amount_usd),
          status: pending.status,
          requested_at: pending.requested_at,
        }
      : null,
    wallets,
  };
};

// OTP (reuses the merchant withdrawal-OTP email)

export const sendPayoutOtp = async (
  userId: number,
  address?: string
): Promise<{ success: boolean; message: string; email_masked?: string }> => {
  const user = await User.findByPk(userId, { attributes: ["user_id", "email", "name", "language"] });
  if (!user) return { success: false, message: "User not found" };
  const u = user as unknown as Record<string, string>;

  const addr = (address || "").trim();
  if (addr && !isValidTronAddress(addr)) {
    return { success: false, message: "Enter a valid USDT (TRC-20) address" };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(OTP_KEY(userId), JSON.stringify({ code, address: addr || null }), { EX: OTP_TTL_SECONDS });

  await sendWithdrawalOTPEmail(
    u.email,
    u.name || "there",
    code,
    "your referral earnings",
    "USDT (TRC-20)",
    addr ? maskAddress(addr) : u.email || "",
    u.language
  );

  const masked = (u.email || "").replace(/(.{2})(.*)(@.*)/, "$1***$3");
  apiLogger.info(`[ReferralPayout] OTP sent to ${masked} (user ${userId})`);
  return { success: true, message: `Code sent to ${masked}`, email_masked: masked };
};

const consumeOtp = async (
  userId: number,
  otp: string,
  requireAddress?: string
): Promise<{ ok: boolean; message?: string }> => {
  const raw = await redis.get(OTP_KEY(userId));
  if (!raw) return { ok: false, message: "Code expired — request a new one" };
  let stored: { code: string; address: string | null };
  try {
    stored = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Code invalid — request a new one" };
  }
  if (String(otp).trim() !== stored.code) return { ok: false, message: "Incorrect code" };
  if (requireAddress && stored.address && stored.address !== requireAddress) {
    return { ok: false, message: "Code was issued for a different address" };
  }
  await redis.del(OTP_KEY(userId));
  return { ok: true };
};

// Opt-in (select saved address = no OTP; new = OTP)

export const optInPayout = async (params: {
  userId: number;
  mode: "credit" | "cash";
  address?: string;
  otp?: string;
}): Promise<{
  success: boolean;
  statusCode?: number;
  code?: string;
  message: string;
  mode?: string;
  trc20_address?: string;
  trc20_address_masked?: string;
}> => {
  const { userId, mode } = params;
  const user = await User.findByPk(userId);
  if (!user) return { success: false, statusCode: 404, message: "User not found" };

  if (mode === "credit") {
    await User.update({ referral_payout_mode: "credit" } as never, { where: { user_id: userId } });
    return {
      success: true,
      mode: "credit",
      message: "Switched to fee credit — your earnings now reduce your own Dynopay fees.",
    };
  }

  const address = (params.address || "").trim();
  if (!isValidTronAddress(address)) {
    return { success: false, statusCode: 400, message: "Enter a valid USDT (TRC-20) address" };
  }

  const saved = await getReusableTrc20Wallets(userId);
  const isSaved = saved.some((w) => w.address === address);

  if (!isSaved) {
    // Brand-new address → require a fresh OTP.
    if (!params.otp) {
      return {
        success: false,
        statusCode: 400,
        code: "OTP_REQUIRED",
        message: "Verify this new address with the code we email you.",
      };
    }
    const v = await consumeOtp(userId, params.otp, address);
    if (!v.ok) return { success: false, statusCode: 400, message: v.message || "Invalid code" };
  }

  await User.update(
    {
      referral_payout_mode: "cash",
      referral_payout_trc20_address: address,
      referral_payout_address_verified_at: new Date(),
    } as never,
    { where: { user_id: userId } }
  );

  apiLogger.info(
    `[ReferralPayout] user ${userId} opted into CASH → ${maskAddress(address)} (${isSaved ? "saved wallet" : "new+OTP"})`
  );

  return {
    success: true,
    mode: "cash",
    trc20_address: address,
    trc20_address_masked: maskAddress(address),
    message: isSaved
      ? "Cash-out enabled with your saved USDT (TRC-20) wallet."
      : "Address verified — cash-out enabled.",
  };
};

// Payout REQUEST (OTP-gated; NO funds move here)

export const requestPayout = async (params: {
  userId: number;
  otp?: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  statusCode?: number;
  code?: string;
  message: string;
  payout?: unknown;
}> => {
  const { userId } = params;
  const user = await User.findByPk(userId);
  if (!user) return { success: false, statusCode: 404, message: "User not found" };
  const u = user as unknown as Record<string, unknown>;

  if (((u.referral_payout_mode as string) || "credit") !== "cash") {
    return { success: false, statusCode: 400, message: "Switch your payout method to cash first." };
  }
  const address = (u.referral_payout_trc20_address as string) || "";
  if (!address || !u.referral_payout_address_verified_at) {
    return { success: false, statusCode: 400, message: "Add and verify a USDT (TRC-20) address first." };
  }
  if (!isValidTronAddress(address)) {
    return { success: false, statusCode: 400, message: "Saved payout address is invalid — please re-add it." };
  }

  if (!params.otp) {
    return {
      success: false,
      statusCode: 400,
      code: "OTP_REQUIRED",
      message: "Confirm this payout with the code we email you.",
    };
  }
  const v = await consumeOtp(userId, params.otp);
  if (!v.ok) return { success: false, statusCode: 400, message: v.message || "Invalid code" };

  const existing = await ReferralPayout.findOne({
    where: { user_id: userId, status: { [Op.in]: ["pending", "processing"] } },
  });
  if (existing) return { success: false, statusCode: 409, message: "A payout is already in progress." };
  const commission = await getReferrerCommissionSummary(userId);
  const unpaid = round2(commission.unpaid_balance_usd || 0);
  if (unpaid < MIN_PAYOUT_USDT) {
    return {
      success: false,
      statusCode: 400,
      message: `You need at least $${MIN_PAYOUT_USDT.toFixed(2)} to cash out. Current balance: $${unpaid.toFixed(2)}.`,
    };
  }

  const payout = await ReferralPayout.create({
    user_id: userId,
    amount_usd: unpaid,
    trc20_address: address,
    status: "pending",
    idempotency_key: params.idempotencyKey || crypto.randomUUID(),
    requested_at: new Date(),
  });

  apiLogger.info(
    `[ReferralPayout] user ${userId} requested $${unpaid.toFixed(2)} → ${maskAddress(address)} (payout ${payout.payout_id})`
  );

  return {
    success: true,
    message: "Payout requested — we'll send your USDT (TRC-20) shortly.",
    payout: {
      payout_id: payout.payout_id,
      amount_usd: unpaid,
      trc20_address_masked: maskAddress(address),
      status: "pending",
      requested_at: payout.requested_at,
    },
  };
};

// LEADER/PROD cron only — execute + monitor payouts
// (submitWithdrawal is NEVER called from an API request)

const applyPayoutToReferrals = async (userId: number, amountUsd: number, txHash: string): Promise<void> => {
  let remaining = round2(amountUsd);
  const referrals = await Referral.findAll({
    where: { referrer_user_id: userId, status: { [Op.in]: ["active", "rewarded"] } },
    order: [["activated_at", "ASC"]],
  });
  for (const r of referrals) {
    if (remaining <= 0.001) break;
    const accrued = Number(r.commission_accrued_usd || 0);
    const paid = Number(r.commission_paid_usd || 0);
    const unpaid = round2(accrued - paid);
    if (unpaid <= 0) continue;
    const applied = Math.min(unpaid, remaining);
    const newPaid = round2(paid + applied);
    await r.update({ commission_paid_usd: newPaid });
    remaining = round2(remaining - applied);
    if (newPaid >= accrued - 0.001) {
      const reward = await ReferralReward.findOne({
        where: { referral_id: r.referral_id, reward_type: "commission" },
      });
      if (reward) await reward.update({ status: "withdrawn", withdrawn_at: new Date(), transaction_id: txHash });
    }
  }
};

export const processReferralPayouts = async (): Promise<number> => {
  const pending = await ReferralPayout.findAll({
    where: { status: "pending" },
    order: [["payout_id", "ASC"]],
    limit: 20,
  });
  let submitted = 0;
  for (const payout of pending) {
    const lockKey = `cron:referralPayout:${payout.payout_id}`;
    const locked = await acquireLock(lockKey, 120, 1, 100, true);
    if (!locked) continue;
    try {
      const amount = Number(payout.amount_usd);
      const balance = await binanceService.getAssetBalance("USDT");
      if (balance.free < amount * 0.99) {
        cronLogger.warn(
          `[ReferralPayout] Insufficient USDT treasury for payout ${payout.payout_id}: have ${balance.free}, need ${amount}`
        );
        await payout.update({ error_message: `Insufficient USDT treasury (${balance.free.toFixed(2)})` });
        continue;
      }
      await payout.update({ status: "processing" });
      const wd = await binanceService.submitWithdrawal({
        coin: "USDT",
        address: payout.trc20_address,
        amount,
        network: "TRC20",
      });
      await payout.update({ binance_withdrawal_id: wd.id, error_message: null });
      cronLogger.info(`[ReferralPayout] Submitted payout ${payout.payout_id} ($${amount}) → Binance wd ${wd.id}`);
      submitted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cronLogger.error(`[ReferralPayout] submit error for ${payout.payout_id}: ${msg}`);
      // Reset to 'pending' so it can retry next cycle (idempotency_key prevents double-send).
      await payout.update({ status: "pending", error_message: msg });
    } finally {
      await releaseLock(lockKey);
    }
  }
  return submitted;
};

/** Poll 'processing' payouts → complete/fail; reconcile referral totals on success. */
export const monitorReferralPayouts = async (): Promise<number> => {
  const processing = await ReferralPayout.findAll({
    where: { status: "processing", binance_withdrawal_id: { [Op.not]: null } },
    limit: 20,
  });
  let completed = 0;
  for (const payout of processing) {
    try {
      const history = await binanceService.getWithdrawalHistory({ coin: "USDT", limit: 50 });
      const match = history.find((w) => w.id === payout.binance_withdrawal_id);
      if (!match) continue;
      if (match.status === 6) {
        const fee = parseFloat(match.transactionFee || "0");
        await payout.update({
          status: "completed",
          tx_hash: match.txId,
          withdrawal_fee_usdt: fee,
          completed_at: new Date(),
        });
        await applyPayoutToReferrals(payout.user_id, Number(payout.amount_usd), match.txId);
        try {
          const user = await User.findByPk(payout.user_id, { attributes: ["email", "name", "language"] });
          const u = user as unknown as Record<string, string> | null;
          if (u?.email) {
            await sendWithdrawalSuccessEmail(
              u.email,
              u.name || "there",
              Number(payout.amount_usd).toFixed(2),
              "USDT-TRC20",
              payout.trc20_address,
              match.txId,
              u.language
            );
          }
        } catch {
          /* email is non-fatal */
        }
        cronLogger.info(`[ReferralPayout] Completed payout ${payout.payout_id}: tx ${match.txId}`);
        completed++;
      } else if (match.status === 1 || match.status === 3 || match.status === 5) {
        await payout.update({
          status: "failed",
          error_message: `Binance withdrawal status ${match.status}`,
          completed_at: new Date(),
        });
        cronLogger.warn(`[ReferralPayout] Payout ${payout.payout_id} FAILED (Binance status ${match.status})`);
      }
    } catch (e) {
      cronLogger.error(
        `[ReferralPayout] monitor error for ${payout.payout_id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  return completed;
};

export default {
  MIN_PAYOUT_USDT,
  getReusableTrc20Wallets,
  getPayoutOverview,
  sendPayoutOtp,
  optInPayout,
  requestPayout,
  processReferralPayouts,
  monitorReferralPayouts,
};
