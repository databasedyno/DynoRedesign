/** Deal-type metadata, guided-terms templates and fiat price display helpers. */
import type { SdDeal, SdDealType } from "@/api/safedeal";

export const DEAL_TYPES: { v: SdDealType; label: string; sub: string; icon: string }[] = [
  { v: "goods", label: "Physical item", sub: "Shipped or handed over", icon: "mdi:package-variant-closed" },
  { v: "service", label: "Service / work", sub: "Design, dev, consulting…", icon: "mdi:briefcase-outline" },
  { v: "digital", label: "Digital goods", sub: "Files, licences, accounts", icon: "mdi:file-download-outline" },
  { v: "other", label: "Something else", sub: "Any other agreement", icon: "mdi:dots-horizontal-circle-outline" },
];

export const dealTypeMeta = (v?: string | null) => DEAL_TYPES.find((t) => t.v === v) || null;

/** Starter terms per deal type — the creator edits before sending. */
export const TERMS_TEMPLATES: Record<SdDealType, string> = {
  goods:
    "Item: [exact make / model / condition]\nIncluded: [accessories, box, papers]\nShipping: [carrier + insured/tracked] to the buyer's address within [X] days of funding\nAcceptance: buyer confirms the item matches the description and photos and is undamaged\nReturns: if it doesn't match, buyer requests changes or opens a dispute within the inspection period",
  service:
    "Scope: [what will be delivered, in detail]\nDeliverables: [list files / outputs]\nTimeline: delivered by the due date; up to [N] rounds of revisions included\nAcceptance: buyer confirms deliverables match the scope\nOut of scope: [anything not included]",
  digital:
    "Product: [name / version / licence type]\nDelivery: [download link / transfer method] within [X] hours of funding\nAcceptance: buyer confirms the files open and match the description\nLicence / ownership: [who owns what after transfer]\nSupport: [what help is included, for how long]",
  other:
    "What's being exchanged: [describe]\nWhen: [delivery / handover date]\nHow the buyer confirms: [what counts as done]\nAnything else both sides agree on: [notes]",
};

export function fiatMoney(amount?: number | null, currency = "USD"): string {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

export const isFiatPriced = (d: Pick<SdDeal, "price_currency" | "currency" | "price_amount">) =>
  !!d.price_currency && d.price_currency !== (d.currency || "USD") && d.price_amount != null;

/** Headline price + USD line for a deal ("€300.00" / "≈ $344.70 · locked at funding"). */
export function dealPrice(d: SdDeal): { primary: string; secondary: string | null; locked: boolean } {
  if (!isFiatPriced(d)) return { primary: fiatMoney(d.amount, d.currency || "USD"), secondary: null, locked: true };
  const locked = !!d.fx_locked_at;
  return {
    primary: fiatMoney(d.price_amount, d.price_currency!),
    secondary: `${locked ? "" : "≈ "}${fiatMoney(d.amount, "USD")}${locked ? ` · rate locked` : " · locked when the buyer funds"}`,
    locked,
  };
}

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
