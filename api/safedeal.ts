/**
 * SafeDeal API client — talks to Dynopay's /api/safedeal/* surface.
 * Sessions are a SafeDeal JWT kept in localStorage and sent as x-safedeal-token.
 */
import axios from "axios";
import type { EscrowDeal, FeeBreakdown, DisputeProposalInput } from "@/api/escrow";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
export const SD_TOKEN_KEY = "sd_token";
export const SD_USER_KEY = "sd_user";

export interface SdUser {
  email: string;
  customer_id: number;
  display_name?: string | null;
}

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

const client = axios.create({ baseURL: apiBaseUrl + "/api/safedeal", headers: { "Content-Type": "application/json" } });
client.interceptors.request.use((cfg) => {
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
  fee_min_usd: number;
  min_deal_usd: number;
  auto_release_presets: number[];
  auto_release_default: number;
  payout_options: { key: string; coin: string; chain: string; label: string }[];
  min_withdrawal_usd: number;
  withdrawal_approval_usd: number;
  live_settlement: boolean;
  dispute_auto_escalate_hours: number;
}

export interface SdBalances {
  available: number;
  held: number;
  total: number;
  currency: string;
}

export interface SdDeal extends EscrowDeal {
  source?: string;
  creator_email?: string | null;
  buyer_email?: string;
  seller_email?: string;
  funding_method?: string | null;
  funding_link_ref?: string | null;
  checkout_url?: string | null;
  buyer_balance?: SdBalances;
  checkout?: { ref: string; url: string; amount: number };
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
  buyer_email_masked: string;
  seller_email_masked: string;
  counterparty_email_masked: string;
  counterparty_email_hint: string;
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
}

export interface SdWithdrawal {
  withdrawal_id: number;
  payout_key: string;
  address: string;
  amount_usd: number | string;
  fee_usd: number | string;
  net_usd: number | string;
  status: string;
  requires_approval: boolean;
  tx_hash: string | null;
  simulated: boolean;
  sent_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  customer_email?: string | null;
}

export interface SdWallet {
  wallet: SdBalances;
  addresses: SdAddress[];
  withdrawals: SdWithdrawal[];
  profile: { auto_withdraw: boolean; auto_withdraw_address_id: number | null };
  limits: { min_withdrawal_usd: number; approval_threshold_usd: number };
  payout_options: SdConfig["payout_options"];
}

export type SdDealAction =
  | "accept" | "decline" | "cancel" | "fund" | "fund-balance" | "checkout" | "deliver" | "release"
  | "dispute" | "dispute-counter" | "dispute-accept" | "dispute-message" | "dispute-escalate";

export const safedealApi = {
  config: async (): Promise<SdConfig> => unwrap(await client.get("/config")),
  feePreview: async (body: { amount: number; fee_payer: string }): Promise<FeeBreakdown> => unwrap(await client.post("/fee-preview", body)),
  sendCode: async (email: string): Promise<{ email: string; preview_code?: string }> => unwrap(await client.post("/auth/send-code", { email })),
  verifyCode: async (email: string, code: string): Promise<{ token: string; user: SdUser }> => unwrap(await client.post("/auth/verify-code", { email, code })),
  stepUp: async (): Promise<{ preview_code?: string }> => unwrap(await client.post("/auth/step-up", {})),
  me: async (): Promise<{ user: SdUser; wallet: SdBalances; profile: SdWallet["profile"]; addresses_count: number }> => unwrap(await client.get("/me")),
  updateProfile: async (body: { auto_withdraw?: boolean; auto_withdraw_address_id?: number | null; display_name?: string }) => unwrap(await client.post("/profile", body)),

  listDeals: async (status?: string, role?: string): Promise<SdDeal[]> => unwrap(await client.get("/deals", { params: { status, role } })),
  createDeal: async (body: {
    title: string; amount: number; my_role: "buyer" | "seller"; counterparty_email: string;
    fee_payer: "buyer" | "seller" | "split"; auto_release_days: number; description?: string; terms?: string;
  }): Promise<SdDeal> => unwrap(await client.post("/deals", body)),
  previewDeal: async (token: string): Promise<SdDealPreview> => unwrap(await client.get(`/deals/${token}/preview`)),
  getDeal: async (token: string): Promise<SdDeal> => unwrap(await client.get(`/deals/${token}`)),
  act: async (token: string, body: { action: SdDealAction } & Record<string, unknown>): Promise<{ deal: SdDeal; message: string }> => {
    const res = await client.post(`/deals/${token}/action`, body);
    return { deal: res.data.data as SdDeal, message: res.data.message as string };
  },
  disputeApi: (token: string, onDeal: (d: SdDeal) => void) => ({
    raise: async (b: DisputeProposalInput) => { const r = await safedealApi.act(token, { action: "dispute", ...b }); onDeal(r.deal); return r.deal; },
    counter: async (b: DisputeProposalInput) => { const r = await safedealApi.act(token, { action: "dispute-counter", ...b }); onDeal(r.deal); return r.deal; },
    accept: async () => { const r = await safedealApi.act(token, { action: "dispute-accept" }); onDeal(r.deal); return r.deal; },
    message: async (message: string) => { const r = await safedealApi.act(token, { action: "dispute-message", message }); onDeal(r.deal); return r.deal; },
    escalate: async () => { const r = await safedealApi.act(token, { action: "dispute-escalate" }); onDeal(r.deal); return r.deal; },
  }),

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
  withdrawQuote: async (body: { address_id: number; amount: number }): Promise<{ amount: number; fee: number; net: number; available: number; requires_approval: boolean; min: number }> =>
    unwrap(await client.post("/wallet/withdraw/quote", body)),
  withdraw: async (body: { address_id: number; amount: number; code: string }): Promise<{ withdrawal: SdWithdrawal; wallet: SdBalances; message?: string }> => {
    const res = await client.post("/wallet/withdraw", body);
    return { ...(res.data.data as any), message: res.data.message };
  },
};

export default safedealApi;
