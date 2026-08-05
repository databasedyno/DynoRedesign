/**
 * Payment-link CRUD handlers.
 * Extracted verbatim from paymentController.ts (no behavior change).
 */
import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger, cronLogger } from "../../utils/loggers";
import {
  errorResponseHelper,
  successResponseHelper,
  sendEmail,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { getRedisItem, setRedisItem, deleteRedisItem, redis } from "../../utils/redisInstance";
import { formatAmountForDisplay, getCurrencyInfo } from "../../utils/currencyUtils";
import { companyModel, paymentLinkModel, userModel, userWalletModel } from "../../models";
import { PaymentUserJwtPayload } from "../../utils/types";
import { checkKycEnforcement, KYC_THRESHOLD_USD } from "../../helper/kycEnforcement";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import * as merchantPoolService from "../../services/merchantPoolService";
import { getCryptoRedisKey } from "../../services/merchantPool/merchantPoolConfig";
import { PaymentState, parseState } from "../../services/paymentStateMachine";
import { finalizeUploadedImage } from "../../services/objectStorage";

// ═══════════════════════════════════════════════════════════════════════════
// DONATION / CROWDFUNDING HELPERS
// A donation link is a multi-use campaign parent (link_type='donation').
// Every donor spawns a 'contribution' child row (parent_link_id set) that
// flows through the regular settlement pipeline untouched. Aggregates below
// are computed from completed child rows.
// ═══════════════════════════════════════════════════════════════════════════

// Statuses that count as "money received" (legacy + state machine values)
const DONATION_COMPLETED_STATUSES = [
  "successful",
  "completed",
  "confirmed",
  "processing",
  "converted",
  "payout_complete",
];

export const getDonationAggregates = async (
  parentLinkId: number
): Promise<{ raised_amount: number; supporters_count: number }> => {
  const [row] = (await sequelize.query(
    `SELECT COUNT(*)::int AS supporters_count, COALESCE(SUM(base_amount), 0)::float AS raised_amount
     FROM tbl_payment_link
     WHERE parent_link_id = :pid AND LOWER(status) IN (:statuses)`,
    {
      replacements: { pid: parentLinkId, statuses: DONATION_COMPLETED_STATUSES },
      type: QueryTypes.SELECT,
    }
  )) as Array<{ supporters_count: number; raised_amount: number }>;
  return {
    raised_amount: Number(row?.raised_amount || 0),
    supporters_count: Number(row?.supporters_count || 0),
  };
};

export const getRecentSupporters = async (
  parentLinkId: number,
  limit = 10
): Promise<Array<{ contribution_id: number; name: string | null; message: string | null; amount: number; currency: string; at: string; organizer_reply: string | null; organizer_reply_at: string | null }>> => {
  const rows = (await sequelize.query(
    `SELECT link_id, donor_name, donor_message, is_anonymous, base_amount, base_currency, "updatedAt",
            organizer_reply, organizer_reply_at
     FROM tbl_payment_link
     WHERE parent_link_id = :pid AND LOWER(status) IN (:statuses)
     ORDER BY "updatedAt" DESC LIMIT :lim`,
    {
      replacements: { pid: parentLinkId, statuses: DONATION_COMPLETED_STATUSES, lim: limit },
      type: QueryTypes.SELECT,
    }
  )) as Array<{
    link_id: number;
    donor_name: string | null;
    donor_message: string | null;
    is_anonymous: boolean | null;
    base_amount: number;
    base_currency: string | null;
    updatedAt: string;
    organizer_reply: string | null;
    organizer_reply_at: string | null;
  }>;
  return rows.map((r) => ({
    contribution_id: Number(r.link_id),
    name: r.is_anonymous ? null : r.donor_name || null,
    message: r.donor_message || null,
    amount: Number(r.base_amount || 0),
    currency: r.base_currency || "USD",
    at: r.updatedAt,
    organizer_reply: r.organizer_reply || null,
    organizer_reply_at: r.organizer_reply_at || null,
  }));
};

// ═══════════════════════════════════════════════════════════════════════════
// CREATOR PAGE ANALYTICS (Session 2026-08-05)
// Rollup of ALL supporter contributions for a creator — tip-jar tips AND
// crowdfunding-campaign contributions — bucketed for a 30-day activity chart
// and a top-supporters list. Used by both:
//   • GET /api/pay/creator/:handle/analytics  (public, honours toggle)
//   • GET /api/user/creator/analytics         (auth, always shows own data)
// ═══════════════════════════════════════════════════════════════════════════

interface CreatorAnalyticsBucket {
  date: string;   // YYYY-MM-DD
  amount: number; // fiat total in creator's widget currency
  count: number;  // # tips that day
}
interface CreatorAnalyticsSupporter {
  name: string;    // first token of donor_name (privacy-conscious)
  amount: number;  // fiat total across all of this supporter's contributions
  currency: string;
  count: number;   // how many times they tipped
}
export interface CreatorAnalyticsData {
  chart: CreatorAnalyticsBucket[];
  top_supporters: CreatorAnalyticsSupporter[];
  totals: {
    amount_30d: number;
    count_30d: number;
    supporters_30d: number;    // distinct-name supporters in the last 30 days
    amount_lifetime: number;   // only in auth endpoint (0 in public)
    supporters_lifetime: number; // only in auth endpoint (0 in public)
  };
  currency: string;
  window_days: number;
}

/**
 * Compute the analytics data for a given creator user_id.
 * @param userId - creator's tbl_user.user_id
 * @param currency - creator's display/widget currency
 * @param includeLifetime - if true, also compute lifetime totals (auth view)
 */
export const getCreatorAnalyticsData = async (
  userId: number,
  currency: string,
  includeLifetime: boolean
): Promise<CreatorAnalyticsData> => {
  const windowDays = 30;
  // We roll up per day in JS to keep the SQL simple + timezone-safe (all
  // buckets are UTC yyyy-mm-dd). Volume is bounded by contributions in a
  // 30-day window per creator — well under a few thousand rows even for the
  // most successful merchants; JS aggregation cost is negligible.
  const rows = (await sequelize.query(
    `SELECT c."createdAt", c.base_amount, c.base_currency, c.donor_name, c.is_anonymous
       FROM tbl_payment_link c
       JOIN tbl_payment_link p ON p.link_id = c.parent_link_id
      WHERE c.link_type = 'contribution'
        AND LOWER(c.status) IN (:statuses)
        AND p.user_id = :uid
        AND p.link_type = 'donation'
        AND c."createdAt" >= NOW() - INTERVAL '${windowDays} days'`,
    {
      replacements: { uid: userId, statuses: DONATION_COMPLETED_STATUSES },
      type: QueryTypes.SELECT,
    }
  )) as Array<{
    createdAt: string;
    base_amount: string | number;
    base_currency: string | null;
    donor_name: string | null;
    is_anonymous: boolean | null;
  }>;

  // Build a zero-filled 30-day bucket array (oldest → today, UTC ymd)
  const now = Date.now();
  const chart: CreatorAnalyticsBucket[] = [];
  const dayIdx: Record<string, number> = {};
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const ymd = d.toISOString().slice(0, 10);
    dayIdx[ymd] = chart.length;
    chart.push({ date: ymd, amount: 0, count: 0 });
  }

  // Group top supporters by first-name token (privacy) — anonymous tips
  // never contribute to the leaderboard. Amounts assume same base_currency
  // as the creator's widget currency (usual case). If a contribution uses a
  // different currency, we include it as-is — cross-currency mixing is rare
  // in practice for a single creator and adds unnecessary FX complexity.
  const supMap = new Map<string, CreatorAnalyticsSupporter>();
  let count30d = 0;
  let amount30d = 0;
  const distinctSupporters30d = new Set<string>();

  for (const r of rows) {
    // Sequelize returns TIMESTAMP columns as JS Date objects — wrap in
    // new Date() to be safe regardless of driver behavior, then take the
    // UTC ymd component so the key matches dayIdx keys built the same way.
    const ymd = new Date(r.createdAt).toISOString().slice(0, 10);
    const idx = dayIdx[ymd];
    const amt = Number(r.base_amount) || 0;
    if (idx !== undefined) {
      chart[idx].amount += amt;
      chart[idx].count += 1;
    }
    count30d += 1;
    amount30d += amt;

    if (!r.is_anonymous && r.donor_name) {
      const first = String(r.donor_name).trim().split(/\s+/)[0];
      if (first) {
        distinctSupporters30d.add(first.toLowerCase());
        const key = first.toLowerCase();
        const entry = supMap.get(key) || {
          name: first,
          amount: 0,
          currency: r.base_currency || currency,
          count: 0,
        };
        entry.amount += amt;
        entry.count += 1;
        supMap.set(key, entry);
      }
    }
  }

  // Round chart amounts to 2 dp (fiat) so recharts doesn't render 12.79999999
  for (const b of chart) b.amount = Math.round(b.amount * 100) / 100;

  const top_supporters = Array.from(supMap.values())
    .sort((a, b) => b.amount - a.amount || b.count - a.count)
    .slice(0, 5)
    .map((s) => ({ ...s, amount: Math.round(s.amount * 100) / 100 }));

  // Lifetime totals (only computed for the merchant's own view)
  let amount_lifetime = 0;
  let supporters_lifetime = 0;
  if (includeLifetime) {
    const [life] = (await sequelize.query(
      `SELECT COALESCE(SUM(c.base_amount), 0)::float AS amount,
              COUNT(*)::int                          AS count
         FROM tbl_payment_link c
         JOIN tbl_payment_link p ON p.link_id = c.parent_link_id
        WHERE c.link_type = 'contribution'
          AND LOWER(c.status) IN (:statuses)
          AND p.user_id = :uid
          AND p.link_type = 'donation'`,
      { replacements: { uid: userId, statuses: DONATION_COMPLETED_STATUSES }, type: QueryTypes.SELECT }
    )) as Array<{ amount: number; count: number }>;
    amount_lifetime = Math.round((Number(life?.amount) || 0) * 100) / 100;
    supporters_lifetime = Number(life?.count) || 0;
  }

  return {
    chart,
    top_supporters,
    totals: {
      amount_30d: Math.round(amount30d * 100) / 100,
      count_30d: count30d,
      supporters_30d: distinctSupporters30d.size,
      amount_lifetime,
      supporters_lifetime,
    },
    currency,
    window_days: windowDays,
  };
};

/**
 * GET /api/pay/creator/:handle/analytics  (public, rate-limited)
 * Returns the 30-day tip chart + top supporters for a creator's PUBLIC page.
 * Honours the `public_analytics_enabled` toggle — if the creator has hidden
 * public analytics, we return `enabled: false` + empty data (the frontend
 * simply skips rendering the widget).
 */
export const getCreatorPublicAnalytics = async (req: express.Request, res: express.Response) => {
  try {
    const handle = String(req.params.handle || "").trim().toLowerCase();
    if (!handle) return errorResponseHelper(res, 400, "Handle is required");

    const [creator] = (await sequelize.query(
      `SELECT user_id, creator_page_enabled, public_analytics_enabled, support_widget_currency
         FROM tbl_user
        WHERE LOWER(handle) = :handle
        LIMIT 1`,
      { replacements: { handle }, type: QueryTypes.SELECT }
    )) as Array<{
      user_id: number;
      creator_page_enabled: boolean | null;
      public_analytics_enabled: boolean | null;
      support_widget_currency: string | null;
    }>;

    if (!creator || !creator.creator_page_enabled) {
      return errorResponseHelper(res, 404, "Creator page not found");
    }

    // Public toggle OFF → shell response with enabled=false
    if (!creator.public_analytics_enabled) {
      return successResponseHelper(res, 200, "Analytics hidden", {
        enabled: false,
        chart: [],
        top_supporters: [],
        totals: { amount_30d: 0, count_30d: 0, supporters_30d: 0, amount_lifetime: 0, supporters_lifetime: 0 },
        currency: creator.support_widget_currency || "USD",
        window_days: 30,
      });
    }

    const data = await getCreatorAnalyticsData(
      creator.user_id,
      creator.support_widget_currency || "USD",
      false  // no lifetime in public
    );

    return successResponseHelper(res, 200, "Creator analytics retrieved", {
      enabled: true,
      ...data,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

interface DonationValidationResult {
  error?: string;
  fields: Record<string, unknown>;
}

/**
 * Validate + normalize donation campaign fields.
 * partial=true (update): only validates fields that are present in the input.
 * partial=false (create): title is required.
 */
const validateDonationInput = (
  input: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {}
): DonationValidationResult => {
  const fields: Record<string, unknown> = {};

  if (input.title !== undefined || !partial) {
    const t = String(input.title ?? "").trim();
    if (!t) return { error: "Campaign title is required for donation links.", fields };
    if (t.length > 255) return { error: "Campaign title must be 255 characters or less.", fields };
    fields.title = t;
  }

  if (input.goal_amount !== undefined) {
    if (input.goal_amount === null || input.goal_amount === "") {
      fields.goal_amount = null;
    } else {
      const g = Number(input.goal_amount);
      if (!Number.isFinite(g) || g <= 0) return { error: "goal_amount must be a positive number.", fields };
      if (g > 999999999) return { error: "goal_amount is too large.", fields };
      fields.goal_amount = Math.round(g * 100) / 100;
    }
  }

  if (input.preset_amounts !== undefined) {
    let arr: number[] = [];
    if (input.preset_amounts === null || input.preset_amounts === "") {
      arr = [];
    } else if (Array.isArray(input.preset_amounts)) {
      arr = (input.preset_amounts as unknown[]).map((n) => Number(n));
    } else if (typeof input.preset_amounts === "string") {
      arr = input.preset_amounts
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map((s) => Number(s));
    } else {
      return { error: "preset_amounts must be an array of numbers or a comma-separated string.", fields };
    }
    if (arr.some((n) => !Number.isFinite(n) || n <= 0)) {
      return { error: "preset_amounts must contain only positive numbers.", fields };
    }
    if (arr.length > 6) return { error: "A maximum of 6 preset amounts is allowed.", fields };
    const unique = [...new Set(arr.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b);
    fields.preset_amounts = unique.length ? unique.join(",") : null;
  }

  if (input.min_amount !== undefined) {
    if (input.min_amount === null || input.min_amount === "") {
      fields.min_amount = null; // controller-level default of 1 applies
    } else {
      const m = Number(input.min_amount);
      if (!Number.isFinite(m) || m <= 0) return { error: "min_amount must be a positive number.", fields };
      if (m > 999999999) return { error: "min_amount is too large.", fields };
      fields.min_amount = Math.round(m * 100) / 100;
    }
  }

  for (const boolField of ["allow_custom_amount", "show_progress", "show_supporters", "auto_close_at_goal"]) {
    if (input[boolField] !== undefined) {
      fields[boolField] = Boolean(input[boolField]);
    }
  }

  if (input.campaign_image !== undefined) {
    if (input.campaign_image === null || input.campaign_image === "") {
      fields.campaign_image = null;
    } else {
      const img = String(input.campaign_image).trim();
      if (img.length > 512) return { error: "campaign_image URL is too long (max 512 chars).", fields };
      if (!/^(https?:\/\/|\/)/i.test(img)) {
        return { error: "campaign_image must be a valid URL.", fields };
      }
      fields.campaign_image = img;
    }
  }

  // ── Crowdfunding v2 fields (Phase 3 — GoFundMe-lite) ──────────────
  if (input.donation_story_md !== undefined) {
    if (input.donation_story_md === null || input.donation_story_md === "") {
      fields.donation_story_md = null;
    } else {
      const s = String(input.donation_story_md);
      if (s.length > 20000) return { error: "donation_story_md is too long (max 20,000 characters).", fields };
      fields.donation_story_md = s;
    }
  }
  if (input.donation_gallery !== undefined) {
    if (input.donation_gallery === null) {
      fields.donation_gallery = [];
    } else if (Array.isArray(input.donation_gallery)) {
      if (input.donation_gallery.length > 12) {
        return { error: "donation_gallery supports at most 12 photos.", fields };
      }
      const clean = [];
      for (const item of input.donation_gallery) {
        if (!item || typeof item !== "object") continue;
        const url = String((item as any).url || "").trim();
        if (!url) continue;
        if (url.length > 512) return { error: "gallery item URL is too long (max 512 chars).", fields };
        if (!/^(https?:\/\/|\/)/i.test(url)) return { error: "gallery item URL must be a valid URL.", fields };
        const caption = (item as any).caption ? String((item as any).caption).slice(0, 240) : undefined;
        clean.push({ url, ...(caption ? { caption } : {}) });
      }
      fields.donation_gallery = clean;
    } else {
      return { error: "donation_gallery must be an array.", fields };
    }
  }
  if (input.donation_ends_at !== undefined) {
    if (input.donation_ends_at === null || input.donation_ends_at === "") {
      fields.donation_ends_at = null;
    } else {
      const d = new Date(String(input.donation_ends_at));
      if (isNaN(d.getTime())) return { error: "donation_ends_at must be a valid ISO date.", fields };
      // Must be in the future
      if (d.getTime() <= Date.now()) return { error: "donation_ends_at must be in the future.", fields };
      fields.donation_ends_at = d;
    }
  }
  if (input.donation_category !== undefined) {
    if (input.donation_category === null || input.donation_category === "") {
      fields.donation_category = null;
    } else {
      const cat = String(input.donation_category).trim().toLowerCase();
      const allowed = ["medical", "community", "creative", "emergency", "education", "animal", "environment", "memorial", "sports", "faith", "other"];
      if (!allowed.includes(cat)) {
        return { error: `donation_category must be one of: ${allowed.join(", ")}.`, fields };
      }
      fields.donation_category = cat;
    }
  }
  if (input.donation_organizer_thanks !== undefined) {
    if (input.donation_organizer_thanks === null || input.donation_organizer_thanks === "") {
      fields.donation_organizer_thanks = null;
    } else {
      const s = String(input.donation_organizer_thanks);
      if (s.length > 2000) return { error: "donation_organizer_thanks is too long (max 2,000 characters).", fields };
      fields.donation_organizer_thanks = s;
    }
  }
  if (input.donation_beneficiary !== undefined) {
    if (input.donation_beneficiary === null) {
      fields.donation_beneficiary = null;
    } else if (typeof input.donation_beneficiary === "object" && input.donation_beneficiary !== null) {
      const b: any = input.donation_beneficiary;
      const name = b.name ? String(b.name).slice(0, 200) : "";
      const description = b.description ? String(b.description).slice(0, 1000) : "";
      if (!name) return { error: "donation_beneficiary.name is required when donation_beneficiary is provided.", fields };
      fields.donation_beneficiary = { name, ...(description ? { description } : {}) };
    } else {
      return { error: "donation_beneficiary must be an object with { name, description? }.", fields };
    }
  }

  return { fields };
};

/** Parse "10,25,50" -> [10, 25, 50] */
export const parsePresetAmounts = (raw: string | null | undefined): number[] => {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
};

export const createPaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  
  // Extract both old and new field names for backward compatibility
  // IMPORTANT: Client should send EITHER new format OR legacy format, not both
  // If both provided, new format (base_*) takes priority
  const { 
    email, 
    base_currency,    // NEW format (recommended)
    currency,         // LEGACY format (backward compatibility)
    modes, 
    amount,           // LEGACY format (backward compatibility)
    base_amount,      // NEW format (recommended)
    description,
    expire,
    callback_url,
    redirect_url,
    webhook_url,
    fee_payer,        // Who pays blockchain fees: 'customer' or 'company'
    company_id,       // Phase 10 Fix: Accept company_id for multi-tenant isolation
    apply_tax,        // Tax toggle: calculate tax based on customer location (default: false)
    tax_inclusive,    // NEW: price already includes tax (retail model) vs added on top (B2B model)
    accepted_currencies, // Array of crypto types to accept (e.g., ['BTC', 'ETH', 'USDT-TRC20'])
    // Fixed tax parameters (alternative to apply_tax location-based)
    // tax_percentage and tax_name removed - not used in this function
    name,              // Customer name
    // ── Donation / crowdfunding fields ──
    link_type,          // 'standard' (default) | 'donation'
    title,              // Campaign headline (required for donations)
    goal_amount,        // Fundraising target (optional)
    preset_amounts,     // Suggested amounts: array or CSV string
    min_amount,         // Minimum accepted donation (default 1)
    allow_custom_amount, // Allow donor-entered amounts (default true)
    show_progress,      // Show progress bar on checkout (default true)
    show_supporters,    // Show supporter wall on checkout (default true)
    auto_close_at_goal, // Stop accepting once goal reached (default false)
    campaign_image      // Cover image URL (uploaded via /pay/uploadCampaignImage)
  } = req.body;
  
  // Normalize field names - use new format first, fall back to legacy, then default
  // Priority: base_currency > currency > 'USD'
  const normalizedCurrency = base_currency || currency || 'USD';
  // Priority: base_amount > amount
  const normalizedAmount = base_amount || amount;
  
  // Donation campaign links are multi-use: donors choose the amount, so no
  // fixed amount is required (base_amount stays 0 on the parent row).
  const isDonation = String(link_type || '').toLowerCase() === 'donation';
  let donationFields: Record<string, unknown> = {};
  
  try {
    if (isDonation) {
      const donationCheck = validateDonationInput(
        {
          title,
          goal_amount,
          preset_amounts,
          min_amount,
          allow_custom_amount,
          show_progress,
          show_supporters,
          auto_close_at_goal,
          campaign_image,
          // ── Crowdfunding v2 fields (Phase 3) ──────────────
          donation_story_md: (req.body as any).donation_story_md,
          donation_gallery: (req.body as any).donation_gallery,
          donation_ends_at: (req.body as any).donation_ends_at,
          donation_category: (req.body as any).donation_category,
          donation_organizer_thanks: (req.body as any).donation_organizer_thanks,
          donation_beneficiary: (req.body as any).donation_beneficiary,
        },
        { partial: false }
      );
      if (donationCheck.error) {
        return errorResponseHelper(res, 400, donationCheck.error);
      }
      donationFields = donationCheck.fields;
      // If custom amounts are disabled, donors can only pick presets — so presets must exist
      const presetsAfter = parsePresetAmounts(donationFields.preset_amounts as string | null);
      const allowCustomAfter = donationFields.allow_custom_amount !== undefined ? Boolean(donationFields.allow_custom_amount) : true;
      if (!allowCustomAfter && presetsAfter.length === 0) {
        return errorResponseHelper(res, 400, "Provide at least one preset amount when custom amounts are disabled.");
      }
    } else {
    // Validate required fields with clear error messages
    if (!normalizedAmount) {
      return errorResponseHelper(
        res, 
        400, 
        "Amount is required. Please provide either 'amount' or 'base_amount' field."
      );
    }
    
    // Validate amount is positive
    if (normalizedAmount <= 0) {
      return errorResponseHelper(
        res,
        400,
        "Amount must be greater than zero."
      );
    }
    }
    
    // Validate email format if provided
    if (email && email.trim() !== "" && !email.includes('@')) {
      return errorResponseHelper(
        res,
        400,
        "Invalid email format. Please provide a valid email address."
      );
    }
    
    // Validate modes if provided
    if (modes) {
      const validModes = ['CRYPTO', 'CARD', 'BANK_TRANSFER', 'GOOGLE_PAY', 'APPLE_PAY', 'USSD', 'MOBILE_MONEY', 'QR_CODE'];
      const invalidModes = modes.filter((mode: string) => !validModes.includes(mode.toUpperCase()));
      
      if (invalidModes.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid payment modes: ${invalidModes.join(', ')}. Valid modes are: ${validModes.join(', ')}`
        );
      }
      
      // Convert to uppercase if lowercase provided
      const normalizedModes = modes.map((mode: string) => mode.toUpperCase());
      req.body.modes = normalizedModes;
    }
    
    // Validate expire format if provided
    if (expire && expire !== 'No' && !['24h', '7d', '30d'].includes(expire)) {
      return errorResponseHelper(
        res,
        400,
        "Invalid expire value. Valid options are: '24h', '7d', '30d', or 'No'."
      );
    }
    
    // Phase 10 Fix: Validate company_id if provided
    if (company_id) {
      const companyExists = await companyModel.findOne({
        where: {
          company_id,
          user_id: userData.user_id,
        },
      });
      
      if (!companyExists) {
        return errorResponseHelper(
          res,
          400,
          "Invalid company_id or company does not belong to this user"
        );
      }
    }
    
    // ========================================
    // KYC ENFORCEMENT: Block payment creation if KYC required but not approved
    // ========================================
    let kycWarning: {
      type: string;
      message: string;
      days_remaining: number;
      threshold_date: string;
      grace_period_end: string;
      kyc_status: string;
      verification_url: string | null;
      api_endpoint: string;
      has_active_session: boolean;
    } | null = null;

    const kycResult = await checkKycEnforcement(userData.user_id, company_id, '[KYC - PaymentCreate]');

    if (kycResult.blocked) {
      return errorResponseHelper(
        res,
        403,
        `KYC verification required. Your transaction volume ($${kycResult.totalVolume.toFixed(2)}) exceeded the $${KYC_THRESHOLD_USD.toLocaleString()} threshold on ${kycResult.thresholdDate?.toLocaleDateString()}. Your 90-day grace period has expired. Please complete KYC verification to continue creating payment links. Current KYC status: ${kycResult.kycStatus}. [KYC_REQUIRED]`
      );
    } else if (kycResult.needsEnforcement && kycResult.kycStatus !== 'approved' && kycResult.daysRemaining !== undefined) {
      // Within grace period - set in-app warning
      const daysRemaining = kycResult.daysRemaining;
      const urgencyType = daysRemaining <= 14 ? "critical" : daysRemaining <= 30 ? "warning" : "info";
      kycWarning = {
        type: urgencyType,
        message: daysRemaining <= 14 
          ? `URGENT: Only ${daysRemaining} days left to complete KYC verification! Your account will be restricted after ${kycResult.gracePeriodEnd?.toLocaleDateString()}.`
          : daysRemaining <= 30
          ? `Warning: ${daysRemaining} days remaining to complete KYC verification before your account is restricted.`
          : `KYC verification required within ${daysRemaining} days. Your transaction volume ($${kycResult.totalVolume.toLocaleString()}) has exceeded the $${KYC_THRESHOLD_USD.toLocaleString()} threshold.`,
        days_remaining: daysRemaining,
        threshold_date: kycResult.thresholdDate?.toISOString() || '',
        grace_period_end: kycResult.gracePeriodEnd?.toISOString() || '',
        kyc_status: kycResult.kycStatus,
        verification_url: kycResult.hasActiveSession ? (kycResult.veriffSessionUrl || null) : null,
        api_endpoint: "/api/kyc/submit",
        has_active_session: !!kycResult.hasActiveSession,
      };
    }
    // ========================================
    // END KYC ENFORCEMENT
    // ========================================
    
    // Phase 11: Validate at least one crypto wallet is configured for this company
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    
    const walletWhereClause: Record<string, unknown> = {
      user_id: userData.user_id,
      wallet_type: { [Op.in]: cryptoTypes },
      wallet_address: { [Op.not]: null },
    };
    
    // If company_id is provided, filter by company_id
    if (company_id) {
      walletWhereClause.company_id = company_id;
    }
    
    const configuredWallets = await userWalletModel.findAll({
      where: walletWhereClause,
      attributes: ['wallet_type'],
    });
    
    if (configuredWallets.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment link."
      );
    }
    
    // Get unique list of ALL configured currencies for this company
    const allConfiguredCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
    cronLogger.info(`[Phase 11] All configured currencies for company_id ${company_id}:`, allConfiguredCurrencies);
    
    // Validate and process accepted_currencies if provided
    let finalAcceptedCurrencies: string[] = allConfiguredCurrencies; // Default: all configured
    let acceptedCurrenciesString: string | null = null;
    
    if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
      // Normalize to uppercase
      const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
      
      // Validate all requested currencies are valid crypto types
      const invalidCryptos = requestedCurrencies.filter((c: string) => !cryptoTypes.includes(c));
      if (invalidCryptos.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid cryptocurrency types: ${invalidCryptos.join(', ')}. Valid options: ${cryptoTypes.join(', ')}`
        );
      }
      
      // Validate all requested currencies have configured wallets
      const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
      if (unconfiguredCurrencies.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Please configure wallets first or select from available currencies: ${allConfiguredCurrencies.join(', ')}`
        );
      }
      
      // Use the merchant's selected currencies
      finalAcceptedCurrencies = requestedCurrencies;
      acceptedCurrenciesString = requestedCurrencies.join(',');
      cronLogger.info(`[createPaymentLink] Merchant selected currencies: ${acceptedCurrenciesString}`);
    } else {
      cronLogger.info(`[createPaymentLink] No currencies specified, using all configured: ${allConfiguredCurrencies.join(',')}`);
    }
    
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    cronLogger.info(`[createPaymentLink] user_id=${userData.user_id}, company_id=${company_id}`);
    
    // Calculate expires_at based on expire option
    // DEFAULT: 7 days if not specified (for security and cleanup)
    let expires_at = null;
    const now = new Date();
    
    if (expire === "No") {
      // Explicitly set to never expire
      expires_at = null;
    } else if (expire === "24h") {
      expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (expire === "30d") {
      expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      // Default to 7 days if not specified or explicitly set to "7d".
      // Donation campaigns default to NO expiry (they run until closed).
      expires_at = (isDonation && !expire)
        ? null
        : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    // company_id is REQUIRED - validate it exists
    if (!company_id) {
      return errorResponseHelper(
        res,
        400,
        "company_id is required. Please specify which company this payment link belongs to."
      );
    }
    
    // Verify the company belongs to this user
    const userCompany = await companyModel.findOne({
      where: { 
        company_id: company_id,
        user_id: userData.user_id 
      }
    });
    
    if (!userCompany) {
      return errorResponseHelper(
        res,
        400,
        "Invalid company_id. The specified company does not exist or does not belong to you."
      );
    }
    
    cronLogger.info(`[createPaymentLink] Using company_id: ${company_id} for user: ${userData.user_id}`);
    
    // ========================================
    // ACTIVE API KEY CHECK: Block if no active API key exists
    // ========================================
    const activeApiKey = await sequelize.query<{ api_id: number }>(
      `SELECT api_id FROM tbl_api WHERE company_id = :companyId AND status = 'active' LIMIT 1`,
      {
        replacements: { companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );
    
    if (!activeApiKey || activeApiKey.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "An active API key is required to create a payment link. Please create one in your developer settings."
      );
    }
    // ========================================
    // END ACTIVE API KEY CHECK
    // ========================================
    
    // Default modes if not provided
    const allowedModes = modes ? modes.join(",") : "crypto,card";
    
    const payload = {
      transaction_id: crypto.randomUUID(),
      email: email || null,
      allowedModes: allowedModes,
      base_amount: isDonation ? 0 : normalizedAmount,
      base_currency: normalizedCurrency,
      user_id: userData.user_id,
      adm_id: userData.user_id,  // Add adm_id for crypto payment compatibility
      company_id: company_id,  // REQUIRED field
      payment_link: (process.env.CHECKOUT_URL || '').trim().replace(/\/$/, '') + "/pay?d=" + uniqueRef,
      description: description || null,
      expires_at: expires_at,
      callback_url: callback_url || null,
      redirect_url: redirect_url || null,
      webhook_url: webhook_url || null,
      fee_payer: fee_payer || 'company',  // Default: company pays fees (existing behavior)
      apply_tax: isDonation ? false : (apply_tax || false),  // Donations never collect sales tax
      tax_inclusive: isDonation ? false : (tax_inclusive === true),  // Only meaningful when apply_tax=true; donations never
      accepted_currencies: acceptedCurrenciesString,  // Store merchant's selected currencies (null = all)
      customer_name: name || null,  // Optional customer name for payment link
      // ── Donation campaign fields (only set for donation links) ──
      ...(isDonation && {
        link_type: 'donation',
        title: donationFields.title,
        goal_amount: donationFields.goal_amount ?? null,
        preset_amounts: donationFields.preset_amounts ?? null,
        min_amount: donationFields.min_amount ?? 1,
        allow_custom_amount: donationFields.allow_custom_amount !== undefined ? donationFields.allow_custom_amount : true,
        show_progress: donationFields.show_progress !== undefined ? donationFields.show_progress : true,
        show_supporters: donationFields.show_supporters !== undefined ? donationFields.show_supporters : true,
        auto_close_at_goal: donationFields.auto_close_at_goal !== undefined ? donationFields.auto_close_at_goal : false,
        campaign_image: donationFields.campaign_image ?? null,
        // Crowdfunding v2 (Phase 3 — GoFundMe-lite)
        donation_story_md: donationFields.donation_story_md ?? null,
        donation_gallery: donationFields.donation_gallery ?? [],
        donation_ends_at: donationFields.donation_ends_at ?? null,
        donation_category: donationFields.donation_category ?? null,
        donation_organizer_thanks: donationFields.donation_organizer_thanks ?? null,
        donation_beneficiary: donationFields.donation_beneficiary ?? null,
      }),
    };

    const links = await paymentLinkModel.create(payload);
    const redisPayload = {
      ...payload,
      pathType: "createLink",
      link_id: links.dataValues.link_id,
      available_currencies: finalAcceptedCurrencies,  // Use merchant's selection or all configured
      all_configured_currencies: allConfiguredCurrencies,  // Store all for reference
      createdAt: new Date().toISOString(),  // Include creation timestamp for checkout
    };

    cronLogger.info(redisPayload);

    await setRedisItem("customer-" + uniqueRef, redisPayload);

    // Send payment link email with referee code (if email provided)
    // Skipped for donation campaigns — there is no single "customer" to bill.
    if (!isDonation && email && email.trim() !== "") {
      try {
        // Import referee code service
        const { createRefereeCode } = await import("../../services/referralService");
        
        // Try to create referee code (will return null if email has account or already received code)
        const refereeCodeData = await createRefereeCode({
          customerEmail: email,
          referrerCompanyId: company_id || userData.company_id,
          referrerUserId: userData.user_id,
          paymentLinkId: links.dataValues.link_id,
        });

        // Build email content
        let refereeCodeSection = "";
        if (refereeCodeData) {
          refereeCodeSection = `
            <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px;">🎁 Special Offer for You!</h3>
              <p style="margin: 0 0 10px 0; color: #14532d; font-size: 14px;">
                Want to accept crypto payments for your own business? Join Dynopay and get <strong>${refereeCodeData.discount}% off</strong> all fees for <strong>${refereeCodeData.duration} days</strong>!
              </p>
              <p style="margin: 0; font-size: 14px;">
                Use code: <strong style="background: #dcfce7; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${refereeCodeData.code}</strong>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #166534;">
                This code is exclusive to you and expires in 30 days.
              </p>
            </div>
          `;
        }

        // Get company name if available
        let companyName = "Dynopay Merchant";
        if (company_id) {
          const company = await companyModel.findByPk(company_id);
          if (company) {
            companyName = (company as { company_name?: string }).company_name || companyName;
          }
        }

        const paymentMessage = `
You have received a payment request from <strong>${companyName}</strong>.

<div style="margin: 20px 0; padding: 20px; background: #f8f9ff; border-radius: 8px;">
  <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${normalizedAmount} ${normalizedCurrency}</p>
  ${description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>` : ''}
  ${expires_at ? `<p style="margin: 0;"><strong>Expires:</strong> ${new Date(expires_at).toLocaleDateString()}</p>` : ''}
</div>

<div style="text-align: center; margin: 24px 0;">
  <a href="${payload.payment_link}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Pay Now</a>
</div>

${refereeCodeSection}
        `.trim();

        await sendEmail(
          email,                                                                          // recipientEmail
          email.split('@')[0] || "Customer",                                              // name (extract from email)
          `Payment Request from ${companyName} - ${normalizedAmount} ${normalizedCurrency}`, // subject
          paymentMessage,                                                                 // message body
          false                                                                           // showImage
        );

        cronLogger.info(`[PaymentLink] Email sent to ${email}${refereeCodeData ? ` with referee code ${refereeCodeData.code}` : ''}`);
      } catch (emailError) {
        cronLogger.error("[PaymentLink] Failed to send email:", emailError);
        // Don't fail the request if email fails
      }
    }
    
    // Send payment link created notification to merchant
    // For donation/crowdfunding campaigns, use a distinct email template
    // (a $10,000 goal on a crowdfunding campaign is NOT a $10,000 payment
    // request — that mismatch was flagged as inconsistent by users).
    try {
      const user = await userModel.findByPk(userData.user_id);
      if (user && user.dataValues.email) {
        if (isDonation) {
          const { sendCrowdfundingCampaignCreatedEmail } = await import("../../services/emailService");
          await sendCrowdfundingCampaignCreatedEmail(
            user.dataValues.email,
            user.dataValues.name || 'Merchant',
            String(donationFields.title || 'Crowdfunding campaign'),
            (donationFields.goal_amount as number | null) ?? null,
            normalizedCurrency,
            payload.payment_link,
            description || null
          );
          cronLogger.info(`[PaymentLink] Crowdfunding campaign notification sent to ${user.dataValues.email}`);
        } else {
          const { sendPaymentLinkCreatedEmail } = await import("../../services/emailService");
          await sendPaymentLinkCreatedEmail(
            user.dataValues.email,
            user.dataValues.name || 'Merchant',
            normalizedAmount.toString(),
            normalizedCurrency,
            payload.payment_link,
            description || 'No description provided',
            expires_at ? new Date(expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null
          );
          cronLogger.info(`[PaymentLink] Merchant notification sent to ${user.dataValues.email}`);
        }
      }
    } catch (merchantEmailError) {
      cronLogger.error("[PaymentLink] Failed to send merchant notification:", merchantEmailError);
      // Don't fail the request if email fails
    }

    // ========================================
    // DIRECT PAY: Reserve merchant pool address when single crypto is selected
    // ========================================
    const MERCHANT_POOL_CRYPTO_TYPES_FOR_LINK = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    let directPayAddress: string | null = null;
    let directPayQrCode: string | null = null;
    let directPayTempId: number | null = null;

    if (
      !isDonation &&
      finalAcceptedCurrencies.length === 1 &&
      MERCHANT_POOL_CRYPTO_TYPES_FOR_LINK.includes(finalAcceptedCurrencies[0])
    ) {
      const singleCrypto = finalAcceptedCurrencies[0];
      try {
        cronLogger.info(`[createPaymentLink] Single crypto ${singleCrypto} selected — reserving merchant pool address for Direct Pay`);
        const poolAddress = await merchantPoolService.reserveAddress(
          singleCrypto,
          payload.transaction_id,
          userData.user_id,
          company_id || 0,
          normalizedAmount || 0
        ) as any;

        if (poolAddress) {
          directPayAddress = poolAddress.dataValues?.wallet_address || poolAddress.wallet_address;
          directPayTempId = poolAddress.dataValues?.temp_address_id || poolAddress.temp_address_id;

          // Generate QR code for the pool address
          const destTag = poolAddress.dataValues?.destination_tag || poolAddress.destination_tag;
          const qrPayload = destTag
            ? `${directPayAddress}?dt=${destTag}`
            : directPayAddress;
          directPayQrCode = await generateQRCodeWithLogo(qrPayload, singleCrypto, 400);

          // Store the reserved pool address info in Redis so checkout can use the SAME address
          const updatedRedisPayload = {
            ...redisPayload,
            direct_pay_temp_id: directPayTempId,
            direct_pay_address: directPayAddress,
          };
          await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);

          // ═══════════════════════════════════════════════════════════════════════
          // CRITICAL FIX: Set crypto-{address} Redis key at link creation time
          // This ensures the webhook processor can find payment data even if the
          // customer sends BTC directly to the address without opening the checkout page.
          // Previously, this key was only set during addPayment (checkout flow), causing
          // webhooks to be silently ignored with "No Redis data found" if the customer
          // paid before visiting checkout.
          // ═══════════════════════════════════════════════════════════════════════
          const dpDestTag = poolAddress.dataValues?.destination_tag || poolAddress.destination_tag;
          const directPayCryptoRedisKey = getCryptoRedisKey(directPayAddress!, dpDestTag);

          // Calculate fee structure for the Direct Pay crypto Redis entry
          const fallbackFeePercent = parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0') / 100;
          // We don't have crypto_amount yet (customer hasn't selected), but store base info
          // The webhook processor + cryptoVerification will handle the actual conversion
          await setRedisItem(directPayCryptoRedisKey, {
            mode: "crypto",
            base_amount_usd: normalizedAmount,
            total_amount_usd: normalizedAmount,
            status: "pending",
            ref: uniqueRef,
            currency: singleCrypto,
            payment_id: payload.transaction_id,
            unique_tx_id: payload.transaction_id,
            walletType: "customer",
            temp_id: directPayTempId,
            is_merchant_pool: "true",
            fee_payer: fee_payer || 'company',
            company_id: company_id || null,
            link_id: links.dataValues.link_id,
            webhook_url: webhook_url || null,
            callback_url: callback_url || null,
            ...(dpDestTag && { destination_tag: dpDestTag }),
            // Mark as direct-pay-created so addPayment can enrich with exact crypto amounts
            direct_pay_origin: "createPaymentLink",
          });
          cronLogger.info(`[createPaymentLink] ✅ Set ${directPayCryptoRedisKey} Redis key for Direct Pay webhook processing`);

          cronLogger.info(`[createPaymentLink] Direct Pay address reserved: ${directPayAddress} (temp_id: ${directPayTempId})`);
        }
      } catch (poolError) {
        cronLogger.warn(`[createPaymentLink] Failed to reserve pool address for Direct Pay: ${(poolError as Error).message}`);
        // Don't fail the link creation — Direct Pay is optional
      }
    }
    // ========================================
    // END DIRECT PAY
    // ========================================

    // Format response to be consistent with getPaymentLinkById
    const amountDisplay = formatAmountForDisplay(isDonation ? 0 : normalizedAmount, normalizedCurrency);
    const currencyInfo = getCurrencyInfo(normalizedCurrency);
    
    const responseData = {
      ...links.dataValues,
      // Formatted amount display
      amount_display: amountDisplay,
      currency_info: currencyInfo,
      display_value: amountDisplay.display_value, // e.g., "$123.00 USD"
      accepted_currencies: links.dataValues.accepted_currencies 
        ? links.dataValues.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,  // null means all configured currencies are accepted
      // Include KYC warning if within grace period (for in-app display)
      ...(kycWarning && { kyc_warning: kycWarning }),
      // Direct Pay pool address (when single crypto selected)
      ...(directPayAddress && {
        direct_pay_address: directPayAddress,
        direct_pay_qr_code: directPayQrCode,
        direct_pay_temp_id: directPayTempId,
      }),
    };

    successResponseHelper(res, 200, "Payment link created successfully", responseData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

export const getPaymentLinks = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  try {
    const { company_id, page, limit, paginated } = req.query;  // Added pagination params
    
    cronLogger.info(`[getPaymentLinks] user_id=${userData.user_id}, company_id=${company_id || 'all'}`);
    
    // Build where clause with optional company_id filter.
    // Contribution child rows (parent_link_id set) are internal — never listed.
    const whereClause: Record<string, unknown> = {
      user_id: userData.user_id,
      parent_link_id: null,
      is_tip_jar: false,
    };
    
    if (company_id) {
      whereClause.company_id = parseInt(company_id as string);
    }
    
    // Check if pagination is requested (backward compatibility)
    const usePagination = paginated === 'true' || page !== undefined || limit !== undefined;
    
    // Get total count for pagination
    const totalCount = await paymentLinkModel.count({ where: whereClause });
    
    // Calculate pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    const links = await paymentLinkModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      ...(usePagination && { limit: limitNum, offset: offset }),
    });

    // Define interface for payment link data
    interface PaymentLinkData {
      link_id: number;
      transaction_id: string;
      description?: string;
      base_amount: number;
      base_currency: string;
      createdAt: Date | string;
      expires_at?: Date | string;
      status?: string;
      times_used?: number;
      payment_link: string;
      email?: string;
      allowedModes?: string;
      company_id?: number;
      callback_url?: string;
      redirect_url?: string;
      webhook_url?: string;
      fee_payer?: string;
      link_type?: string;
      title?: string;
      goal_amount?: number;
      preset_amounts?: string;
      min_amount?: number;
      allow_custom_amount?: boolean;
      show_progress?: boolean;
      show_supporters?: boolean;
      auto_close_at_goal?: boolean;
      campaign_image?: string;
      // Crowdfunding v2 (Phase 3) fields
      donation_story_md?: string | null;
      donation_gallery?: string[] | string | null;
      donation_ends_at?: Date | string | null;
      donation_category?: string | null;
      donation_organizer_thanks?: string | null;
      donation_beneficiary?: string | null;
    }

    // ── Donation aggregates (raised amount + supporter count per campaign) ──
    const donationLinkIds = (links as Array<{ dataValues: PaymentLinkData }>)
      .filter((l) => l.dataValues.link_type === 'donation')
      .map((l) => l.dataValues.link_id);
    const donationAgg: Record<number, { raised_amount: number; supporters_count: number }> = {};
    if (donationLinkIds.length > 0) {
      try {
        const aggRows = (await sequelize.query(
          `SELECT parent_link_id, COUNT(*)::int AS supporters_count, COALESCE(SUM(base_amount),0)::float AS raised_amount
           FROM tbl_payment_link
           WHERE parent_link_id IN (:ids) AND LOWER(status) IN (:statuses)
           GROUP BY parent_link_id`,
          {
            replacements: { ids: donationLinkIds, statuses: DONATION_COMPLETED_STATUSES },
            type: QueryTypes.SELECT,
          }
        )) as Array<{ parent_link_id: number; supporters_count: number; raised_amount: number }>;
        aggRows.forEach((r) => {
          donationAgg[r.parent_link_id] = {
            raised_amount: Number(r.raised_amount || 0),
            supporters_count: Number(r.supporters_count || 0),
          };
        });
      } catch (aggErr) {
        cronLogger.warn('[getPaymentLinks] Donation aggregate query failed:', aggErr);
      }
    }

    // Format for UI with computed status
    const formattedLinks = (links as Array<{ dataValues: PaymentLinkData }>).map((link) => {
      const linkData = link.dataValues;
      const now = new Date();
      const isDonationLink = linkData.link_type === 'donation';
      const agg = isDonationLink
        ? donationAgg[linkData.link_id] || { raised_amount: 0, supporters_count: 0 }
        : null;
      
      // Calculate status (normalized to lowercase for frontend consistency)
      let status = "active";
      
      // Check if link is still in draft/pending state (no payment_link URL yet or amount is 0)
      // Donation parents legitimately have base_amount 0 — never "pending".
      const rawDbStatus = (linkData.status || "pending").toLowerCase().trim();
      if (!isDonationLink && rawDbStatus === "pending" && (!linkData.base_amount || Number(linkData.base_amount) === 0)) {
        status = "pending";
      }
      
      // Expired overrides pending/active
      if (linkData.expires_at && new Date(linkData.expires_at as string) <= now) {
        status = "expired";
      }
      
      // Completed overrides everything except expired
      if (parseState(linkData.status) === PaymentState.PAYOUT_COMPLETE) {
        status = "completed";
      }

      // Donation campaign auto-closed at goal → "completed"
      if (
        isDonationLink &&
        status === "active" &&
        linkData.auto_close_at_goal &&
        Number(linkData.goal_amount) > 0 &&
        (agg?.raised_amount || 0) >= Number(linkData.goal_amount)
      ) {
        status = "completed";
      }

      // Format dates
      const formatDate = (date: Date | string | undefined | null): string => {
        if (!date) return "Never";
        const d = new Date(date);
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', '');
      };

      // Use centralized currency formatting
      const currency = linkData.base_currency || 'USD';
      const amountDisplay = formatAmountForDisplay(Number(linkData.base_amount), currency);
      const currencyInfo = getCurrencyInfo(currency);

      return {
        link_id: linkData.link_id,
        transaction_id: linkData.transaction_id,
        description: linkData.description || "No description",
        display_value: amountDisplay.display_value, // e.g., "$123.00 USD"
        amount_display: amountDisplay,
        currency_info: currencyInfo,
        base_amount: linkData.base_amount,
        base_currency: linkData.base_currency,
        created: formatDate(linkData.createdAt),
        expires: formatDate(linkData.expires_at),
        status: status,
        times_used: linkData.times_used || 0,
        payment_link: linkData.payment_link,
        email: linkData.email,
        allowedModes: linkData.allowedModes,
        callback_url: linkData.callback_url,
        redirect_url: linkData.redirect_url,
        webhook_url: linkData.webhook_url,
        fee_payer: linkData.fee_payer || 'company',  // Who pays blockchain fees
        company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
        // ── Donation campaign block ──
        link_type: linkData.link_type || 'standard',
        ...(isDonationLink && {
          donation: {
            title: linkData.title || null,
            goal_amount: linkData.goal_amount != null ? Number(linkData.goal_amount) : null,
            raised_amount: agg?.raised_amount || 0,
            supporters_count: agg?.supporters_count || 0,
            progress_percent:
              Number(linkData.goal_amount) > 0
                ? Math.min(100, Math.round(((agg?.raised_amount || 0) / Number(linkData.goal_amount)) * 100))
                : null,
            min_amount: linkData.min_amount != null ? Number(linkData.min_amount) : 1,
            preset_amounts: parsePresetAmounts(linkData.preset_amounts),
            allow_custom_amount: linkData.allow_custom_amount !== false,
            show_progress: linkData.show_progress !== false,
            show_supporters: linkData.show_supporters !== false,
            auto_close_at_goal: Boolean(linkData.auto_close_at_goal),
            campaign_image: linkData.campaign_image || null,
            // Crowdfunding v2 (Phase 3)
            story_md: linkData.donation_story_md || null,
            gallery: Array.isArray(linkData.donation_gallery) ? linkData.donation_gallery : [],
            ends_at: linkData.donation_ends_at || null,
            category: linkData.donation_category || null,
            organizer_thanks: linkData.donation_organizer_thanks || null,
            beneficiary: linkData.donation_beneficiary || null,
          },
        }),
      };
    });

    // Return with pagination info only if pagination was requested
    // Otherwise return array directly for backward compatibility
    if (usePagination) {
      successResponseHelper(res, 200, "Payment links retrieved successfully", {
        links: formattedLinks,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        }
      });
    } else {
      // Backward compatible: return array directly
      successResponseHelper(res, 200, "Links Fetched Successfully!", formattedLinks);
    }
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

/**
 * Get single payment link by ID
 * GET /api/pay/links/:id
 */
export const getPaymentLinkById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  
  try {
    const link = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!link) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    const linkData = link.dataValues;
    const now = new Date();
    const isDonationLink = linkData.link_type === 'donation';
    
    // Calculate status (normalized to lowercase for frontend consistency)
    let status = "active";
    
    // Check if link is still in draft/pending state
    // Donation parents legitimately have base_amount 0 — never "pending".
    const rawDbStatus = (linkData.status || "pending").toLowerCase().trim();
    if (!isDonationLink && rawDbStatus === "pending" && (!linkData.base_amount || Number(linkData.base_amount) === 0)) {
      status = "pending";
    }
    
    // Expired overrides pending/active
    if (linkData.expires_at && new Date(linkData.expires_at) <= now) {
      status = "expired";
    }
    // Completed overrides everything except expired
    if (parseState(linkData.status) === PaymentState.PAYOUT_COMPLETE) {
      status = "completed";
    }

    // Format dates
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '');
    };

    const response = {
      link_id: linkData.link_id,
      transaction_id: linkData.transaction_id,
      description: linkData.description,
      base_amount: linkData.base_amount,
      base_currency: linkData.base_currency,
      paid_amount: linkData.paid_amount,
      paid_currency: linkData.paid_currency,
      created: formatDate(linkData.createdAt),
      updated: formatDate(linkData.updatedAt),
      expires_at: linkData.expires_at,
      expires: formatDate(linkData.expires_at) || "Never",
      status: status,
      times_used: linkData.times_used || 0,
      payment_link: linkData.payment_link,
      email: linkData.email,
      allowedModes: linkData.allowedModes,
      payment_mode: linkData.payment_mode,
      transaction_reference: linkData.transaction_reference,
      callback_url: linkData.callback_url,
      redirect_url: linkData.redirect_url,
      webhook_url: linkData.webhook_url,
      company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
      fee_payer: linkData.fee_payer || 'company',
      apply_tax: linkData.apply_tax || false,
      accepted_currencies: linkData.accepted_currencies 
        ? linkData.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,  // null means all configured currencies are accepted
      link_type: linkData.link_type || 'standard',
    };

    // ── Donation campaign block: aggregates + contribution history ──
    if (isDonationLink) {
      const agg = await getDonationAggregates(Number(linkData.link_id));

      // Auto-closed at goal → surface as "completed"
      if (
        response.status === 'active' &&
        linkData.auto_close_at_goal &&
        Number(linkData.goal_amount) > 0 &&
        agg.raised_amount >= Number(linkData.goal_amount)
      ) {
        response.status = 'completed';
      }

      const contributionRows = (await sequelize.query(
        `SELECT link_id, base_amount, base_currency, paid_amount, paid_currency, status,
                donor_name, donor_message, is_anonymous, "createdAt", "updatedAt"
         FROM tbl_payment_link
         WHERE parent_link_id = :pid
         ORDER BY "createdAt" DESC LIMIT 100`,
        { replacements: { pid: linkData.link_id }, type: QueryTypes.SELECT }
      )) as Array<Record<string, unknown>>;

      const contributions = contributionRows.map((c) => {
        const st = String(c.status || 'pending').toLowerCase().trim();
        const isCompleted = DONATION_COMPLETED_STATUSES.includes(st);
        return {
          link_id: c.link_id,
          amount: Number(c.base_amount || 0),
          currency: c.base_currency || linkData.base_currency || 'USD',
          donor_name: c.is_anonymous ? null : c.donor_name || null,
          donor_message: c.donor_message || null,
          is_anonymous: Boolean(c.is_anonymous),
          status: isCompleted ? 'completed' : st,
          created_at: c.createdAt,
        };
      });

      (response as Record<string, unknown>).donation = {
        title: linkData.title || null,
        goal_amount: linkData.goal_amount != null ? Number(linkData.goal_amount) : null,
        raised_amount: agg.raised_amount,
        supporters_count: agg.supporters_count,
        progress_percent:
          Number(linkData.goal_amount) > 0
            ? Math.min(100, Math.round((agg.raised_amount / Number(linkData.goal_amount)) * 100))
            : null,
        min_amount: linkData.min_amount != null ? Number(linkData.min_amount) : 1,
        preset_amounts: parsePresetAmounts(linkData.preset_amounts),
        allow_custom_amount: linkData.allow_custom_amount !== false,
        show_progress: linkData.show_progress !== false,
        show_supporters: linkData.show_supporters !== false,
        auto_close_at_goal: Boolean(linkData.auto_close_at_goal),
        campaign_image: linkData.campaign_image || null,
        // Crowdfunding v2 (Phase 3 — GoFundMe-lite)
        story_md: linkData.donation_story_md || null,
        gallery: Array.isArray(linkData.donation_gallery) ? linkData.donation_gallery : [],
        ends_at: linkData.donation_ends_at || null,
        category: linkData.donation_category || null,
        organizer_thanks: linkData.donation_organizer_thanks || null,
        beneficiary: linkData.donation_beneficiary || null,
        contributions,
      };
    }

    successResponseHelper(res, 200, "Payment link retrieved successfully", response);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

/**
 * Update payment link
 * PUT /api/pay/links/:id
 */
export const updatePaymentLink = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  const { 
    description, 
    expire,
    email,
    base_amount,
    base_currency,
    amount,               // Session 54: dashboard create/edit form sends `amount`
    currency,             // and `currency`; accept as aliases for base_amount/
                          // base_currency so standard-link amount/currency edits
                          // actually persist (previously silently ignored).
    allowedModes,
    fee_payer,
    apply_tax,
    tax_inclusive,       // NEW: retail (true) vs B2B (false) pricing display
    accepted_currencies,  // Array of crypto types to accept
    callback_url, 
    redirect_url, 
    webhook_url,
    name,                 // Customer name
    // ── Donation / crowdfunding fields (donation links only) ──
    title,
    goal_amount,
    preset_amounts,
    min_amount,
    allow_custom_amount,
    show_progress,
    show_supporters,
    auto_close_at_goal,
    campaign_image,
    // ── Crowdfunding v2 (Phase 3 — GoFundMe-lite) ──
    donation_story_md,
    donation_gallery,
    donation_ends_at,
    donation_category,
    donation_organizer_thanks,
    donation_beneficiary,
  } = req.body;
  
  try {
    // First check if link exists and belongs to user
    const existingLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!existingLink) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    // Check if link is already completed - don't allow updates
    if (existingLink.dataValues.status === 'completed') {
      return errorResponseHelper(res, 400, "Cannot update a completed payment link");
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {};
    
    // For accepted_currencies validation, we need to fetch configured wallets
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    let allConfiguredCurrencies: string[] = [];
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (email !== undefined) {
      updateData.email = email;
    }
    
    // Session 54 fix: accept both `base_amount` (REST API clients) and `amount`
    // (dashboard create/edit form) as the amount field. Previously only
    // base_amount was read, so editing a standard link's amount from the
    // dashboard silently did nothing (returned 200 but amount unchanged).
    const effectiveBaseAmount = base_amount !== undefined ? base_amount : amount;
    if (effectiveBaseAmount !== undefined && existingLink.dataValues.link_type !== 'donation') {
      const amountNum = Number(effectiveBaseAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return errorResponseHelper(res, 400, "Invalid amount. Must be a positive number.");
      }
      updateData.base_amount = amountNum;
    }
    
    const effectiveBaseCurrency = base_currency !== undefined ? base_currency : currency;
    if (effectiveBaseCurrency !== undefined) {
      const validCurrencies = [
        // Major International
        'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
        // Latin America (high crypto adoption)
        'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
        // African (high crypto adoption)
        'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
        'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF'
      ];
      if (!validCurrencies.includes(String(effectiveBaseCurrency).toUpperCase())) {
        return errorResponseHelper(res, 400, `Invalid currency. Valid options: ${validCurrencies.join(', ')}`);
      }
      updateData.base_currency = String(effectiveBaseCurrency).toUpperCase();
    }
    
    if (allowedModes !== undefined) {
      // Can be array or comma-separated string
      let modes = allowedModes;
      if (Array.isArray(allowedModes)) {
        modes = allowedModes.join(',');
      }
      const validModes = ['CRYPTO', 'CARD', 'BANK'];
      const providedModes = modes.split(',').map((m: string) => m.trim().toUpperCase());
      const invalidModes = providedModes.filter((m: string) => !validModes.includes(m));
      if (invalidModes.length > 0) {
        return errorResponseHelper(res, 400, `Invalid payment modes: ${invalidModes.join(', ')}. Valid options: ${validModes.join(', ')}`);
      }
      updateData.allowedModes = providedModes.join(',');
    }
    
    if (fee_payer !== undefined) {
      const validFeePayers = ['customer', 'company'];
      if (!validFeePayers.includes(fee_payer.toLowerCase())) {
        return errorResponseHelper(res, 400, "Invalid fee_payer. Must be 'customer' or 'company'.");
      }
      updateData.fee_payer = fee_payer.toLowerCase();
    }
    
    if (apply_tax !== undefined) {
      updateData.apply_tax = Boolean(apply_tax);
    }
    if (tax_inclusive !== undefined) {
      updateData.tax_inclusive = Boolean(tax_inclusive);
    }
    
    // Handle accepted_currencies update
    if (accepted_currencies !== undefined) {
      if (accepted_currencies === null || (Array.isArray(accepted_currencies) && accepted_currencies.length === 0)) {
        // Clear selection - use all configured wallets
        updateData.accepted_currencies = null;
      } else if (Array.isArray(accepted_currencies)) {
        // Fetch configured wallets to validate
        const company_id = existingLink.dataValues.company_id;
        const walletWhereClause: Record<string, unknown> = {
          user_id: userData.user_id,
          wallet_type: { [Op.in]: cryptoTypes },
          wallet_address: { [Op.not]: null },
        };
        if (company_id) {
          walletWhereClause.company_id = company_id;
        }
        
        const configuredWallets = await userWalletModel.findAll({
          where: walletWhereClause,
          attributes: ['wallet_type'],
        });
        
        allConfiguredCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
        
        // Normalize to uppercase
        const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
        
        // Validate all requested currencies are valid crypto types
        const invalidCryptos = requestedCurrencies.filter((c: string) => !cryptoTypes.includes(c));
        if (invalidCryptos.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `Invalid cryptocurrency types: ${invalidCryptos.join(', ')}. Valid options: ${cryptoTypes.join(', ')}`
          );
        }
        
        // Validate all requested currencies have configured wallets
        const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
        if (unconfiguredCurrencies.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Please configure wallets first or select from available: ${allConfiguredCurrencies.join(', ')}`
          );
        }
        
        updateData.accepted_currencies = requestedCurrencies.join(',');
        cronLogger.info(`[updatePaymentLink] Updated accepted currencies: ${updateData.accepted_currencies}`);
      }
    }
    
    if (expire !== undefined) {
      // Calculate new expires_at
      if (expire === "No" || expire === null || expire === "") {
        updateData.expires_at = null;
      } else {
        const now = new Date();
        if (expire === "24h") {
          updateData.expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (expire === "7d") {
          updateData.expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (expire === "30d") {
          updateData.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          return errorResponseHelper(res, 400, "Invalid expire value. Valid options: '24h', '7d', '30d', 'No', or null");
        }
      }
    }
    
    if (callback_url !== undefined) {
      updateData.callback_url = callback_url || null;
    }
    
    if (redirect_url !== undefined) {
      updateData.redirect_url = redirect_url || null;
    }
    
    if (webhook_url !== undefined) {
      updateData.webhook_url = webhook_url || null;
    }

    if (name !== undefined) {
      updateData.customer_name = name || null;
    }

    // ── Donation campaign field updates (donation links only) ──
    if (existingLink.dataValues.link_type === 'donation') {
      const donationInput: Record<string, unknown> = {};
      if (title !== undefined) donationInput.title = title;
      if (goal_amount !== undefined) donationInput.goal_amount = goal_amount;
      if (preset_amounts !== undefined) donationInput.preset_amounts = preset_amounts;
      if (min_amount !== undefined) donationInput.min_amount = min_amount;
      if (allow_custom_amount !== undefined) donationInput.allow_custom_amount = allow_custom_amount;
      if (show_progress !== undefined) donationInput.show_progress = show_progress;
      if (show_supporters !== undefined) donationInput.show_supporters = show_supporters;
      if (auto_close_at_goal !== undefined) donationInput.auto_close_at_goal = auto_close_at_goal;
      if (campaign_image !== undefined) donationInput.campaign_image = campaign_image;
      // Crowdfunding v2 (Phase 3)
      if (donation_story_md !== undefined) donationInput.donation_story_md = donation_story_md;
      if (donation_gallery !== undefined) donationInput.donation_gallery = donation_gallery;
      if (donation_ends_at !== undefined) donationInput.donation_ends_at = donation_ends_at;
      if (donation_category !== undefined) donationInput.donation_category = donation_category;
      if (donation_organizer_thanks !== undefined) donationInput.donation_organizer_thanks = donation_organizer_thanks;
      if (donation_beneficiary !== undefined) donationInput.donation_beneficiary = donation_beneficiary;

      if (Object.keys(donationInput).length > 0) {
        const donationCheck = validateDonationInput(donationInput, { partial: true });
        if (donationCheck.error) {
          return errorResponseHelper(res, 400, donationCheck.error);
        }
        Object.assign(updateData, donationCheck.fields);

        // Cross-rule on the MERGED result: custom amounts off requires presets
        const mergedAllowCustom =
          updateData.allow_custom_amount !== undefined
            ? Boolean(updateData.allow_custom_amount)
            : existingLink.dataValues.allow_custom_amount !== false;
        const mergedPresets = parsePresetAmounts(
          (updateData.preset_amounts !== undefined
            ? (updateData.preset_amounts as string | null)
            : existingLink.dataValues.preset_amounts) as string | null
        );
        if (!mergedAllowCustom && mergedPresets.length === 0) {
          return errorResponseHelper(res, 400, "Provide at least one preset amount when custom amounts are disabled.");
        }
      }
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields provided for update");
    }

    // Update the link in database
    await paymentLinkModel.update(updateData, {
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Fetch updated link
    const updatedLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // CRITICAL: Also update Redis so checkout page and payment processing get new data
    if (updatedLink) {
      const linkData = updatedLink.dataValues;
      
      // Extract the uniqueRef from payment_link URL (the 'd' parameter)
      const paymentLinkUrl = linkData.payment_link;
      const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
      const uniqueRef = urlMatch ? urlMatch[1] : null;
      
      if (uniqueRef) {
        // Get existing Redis data to preserve fields not in database
        const existingRedisData = await getRedisItem("customer-" + uniqueRef);
        
        let updatedRedisPayload: Record<string, unknown>;
        
        if (existingRedisData && Object.keys(existingRedisData).length > 0) {
          // Calculate new available_currencies based on accepted_currencies
          let newAvailableCurrencies = existingRedisData.available_currencies || existingRedisData.all_configured_currencies || [];
          
          if (linkData.accepted_currencies) {
            // Use merchant's selection
            newAvailableCurrencies = linkData.accepted_currencies.split(',').map((c: string) => c.trim());
          } else if (existingRedisData.all_configured_currencies) {
            // No selection, use all configured
            newAvailableCurrencies = existingRedisData.all_configured_currencies;
          }
          
          // Merge updated fields with existing Redis data
          updatedRedisPayload = {
            ...existingRedisData,
            // Update all fields that could have changed
            email: linkData.email,
            base_amount: linkData.base_amount,
            amount: linkData.base_amount,  // FIX: Sync 'amount' alongside 'base_amount' for code paths that read 'amount'
            base_currency: linkData.base_currency,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer,
            apply_tax: linkData.apply_tax,
            allowedModes: linkData.allowedModes,
            accepted_currencies: linkData.accepted_currencies,
            available_currencies: newAvailableCurrencies,
            customer_name: linkData.customer_name,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // FIX: Redis key expired/evicted — reconstruct from DB to keep payment link functional
          cronLogger.warn(`[updatePaymentLink] Redis key customer-${uniqueRef} missing, reconstructing from DB`);
          
          // Fetch configured wallets for available_currencies
          const company_id = linkData.company_id;
          const walletWhereClause: Record<string, unknown> = {
            user_id: userData.user_id,
            wallet_type: { [Op.in]: cryptoTypes },
            wallet_address: { [Op.not]: null },
          };
          if (company_id) {
            walletWhereClause.company_id = company_id;
          }
          const configuredWallets = await userWalletModel.findAll({
            where: walletWhereClause,
            attributes: ['wallet_type'],
          });
          const reconstructedCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
          
          let availableCurrencies = reconstructedCurrencies;
          if (linkData.accepted_currencies) {
            availableCurrencies = linkData.accepted_currencies.split(',').map((c: string) => c.trim());
          }
          
          updatedRedisPayload = {
            transaction_id: linkData.transaction_id,
            email: linkData.email,
            allowedModes: linkData.allowedModes,
            base_amount: linkData.base_amount,
            amount: linkData.base_amount,
            base_currency: linkData.base_currency,
            user_id: linkData.user_id,
            adm_id: linkData.user_id,
            company_id: company_id,
            payment_link: linkData.payment_link,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer || 'company',
            apply_tax: linkData.apply_tax || false,
            accepted_currencies: linkData.accepted_currencies,
            customer_name: linkData.customer_name,
            pathType: "createLink",
            link_id: linkData.link_id,
            link_type: linkData.link_type || 'standard',
            available_currencies: availableCurrencies,
            all_configured_currencies: reconstructedCurrencies,
            createdAt: linkData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reconstructed: true,  // Flag so we know this was rebuilt
          };
          cronLogger.info(`[updatePaymentLink] Reconstructed Redis payload for customer-${uniqueRef}`);
        }
        
        await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);
        cronLogger.info(`[updatePaymentLink] Redis updated for key: customer-${uniqueRef}`);
        
        // FIX: If an active crypto address exists, update crypto-{address} Redis key too
        // This handles the edge case where merchant updates webhook_url/amount AFTER
        // a customer has initiated payment but BEFORE it's confirmed
        const activeAddress = updatedRedisPayload.active_crypto_address as { address?: string; destination_tag?: number | null } | undefined;
        if (activeAddress?.address) {
          const activeDestTag = activeAddress.destination_tag ? Number(activeAddress.destination_tag) : null;
          const activeCryptoKey = getCryptoRedisKey(activeAddress.address, activeDestTag);
          const cryptoRedisData = await getRedisItem(activeCryptoKey);
          if (cryptoRedisData && parseState(cryptoRedisData.status) === PaymentState.PENDING) {
            const cryptoUpdates: Record<string, unknown> = {};
            
            if (updateData.webhook_url !== undefined) {
              cryptoUpdates.webhook_url = linkData.webhook_url;
            }
            if (updateData.callback_url !== undefined) {
              cryptoUpdates.callback_url = linkData.callback_url;
            }
            
            if (Object.keys(cryptoUpdates).length > 0) {
              await setRedisItem(activeCryptoKey, {
                ...cryptoRedisData,
                ...cryptoUpdates,
              });
              cronLogger.info(`[updatePaymentLink] Also updated ${activeCryptoKey} with: ${Object.keys(cryptoUpdates).join(', ')}`);
            }
          }
        }
      } else {
        cronLogger.warn(`[updatePaymentLink] Could not extract uniqueRef from payment_link: ${paymentLinkUrl}`);
      }
    }

    // Format response to be consistent - accepted_currencies as array
    const responseData = {
      ...updatedLink.dataValues,
      accepted_currencies: updatedLink.dataValues.accepted_currencies 
        ? updatedLink.dataValues.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,
    };

    successResponseHelper(res, 200, "Payment link updated successfully", responseData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

export const deletePaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  try {
    // First get the payment link to extract uniqueRef for Redis deletion
    const linkToDelete = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });
    
    if (!linkToDelete) {
      return errorResponseHelper(res, 404, "Link not found!");
    }
    
    // Extract uniqueRef from payment_link URL
    const paymentLinkUrl = linkToDelete.dataValues.payment_link;
    const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
    const uniqueRef = urlMatch ? urlMatch[1] : null;
    
    // Delete from database
    const links = await paymentLinkModel.destroy({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Donation campaigns: also remove contribution child rows (internal records).
    // In-flight donor Redis sessions are intentionally kept so a donor who is
    // mid-payment can still complete (their child row is gone from the list anyway).
    if (linkToDelete.dataValues.link_type === 'donation') {
      const removedChildren = await paymentLinkModel.destroy({
        where: {
          user_id: userData.user_id,
          parent_link_id: link_id,
        },
      });
      cronLogger.info(`[deletePaymentLink] Removed ${removedChildren} contribution rows for campaign ${link_id}`);
    }

    // Also delete from Redis to prevent checkout access
    if (uniqueRef) {
      await deleteRedisItem("customer-" + uniqueRef);
      cronLogger.info(`[deletePaymentLink] Redis deleted for key: customer-${uniqueRef}`);
    }

    successResponseHelper(res, 200, "Payment link deleted successfully", links);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { id: userData.id, email: userData.email });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// START DONATION (public checkout endpoint, rate-limited like getData)
// Spawns a 'contribution' child payment link + Redis session for one donor.
// The checkout page then continues its normal flow using the returned ref,
// so 100% of the existing payment/settlement machinery is reused untouched.
// ═══════════════════════════════════════════════════════════════════════════
export const startDonation = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { data, amount, donor_name, donor_message, is_anonymous } = req.body;

    if (!data) {
      return errorResponseHelper(res, 400, "Campaign reference is required");
    }

    // Resolve the campaign parent via its Redis session (same lookup as getData)
    const item = await getRedisItem("customer-" + data);
    if (!item || Object.keys(item).length === 0) {
      return errorResponseHelper(res, 404, "Campaign not found or expired");
    }
    if (item.link_type !== "donation" || !item.link_id) {
      return errorResponseHelper(res, 400, "This link is not a donation campaign");
    }

    // DB row is the source of truth for donation settings (survives edits)
    const parent = await paymentLinkModel.findOne({ where: { link_id: item.link_id } });
    if (!parent || parent.dataValues.link_type !== "donation") {
      return errorResponseHelper(res, 404, "Campaign not found");
    }
    const p = parent.dataValues;

    // Campaign ended?
    if (p.expires_at && new Date(p.expires_at) <= new Date()) {
      return errorResponseHelper(res, 410, "This campaign has ended.");
    }

    // Auto-close at goal?
    const agg = await getDonationAggregates(Number(p.link_id));
    if (p.auto_close_at_goal && Number(p.goal_amount) > 0 && agg.raised_amount >= Number(p.goal_amount)) {
      return errorResponseHelper(res, 410, "This campaign has reached its goal and is now closed.");
    }

    // ── Amount validation ──
    const rawAmt = Number(amount);
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      return errorResponseHelper(res, 400, "Please enter a valid donation amount.");
    }
    const amt = Math.round(rawAmt * 100) / 100;
    const minAmt = Number(p.min_amount) > 0 ? Number(p.min_amount) : 1;
    if (amt < minAmt) {
      return errorResponseHelper(res, 400, `Minimum donation is ${minAmt} ${p.base_currency || "USD"}.`);
    }
    if (amt > 999999999) {
      return errorResponseHelper(res, 400, "Amount is too large.");
    }
    const presets = parsePresetAmounts(p.preset_amounts);
    const allowCustom = p.allow_custom_amount !== false;
    if (!allowCustom && presets.length > 0 && !presets.some((ps) => Math.abs(ps - amt) < 0.001)) {
      return errorResponseHelper(res, 400, "Please choose one of the suggested amounts.");
    }

    // ── Donor fields (sanitized) ──
    const dName = donor_name ? String(donor_name).trim().slice(0, 100) : null;
    const dMsg = donor_message ? String(donor_message).trim().slice(0, 280) : null;
    const anon = Boolean(is_anonymous);

    // ── Create the contribution child row ──
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    const childPayload = {
      transaction_id: crypto.randomUUID(),
      email: null,
      allowedModes: p.allowedModes || "crypto",
      base_amount: amt,
      base_currency: p.base_currency || "USD",
      user_id: p.user_id,
      adm_id: p.user_id, // crypto payment compatibility (mirrors createPaymentLink)
      company_id: p.company_id || null,
      payment_link: (process.env.CHECKOUT_URL || "").trim().replace(/\/$/, "") + "/pay?d=" + uniqueRef,
      description: p.title || p.description || "Donation",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // donor payment window
      callback_url: p.callback_url || null,
      redirect_url: p.redirect_url || null,
      webhook_url: p.webhook_url || null,
      fee_payer: p.fee_payer || "company",
      apply_tax: false, // donations never collect sales tax
      accepted_currencies: p.accepted_currencies || null,
      customer_name: anon ? null : dName,
      link_type: "contribution",
      parent_link_id: p.link_id,
      donor_name: dName,
      donor_message: dMsg,
      is_anonymous: anon,
    };

    const child = await paymentLinkModel.create(childPayload);

    // ── Available currencies for the donor's checkout session ──
    let availableCurrencies: string[] = [];
    if (Array.isArray(item.available_currencies)) {
      availableCurrencies = item.available_currencies;
    } else if (typeof item.available_currencies === "string" && item.available_currencies) {
      availableCurrencies = item.available_currencies.split(",").map((c: string) => c.trim());
    } else if (p.accepted_currencies) {
      availableCurrencies = String(p.accepted_currencies).split(",").map((c: string) => c.trim());
    }

    const redisPayload = {
      ...childPayload,
      pathType: "createLink",
      link_id: child.dataValues.link_id,
      available_currencies: availableCurrencies,
      all_configured_currencies: item.all_configured_currencies || availableCurrencies,
      createdAt: new Date().toISOString(),
    };
    await setRedisItem("customer-" + uniqueRef, redisPayload);

    cronLogger.info(
      `[startDonation] Contribution ${child.dataValues.link_id} (${amt} ${childPayload.base_currency}) created for campaign ${p.link_id}${dName ? ` by ${anon ? "anonymous" : dName}` : ""}`
    );

    return successResponseHelper(res, 200, "Donation started", {
      d: uniqueRef,
      payment_link: childPayload.payment_link,
      amount: amt,
      currency: childPayload.base_currency,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// START TIP — creator-exclusive "Buy me a coffee" / tip / support flow.
// Public (no auth). Resolves the creator by handle, validates the amount against
// the creator's Support Widget config, lazily creates a hidden singleton "tip jar"
// donation parent (is_tip_jar=true) if needed, then spawns a 'contribution' child
// so the tip reuses the entire donation-flavored crypto checkout (Session 38).
// ═══════════════════════════════════════════════════════════════════════════
export const startTip = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { handle: rawHandle, amount, donor_name, donor_message, is_anonymous } = req.body;
    const handle = String(rawHandle || "").trim().toLowerCase();
    if (!handle) {
      return errorResponseHelper(res, 400, "Creator handle is required");
    }

    // Resolve the creator + widget config
    const creator = await userModel.findOne({
      where: sequelize.where(sequelize.fn("LOWER", sequelize.col("handle")), handle),
      attributes: [
        "user_id", "name", "handle", "creator_page_enabled",
        "support_widget_enabled", "support_widget_style", "support_widget_label",
        "support_widget_preset_amounts", "support_widget_currency", "support_widget_min_amount",
        "support_widget_allow_message", "support_widget_thanks_message", "support_widget_show_supporters",
      ],
    });
    if (!creator || !creator.dataValues.creator_page_enabled || !creator.dataValues.support_widget_enabled) {
      return errorResponseHelper(res, 404, "This creator isn't accepting tips right now.");
    }
    const u = creator.dataValues as Record<string, any>;

    // ── Amount validation ──
    const rawAmt = Number(amount);
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      return errorResponseHelper(res, 400, "Please enter a valid amount.");
    }
    const amt = Math.round(rawAmt * 100) / 100;
    const minAmt = Number(u.support_widget_min_amount) > 0 ? Number(u.support_widget_min_amount) : 1;
    const widgetCurrency = String(u.support_widget_currency || "USD").toUpperCase();
    if (amt < minAmt) {
      return errorResponseHelper(res, 400, `Minimum is ${minAmt} ${widgetCurrency}.`);
    }
    if (amt > 999999999) {
      return errorResponseHelper(res, 400, "Amount is too large.");
    }

    // Resolve the creator's company (first/primary)
    const company = await companyModel.findOne({
      where: { user_id: u.user_id },
      order: [["company_id", "ASC"]],
    });
    if (!company) {
      return errorResponseHelper(res, 400, "This creator isn't set up to receive payments yet.");
    }
    const company_id = company.dataValues.company_id;

    // Configured wallet currencies for that company
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    const wallets = await userWalletModel.findAll({
      where: {
        user_id: u.user_id,
        company_id,
        wallet_type: { [Op.in]: cryptoTypes },
        wallet_address: { [Op.not]: null },
      },
      attributes: ["wallet_type"],
    });
    if (!wallets.length) {
      return errorResponseHelper(res, 400, "This creator hasn't configured a payout wallet yet.");
    }
    const allConfiguredCurrencies = [...new Set(wallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];

    // ── Donor fields (sanitized) ──
    const dName = donor_name ? String(donor_name).trim().slice(0, 100) : null;
    const allowMsg = u.support_widget_allow_message !== false;
    const dMsg = (allowMsg && donor_message) ? String(donor_message).trim().slice(0, 280) : null;
    const anon = Boolean(is_anonymous);

    // Style-derived default title
    const STYLE_TITLES: Record<string, string> = { coffee: "Buy me a coffee", tip: "Send a tip", support: "Support me" };
    const jarTitle = (u.support_widget_label && String(u.support_widget_label).trim())
      || STYLE_TITLES[String(u.support_widget_style || "coffee")]
      || "Support me";

    let presetsArr: number[] = [];
    if (Array.isArray(u.support_widget_preset_amounts)) {
      presetsArr = (u.support_widget_preset_amounts as unknown[]).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    }
    const presetsCsv = presetsArr.length ? presetsArr.join(",") : null;

    // Creator page URL (used as "back to campaign" target on the success screen).
    // Prefer the branded creator domain (CREATOR_BASE_URL, e.g. dynopay.me).
    const creatorPageUrl = (process.env.CREATOR_BASE_URL || process.env.FRONTEND_URL || process.env.SERVER_URL || "").trim().replace(/\/$/, "") + "/" + u.handle;

    // ── Find or lazily create the hidden singleton tip-jar parent ──
    let tipJar = await paymentLinkModel.findOne({
      where: { user_id: u.user_id, is_tip_jar: true, parent_link_id: null },
    });
    if (!tipJar) {
      tipJar = await paymentLinkModel.create({
        transaction_id: crypto.randomUUID(),
        email: null,
        allowedModes: "crypto",
        base_amount: 0,
        base_currency: widgetCurrency,
        user_id: u.user_id,
        adm_id: u.user_id,
        company_id,
        payment_link: creatorPageUrl,
        description: jarTitle,
        expires_at: null,
        fee_payer: "company",
        apply_tax: false,
        accepted_currencies: null, // null = all configured
        customer_name: null,
        link_type: "donation",
        is_tip_jar: true,
        title: jarTitle,
        goal_amount: null,
        preset_amounts: presetsCsv,
        min_amount: minAmt,
        allow_custom_amount: true,
        show_progress: false,
        show_supporters: u.support_widget_show_supporters !== false,
        auto_close_at_goal: false,
        campaign_image: null,
      });
    } else {
      // Keep the jar in sync with the latest widget config (best-effort)
      await paymentLinkModel.update(
        {
          title: jarTitle,
          description: jarTitle,
          base_currency: widgetCurrency,
          min_amount: minAmt,
          preset_amounts: presetsCsv,
          payment_link: creatorPageUrl,
          show_supporters: u.support_widget_show_supporters !== false,
        },
        { where: { link_id: tipJar.dataValues.link_id } }
      );
    }
    const p = tipJar.dataValues as Record<string, any>;

    // ── Create the contribution child (mirrors startDonation) ──
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    const childPayload = {
      transaction_id: crypto.randomUUID(),
      email: null,
      allowedModes: "crypto",
      base_amount: amt,
      base_currency: widgetCurrency,
      user_id: u.user_id,
      adm_id: u.user_id,
      company_id,
      payment_link: (process.env.CHECKOUT_URL || "").trim().replace(/\/$/, "") + "/pay?d=" + uniqueRef,
      description: jarTitle,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      callback_url: null,
      redirect_url: null,
      webhook_url: null,
      fee_payer: "company",
      apply_tax: false,
      accepted_currencies: null,
      customer_name: anon ? null : dName,
      link_type: "contribution",
      parent_link_id: p.link_id,
      donor_name: dName,
      donor_message: dMsg,
      is_anonymous: anon,
    };

    const child = await paymentLinkModel.create(childPayload);

    const redisPayload = {
      ...childPayload,
      pathType: "createLink",
      link_id: child.dataValues.link_id,
      available_currencies: allConfiguredCurrencies,
      all_configured_currencies: allConfiguredCurrencies,
      createdAt: new Date().toISOString(),
    };
    await setRedisItem("customer-" + uniqueRef, redisPayload);

    cronLogger.info(
      `[startTip] Tip ${child.dataValues.link_id} (${amt} ${widgetCurrency}) for creator @${handle} via jar ${p.link_id}${dName ? ` by ${anon ? "anonymous" : dName}` : ""}`
    );

    return successResponseHelper(res, 200, "Tip started", {
      d: uniqueRef,
      payment_link: childPayload.payment_link,
      amount: amt,
      currency: widgetCurrency,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN COVER IMAGE UPLOAD (authenticated, uses shared uploadImage multer)
// Returns an absolute URL served through /api/static/images (works behind
// both the preview ingress and the production nginx, mirroring company logos).
// ═══════════════════════════════════════════════════════════════════════════
export const uploadCampaignImage = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const file = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return errorResponseHelper(res, 400, "No image uploaded.");
    }
    const serverUrl = (process.env.SERVER_URL || "").trim().replace(/\/$/, "");
    const url = await finalizeUploadedImage(file, serverUrl);
    apiLogger.info(`[uploadCampaignImage] uploaded: ${file.filename} (${file.mimetype}, ${file.size}b)`);
    return successResponseHelper(res, 200, "Image uploaded", {
      url,
      name: file.originalname?.slice(0, 255) || file.filename,
      type: file.mimetype,
      size: file.size,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SET REFUND ADDRESS — CleanCheckoutV2 (Phase 1)
// Public endpoint called by the customer on the checkout page when they
// want to register a refund address for wrong-asset/wrong-network mistakes.
// Requires the customer session JWT that /pay/getData handed out.
// Idempotent: overwrites any previous value. Best-effort — refund still
// needs manual approval by the merchant.
// ═══════════════════════════════════════════════════════════════════════════
export const setRefundAddress = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { data, refund_address } = req.body || {};
    if (!data || typeof data !== "string") {
      return errorResponseHelper(res, 400, "Missing payment reference.");
    }
    const raw = String(refund_address || "").trim();
    if (!raw) {
      return errorResponseHelper(res, 400, "Refund address is required.");
    }
    if (raw.length > 255) {
      return errorResponseHelper(res, 400, "Refund address is too long (max 255 characters).");
    }
    // Basic sanity — reject obvious junk like spaces / control chars.
    if (/\s/.test(raw)) {
      return errorResponseHelper(res, 400, "Refund address must not contain whitespace.");
    }

    // Ownership check: the session JWT's user_id must match the payment link's user_id.
    // The customerAuthMiddleware only validates the JWT — we still need to
    // ensure the ref they're modifying belongs to the same session, otherwise
    // a captured token would let anyone poke at any link's refund address.
    const authUser = (req as express.Request & { user?: { user_id?: number } }).user;
    const link = await paymentLinkModel.findOne({
      where: { payment_link: { [Op.like]: `%d=${data}%` } as any },
    });
    if (!link) {
      return errorResponseHelper(res, 404, "Payment link not found.");
    }
    if (authUser?.user_id && Number(authUser.user_id) !== Number(link.dataValues.user_id)) {
      // Session token belongs to a different merchant → block.
      return errorResponseHelper(res, 403, "Not authorized to modify this payment link.");
    }

    await link.update({ refund_address: raw });
    apiLogger.info(`[setRefundAddress] link_id=${link.dataValues.link_id} refund_address set`);
    return successResponseHelper(res, 200, "Refund address saved.", { link_id: link.dataValues.link_id });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CREATOR VANITY PAGE — public profile at dynopay.me/{handle}
// Returns the creator's public info + their active donation campaigns and
// reusable payment links. No auth (crawler-friendly for the SSR page).
// ═══════════════════════════════════════════════════════════════════════════
export const getCreatorProfile = async (req: express.Request, res: express.Response) => {
  try {
    const handle = String(req.params.handle || "").trim().toLowerCase();
    if (!handle) return errorResponseHelper(res, 400, "Handle is required");

    const creator = (await sequelize.query(
      `SELECT user_id, name, photo, bio, handle, creator_page_enabled, cover_image, social_links,
              support_widget_enabled, support_widget_style, support_widget_label,
              support_widget_preset_amounts, support_widget_currency, support_widget_min_amount,
              support_widget_allow_message, support_widget_thanks_message, support_widget_show_supporters,
              theme_accent_color, theme_cover_style, theme_cover_gradient,
              public_analytics_enabled
       FROM tbl_user
       WHERE LOWER(handle) = :handle AND creator_page_enabled = true
       LIMIT 1`,
      { replacements: { handle }, type: QueryTypes.SELECT }
    )) as Array<{
      user_id: number;
      name: string;
      photo: string | null;
      bio: string | null;
      handle: string;
      creator_page_enabled: boolean;
      cover_image: string | null;
      social_links: Record<string, string> | null;
      support_widget_enabled: boolean | null;
      support_widget_style: string | null;
      support_widget_label: string | null;
      support_widget_preset_amounts: unknown;
      support_widget_currency: string | null;
      support_widget_min_amount: number | string | null;
      support_widget_allow_message: boolean | null;
      support_widget_thanks_message: string | null;
      support_widget_show_supporters: boolean | null;
      theme_accent_color: string | null;
      theme_cover_style: string | null;
      theme_cover_gradient: string | null;
      public_analytics_enabled: boolean | null;
    }>;

    if (!creator.length) {
      return errorResponseHelper(res, 404, "Creator page not found");
    }
    const c = creator[0];

    const rows = await paymentLinkModel.findAll({
      where: {
        user_id: c.user_id,
        parent_link_id: null,
        [Op.or]: [{ link_type: "donation" }, { payment_mode: "createLink" }],
      },
      order: [["createdAt", "DESC"]],
      limit: 30,
    });

    const now = Date.now();
    const links: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const d = r.dataValues as Record<string, any>;
      if (d.expires_at && new Date(d.expires_at).getTime() < now) continue;
      // Decision (Session 40): the creator page shows the Support Widget ONLY.
      // Donation campaigns (incl. the hidden tip-jar parent) never surface here —
      // they live purely as shareable/embeddable payment links.
      if (d.link_type === "donation" || d.is_tip_jar) continue;
      const isDonation = false;
      const currency = d.base_currency || "USD";
      let raised = 0, supporters = 0, progress: number | null = null, closed = false;
      if (isDonation) {
        const agg = await getDonationAggregates(d.link_id);
        raised = agg.raised_amount;
        supporters = agg.supporters_count;
        if (d.goal_amount && Number(d.goal_amount) > 0) {
          progress = Math.min(100, Math.round((raised / Number(d.goal_amount)) * 100));
          closed = Boolean(d.auto_close_at_goal) && raised >= Number(d.goal_amount);
        }
      }
      links.push({
        type: isDonation ? "donation" : "link",
        link_id: d.link_id,
        title: d.title || d.description || (isDonation ? "Support this campaign" : "Payment link"),
        description: d.description || null,
        image: d.campaign_image || null,
        amount: isDonation ? null : Number(d.base_amount || 0),
        currency,
        goal_amount: d.goal_amount ? Number(d.goal_amount) : null,
        raised_amount: raised,
        supporters_count: supporters,
        progress_percent: progress,
        closed,
        url: d.payment_link || null,
      });
    }

    // Donation campaigns first, then reusable links
    links.sort((a, b) => (a.type === "donation" ? -1 : 1) - (b.type === "donation" ? -1 : 1));

    // ── Support Widget (Tip / Buy-me-a-coffee) — creator-exclusive ──
    let supportWidget: Record<string, unknown> | null = null;
    if (c.support_widget_enabled) {
      let presets: number[] = [];
      const rawPresets = c.support_widget_preset_amounts;
      if (Array.isArray(rawPresets)) {
        presets = (rawPresets as unknown[]).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
      } else if (typeof rawPresets === "string" && rawPresets) {
        try {
          const parsed = JSON.parse(rawPresets);
          if (Array.isArray(parsed)) presets = parsed.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0);
        } catch {
          presets = String(rawPresets).split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
        }
      }
      if (presets.length === 0) presets = [3, 5, 10, 25];

      const showSupporters = c.support_widget_show_supporters !== false;
      let supportersCount: number | null = null;
      let raisedAmount: number | null = null;
      if (showSupporters) {
        const jar = await paymentLinkModel.findOne({
          where: { user_id: c.user_id, is_tip_jar: true, parent_link_id: null },
          attributes: ["link_id"],
        });
        if (jar) {
          const agg = await getDonationAggregates(jar.dataValues.link_id);
          supportersCount = agg.supporters_count;
          raisedAmount = agg.raised_amount;
        } else {
          supportersCount = 0;
          raisedAmount = 0;
        }
      }

      supportWidget = {
        enabled: true,
        style: c.support_widget_style || "coffee",
        label: c.support_widget_label || null,
        preset_amounts: presets,
        currency: (c.support_widget_currency || "USD").toUpperCase(),
        min_amount: Number(c.support_widget_min_amount) > 0 ? Number(c.support_widget_min_amount) : 1,
        allow_message: c.support_widget_allow_message !== false,
        thanks_message: c.support_widget_thanks_message || null,
        show_supporters: showSupporters,
        supporters_count: supportersCount,
        raised_amount: raisedAmount,
      };
    }

    // ── Visit + referrer tracking — bot-filtered, deduped, owner-excluded ──
    // Hardened (Session: creator-stats): only count a visit when it is (a) not a
    // known bot/crawler UA, (b) not the logged-in creator viewing their own page,
    // and (c) the first hit from this IP+device within a 24h window. Best-effort:
    // never let analytics fail the SSR fetch.
    try {
      const ua = String(req.headers["user-agent"] || "").trim();
      const BOT_RE =
        /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|discord|slack|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptimerobot|axios|go-http|node-fetch|semrush|ahrefs|screaming|feedfetcher|scrape/i;

      // Owner exclusion (best-effort): decode an optional bearer token and skip
      // counting when the viewer is the creator themselves.
      let viewerUserId: number | null = null;
      try {
        const authHeader = String(req.headers["authorization"] || "");
        const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (bearer) {
          const decoded = jwt.decode(bearer) as { user_id?: number } | null;
          if (decoded && decoded.user_id) viewerUserId = Number(decoded.user_id);
        }
      } catch { /* noop */ }

      const isBot = !ua || BOT_RE.test(ua);
      const isOwner = viewerUserId !== null && viewerUserId === Number(c.user_id);

      if (!isBot && !isOwner) {
        // Visitor de-duplication: hash IP + UA, count once per 24h (SET NX EX).
        const rawIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
        const ip = (typeof rawIp === "string" ? rawIp : String(rawIp)).split(",")[0].trim();
        const visitorHash = crypto
          .createHash("sha256")
          .update(`${ip}|${ua}`)
          .digest("hex")
          .slice(0, 32);
        const dedupeKey = `creator-visit-seen:${handle}:${visitorHash}`;

        // Resolves to "OK" only on the FIRST visit within the window, else null.
        const firstVisit = await redis
          .set(dedupeKey, "1", { NX: true, EX: 60 * 60 * 24 })
          .catch(() => null);

        if (firstVisit) {
          const ymd = new Date().toISOString().slice(0, 10);
          redis.incr(`creator-visits:${handle}`).catch(() => { /* noop */ });
          redis
            .incr(`creator-visits:${handle}:day:${ymd}`)
            .then(() => redis.expire(`creator-visits:${handle}:day:${ymd}`, 60 * 60 * 24 * 32))
            .catch(() => { /* noop */ });

          // ── Referrer tracking (Session 60) ──
          // Extract domain from Referer header, skip self / empty / same-host.
          const rawReferer = String(
            req.headers["referer"] || req.headers["referrer"] || ""
          ).trim();
          if (rawReferer) {
            try {
              const u = new URL(rawReferer);
              const host = u.hostname.toLowerCase();
              const selfHosts = new Set([
                "dynopay.me",
                "dynopay.com",
                "checkout.dynopay.com",
                "www.dynopay.com",
                "www.dynopay.me",
              ]);
              if (host && !selfHosts.has(host)) {
                // Strip common tracking noise; keep bare eTLD+something (best-effort)
                const domain = host.replace(/^www\./, "").slice(0, 80);
                redis
                  .hIncrBy(`creator-referrers:${handle}`, domain, 1)
                  .then(() => redis.expire(`creator-referrers:${handle}`, 60 * 60 * 24 * 90))
                  .catch(() => { /* noop */ });
              }
            } catch { /* invalid URL — ignore */ }
          } else {
            // "direct" bucket for no-referrer visits (typed URL, mobile app, dark-social)
            redis
              .hIncrBy(`creator-referrers:${handle}`, "(direct)", 1)
              .then(() => redis.expire(`creator-referrers:${handle}`, 60 * 60 * 24 * 90))
              .catch(() => { /* noop */ });
          }
        }
      }
    } catch { /* noop */ }

    return successResponseHelper(res, 200, "Creator profile retrieved", {
      creator: {
        name: c.name || c.handle,
        handle: c.handle,
        bio: c.bio || null,
        photo: c.photo && !String(c.photo).includes("user_image.png") ? c.photo : null,
        cover_image: c.cover_image || null,
        social_links: (c.social_links && typeof c.social_links === "object") ? c.social_links : {},
        theme: {
          accent_color: c.theme_accent_color || null,
          cover_style: c.theme_cover_style || null,
          cover_gradient: c.theme_cover_gradient || null,
        },
        // Whether the creator wants their 30-day analytics widget shown publicly.
        // The SSR page uses this to decide if it should even fetch analytics.
        public_analytics_enabled: c.public_analytics_enabled !== false,
      },
      support_widget: supportWidget,
      links,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, {});
  }
};
