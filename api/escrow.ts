/**
 * Escrow types + Dynopay ADMIN client (oversight, dispute arbitration, scans).
 * Party-facing escrow calls live in api/safedeal.ts. Admin calls go through
 * `adminBaseApi` (auto-attaches admin_token); responses are `{ message, data }`.
 */
import adminBaseApi from "@/axiosAdmin";

// ---- shared types (kept loose; the backend is the source of truth) ----------
export type EscrowRole = "buyer" | "seller";
export type FeePayer = "buyer" | "seller" | "split";
export type SettlementOutcome = "release" | "refund" | "split";

export interface CostItem {
  key: "escrow_fee" | "exchange_fee" | "network_fee" | "conversion_fee" | "withdrawal_fee";
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
  exchangeFeePercent?: number;
  exchangeFeeUsd?: number;
  // itemised pass-through settlement costs (estimated, folded into the price)
  networkFeeUsd?: number;
  conversionFeeUsd?: number;
  withdrawalFeeUsd?: number;
  passThroughCosts?: number;
  totalCost?: number;
  payoutCoin?: string;
  costsEstimated?: boolean;
  // Pre-funding quote is priced for a stablecoin; this is the extra a BTC/ETH… payer adds.
  quotedFundingCoin?: string;
  fundingCoinAssumed?: boolean;
  nonStableSurchargeUsd?: number;
  costItems?: CostItem[];
  buyerPays: number;
  sellerReceives: number;
  platformFee: number;
  networkNote: string;
  // fee-preview extras (admin policy)
  minDealUsd?: number;
  belowMinimum?: boolean;
  maxDealUsd?: number;
  maxDealEur?: number;
  aboveMaximum?: boolean;
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
  // SafeDeal Batch 2/3 (present on every deal; null for legacy rows)
  deal_type?: string | null;
  delivery_due_at?: string | null;
  revision_round?: number;
  revision_note?: string | null;
  max_revision_rounds?: number;
  delivery_proof?: { note?: string | null; links?: string[]; tracking?: { carrier?: string | null; number: string } | null; attachment_ids?: number[] } | null;
  price_currency?: string | null;
  price_amount?: number | null;
  fx_rate?: number | null;
  fx_locked_at?: string | null;
  attachments?: EscrowAttachment[];
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
  /** Evidence files attached to this entry (ids resolve against deal.attachments). */
  attachment_ids?: number[];
}

/** A proposed dispute resolution, sent when raising or countering. */
export interface DisputeProposalInput {
  proposed_outcome: SettlementOutcome;
  split_percent_seller?: number;
  message?: string;
  reason?: string;
  kind?: "cancellation";
  attachment_ids?: number[];
}

export interface EscrowAttachment {
  attachment_id: number;
  name: string;
  type: string;
  size: number;
  context: string;
  ref: string | null;
  by: string | null;
  created_at: string;
}

const unwrap = (res: any) => res?.data?.data;

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
  runSafeDealReminders: async (): Promise<{ count: number }> => unwrap(await adminBaseApi.post("/safedeal/admin/run-reminders", {})),
  /** Private evidence file → blob (admin token attached by adminBaseApi). */
  openFile: async (id: number): Promise<void> => {
    const res = await adminBaseApi.get(`/safedeal/admin/files/${id}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};

export default escrowAdminApi;
