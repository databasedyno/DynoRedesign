/**
 * Shareable receipt links — create-or-reuse an unguessable public URL for a
 * settled payment, and shape the public JSON the /receipt/<token> page renders.
 *
 * Producers: settlement (customer confirmation email) and the checkout paid
 * card ("Copy receipt link"). Consumers: GET /api/pay/receipt/:token (+ /pdf).
 */
import crypto from "crypto";
import { paymentReceiptModel } from "../models";
import type { ReceiptData } from "./pdfReceiptService";
import { FRONTEND_BASE_URL } from "./email/emailShared";
import { t, normalizeLang } from "../utils/emailI18n";
import { getCoinSymbol, getNetworkDisplayName, getCoinDisplayName } from "../utils/networkLabels";
import { apiLogger } from "../utils/loggers";

/** ReceiptData with a JSON-safe date. */
export type ReceiptSnapshot = Omit<ReceiptData, "paymentDate" | "receiptUrl"> & { paymentDate: string };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // no 0/O/1/l/I

/** 22 chars from a 57-symbol alphabet ≈ 128 bits — unguessable, copy-friendly. */
export const newReceiptToken = (): string => {
  const bytes = crypto.randomBytes(22);
  let out = "";
  for (let i = 0; i < 22; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

export const isValidReceiptToken = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9]{16,40}$/.test(token);

export const buildReceiptUrl = (token: string): string => `${FRONTEND_BASE_URL}/receipt/${token}`;
/** Same-origin API path (the ingress routes /api/* to the backend on every host). */
export const buildReceiptPdfUrl = (token: string): string => `${FRONTEND_BASE_URL}/api/pay/receipt/${token}/pdf`;

export const toSnapshot = (data: ReceiptData): ReceiptSnapshot => {
  const { paymentDate, receiptUrl: _omit, ...rest } = data;
  void _omit;
  return { ...rest, paymentDate: new Date(paymentDate).toISOString() };
};

export const fromSnapshot = (snap: ReceiptSnapshot, receiptUrl?: string): ReceiptData => ({
  ...snap,
  paymentDate: new Date(snap.paymentDate),
  receiptUrl,
});

/**
 * Stable idempotency key for a payment: the on-chain hash when known (first one
 * if several were joined), otherwise the payment/transaction id.
 */
export const receiptDedupeKey = (data: Pick<ReceiptData, "transactionReference" | "transactionId">): string => {
  const ref = String(data.transactionReference || "").split(",")[0].trim();
  return (ref ? `tx:${ref}` : `id:${String(data.transactionId).trim()}`).slice(0, 191);
};

/**
 * Create (or reuse) the public receipt for a settled payment. Never throws —
 * a link is a nice-to-have on top of the settlement path; returns null on failure.
 */
export const ensureReceiptLink = async (
  data: ReceiptData,
  companyId?: number | null
): Promise<{ token: string; url: string } | null> => {
  try {
    const dedupeKey = receiptDedupeKey(data);
    const existing = (await paymentReceiptModel.findOne({ where: { dedupe_key: dedupeKey } })) as any;
    if (existing) {
      return { token: existing.receipt_token, url: buildReceiptUrl(existing.receipt_token) };
    }
    const token = newReceiptToken();
    try {
      await paymentReceiptModel.create({
        receipt_token: token,
        dedupe_key: dedupeKey,
        company_id: companyId ?? null,
        transaction_ref: String(data.transactionId).slice(0, 191),
        lang: normalizeLang(data.lang),
        payload: toSnapshot(data),
      });
      return { token, url: buildReceiptUrl(token) };
    } catch (createErr: any) {
      // Lost a race with the other producer — reuse theirs.
      const raced = (await paymentReceiptModel.findOne({ where: { dedupe_key: dedupeKey } })) as any;
      if (raced) return { token: raced.receipt_token, url: buildReceiptUrl(raced.receipt_token) };
      throw createErr;
    }
  } catch (err) {
    apiLogger.error("[Receipt] ensureReceiptLink failed:", err);
    return null;
  }
};

export const getReceiptByToken = async (
  token: string
): Promise<{ token: string; snapshot: ReceiptSnapshot; companyId: number | null } | null> => {
  if (!isValidReceiptToken(token)) return null;
  const row = (await paymentReceiptModel.findByPk(token)) as any;
  if (!row) return null;
  // Fire-and-forget view counter (helps merchants see the link is actually used).
  paymentReceiptModel.increment("view_count", { where: { receipt_token: token } }).catch(() => undefined);
  return { token, snapshot: row.payload as ReceiptSnapshot, companyId: row.company_id ?? null };
};

/** s***@example.com — the page is public by link; never expose the full address. */
export const maskEmail = (email?: string | null): string => {
  const e = String(email || "").trim();
  const at = e.indexOf("@");
  if (at <= 0) return "";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const shown = local.length <= 2 ? local.charAt(0) : local.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(3, Math.min(6, local.length - shown.length)))}@${domain}`;
};

const EXPLORER: Record<string, (h: string) => string> = {
  BTC: (h) => `https://mempool.space/tx/${h}`,
  LTC: (h) => `https://blockchair.com/litecoin/transaction/${h}`,
  DOGE: (h) => `https://blockchair.com/dogecoin/transaction/${h}`,
  BCH: (h) => `https://blockchair.com/bitcoin-cash/transaction/${h}`,
  ETH: (h) => `https://etherscan.io/tx/${h}`,
  POLYGON: (h) => `https://polygonscan.com/tx/${h}`,
  TRX: (h) => `https://tronscan.org/#/transaction/${h}`,
  SOL: (h) => `https://solscan.io/tx/${h}`,
  XRP: (h) => `https://xrpscan.com/tx/${h}`,
};
const chainOf = (code: string): string => {
  const c = code.toUpperCase();
  if (c.endsWith("-ERC20")) return "ETH";
  if (c.endsWith("-TRC20")) return "TRX";
  if (c.endsWith("-POLYGON")) return "POLYGON";
  if (c === "RLUSD") return "XRP";
  return c;
};

/** Block-explorer link for the (first) on-chain hash of a payment, or null. */
export const explorerTxUrl = (cryptoCode?: string | null, reference?: string | null): string | null => {
  const hash = String(reference || "").split(",")[0].trim();
  if (!cryptoCode || !hash || hash.length < 16) return null;
  const fn = EXPLORER[chainOf(cryptoCode)];
  return fn ? fn(hash) : null;
};

/**
 * Public JSON for the receipt page. Labels are localized HERE (same emails.json
 * strings the PDF/email use) so the page needs no i18n of its own and the three
 * surfaces can never drift apart.
 */
export type MerchantContact = {
  legalName: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
};

/** Live (non-snapshot) merchant contact for the receipt footer — contact details may change after settlement. */
export const loadMerchantContact = async (companyId: number | null): Promise<MerchantContact | null> => {
  if (!companyId) return null;
  try {
    const { companyModel } = await import("../models");
    const c = (await companyModel.findByPk(companyId, {
      attributes: ["company_name", "email", "website", "mobile", "address_line1", "address_line2", "city", "state", "zip_code", "country"],
    })) as any;
    if (!c) return null;
    const v = c.dataValues;
    const address = [v.address_line1, v.address_line2, [v.zip_code, v.city].filter(Boolean).join(" "), v.state, v.country]
      .map((s: unknown) => String(s || "").trim())
      .filter(Boolean)
      .join(", ");
    const website = String(v.website || "").trim();
    return {
      legalName: v.company_name || null,
      email: v.email || null,
      website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null,
      phone: v.mobile || null,
      address: address || null,
    };
  } catch {
    return null;
  }
};

export const toPublicReceipt = (token: string, snap: ReceiptSnapshot, contact: MerchantContact | null = null) => {
  const L = normalizeLang(snap.lang);
  const coinSymbol = getCoinSymbol(snap.cryptoCurrency);
  const network = getNetworkDisplayName(snap.cryptoCurrency);
  return {
    token,
    lang: L,
    url: buildReceiptUrl(token),
    pdfUrl: buildReceiptPdfUrl(token),
    status: "completed",
    amount: snap.amount,
    currency: snap.currency,
    cryptoAmount: snap.cryptoAmount || null,
    cryptoCurrency: snap.cryptoCurrency || null,
    coinSymbol: coinSymbol || null,
    coinName: snap.cryptoCurrency ? getCoinDisplayName(snap.cryptoCurrency) : null,
    network: network || null,
    merchant: {
      name: snap.companyName,
      logo: snap.companyLogo || null,
      verified: !!snap.merchantVerified,
      contact: contact && (contact.email || contact.website || contact.phone || contact.address || (contact.legalName && contact.legalName !== snap.companyName))
        ? contact
        : null,
    },
    customer: {
      name: snap.customerName || null,
      emailMasked: maskEmail(snap.customerEmail) || null,
    },
    transactionId: snap.transactionId,
    transactionReference: snap.transactionReference || null,
    explorerUrl: explorerTxUrl(snap.cryptoCurrency, snap.transactionReference),
    paymentDate: snap.paymentDate,
    description: snap.description || null,
    paymentMethod: snap.cryptoCurrency
      ? `${t("receipt.cryptocurrency", L)} (${network ? coinSymbol : snap.cryptoCurrency})`
      : t("receipt.cryptocurrency", L),
    labels: {
      title: t("receipt.title", L),
      successful: t("receipt.successful", L),
      receiptNo: t("receipt.receiptNo", L, { number: String(snap.transactionId).substring(0, 8).toUpperCase() }),
      amountPaid: t("labels.amountPaid", L),
      transactionDetails: t("receipt.transactionDetails", L),
      transactionId: t("labels.transactionId", L),
      reference: t("labels.reference", L),
      paymentMethod: t("receipt.paymentMethod", L),
      network: t("receipt.network", L),
      status: t("labels.status", L),
      completed: t("receipt.completed", L),
      dateTime: t("receipt.dateTime", L),
      paidTo: t("receipt.paidTo", L),
      customer: t("labels.customer", L),
      verifiedMerchant: t("receipt.verifiedMerchant", L),
      description: t("labels.description", L),
      contactMerchant: t("receipt.contactMerchant", L, { company: snap.companyName }),
      merchantContact: t("receipt.merchantContact", L),
      refundNote: t("receipt.refundNote", L, { company: snap.companyName }),
      print: t("receipt.print", L),
      legalName: t("receipt.legalName", L),
      emailLabel: t("receipt.emailLabel", L),
      websiteLabel: t("receipt.websiteLabel", L),
      phoneLabel: t("receipt.phoneLabel", L),
      addressLabel: t("receipt.addressLabel", L),
      autoGenerated: t("receipt.autoGenerated", L),
      downloadPdf: t("receipt.downloadPdf", L),
      copyLink: t("receipt.copyLink", L),
      linkCopied: t("receipt.linkCopied", L),
      viewOnExplorer: t("receipt.viewOnExplorer", L),
      tagline: t("chrome.tagline", L),
      rights: t("chrome.rights", L, { year: new Date().getFullYear() }),
      support: t("chrome.support", L),
    },
  };
};

export type PublicReceipt = ReturnType<typeof toPublicReceipt>;
