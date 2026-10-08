/**
 * SafeDeal referrals & loyalty.
 *  - Every SafeDeal user has a referral code. A brand-new user who signs up through it gets a
 *    $5 welcome fee credit; the referrer earns $5 once that friend completes a released deal of
 *    at least $50 (max 20 rewarded referrals per referrer per month) plus milestone bonuses.
 *  - Fee credit is NON-CASHABLE: it only lowers the escrow fee a party pays, applied
 *    automatically when a deal is released (never on refunds / splits / cancellations).
 *  - Loyalty levels lower the escrow fee percent by completed deals OR completed volume
 *    (the minimum fee still applies).
 * Every credit movement is an idempotent row in tbl_safedeal_credit_ledger (unique reference).
 */
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { round2Float as round2 } from "../../utils/money";
import { safedealBaseUrl } from "../../utils/emailTemplate";
import { sendSafeDealReferralRewardEmail } from "../email/safedealEmails";

export const REFERRER_REWARD_USD = 5;
export const WELCOME_CREDIT_USD = 5;
export const QUALIFY_MIN_DEAL_USD = 50;
export const MONTHLY_REWARD_CAP = 20;
export const MILESTONES = [
  { friends: 3, bonus: 15 },
  { friends: 10, bonus: 50 },
  { friends: 25, bonus: 150 },
];

export interface LevelDef {
  key: "member" | "silver" | "gold" | "platinum";
  label: string;
  discount: number; // percentage points off the standard escrow fee
  minDeals: number;
  minVolumeUsd: number;
}

export const LEVELS: LevelDef[] = [
  { key: "member", label: "Member", discount: 0, minDeals: 0, minVolumeUsd: 0 },
  { key: "silver", label: "Silver", discount: 0.5, minDeals: 3, minVolumeUsd: 1000 },
  { key: "gold", label: "Gold", discount: 1, minDeals: 10, minVolumeUsd: 5000 },
  { key: "platinum", label: "Platinum", discount: 1.5, minDeals: 25, minVolumeUsd: 20000 },
];

type CreditKind = "welcome" | "referral" | "milestone" | "applied";

const select = <T extends object = any>(sql: string, replacements: Record<string, unknown>, transaction?: any): Promise<T[]> =>
  sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT, transaction });

const maskEmail = (e: unknown): string => {
  const [u, d] = String(e || "").split("@");
  if (!d) return "a friend";
  if (/telegram\.safedeal$/i.test(d)) return "a Telegram user";
  return `${u.slice(0, 2)}•••@${d}`;
};

export const normalizeRefCode = (raw: unknown): string | null => {
  const c = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 5 && c.length <= 16 ? c : null;
};

// ── fee-credit ledger ─────────────────────────────────────────────────────────

/**
 * Post one idempotent credit movement. `amountFor` gets the current balance (row-locked) and
 * returns the signed amount; a repeat call with the same reference returns the original amount.
 */
async function postCredit(
  customerId: number,
  kind: CreditKind,
  reference: string,
  amountFor: (balance: number) => number,
  extra: { escrowId?: number | null; referralId?: number | null; note?: string } = {}
): Promise<{ amount: number; posted: boolean; balance: number }> {
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO tbl_safedeal_profile (customer_id, company_id)
         SELECT customer_id, company_id FROM tbl_customer WHERE customer_id = :cid
       ON CONFLICT (customer_id) DO NOTHING`,
      { replacements: { cid: customerId }, transaction }
    );
    const rows = await select<{ fee_credit_usd: string }>(`SELECT fee_credit_usd FROM tbl_safedeal_profile WHERE customer_id = :cid FOR UPDATE`, { cid: customerId }, transaction);
    if (!rows.length) return { amount: 0, posted: false, balance: 0 };
    const balance = Number(rows[0].fee_credit_usd || 0);
    const prev = await select<{ amount_usd: string }>(`SELECT amount_usd FROM tbl_safedeal_credit_ledger WHERE reference = :reference`, { reference }, transaction);
    if (prev.length) return { amount: Number(prev[0].amount_usd), posted: false, balance };
    const amount = round2(amountFor(balance));
    if (!amount || balance + amount < 0) return { amount: 0, posted: false, balance };
    const after = round2(balance + amount);
    await sequelize.query(
      `INSERT INTO tbl_safedeal_credit_ledger (customer_id, kind, amount_usd, balance_after_usd, escrow_id, referral_id, note, reference)
       VALUES (:cid, :kind, :amount, :after, :escrowId, :referralId, :note, :reference)`,
      { replacements: { cid: customerId, kind, amount, after, escrowId: extra.escrowId ?? null, referralId: extra.referralId ?? null, note: extra.note ?? null, reference }, transaction }
    );
    await sequelize.query(`UPDATE tbl_safedeal_profile SET fee_credit_usd = :after, updated_at = NOW() WHERE customer_id = :cid`, { replacements: { cid: customerId, after }, transaction });
    return { amount, posted: true, balance: after };
  });
}

export async function creditBalance(customerId: number | null | undefined): Promise<number> {
  if (!customerId) return 0;
  const rows = await select<{ fee_credit_usd: string }>(`SELECT fee_credit_usd FROM tbl_safedeal_profile WHERE customer_id = :cid`, { cid: customerId });
  return round2(Number(rows[0]?.fee_credit_usd || 0));
}

// ── loyalty levels ────────────────────────────────────────────────────────────

export async function customerStats(customerId: number | null | undefined): Promise<{ deals: number; volume: number }> {
  if (!customerId) return { deals: 0, volume: 0 };
  const rows = await select<{ deals: string; volume: string }>(
    `SELECT COUNT(*) AS deals, COALESCE(SUM(amount), 0) AS volume FROM tbl_escrow_deal
      WHERE source = 'safedeal' AND status = 'completed' AND simulated = false
        AND (creator_customer_id = :cid OR counterparty_customer_id = :cid)`,
    { cid: customerId }
  );
  return { deals: Number(rows[0]?.deals || 0), volume: round2(Number(rows[0]?.volume || 0)) };
}

export const levelFromStats = (s: { deals: number; volume: number }): LevelDef =>
  [...LEVELS].reverse().find((l) => s.deals >= l.minDeals || s.volume >= l.minVolumeUsd) || LEVELS[0];

export const levelPercent = (level: LevelDef, basePercent: number): number => round2(Math.max(0, basePercent - level.discount));

export async function levelForCustomer(customerId: number | null | undefined): Promise<LevelDef> {
  return levelFromStats(await customerStats(customerId));
}

/** Escrow fee percent for a deal from the fee payer's level (a 50/50 split blends both sides). */
export async function feeTermsFor(input: { basePercent: number; feePayer: string; buyerCid?: number | null; sellerCid?: number | null }): Promise<{ feePercent: number; feeLevel: string | null }> {
  const [buyer, seller] = await Promise.all([levelForCustomer(input.buyerCid), levelForCustomer(input.sellerCid)]);
  if (input.feePayer === "split") {
    const pct = round2((levelPercent(buyer, input.basePercent) + levelPercent(seller, input.basePercent)) / 2);
    return { feePercent: pct, feeLevel: buyer.key === "member" && seller.key === "member" ? null : `${buyer.key}/${seller.key}` };
  }
  const lvl = input.feePayer === "seller" ? seller : buyer;
  return { feePercent: levelPercent(lvl, input.basePercent), feeLevel: lvl.key === "member" ? null : lvl.key };
}

// ── referral codes ────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const genCode = (): string => Array.from(crypto.randomBytes(7), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

/** The customer's referral code, minted on first use. */
export async function ensureReferralCode(customerId: number): Promise<string> {
  const rows = await select<{ referral_code: string | null }>(`SELECT referral_code FROM tbl_safedeal_profile WHERE customer_id = :cid`, { cid: customerId });
  if (rows[0]?.referral_code) return rows[0].referral_code;
  for (let i = 0; i < 6; i++) {
    try {
      const code = genCode();
      await sequelize.query(
        `INSERT INTO tbl_safedeal_profile (customer_id, company_id, referral_code)
           SELECT customer_id, company_id, :code FROM tbl_customer WHERE customer_id = :cid
         ON CONFLICT (customer_id) DO UPDATE SET referral_code = COALESCE(tbl_safedeal_profile.referral_code, EXCLUDED.referral_code)`,
        { replacements: { cid: customerId, code } }
      );
      const again = await select<{ referral_code: string | null }>(`SELECT referral_code FROM tbl_safedeal_profile WHERE customer_id = :cid`, { cid: customerId });
      if (again[0]?.referral_code) return again[0].referral_code;
    } catch (e) {
      if (!/unique|duplicate/i.test((e as Error).message)) throw e;
    }
  }
  throw new Error("Could not mint a referral code.");
}

export const referralLink = (code: string): string => {
  const u = new URL(safedealBaseUrl());
  u.searchParams.set("ref", code);
  return u.toString();
};

/** Public: is this a live referral code? (No referrer identity is exposed.) */
export async function referralLookup(raw: unknown): Promise<{ valid: boolean; code: string | null; welcome_credit_usd: number }> {
  const code = normalizeRefCode(raw);
  if (!code) return { valid: false, code: null, welcome_credit_usd: WELCOME_CREDIT_USD };
  const rows = await select(`SELECT 1 FROM tbl_safedeal_profile WHERE referral_code = :code`, { code });
  return { valid: rows.length > 0, code, welcome_credit_usd: WELCOME_CREDIT_USD };
}

/**
 * Attach a referral on a brand-new SafeDeal account (first-ever sign-in, no completed deals).
 * One referrer per account, never yourself. Grants the friend's welcome credit.
 */
export async function attachReferral(refereeCid: number, raw: unknown, isNewProfile: boolean): Promise<{ applied: boolean; welcome_credit_usd?: number }> {
  try {
    const code = normalizeRefCode(raw);
    if (!code || !isNewProfile) return { applied: false };
    const ref = await select<{ customer_id: number; company_id: number }>(`SELECT customer_id, company_id FROM tbl_safedeal_profile WHERE referral_code = :code`, { code });
    const referrer = ref[0];
    if (!referrer || Number(referrer.customer_id) === Number(refereeCid)) return { applied: false };
    if ((await customerStats(refereeCid)).deals > 0) return { applied: false };
    const ins = await select<{ referral_id: number }>(
      `INSERT INTO tbl_safedeal_referral (referrer_customer_id, referee_customer_id, code)
         SELECT :referrer, c.customer_id, :code FROM tbl_customer c WHERE c.customer_id = :referee AND c.company_id = :coid
       ON CONFLICT (referee_customer_id) DO NOTHING RETURNING referral_id`,
      { referrer: referrer.customer_id, referee: refereeCid, code, coid: referrer.company_id }
    );
    if (!ins.length) return { applied: false };
    await sequelize.query(`UPDATE tbl_safedeal_profile SET referred_by_customer_id = :referrer, updated_at = NOW() WHERE customer_id = :referee`, { replacements: { referrer: referrer.customer_id, referee: refereeCid } });
    await postCredit(refereeCid, "welcome", `welcome:${refereeCid}`, () => WELCOME_CREDIT_USD, {
      referralId: ins[0].referral_id,
      note: `Welcome credit — $${WELCOME_CREDIT_USD} off your first deal fee`,
    });
    return { applied: true, welcome_credit_usd: WELCOME_CREDIT_USD };
  } catch (e) {
    apiLogger.warn(`[safedeal.rewards] attachReferral(${refereeCid}) failed: ${(e as Error).message}`);
    return { applied: false };
  }
}

// ── fee credits at release ────────────────────────────────────────────────────

const partyIds = (deal: any): { buyerCid: number | null; sellerCid: number | null } => {
  const creatorIsBuyer = deal.creator_role === "buyer";
  const c = deal.creator_customer_id ? Number(deal.creator_customer_id) : null;
  const o = deal.counterparty_customer_id ? Number(deal.counterparty_customer_id) : null;
  return creatorIsBuyer ? { buyerCid: c, sellerCid: o } : { buyerCid: o, sellerCid: c };
};

/** Each side's share of the escrow fee (fee_payer; a split is 50/50). */
export const escrowFeeShares = (escrowFee: number, feePayer: string): { buyer: number; seller: number } => {
  const fee = round2(Number(escrowFee) || 0);
  const buyer = feePayer === "buyer" ? fee : feePayer === "split" ? round2(fee / 2) : 0;
  return { buyer, seller: round2(fee - buyer) };
};

/**
 * Release only: spend each fee-paying party's credit against their share of the GROSS escrow
 * fee and record it on the deal (fee_credit_buyer_usd / fee_credit_seller_usd). Idempotent per
 * deal + side, so a retried settlement re-uses the same amounts.
 */
export async function applyReleaseFeeCredits(deal: any, grossEscrowFee: number): Promise<void> {
  const shares = escrowFeeShares(grossEscrowFee, String(deal.fee_payer || "buyer"));
  const { buyerCid, sellerCid } = partyIds(deal);
  const spend = async (cid: number | null, share: number, side: "buyer" | "seller"): Promise<number> => {
    if (!cid || !(share > 0)) return 0;
    try {
      const r = await postCredit(cid, "applied", `applied:${deal.escrow_id}:${side}`, (bal) => -Math.min(bal, share), {
        escrowId: Number(deal.escrow_id),
        note: `Applied to the escrow fee on deal SD-${deal.escrow_id} "${String(deal.title || "").slice(0, 80)}"`,
      });
      return round2(Math.max(0, -r.amount));
    } catch (e) {
      apiLogger.warn(`[safedeal.rewards] fee credit for deal ${deal.escrow_id} (${side}) skipped: ${(e as Error).message}`);
      return 0;
    }
  };
  deal.fee_credit_buyer_usd = await spend(buyerCid, shares.buyer, "buyer");
  deal.fee_credit_seller_usd = await spend(sellerCid, shares.seller, "seller");
}

/** What the viewer's credit would knock off this (open) deal's fee at release. */
export async function feeCreditPreview(customerId: number | null | undefined, escrowFee: number, feePayer: string, role: "buyer" | "seller"): Promise<{ available: number; preview: number }> {
  const available = await creditBalance(customerId);
  const share = escrowFeeShares(escrowFee, feePayer)[role];
  return { available, preview: round2(Math.min(available, share)) };
}

// ── referral rewards on a completed deal ──────────────────────────────────────

async function awardMilestones(referrerCid: number, referrerEmail: string): Promise<number> {
  const rows = await select<{ n: string }>(`SELECT COUNT(*) AS n FROM tbl_safedeal_referral WHERE referrer_customer_id = :cid AND status = 'rewarded'`, { cid: referrerCid });
  const count = Number(rows[0]?.n || 0);
  let bonus = 0;
  for (const m of MILESTONES.filter((x) => count >= x.friends)) {
    const r = await postCredit(referrerCid, "milestone", `milestone:${referrerCid}:${m.friends}`, () => m.bonus, { note: `Milestone bonus — ${m.friends} friends rewarded` });
    if (r.posted) {
      bonus += m.bonus;
      void sendSafeDealReferralRewardEmail(referrerEmail, { amount: m.bonus, kind: "milestone", friends: m.friends, balance: r.balance });
    }
  }
  return bonus;
}

async function qualifyReferral(refereeCid: number, deal: any): Promise<void> {
  const refs = await select<{ referral_id: number; referrer_customer_id: number; referee_email: string; referrer_email: string }>(
    `SELECT r.referral_id, r.referrer_customer_id, ce.email AS referee_email, cr.email AS referrer_email
       FROM tbl_safedeal_referral r
       JOIN tbl_customer ce ON ce.customer_id = r.referee_customer_id
       JOIN tbl_customer cr ON cr.customer_id = r.referrer_customer_id
      WHERE r.referee_customer_id = :cid AND r.status = 'joined'`,
    { cid: refereeCid }
  );
  const ref = refs[0];
  if (!ref) return;
  const month = await select<{ n: string }>(
    `SELECT COUNT(*) AS n FROM tbl_safedeal_referral WHERE referrer_customer_id = :cid AND status = 'rewarded' AND rewarded_at >= date_trunc('month', NOW())`,
    { cid: ref.referrer_customer_id }
  );
  const capped = Number(month[0]?.n || 0) >= MONTHLY_REWARD_CAP;
  const upd = await select<{ referral_id: number }>(
    `UPDATE tbl_safedeal_referral SET status = :status, qualifying_escrow_id = :eid, reward_usd = :amt, rewarded_at = NOW()
      WHERE referral_id = :id AND status = 'joined' RETURNING referral_id`,
    { status: capped ? "capped" : "rewarded", eid: Number(deal.escrow_id), amt: capped ? 0 : REFERRER_REWARD_USD, id: ref.referral_id }
  );
  if (!upd.length || capped) return;
  const r = await postCredit(ref.referrer_customer_id, "referral", `referral:${ref.referral_id}`, () => REFERRER_REWARD_USD, {
    referralId: ref.referral_id,
    escrowId: Number(deal.escrow_id),
    note: `${maskEmail(ref.referee_email)} completed their first deal`,
  });
  if (r.posted) void sendSafeDealReferralRewardEmail(ref.referrer_email, { amount: REFERRER_REWARD_USD, kind: "referral", friend: maskEmail(ref.referee_email), balance: r.balance });
  await awardMilestones(ref.referrer_customer_id, ref.referrer_email);
}

/** Hook after a SafeDeal is released: reward the referrer of either party (first qualifying deal). */
export async function onDealCompleted(deal: any): Promise<void> {
  try {
    if (deal?.source !== "safedeal" || deal.status !== "completed" || String(deal.outcome || "release") !== "release") return;
    if (deal.simulated || Number(deal.amount) < QUALIFY_MIN_DEAL_USD) return;
    const { buyerCid, sellerCid } = partyIds(deal);
    for (const cid of [buyerCid, sellerCid]) if (cid) await qualifyReferral(cid, deal);
  } catch (e) {
    apiLogger.warn(`[safedeal.rewards] onDealCompleted(${deal?.escrow_id}) failed: ${(e as Error).message}`);
  }
}

// ── dashboard ─────────────────────────────────────────────────────────────────

export async function rewardsSummary(customerId: number, basePercent: number, minFeeUsd: number): Promise<Record<string, unknown>> {
  const code = await ensureReferralCode(customerId);
  const [profileRows, stats, referrals, history, totals] = await Promise.all([
    select<{ fee_credit_usd: string; referred_by_customer_id: number | null }>(`SELECT fee_credit_usd, referred_by_customer_id FROM tbl_safedeal_profile WHERE customer_id = :cid`, { cid: customerId }),
    customerStats(customerId),
    select<{ referral_id: number; email: string; status: string; reward_usd: string; created_at: string; rewarded_at: string | null }>(
      `SELECT r.referral_id, c.email, r.status, r.reward_usd, r.created_at, r.rewarded_at
         FROM tbl_safedeal_referral r JOIN tbl_customer c ON c.customer_id = r.referee_customer_id
        WHERE r.referrer_customer_id = :cid ORDER BY r.created_at DESC LIMIT 200`,
      { cid: customerId }
    ),
    select<{ entry_id: number; kind: string; amount_usd: string; balance_after_usd: string; escrow_id: number | null; note: string | null; created_at: string }>(
      `SELECT entry_id, kind, amount_usd, balance_after_usd, escrow_id, note, created_at FROM tbl_safedeal_credit_ledger WHERE customer_id = :cid ORDER BY created_at DESC, entry_id DESC LIMIT 50`,
      { cid: customerId }
    ),
    select<{ earned: string; used: string }>(
      `SELECT COALESCE(SUM(amount_usd) FILTER (WHERE amount_usd > 0), 0) AS earned, COALESCE(-SUM(amount_usd) FILTER (WHERE amount_usd < 0), 0) AS used
         FROM tbl_safedeal_credit_ledger WHERE customer_id = :cid`,
      { cid: customerId }
    ),
  ]);
  const level = levelFromStats(stats);
  const idx = LEVELS.findIndex((l) => l.key === level.key);
  const next = LEVELS[idx + 1] || null;
  const rewarded = referrals.filter((r) => r.status === "rewarded").length;
  const nextMilestone = MILESTONES.find((m) => rewarded < m.friends) || null;
  return {
    code,
    link: referralLink(code),
    credit: {
      balance: round2(Number(profileRows[0]?.fee_credit_usd || 0)),
      earned_total: round2(Number(totals[0]?.earned || 0)),
      used_total: round2(Number(totals[0]?.used || 0)),
    },
    level: {
      key: level.key,
      label: level.label,
      fee_percent: levelPercent(level, basePercent),
      base_fee_percent: basePercent,
      completed_deals: stats.deals,
      completed_volume_usd: stats.volume,
      next: next
        ? {
            key: next.key,
            label: next.label,
            fee_percent: levelPercent(next, basePercent),
            min_deals: next.minDeals,
            min_volume_usd: next.minVolumeUsd,
            deals_needed: Math.max(0, next.minDeals - stats.deals),
            volume_needed_usd: round2(Math.max(0, next.minVolumeUsd - stats.volume)),
            progress: round2(Math.min(1, Math.max(stats.deals / next.minDeals, stats.volume / next.minVolumeUsd))),
          }
        : null,
      levels: LEVELS.map((l) => ({ key: l.key, label: l.label, fee_percent: levelPercent(l, basePercent), min_deals: l.minDeals, min_volume_usd: l.minVolumeUsd })),
    },
    referrals: {
      total: referrals.length,
      rewarded,
      pending: referrals.filter((r) => r.status === "joined").length,
      earned_usd: round2(referrals.reduce((s, r) => s + Number(r.reward_usd || 0), 0)),
      list: referrals.map((r) => ({
        referral_id: r.referral_id,
        friend: maskEmail(r.email),
        status: r.status,
        reward_usd: round2(Number(r.reward_usd || 0)),
        joined_at: r.created_at,
        rewarded_at: r.rewarded_at,
      })),
    },
    milestones: MILESTONES.map((m) => ({ friends: m.friends, bonus_usd: m.bonus, reached: rewarded >= m.friends })),
    next_milestone: nextMilestone ? { friends: nextMilestone.friends, bonus_usd: nextMilestone.bonus, remaining: nextMilestone.friends - rewarded } : null,
    history: history.map((h) => ({ ...h, amount_usd: round2(Number(h.amount_usd)), balance_after_usd: round2(Number(h.balance_after_usd)) })),
    referred: !!profileRows[0]?.referred_by_customer_id,
    rules: {
      referrer_reward_usd: REFERRER_REWARD_USD,
      welcome_credit_usd: WELCOME_CREDIT_USD,
      qualify_min_deal_usd: QUALIFY_MIN_DEAL_USD,
      monthly_reward_cap: MONTHLY_REWARD_CAP,
      min_fee_usd: minFeeUsd,
    },
  };
}
