/**
 * SafeDeal API client — talks to Dynopay's /api/safedeal/* surface.
 * Sessions are a SafeDeal JWT kept in localStorage and sent as x-safedeal-token.
 */
import axios from "axios";
import type { EscrowDeal, FeeBreakdown, DisputeProposalInput, CostItem } from "@/api/escrow";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
export const SD_TOKEN_KEY = "sd_token";
export const SD_USER_KEY = "sd_user";

/** On safedeal.sh the API is proxied same-origin under /api — skip the cross-origin hop (and its preflight). */
const sdApiBase = (): string => {
  if (typeof window !== "undefined" && /(^|\.)safedeal\.sh$/i.test(window.location.hostname)) return "";
  return apiBaseUrl;
};

export interface SdUser {
  email: string;
  customer_id: number;
  display_name?: string | null;
  /** Telegram-only accounts carry a synthetic email until the user adds a real one. */
  email_is_placeholder?: boolean;
}

/** Telegram sign-ins get a non-routable synthetic address; treat these as "no real email yet". */
export const isPlaceholderSdEmail = (email?: string | null): boolean => /@telegram\.safedeal$/i.test(String(email ?? ""));

/** A friendly label for a party — real emails show as-is; Telegram placeholders read as a person, not tg123@…. */
export const prettyParty = (email?: string | null, fallback = "the other party"): string => {
  const e = String(email ?? "").trim();
  if (!e) return fallback;
  return isPlaceholderSdEmail(e) ? "a Telegram user" : e;
};

export const sdSession = {
  token: (): string | null => (typeof window === "undefined" ? null : window.localStorage.getItem(SD_TOKEN_KEY)),
  user: (): SdUser | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(SD_USER_KEY);
      return raw ? (JSON.parse(raw) as SdUser) : null;
    } catch {
      return null;
    }
  },
  set(token: string, user: SdUser) {
    window.localStorage.setItem(SD_TOKEN_KEY, token);
    window.localStorage.setItem(SD_USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("sd-session"));
  },
  clear() {
    window.localStorage.removeItem(SD_TOKEN_KEY);
    window.localStorage.removeItem(SD_USER_KEY);
    window.dispatchEvent(new Event("sd-session"));
  },
};

const client = axios.create({ headers: { "Content-Type": "application/json" } });
client.interceptors.request.use((cfg) => {
  cfg.baseURL = `${sdApiBase()}/api/safedeal`;
  const t = sdSession.token();
  if (t) cfg.headers["x-safedeal-token"] = t;
  return cfg;
});
client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== "undefined" && sdSession.token()) sdSession.clear();
    return Promise.reject(err);
  }
);

const unwrap = <T,>(res: { data: { data: T; message?: string } }): T => res.data.data;
export const sdError = (e: any): string => e?.response?.data?.message || e?.message || "Something went wrong.";

export interface SdConfig {
  fee_percent: number;
  cancellation_fee_percent?: number;
  fee_min_usd: number;
  min_deal_usd: number;
  max_deal_eur?: number;
  max_deal_usd?: number;
  auto_release_presets: number[];
  auto_release_default: number;
  payout_options: { key: string; coin: string; chain: string; label: string }[];
  min_withdrawal_usd: number;
  withdrawal_approval_usd: number;
  live_settlement: boolean;
  dispute_auto_escalate_hours: number;
  legal_name?: string;
  price_currencies?: string[];
  attachment_limits?: { max_files: number; max_mb: number; types: string[] };
  deal_types?: string[];
  max_revision_rounds?: number;
  address_cooling_hours?: number;
  telegram_bot?: string | null;
}

export interface SdBalances {
  available: number;
  held: number;
  total: number;
  currency: string;
}

export interface SdAttachment {
  attachment_id: number;
  name: string;
  type: string;
  size: number;
  context: "delivery" | "dispute" | "pending" | string;
  ref: string | null;
  by: string | null;
  created_at: string;
}

export interface SdDeliveryProof {
  note?: string | null;
  links?: string[];
  tracking?: { carrier?: string | null; number: string } | null;
  attachment_ids?: number[];
}

export interface SdCounterparty {
  email_masked: string;
  verified_email: boolean;
  member_since: string | null;
  completed_deals: number;
}

export type SdDealType = "goods" | "service" | "digital" | "other";

export interface SdFundingPayment {
  payment_id: string;
  coin: string;
  address: string;
  destination_tag?: number | null;
  crypto_amount: string;
  base_amount: number;
  base_currency: string;
  qr_code?: string | null;
  status: "waiting" | "pending" | "underpaid" | "confirmed" | "settled" | "expired";
  created_at: string;
  expires_at: string;
  seen_tx?: string | null;
  received_crypto?: number | null;
  settlement_tx?: string | null;
  merchant_amount?: number | null;
  events?: { event: string; at: string }[];
}

export interface SdFundingCoin {
  coin: string;
  label: string;
  network: string;
  stable: boolean;
  cheap: boolean;
  buyer_pays: number;
  network_fee: number;
  conversion_fee: number;
  exchange_fee: number;
  /** Difference vs the stablecoin quote shown on the deal page (0 for USDT/USDC). */
  surcharge?: number;
}

export interface SdTopupQuote {
  coin: string;
  label: string;
  network: string;
  stable: boolean;
  cheap: boolean;
  amount: number;
  network_fee: number;
  conversion_fee: number;
  exchange_fee: number;
  exchange_fee_percent: number;
  pays: number;
}

export type SdTopupStatus = "waiting" | "pending" | "underpaid" | "credited" | "expired";

export interface SdTopup {
  topup_id: number;
  coin: string;
  amount_usd: number | string;
  network_fee_usd: number | string;
  conversion_fee_usd: number | string;
  exchange_fee_usd: number | string;
  pays_usd: number | string;
  payment_id: string | null;
  address: string | null;
  destination_tag: number | null;
  crypto_amount: string | null;
  qr_code: string | null;
  status: SdTopupStatus;
  seen_tx: string | null;
  simulated: boolean;
  expires_at: string;
  credited_at: string | null;
  created_at: string;
}

/** A unified invoice/receipt row: a closed/funded deal, or a wallet deposit (top-up). */
export interface SdInvoiceDeal {
  type: "deal";
  id: string;
  escrow_id: number;
  deal_token: string;
  invoice_no: string;
  title: string;
  status: string;
  outcome: string | null;
  state: string;
  state_label: string;
  date: string;
  closed_at: string;
  my_role: "buyer" | "seller";
  amount: number;
  currency: string;
  funding_coin: string | null;
  funding_method: string | null;
  funding_label: string;
  fee_payer: string;
  total_cost: number;
  cost_items: CostItem[];
  my_fee_share: number;
  buyer_paid: number;
  my_amount: number;
  my_payout: { withdrawal_id: number; status: string; net_usd: number; payout_key: string; address: string } | null;
}

export interface SdInvoiceDeposit {
  type: "deposit";
  id: string;
  topup_id: number;
  invoice_no: string;
  title: string;
  state: string;
  state_label: string;
  date: string;
  closed_at: string;
  coin: string;
  coin_label: string;
  network: string;
  amount: number;
  currency: string;
  received_usd: number;
  network_fee_usd: number;
  conversion_fee_usd: number;
  exchange_fee_usd: number;
  total_fee_usd: number;
  credited_usd: number;
}

export type SdInvoice = SdInvoiceDeal | SdInvoiceDeposit;

export interface SdFunding {
  status: string;
  coins: SdFundingCoin[];
  payment: SdFundingPayment | null;
  funded_at?: string | null;
  funding_coin?: string | null;
  funding_tx_hash?: string | null;
  funding_settled_at?: string | null;
  custody_amount_stable?: number | null;
  live: boolean;
}

export interface SdPayoutPref {
  address_id: number;
  set_at: string;
  before_funding: boolean;
  address?: Pick<SdAddress, "address_id" | "payout_key" | "address" | "label" | "usable_at" | "created_at"> | null;
}

export interface SdDeal extends EscrowDeal {
  source?: string;
  creator_email?: string | null;
  buyer_email?: string;
  seller_email?: string;
  // Invitation model: 'email' (addressed) | 'link' (open seat claimed by the first visitor).
  invite_kind?: "email" | "link";
  counterparty_claimed_at?: string | null;
  funding_method?: string | null;
  funding_link_ref?: string | null;
  checkout_url?: string | null;
  buyer_balance?: SdBalances;
  funding_payment?: SdFundingPayment | null;
  funding_settled_at?: string | null;
  custody_realized_usd?: number | null;
  payout_prefs?: Record<string, SdPayoutPref> | null;
  my_addresses?: Pick<SdAddress, "address_id" | "payout_key" | "address" | "label" | "usable_at" | "created_at">[];
  my_payout_pref?: SdPayoutPref | null;
  // Batch 2/3
  deal_type?: SdDealType | null;
  delivery_due_at?: string | null;
  revision_round?: number;
  revision_note?: string | null;
  max_revision_rounds?: number;
  amended_at?: string | null;
  invite_resent_at?: string | null;
  delivery_proof?: SdDeliveryProof | null;
  price_currency?: string | null;
  price_amount?: number | null;
  fx_rate?: number | null;
  fx_locked_at?: string | null;
  attachments?: SdAttachment[];
  counterparty?: SdCounterparty;
}

export interface SdFeePreview extends FeeBreakdown {
  price?: { currency: string; amount: number; rate: number; usd: number; indicative: boolean } | null;
}

export interface SdDealPreview {
  deal_token: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  creator_role: "buyer" | "seller";
  fee_payer: string;
  auto_release_days: number;
  // Invitation model (link deals have an open, claimable seat).
  invite_kind?: "email" | "link";
  open_seat?: boolean;
  claimed?: boolean;
  buyer_email_masked: string;
  seller_email_masked: string;
  counterparty_email_masked: string;
  counterparty_email_hint: string | null;
  buyer_pays: number;
  seller_receives: number;
  created_at: string;
}

export interface SdStatementRow {
  id: string | null;
  at: string;
  type: string;
  kind: string;
  amount: number;
  signed: number;
  bucket: "available" | "held" | "transfer";
  description: string;
  reference: string;
  source: string;
  escrow_id: number | null;
  deal_title: string | null;
  running_balance: number;
  meta: Record<string, unknown>;
}

export interface SdAddress {
  address_id: number;
  payout_key: string;
  coin: string;
  network: string;
  address: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
  /** created_at + cooling-off window; withdrawals to this address are blocked before then. */
  usable_at?: string;
  /** "Verify with wallet": when the owner signed for this address (null = unverified). */
  ownership_verified_at?: string | null;
  ownership_verified_via?: string | null;
}

/** What the user is confirming with a step-up code — drives the email copy. */
export type StepUpAction = "cashout" | "address_add" | "address_remove" | "payout_destination";

export interface SdWithdrawal {
  withdrawal_id: number;
  payout_key: string;
  address: string;
  amount_usd: number | string;
  fee_usd: number | string;
  net_usd: number | string;
  status: string;
  requires_approval: boolean;
  /** Exchange order ref at dispatch ("BINANCE-<id>") — never shown to users. */
  tx_hash: string | null;
  /** Real blockchain hash once the network confirmed (backfilled a few minutes after sending). */
  chain_tx_hash?: string | null;
  chain_confirmed_at?: string | null;
  simulated: boolean;
  sent_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  source?: string;
  escrow_id?: number | null;
  customer_email?: string | null;
}

export interface SdWallet extends Partial<SdBalances> {
  wallet: SdBalances;
  addresses: SdAddress[];
  withdrawals: SdWithdrawal[];
  topups: SdTopup[];
  profile: { auto_withdraw: boolean; auto_withdraw_address_id: number | null; parked_payout_usd?: number; deposit_reserved_usd?: number };
  limits: { min_withdrawal_usd: number; approval_threshold_usd: number; min_topup_usd: number; max_topup_usd: number };
  payout_options: SdConfig["payout_options"];
  live: boolean;
}

export type SdDealAction =
  | "accept" | "decline" | "cancel" | "fund" | "fund-balance" | "deliver" | "release"
  | "request-changes" | "amend" | "resend-invite" | "regenerate-link"
  | "dispute" | "dispute-counter" | "dispute-accept" | "dispute-message" | "dispute-escalate";

export interface SdCreateDealBody {
  title: string;
  amount: number;
  price_currency?: string;
  my_role: "buyer" | "seller";
  /** Omit (with invite_by_link) to create an open-seat shareable link deal. */
  counterparty_email?: string;
  invite_by_link?: boolean;
  fee_payer: "buyer" | "seller" | "split";
  auto_release_days: number;
  deal_type?: SdDealType;
  delivery_due_at?: string | null;
  description?: string;
  terms?: string;
}

export type SdAmendBody = Partial<Pick<SdCreateDealBody, "title" | "amount" | "price_currency" | "fee_payer" | "auto_release_days" | "deal_type" | "delivery_due_at" | "terms" | "description">>;

export const safedealApi = {
  config: async (): Promise<SdConfig> => unwrap(await client.get("/config")),
  feePreview: async (body: { amount: number; fee_payer: string; price_currency?: string }): Promise<SdFeePreview> => unwrap(await client.post("/fee-preview", body)),
  sendCode: async (email: string): Promise<{ email: string; preview_code?: string }> => unwrap(await client.post("/auth/send-code", { email })),
  verifyCode: async (email: string, code: string): Promise<{ token: string; user: SdUser }> => unwrap(await client.post("/auth/verify-code", { email, code })),
  telegramAuth: async (data: Record<string, unknown>): Promise<{ token: string; user: SdUser }> => unwrap(await client.post("/auth/telegram", data)),
  telegramStatus: async (): Promise<{ linked: boolean; bot: string | null; configured: boolean }> => unwrap(await client.get("/telegram")),
  telegramLink: async (data: Record<string, unknown>): Promise<{ linked: boolean; message_sent: boolean; bot: string | null }> => unwrap(await client.post("/telegram/link", data)),
  telegramTest: async (): Promise<{ sent: boolean }> => unwrap(await client.post("/telegram/test", {})),
  telegramUnlink: async (): Promise<{ linked: boolean }> => unwrap(await client.post("/telegram/unlink", {})),
  /** Fresh one-time code for a sensitive wallet change. `action` shapes the email ("Confirm your cashout"). */
  stepUp: async (action?: StepUpAction): Promise<{ preview_code?: string }> => unwrap(await client.post("/auth/step-up", action ? { action } : {})),
  me: async (): Promise<{ user: SdUser; wallet: SdBalances; profile: SdWallet["profile"]; addresses_count: number }> => unwrap(await client.get("/me")),
  updateProfile: async (body: { auto_withdraw?: boolean; auto_withdraw_address_id?: number | null; display_name?: string }) => unwrap(await client.post("/profile", body)),

  /** Add a real email to the signed-in account (Telegram users, or anyone who wants email login). */
  addEmailStart: async (email: string): Promise<{ email: string; preview_code?: string }> => unwrap(await client.post("/account/email/start", { email })),
  addEmailVerify: async (code: string): Promise<{ token: string; user: SdUser; connected_deals: number }> => unwrap(await client.post("/account/email/verify", { code })),

  listDeals: async (status?: string, role?: string): Promise<SdDeal[]> => unwrap(await client.get("/deals", { params: { status, role } })),
  createDeal: async (body: SdCreateDealBody): Promise<SdDeal> => unwrap(await client.post("/deals", body)),
  previewDeal: async (token: string): Promise<SdDealPreview> => unwrap(await client.get(`/deals/${token}/preview`)),
  getDeal: async (token: string): Promise<SdDeal> => unwrap(await client.get(`/deals/${token}`)),
  /** Claim the open counterparty seat on a shareable-link deal (first signed-in visitor wins). */
  claimDeal: async (token: string): Promise<SdDeal> => unwrap(await client.post(`/deals/${token}/claim`, {})),
  act: async (token: string, body: { action: SdDealAction } & Record<string, unknown>): Promise<{ deal: SdDeal; message: string }> => {
    const res = await client.post(`/deals/${token}/action`, body);
    return { deal: res.data.data as SdDeal, message: res.data.message as string };
  },
  disputeApi: (token: string, onDeal: (d: SdDeal) => void) => ({
    raise: async (b: DisputeProposalInput) => { const r = await safedealApi.act(token, { action: "dispute", ...b }); onDeal(r.deal); return r.deal; },
    counter: async (b: DisputeProposalInput) => { const r = await safedealApi.act(token, { action: "dispute-counter", ...b }); onDeal(r.deal); return r.deal; },
    accept: async () => { const r = await safedealApi.act(token, { action: "dispute-accept" }); onDeal(r.deal); return r.deal; },
    message: async (message: string, attachment_ids?: number[]) => { const r = await safedealApi.act(token, { action: "dispute-message", message, attachment_ids }); onDeal(r.deal); return r.deal; },
    escalate: async () => { const r = await safedealApi.act(token, { action: "dispute-escalate" }); onDeal(r.deal); return r.deal; },
    upload: (file: File, onProgress?: (pct: number) => void) => safedealApi.uploadFile(token, file, onProgress),
    open: (id: number) => safedealApi.openFile(token, id),
  }),

  /** Evidence upload (multipart) → pending attachment; bind it via the next deal action's attachment_ids. */
  uploadFile: async (token: string, file: File, onProgress?: (pct: number) => void): Promise<SdAttachment> => {
    const form = new FormData();
    form.append("file", file);
    const res = await client.post(`/deals/${token}/files`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });
    return res.data.data as SdAttachment;
  },
  fileBlob: async (token: string, id: number): Promise<Blob> => (await client.get(`/deals/${token}/files/${id}`, { responseType: "blob" })).data as Blob,
  /** Files are private (session header) — fetch as a blob and open in a new tab. */
  openFile: async (token: string, id: number): Promise<void> => {
    const blob = await safedealApi.fileBlob(token, id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  dealPdf: async (token: string): Promise<Blob> => (await client.get(`/deals/${token}/summary.pdf`, { responseType: "blob" })).data as Blob,

  /** Funding via Dynopay's Merchant API: coin list + current payment (buyer only). */
  funding: async (token: string): Promise<SdFunding> => unwrap(await client.get(`/deals/${token}/funding`)),
  /** Buyer paid from a connected wallet — record the tx hash next to the funding address (support hint). */
  fundingWalletTx: async (token: string, body: { tx_hash: string; coin: string; address: string; from_address?: string; wallet_name?: string }): Promise<{ tx_hash: string }> =>
    unwrap(await client.post(`/deals/${token}/funding/wallet-tx`, body)),
  /** "Verify with wallet" for a saved cashout address: nonce → sign → verify. */
  addressVerifyNonce: async (id: number): Promise<{ nonce: string; message: string; address: string; code: string; family: string; expires_at: string }> =>
    unwrap(await client.post(`/wallet/addresses/${id}/verify-nonce`, {})),
  addressVerify: async (id: number, body: { nonce: string; signature: string; wallet_name?: string }): Promise<SdAddress> =>
    unwrap(await client.post(`/wallet/addresses/${id}/verify`, body)),
  createFunding: async (token: string, coin: string): Promise<{ funding: SdFunding; message: string }> => {
    const res = await client.post(`/deals/${token}/funding`, { coin });
    return { funding: res.data.data as SdFunding, message: res.data.message as string };
  },
  /** Where my payout/refund should go for this deal — a saved address, or a new one (needs a step-up code). */
  setPayoutDestination: async (token: string, body: { address_id?: number; payout_key?: string; address?: string; label?: string; code?: string }): Promise<{ deal: SdDeal; message: string }> => {
    const res = await client.post(`/deals/${token}/payout-destination`, body);
    return { deal: res.data.data as SdDeal, message: res.data.message as string };
  },

  wallet: async (): Promise<SdWallet> => unwrap(await client.get("/wallet")),
  statement: async (params: { from?: string; to?: string; limit?: number } = {}): Promise<{ wallet: SdBalances; entries: SdStatementRow[] }> =>
    unwrap(await client.get("/wallet/statement", { params })),
  statementCsvUrl: () => `${apiBaseUrl}/api/safedeal/wallet/statement.csv`,
  downloadStatementCsv: async (params: { from?: string; to?: string } = {}): Promise<Blob> => {
    const res = await client.get("/wallet/statement.csv", { params, responseType: "blob" });
    return res.data as Blob;
  },
  addAddress: async (body: { payout_key: string; address: string; label?: string; code: string }): Promise<SdAddress> => unwrap(await client.post("/wallet/addresses", body)),
  removeAddress: async (id: number, code: string): Promise<SdAddress> => unwrap(await client.post(`/wallet/addresses/${id}/remove`, { code })),
  withdrawQuote: async (body: { address_id: number; amount: number }): Promise<{ amount: number; fee: number; fee_waived: number; fee_credit_available: number; net: number; available: number; requires_approval: boolean; below_min: boolean; min: number }> =>
    unwrap(await client.post("/wallet/withdraw/quote", body)),
  withdraw: async (body: { address_id: number; amount: number; code: string }): Promise<{ withdrawal: SdWithdrawal; wallet: SdBalances; message?: string }> => {
    const res = await client.post("/wallet/withdraw", body);
    return { ...(res.data.data as any), message: res.data.message };
  },

  /** Wallet top-ups: deposit crypto through Dynopay → USD balance credited on confirmation. */
  topupCoins: async (amount: number): Promise<{ amount: number; coins: SdTopupQuote[]; min_topup_usd: number; max_topup_usd: number; live: boolean }> =>
    unwrap(await client.get("/wallet/topup/coins", { params: { amount } })),
  createTopup: async (body: { amount: number; coin: string }): Promise<{ topup: SdTopup; live: boolean; message: string }> => {
    const res = await client.post("/wallet/topup", body);
    return { ...(res.data.data as any), message: res.data.message };
  },
  getTopup: async (id: number): Promise<{ topup: SdTopup; wallet: SdBalances; live: boolean }> => unwrap(await client.get(`/wallet/topup/${id}`)),
  simulateTopup: async (id: number): Promise<{ topup: SdTopup; wallet: SdBalances; message: string }> => {
    const res = await client.post(`/wallet/topup/${id}/simulate`, {});
    return { ...(res.data.data as any), message: res.data.message };
  },
  /** Closed/funded deals + wallet deposits with fees — retrievable any time after sign-in. */
  invoices: async (): Promise<SdInvoice[]> => unwrap(await client.get("/invoices")),
  /** Branded PDF deposit receipt for a wallet top-up. */
  topupReceiptPdf: async (id: number): Promise<Blob> => (await client.get(`/wallet/topup/${id}/receipt.pdf`, { responseType: "blob" })).data as Blob,
};

export default safedealApi;
