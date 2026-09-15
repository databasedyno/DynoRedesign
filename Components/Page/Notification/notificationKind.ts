import type { AttentionGroup } from "@/Components/Page/Dashboard/v2026/command/useAttentionItems";

/** Wave 3g — inbox type filter (plan §4: payments · security · system · growth). */
export type NotifKind = "payments" | "security" | "system" | "growth";
export const NOTIF_KINDS: NotifKind[] = ["payments", "security", "system", "growth"];

export const kindOf = (type: string): NotifKind => {
  const t = String(type || "").toLowerCase();
  if (/referral|handle|storefront|creator|tip|supporter|milestone|fee_free|growth|promo/.test(t)) return "growth";
  if (/security|wallet|kyc|api_key|login|device|2fa|password|freeze|lock/.test(t)) return "security";
  if (/payment|transaction|received|confirmed|settled|partial|overpaid|underpaid|refund|conversion|payout|forward|invoice|order/.test(t)) return "payments";
  return "system";
};

export const kindOfAttention = (group: AttentionGroup): NotifKind =>
  group === "money" ? "payments" : group === "config" ? "system" : group;

export const KIND_ICON: Record<NotifKind, string> = {
  payments: "coins",
  security: "shield",
  system: "settings-2",
  growth: "sparkles",
};
