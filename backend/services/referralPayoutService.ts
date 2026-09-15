import { raw as envRaw } from "../utils/config";
import { apiLogger } from "../utils/loggers";
import { QueryTypes, Op } from "sequelize";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import User from "../models/userModels/userModel";
import ReferralPayout from "../models/referralModels/referralPayoutModel";
import { tatumClient } from "../integrations/tatum/TatumClient";
import { sendReferralPayoutRequestedEmail, sendReferralAutoPayEnabledEmail } from "./emailService";
import { getReferrerCommissionSummary } from "./referralService";
import { toFixedStr, toNumber } from "../utils/money";

/**
 * Referral revenue-share CASH-OUT (Phase 2). Reward accrues at the ACCOUNT level
 * (tbl_user) but wallets live at the COMPANY level (tbl_user_wallet): aggregate
 * every TRON address across all the account's companies for reuse, opt into cash
 * (every payout-method change is gated by the `payout` step-up session at the
 * router), payout REQUEST (no funds move — API only writes a row), and execute via Binance USDT-TRC20 on the
 * LEADER/PROD cron only (submitWithdrawal is NEVER called from an API request).
 */

export const MIN_PAYOUT_USDT: number = (() => {
  const v = Number(envRaw("REFERRAL_MIN_PAYOUT_USDT"));
  return Number.isFinite(v) && v > 0 ? v : 25;
})();

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

const round2 = (n: number): number => toNumber((Number(n) || 0), 2);

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
      "referral_payout_auto",
      "referral_payout_auto_min_usd",
    ],
  });
  if (!user) throw new Error("User not found");
  const u = user as unknown as Record<string, unknown>;

  const commission = await getReferrerCommissionSummary(userId);
  const unpaid = round2(commission.unpaid_balance_usd || 0);
  const creditedBalance = round2(commission.total_credited_usd || 0);

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
    // Lifetime referral credit already spent reducing this account's own fees.
    credited_balance_usd: creditedBalance,
    // Balance usable as fee credit right now (0 while in cash mode — reserved for cash-out).
    available_credit_usd: mode === "credit" ? unpaid : 0,
    has_verified_address: hasVerifiedAddress,
    auto: !!u.referral_payout_auto,
    auto_min_usd: u.referral_payout_auto_min_usd != null ? Number(u.referral_payout_auto_min_usd) : MIN_PAYOUT_USDT,
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

// Identity for every payout-method change is proven by the `payout` step-up session
// (requireStepUp at the router) — no per-action OTP here.

// Opt-in (credit, or cash with a saved / new TRC-20 address)

export const optInPayout = async (params: {
  userId: number;
  mode: "credit" | "cash";
  address?: string;
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
  const u = user as unknown as Record<string, unknown>;

  if (mode === "credit") {
    // Opt-out: turn cash off but KEEP the saved wallet + verification on file for later.
    await User.update({ referral_payout_mode: "credit" } as never, { where: { user_id: userId } });
    return {
      success: true,
      mode: "credit",
      message: "Cash-out turned off — your earnings now reduce your own Dynopay fees. Your payout address stays saved.",
    };
  }

  const address = (params.address || "").trim();
  if (!isValidTronAddress(address)) {
    return { success: false, statusCode: 400, message: "Enter a valid USDT (TRC-20) address" };
  }

  const saved = await getReusableTrc20Wallets(userId);
  const isSaved = saved.some((w) => w.address === address);
  const isVerifiedOnFile =
    address === (u.referral_payout_trc20_address as string) && !!u.referral_payout_address_verified_at;

  await User.update(
    {
      referral_payout_mode: "cash",
      referral_payout_trc20_address: address,
      referral_payout_address_verified_at: new Date(),
    } as never,
    { where: { user_id: userId } }
  );

  apiLogger.info(
    `[ReferralPayout] user ${userId} opted into CASH → ${maskAddress(address)} (${isSaved ? "saved wallet" : isVerifiedOnFile ? "re-enable on-file" : "new address"})`
  );

  return {
    success: true,
    mode: "cash",
    trc20_address: address,
    trc20_address_masked: maskAddress(address),
    message: isSaved
      ? "Cash-out enabled with your saved USDT (TRC-20) wallet."
      : isVerifiedOnFile
        ? "Cash-out re-enabled to your saved address."
        : "Address verified — cash-out enabled.",
  };
};

// Payout REQUEST (step-up gated; NO funds move here)

export const requestPayout = async (params: {
  userId: number;
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
      message: `You need at least $${toFixedStr(MIN_PAYOUT_USDT, 2)} to cash out. Current balance: $${toFixedStr(unpaid, 2)}.`,
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
    `[ReferralPayout] user ${userId} requested $${toFixedStr(unpaid, 2)} → ${maskAddress(address)} (payout ${payout.payout_id})`
  );

  try {
    await sendReferralPayoutRequestedEmail(
      u.email as string,
      (u.name as string) || "there",
      unpaid,
      maskAddress(address),
      false,
      u.language as string | undefined
    );
  } catch {
    /* email non-fatal */
  }

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

// Auto cash-out (opt-in standing authorization)

export const setAutoPayout = async (params: {
  userId: number;
  enabled: boolean;
  autoMinUsd?: number;
}): Promise<{ success: boolean; statusCode?: number; code?: string; message: string; auto?: boolean; auto_min_usd?: number }> => {
  const { userId, enabled } = params;
  const user = await User.findByPk(userId);
  if (!user) return { success: false, statusCode: 404, message: "User not found" };
  const u = user as unknown as Record<string, unknown>;

  if (!enabled) {
    await User.update({ referral_payout_auto: false } as never, { where: { user_id: userId } });
    return { success: true, auto: false, message: "Auto cash-out turned off." };
  }

  if (
    ((u.referral_payout_mode as string) || "credit") !== "cash" ||
    !u.referral_payout_trc20_address ||
    !u.referral_payout_address_verified_at
  ) {
    return { success: false, statusCode: 400, message: "Set up USDT (TRC-20) cash-out first, then enable auto." };
  }
  const requested = Number(params.autoMinUsd);
  const min = Number.isFinite(requested) && requested > MIN_PAYOUT_USDT ? round2(requested) : MIN_PAYOUT_USDT;
  await User.update(
    { referral_payout_auto: true, referral_payout_auto_min_usd: min } as never,
    { where: { user_id: userId } }
  );

  try {
    await sendReferralAutoPayEnabledEmail(
      u.email as string,
      (u.name as string) || "there",
      min,
      maskAddress(u.referral_payout_trc20_address as string),
      u.language as string | undefined
    );
  } catch {
    /* email non-fatal */
  }

  apiLogger.info(`[ReferralPayout] user ${userId} enabled AUTO cash-out at $${toFixedStr(min, 2)}`);
  return {
    success: true,
    auto: true,
    auto_min_usd: min,
    message: `Auto cash-out is on. We'll send your rewards automatically once they reach $${toFixedStr(min, 2)}.`,
  };
};

export default {
  MIN_PAYOUT_USDT,
  getReusableTrc20Wallets,
  getPayoutOverview,
  optInPayout,
  requestPayout,
  setAutoPayout,
};
