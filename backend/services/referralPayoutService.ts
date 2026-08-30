import { raw as envRaw } from "../utils/config";
import { apiLogger } from "../utils/loggers";
import { QueryTypes, Op } from "sequelize";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import User from "../models/userModels/userModel";
import ReferralPayout from "../models/referralModels/referralPayoutModel";
import { tatumClient } from "../integrations/tatum/TatumClient";
import { redis } from "../utils/redisInstance";
import { sendWithdrawalOTPEmail } from "./emailService";
import { getReferrerCommissionSummary } from "./referralService";

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
  const u = user as unknown as Record<string, unknown>;

  if (mode === "credit") {
    // Opt-out: turn cash off but KEEP the saved wallet + verification on file for later.
    await User.update({ referral_payout_mode: "credit" } as never, { where: { user_id: userId } });
    return {
      success: true,
      mode: "credit",
      message: "Cash-out turned off — your earnings now reduce your own Dynopay fees. Your wallet stays saved.",
    };
  }

  const address = (params.address || "").trim();
  if (!isValidTronAddress(address)) {
    return { success: false, statusCode: 400, message: "Enter a valid USDT (TRC-20) address" };
  }

  const saved = await getReusableTrc20Wallets(userId);
  const isSaved = saved.some((w) => w.address === address);
  // Re-enabling the exact address already verified on file (after an opt-out) needs no new OTP.
  const isVerifiedOnFile =
    address === (u.referral_payout_trc20_address as string) && !!u.referral_payout_address_verified_at;

  if (!isSaved && !isVerifiedOnFile) {
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
    `[ReferralPayout] user ${userId} opted into CASH → ${maskAddress(address)} (${isSaved ? "saved wallet" : isVerifiedOnFile ? "re-enable on-file" : "new+OTP"})`
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

// Payout history + CSV export (read-only)

const txUrl = (h: string | null): string | null => (h ? `https://tronscan.org/#/transaction/${h}` : null);

export interface PayoutHistoryItem {
  payout_id: number;
  amount_usd: number;
  status: string;
  trc20_address_masked: string;
  tx_hash: string | null;
  tx_url: string | null;
  withdrawal_fee_usdt: number | null;
  requested_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
}

export const getPayoutHistory = async (userId: number): Promise<PayoutHistoryItem[]> => {
  const rows = await ReferralPayout.findAll({
    where: { user_id: userId },
    order: [["payout_id", "DESC"]],
    limit: 100,
  });
  return rows.map((p) => ({
    payout_id: p.payout_id,
    amount_usd: Number(p.amount_usd),
    status: p.status,
    trc20_address_masked: maskAddress(p.trc20_address),
    tx_hash: p.tx_hash || null,
    tx_url: txUrl(p.tx_hash || null),
    withdrawal_fee_usdt: p.withdrawal_fee_usdt != null ? Number(p.withdrawal_fee_usdt) : null,
    requested_at: p.requested_at || null,
    completed_at: p.completed_at || null,
    error_message: p.error_message || null,
  }));
};

export const getPayoutHistoryCsv = async (userId: number): Promise<string> => {
  const rows = await ReferralPayout.findAll({
    where: { user_id: userId },
    order: [["payout_id", "DESC"]],
    limit: 1000,
  });
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "Payout ID",
    "Amount (USD)",
    "Status",
    "USDT-TRC20 Address",
    "Tx Hash",
    "Network Fee (USDT)",
    "Requested (UTC)",
    "Completed (UTC)",
    "Note",
  ];
  const lines = [header.join(",")];
  for (const p of rows) {
    lines.push(
      [
        p.payout_id,
        Number(p.amount_usd).toFixed(2),
        p.status,
        p.trc20_address,
        p.tx_hash || "",
        p.withdrawal_fee_usdt != null ? Number(p.withdrawal_fee_usdt).toFixed(6) : "",
        p.requested_at ? new Date(p.requested_at).toISOString() : "",
        p.completed_at ? new Date(p.completed_at).toISOString() : "",
        p.error_message || "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
};

export default {
  MIN_PAYOUT_USDT,
  getReusableTrc20Wallets,
  getPayoutOverview,
  sendPayoutOtp,
  optInPayout,
  requestPayout,
  getPayoutHistory,
  getPayoutHistoryCsv,
};
