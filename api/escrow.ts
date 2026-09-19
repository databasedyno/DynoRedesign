/**
 * Escrow API client.
 *
 * - Merchant calls go through `axiosBaseApi` (auto-attaches the merchant Bearer
 *   token + X-Company-Id, base already prefixes /api/).
 * - Admin calls go through `adminBaseApi` (auto-attaches the admin_token).
 * - Public (counterparty) calls use a bare axios instance so the merchant
 *   token interceptor never runs; the escrow session token is passed in the
 *   `x-escrow-token` header after the email-OTP step.
 *
 * Every backend response is the `{ message, data }` envelope, so each helper
 * unwraps `res.data.data` for the caller.
 */
import axios from "axios";
import axiosBaseApi from "@/axiosConfig";
import adminBaseApi from "@/axiosAdmin";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

// ---- shared types (kept loose; the backend is the source of truth) ----------
export type EscrowRole = "buyer" | "seller";
export type FeePayer = "buyer" | "seller" | "split";
export type SettlementOutcome = "release" | "refund" | "split";

export interface CostItem {
  key: "escrow_fee" | "network_fee" | "conversion_fee" | "withdrawal_fee";
  label: string;
  amount: number;
  note?: string;
}

export interface FeeBreakdown {
  amount: number;
  currency: string;
  feePercent: number;
  feeMinUsd: number;
  feePayer: FeePayer;
  escrowFee: number;
  // itemised pass-through settlement costs (estimated, folded into the price)
  networkFeeUsd?: number;
  conversionFeeUsd?: number;
  withdrawalFeeUsd?: number;
  passThroughCosts?: number;
  totalCost?: number;
  payoutCoin?: string;
  costsEstimated?: boolean;
  costItems?: CostItem[];
  buyerPays: number;
  sellerReceives: number;
  platformFee: number;
  networkNote: string;
  // fee-preview extras (admin policy)
  minDealUsd?: number;
  belowMinimum?: boolean;
}

export interface EscrowDeal {
  escrow_id: number;
  deal_token: string;
  company_id: number;
  creator_role: EscrowRole;
  counterparty_email: string;
  counterparty_verified?: boolean;
  title: string;
  description?: string | null;
  amount: number;
  currency: string;
  accepted_coins?: string | null;
  terms?: string | null;
  fee_percent: number;
  fee_payer: FeePayer;
  auto_release_days: number;
  status: string;
  status_label: string;
  settlement_phase: "none" | "pending" | "partial" | "paid";
  outcome?: SettlementOutcome | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  funded_at?: string | null;
  delivered_at?: string | null;
  auto_release_at?: string | null;
  outcome_authorized_at?: string | null;
  completed_at?: string | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
  disputed_at?: string | null;
  dispute_resolved_at?: string | null;
  fully_paid_at?: string | null;
  delivery_note?: string | null;
  dispute_reason?: string | null;
  dispute_raised_by?: string | null;
  dispute_resolution?: string | null;
  // Dispute negotiation (two-tier: parties settle first, admin fallback)
  dispute_stage?: "negotiation" | "escalated" | "resolved" | null;
  dispute_proposal?: DisputeProposal | null;
  dispute_proposal_by?: EscrowRole | null;
  dispute_escalated_at?: string | null;
  dispute_auto_escalate_at?: string | null;
  dispute_thread?: DisputeThreadEntry[];
  split_percent_seller?: number | null;
  custody_stablecoin?: string | null;
  custody_amount_stable?: number | null;
  converted_at?: string | null;
  seller_entitlement_stable?: number | null;
  seller_payout_state?: "na" | "pending" | "paid" | "retrying";
  seller_paid_at?: string | null;
  seller_payout_coin?: string | null;
  buyer_entitlement_stable?: number | null;
  buyer_payout_state?: "na" | "pending" | "paid" | "retrying";
  buyer_paid_at?: string | null;
  buyer_refund_coin?: string | null;
  needs_admin_review?: boolean;
  funding_coin?: string | null;
  funded_amount_usd?: number | null;
  simulated?: boolean;
  invite_url: string;
  stablecoins: string[];
  breakdown: FeeBreakdown;
  created_at?: string;
  updated_at?: string;
  // authed detail extras
  my_role?: EscrowRole;
  is_creator?: boolean;
  seller_payout_address?: string | null;
  buyer_refund_address?: string | null;
  seller_payout_tx?: string | null;
  buyer_payout_tx?: string | null;
  settlement_note?: string | null;
  activity_log?: ActivityEntry[];
  // public view extras
  seller_address_on_file?: boolean;
  buyer_address_on_file?: boolean;
  counterparty_role?: EscrowRole;
  creator_role_side?: EscrowRole;
  created_by?: string;
  brand?: string;
  has_account?: boolean;
}

export interface ActivityEntry {
  type: string;
  actor?: string;
  role?: string;
  note?: string;
  at?: string;
}

export interface DisputeProposal {
  outcome: SettlementOutcome;
  split_percent_seller?: number | null;
  by?: EscrowRole;
  at?: string;
  message?: string | null;
  /** "cancellation" = a post-funding cancel request (always a refund; fees kept). */
  kind?: "cancellation" | null;
}

export interface DisputeThreadEntry {
  at?: string;
  by?: string; // buyer | seller | admin | system
  type: string; // open | counter | accept | message | escalate | auto_escalate | resolve
  kind?: "cancellation" | null;
  outcome?: SettlementOutcome;
  split_percent_seller?: number | null;
  message?: string | null;
  reason?: string | null;
}

/** A proposed dispute resolution, sent when raising or countering. */
export interface DisputeProposalInput {
  proposed_outcome: SettlementOutcome;
  split_percent_seller?: number;
  message?: string;
  reason?: string;
  kind?: "cancellation";
}

const unwrap = (res: any) => res?.data?.data;

// ═══════════════════════════════════════════════════════════════════════════
// MERCHANT
// ═══════════════════════════════════════════════════════════════════════════
export const escrowApi = {
  feePreview: async (body: {
    amount: number | string;
    currency?: string;
    fee_percent?: number;
    fee_min_usd?: number;
    fee_payer?: FeePayer;
    payout_coin?: string;
    accepted_coins?: string;
  }): Promise<FeeBreakdown> => unwrap(await axiosBaseApi.post("/escrow/fee-preview", body)),

  create: async (body: Record<string, unknown>): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post("/escrow", body)),

  list: async (params: { company_id?: number | string; status?: string; role?: EscrowRole } = {}): Promise<EscrowDeal[]> => {
    const q = new URLSearchParams();
    if (params.company_id) q.set("company_id", String(params.company_id));
    if (params.status) q.set("status", params.status);
    if (params.role) q.set("role", params.role);
    const qs = q.toString();
    return unwrap(await axiosBaseApi.get(`/escrow${qs ? `?${qs}` : ""}`)) || [];
  },

  get: async (id: number | string): Promise<EscrowDeal> => unwrap(await axiosBaseApi.get(`/escrow/${id}`)),

  simulateFund: async (id: number | string, coin: string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/simulate-fund`, { coin })),

  deliver: async (id: number | string, delivery_note?: string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/deliver`, { delivery_note })),

  release: async (id: number | string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/release`, {})),

  dispute: async (id: number | string, body: DisputeProposalInput): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/dispute`, body)),

  counterDispute: async (id: number | string, body: DisputeProposalInput): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/dispute/counter`, body)),

  acceptDispute: async (id: number | string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/dispute/accept`, {})),

  disputeMessage: async (id: number | string, message: string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/dispute/message`, { message })),

  escalateDispute: async (id: number | string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/dispute/escalate`, {})),

  cancel: async (id: number | string, reason?: string): Promise<EscrowDeal> =>
    unwrap(await axiosBaseApi.post(`/escrow/${id}/cancel`, { reason })),

  payoutInfo: async (
    id: number | string,
    body: { payout_address?: string; payout_coin?: string; refund_address?: string; refund_coin?: string }
  ): Promise<EscrowDeal> => unwrap(await axiosBaseApi.post(`/escrow/${id}/payout-info`, body)),
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════
export const escrowAdminApi = {
  list: async (params: { status?: string; company_id?: number | string } = {}): Promise<EscrowDeal[]> => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.company_id) q.set("company_id", String(params.company_id));
    const qs = q.toString();
    return unwrap(await adminBaseApi.get(`/escrow/admin/deals${qs ? `?${qs}` : ""}`)) || [];
  },
  disputes: async (stage?: "negotiation" | "escalated" | "resolved"): Promise<EscrowDeal[]> =>
    unwrap(await adminBaseApi.get(`/escrow/admin/disputes${stage ? `?stage=${stage}` : ""}`)) || [],
  resolve: async (
    id: number | string,
    body: { outcome: SettlementOutcome; split_percent_seller?: number; note?: string }
  ): Promise<EscrowDeal> => unwrap(await adminBaseApi.post(`/escrow/admin/${id}/resolve`, body)),
  runAutoRelease: async (): Promise<{ processed: number[]; count: number }> =>
    unwrap(await adminBaseApi.post("/escrow/admin/run-auto-release", {})),
  runPayoutReminders: async (): Promise<any> => unwrap(await adminBaseApi.post("/escrow/admin/run-payout-reminders", {})),
  runDisputeEscalations: async (): Promise<{ escalated: number[]; count: number }> =>
    unwrap(await adminBaseApi.post("/escrow/admin/run-dispute-escalations", {})),
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC (counterparty — no Dynopay account required)
// ═══════════════════════════════════════════════════════════════════════════
const publicClient = axios.create({
  baseURL: apiBaseUrl + "/api/",
  headers: { "Content-Type": "application/json" },
});

const withToken = (token?: string | null) =>
  token ? { headers: { "x-escrow-token": token } } : undefined;

export const escrowPublicApi = {
  get: async (token: string): Promise<EscrowDeal> => unwrap(await publicClient.get(`/escrow/public/${token}`)),

  sendOtp: async (token: string, email: string): Promise<{ has_account: boolean; preview_otp?: string }> =>
    unwrap(await publicClient.post(`/escrow/public/${token}/send-otp`, { email })),

  verifyOtp: async (
    token: string,
    email: string,
    otp: string
  ): Promise<{ escrow_session: string; expires_in: number; has_account: boolean }> =>
    unwrap(await publicClient.post(`/escrow/public/${token}/verify-otp`, { email, otp })),

  respond: async (
    token: string,
    sessionToken: string,
    action: "accept" | "decline",
    reason?: string
  ): Promise<EscrowDeal> =>
    unwrap(await publicClient.post(`/escrow/public/${token}/respond`, { action, reason }, withToken(sessionToken))),

  action: async (
    token: string,
    sessionToken: string,
    body: {
      action:
        | "fund"
        | "deliver"
        | "release"
        | "dispute"
        | "dispute-counter"
        | "dispute-accept"
        | "dispute-message"
        | "dispute-escalate"
        | "cancel"
        | "payout-info";
      coin?: string;
      delivery_note?: string;
      reason?: string;
      // dispute proposal fields
      proposed_outcome?: SettlementOutcome;
      split_percent_seller?: number;
      message?: string;
      kind?: "cancellation";
      payout_address?: string;
      payout_coin?: string;
      refund_address?: string;
      refund_coin?: string;
    }
  ): Promise<EscrowDeal> =>
    unwrap(await publicClient.post(`/escrow/public/${token}/action`, body, withToken(sessionToken))),
};

export default escrowApi;
