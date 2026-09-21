/**
 * SafeDeal deal summary PDF — a party's record of the agreement, money,
 * delivery proof, dispute outcome and full timeline. Text-only (no logo file
 * for SafeDeal); same indigo/grey palette as the invoice chrome.
 */
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { INK } from "../pdf/invoiceChrome";
import { dealFeeBreakdown } from "../../controller/escrow/escrowShared";
import type { AttachmentPublic } from "./safedealAttachments";

// SafeDeal brand — gold + near-black (matches the app's sdTheme).
const SD_GOLD = "#F0A500";
const SD_INK = "#0A0A0B";
const SD_LOGO_PATH = path.resolve(__dirname, "../../../public/safedeal/favicon-512.png");

/** Draw the SafeDeal brand mark (gold top rule + logo icon + wordmark) and return the y below it. */
function drawBrandHeader(doc: PDFKit.PDFDocument, subtitle: string): void {
  doc.rect(0, 0, doc.page.width, 6).fill(SD_GOLD);
  let tx = 48;
  try {
    if (fs.existsSync(SD_LOGO_PATH)) {
      doc.image(SD_LOGO_PATH, 48, 30, { width: 28, height: 28 });
      tx = 84;
    }
  } catch {
    /* logo optional — fall back to wordmark only */
  }
  doc.font("Helvetica-Bold").fontSize(18).fillColor(SD_INK).text("SafeDeal", tx, 34);
  doc.font("Helvetica").fontSize(9).fillColor(INK.muted).text(subtitle, tx, 56);
}

const fmt = (n: number | string | null | undefined, cur = "USD") =>
  `${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const when = (iso?: string | Date | null) => (iso ? new Date(iso).toUTCString().replace(/:\d\d GMT$/, " UTC") : "—");
const title = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export interface DealPdfInput {
  deal: Record<string, any>;
  buyerEmail: string;
  sellerEmail: string;
  attachments: AttachmentPublic[];
  legalName: string;
  /** The party downloading the document — the invoice is addressed to them. */
  viewer?: { role: "buyer" | "seller"; email: string } | null;
  /** Settlement payouts (withdrawals with source='settlement') for this deal. */
  payouts?: { withdrawal_id: number; customer_id: number; payout_key: string; address: string; net_usd: string | number; status: string; tx_hash: string | null; created_at: string }[];
}

const CLOSED = ["completed", "refunded", "split"];

/** What each side bears of the total fee/cost stack, per the deal's fee_payer. */
export function feeShares(totalCost: number, feePayer: string): { buyer: number; seller: number } {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  if (feePayer === "seller") return { buyer: 0, seller: r2(totalCost) };
  if (feePayer === "split") { const half = r2(totalCost / 2); return { buyer: half, seller: r2(totalCost - half) }; }
  return { buyer: r2(totalCost), seller: 0 };
}

export function generateDealSummaryPdf({ deal: d, buyerEmail, sellerEmail, attachments, legalName, viewer, payouts = [] }: DealPdfInput): PDFKit.PDFDocument {
  const closed = CLOSED.includes(String(d.status)) && !!d.outcome;
  const docTitle = closed ? `SafeDeal invoice SD-${d.escrow_id}` : `SafeDeal #${d.escrow_id} — ${d.title}`;
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: docTitle } });
  const b = dealFeeBreakdown(d);
  const W = doc.page.width - 96;

  // Brand bar + header
  drawBrandHeader(doc, `${closed ? `Invoice SD-${d.escrow_id}` : "Escrow deal summary"} · generated ${when(new Date())}`);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK.text).text(d.title, 48, 84, { width: W });
  doc.font("Helvetica").fontSize(10.5).fillColor(INK.body).text(`Deal #${d.escrow_id} · Status: ${title(String(d.status))}${d.deal_type ? ` · Type: ${title(String(d.deal_type))}` : ""}`);
  if (viewer) doc.font("Helvetica").fontSize(10).fillColor(INK.muted).text(`Issued to: ${viewer.email} (${viewer.role})`);
  doc.moveDown(0.8);

  const section = (label: string) => {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK.muted).text(label.toUpperCase(), { characterSpacing: 0.8 });
    doc.moveTo(48, doc.y + 2).lineTo(48 + W, doc.y + 2).strokeColor(INK.hairline).lineWidth(0.7).stroke();
    doc.moveDown(0.5);
  };
  const row = (l: string, v: string, bold = false) => {
    const y = doc.y;
    doc.font("Helvetica").fontSize(10.5).fillColor(INK.body).text(l, 48, y, { width: W * 0.55 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).fillColor(INK.text).text(v, 48 + W * 0.55, y, { width: W * 0.45, align: "right" });
    doc.moveDown(0.25);
  };

  section("Parties");
  row("Buyer", buyerEmail);
  row("Seller", sellerEmail);
  row("Created by", `${title(String(d.creator_role))} · ${when(d.created_at)}`);

  section("Agreement");
  const fiat = d.price_currency && d.price_currency !== d.currency && d.price_amount != null;
  row("Deal amount", fiat ? `${fmt(d.price_amount, d.price_currency)} (≈ ${fmt(d.amount, d.currency)})` : fmt(d.amount, d.currency), true);
  if (fiat) row("Exchange rate", d.fx_locked_at ? `1 ${d.price_currency} = ${Number(d.fx_rate).toFixed(4)} USD · locked ${when(d.fx_locked_at)}` : "Indicative — locked when the buyer funds");
  row("Escrow fee payer", title(String(d.fee_payer)));
  row("Inspection period", `${d.auto_release_days} day(s) after delivery`);
  if (d.delivery_due_at) row("Delivery due", when(d.delivery_due_at));
  if (d.terms) {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK.text).text("Terms");
    doc.font("Helvetica").fontSize(10).fillColor(INK.body).text(String(d.terms), { width: W });
  }

  section(closed ? "Invoice — final costs" : "Money (estimate)");
  row("Deal amount", fmt(b.amount, d.currency));
  for (const c of b.costItems || []) row(c.label.replace(" (est.)", closed ? "" : " (est.)"), fmt(c.amount, d.currency));
  row("Total fees & costs", fmt(b.totalCost, d.currency), true);
  const shares = feeShares(b.totalCost, String(d.fee_payer));
  row("Fees paid by", title(String(d.fee_payer)) + (d.fee_payer === "split" ? " (50/50)" : ""));
  row("Buyer's share of fees", fmt(shares.buyer, d.currency));
  row("Seller's share of fees", fmt(shares.seller, d.currency));
  if (viewer) row("Your share of fees", fmt(viewer.role === "buyer" ? shares.buyer : shares.seller, d.currency), true);
  row(closed ? "Buyer paid into escrow" : "Buyer pays", fmt(d.funded_amount_usd ?? b.buyerPays, d.currency), true);
  row("Payment method", String(d.funding_method) === "balance" ? "Paid with SafeDeal wallet balance" : `Paid with crypto${d.funding_coin ? ` — ${d.funding_coin}` : ""}`);
  if (d.funding_coin && String(d.funding_method) !== "balance") row("Funded in", `${d.funding_coin}${d.funding_crypto_amount ? ` · ${d.funding_crypto_amount}` : ""}${d.funding_tx_hash ? ` · tx ${String(d.funding_tx_hash).slice(0, 24)}…` : ""}`);
  if (d.custody_amount_stable != null) row("Held in custody", `${fmt(d.custody_amount_stable, d.custody_stablecoin || "USDT")}${d.funding_method ? ` · via ${d.funding_method}` : ""}`);
  if (closed) {
    row("Outcome", `${title(String(d.outcome))}${d.outcome === "split" && d.split_percent_seller != null ? ` · seller ${d.split_percent_seller}%` : ""} · ${when(d.outcome_authorized_at || d.completed_at || d.refunded_at)}`);
    if (Number(d.seller_entitlement_stable) > 0) row("Seller received", fmt(d.seller_entitlement_stable, d.custody_stablecoin || "USDT"), true);
    if (Number(d.buyer_entitlement_stable) > 0) row("Buyer refunded", fmt(d.buyer_entitlement_stable, d.custody_stablecoin || "USDT"), true);
    row("Kept by SafeDeal (fees + costs)", fmt(b.totalCost, d.currency));
  } else {
    row("Seller receives", fmt(b.sellerReceives, d.currency), true);
  }
  if (d.settlement_note) row("Settlement", String(d.settlement_note));
  if (payouts.length) {
    section("Payouts from custody");
    for (const p of payouts) row(`#${p.withdrawal_id} · ${p.payout_key} ${p.address.slice(0, 6)}…${p.address.slice(-4)} · ${title(p.status)}`, `${fmt(p.net_usd, "USDT")}${p.tx_hash ? ` · ${p.tx_hash.slice(0, 20)}…` : ""}`);
    doc.font("Helvetica").fontSize(9).fillColor(INK.muted).text("Network fees on these payouts were already covered by the deal (withdrawal fee line above).", { width: W });
  }

  const proof = d.delivery_proof || null;
  if (proof || d.delivery_note) {
    section("Delivery proof");
    if (d.delivery_note) doc.font("Helvetica").fontSize(10.5).fillColor(INK.body).text(String(d.delivery_note), { width: W });
    if (proof?.tracking?.number) row("Tracking", `${proof.tracking.carrier ? `${proof.tracking.carrier} · ` : ""}${proof.tracking.number}`);
    for (const l of (proof?.links as string[]) || []) doc.font("Helvetica").fontSize(10).fillColor(INK.brand).text(l, { link: l, underline: true, width: W });
    const files = attachments.filter((a) => a.context === "delivery");
    if (files.length) row("Files", files.map((f) => f.name).join(", "));
  }

  if (d.dispute_thread && d.dispute_thread.length) {
    section(d.dispute_thread.some((t: any) => t.kind === "cancellation") ? "Cancellation request" : "Dispute");
    if (d.dispute_reason) row("Reason", String(d.dispute_reason));
    row("Stage", title(String(d.dispute_stage || "negotiation")));
    for (const t of d.dispute_thread as any[]) {
      const what = t.type === "open" || t.type === "counter" ? `${t.type}: ${t.outcome}${t.split_percent_seller != null ? ` (seller ${t.split_percent_seller}%)` : ""}` : t.type;
      doc.font("Helvetica").fontSize(9.5).fillColor(INK.body).text(`${when(t.at)} · ${title(String(t.by || "system"))} — ${what}${t.message ? `: ${t.message}` : ""}`, { width: W });
    }
  }

  section("Timeline");
  for (const a of (d.activity_log as any[]) || []) {
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK.text).text(`${when(a.at)}  `, { continued: true });
    doc.font("Helvetica").fillColor(INK.body).text(`${a.note || title(String(a.type))}${a.role ? ` (${a.role})` : ""}`, { width: W });
  }

  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(8.5).fillColor(INK.faint).text(
    `SafeDeal is operated by ${legalName}. Funds are held securely in escrow (in USDT) until the deal completes. This summary reflects the deal record at the time it was generated; the online deal page is the source of truth.`,
    { width: W }
  );
  doc.end();
  return doc;
}


/** Collect a finished PDFKit document (the generators call doc.end() already) into a Buffer for email attachments. */
export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export interface TopupReceiptInput {
  topup: {
    topup_id: number;
    coin: string;
    amount_usd: string | number;
    network_fee_usd: string | number;
    conversion_fee_usd: string | number;
    exchange_fee_usd: string | number;
    pays_usd: string | number;
    crypto_amount: string | null;
    status: string;
    seen_tx?: string | null;
    credited_at?: string | null;
    created_at: string;
  };
  coinLabel: string;
  network: string;
  customerEmail: string;
  legalName: string;
}

/** SafeDeal deposit receipt — a customer's record of a wallet top-up and the fees on it. */
export function generateTopupReceiptPdf({ topup: t, coinLabel, network, customerEmail, legalName }: TopupReceiptInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `SafeDeal deposit receipt DEP-${t.topup_id}` } });
  const W = doc.page.width - 96;
  const credited = t.status === "credited";

  drawBrandHeader(doc, `Deposit receipt DEP-${t.topup_id} · generated ${when(new Date())}`);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK.text).text("Deposit to wallet balance", 48, 84, { width: W });
  doc.font("Helvetica").fontSize(10).fillColor(INK.muted).text(`Issued to: ${customerEmail}`);
  doc.moveDown(0.8);

  const section = (label: string) => {
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK.muted).text(label.toUpperCase(), { characterSpacing: 0.8 });
    doc.moveTo(48, doc.y + 2).lineTo(48 + W, doc.y + 2).strokeColor(INK.hairline).lineWidth(0.7).stroke();
    doc.moveDown(0.5);
  };
  const row = (l: string, v: string, bold = false) => {
    const y = doc.y;
    doc.font("Helvetica").fontSize(10.5).fillColor(INK.body).text(l, 48, y, { width: W * 0.55 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).fillColor(INK.text).text(v, 48 + W * 0.55, y, { width: W * 0.45, align: "right" });
    doc.moveDown(0.25);
  };

  section("Deposit");
  row("Date", when(t.credited_at || t.created_at));
  row("Status", credited ? "Credited to balance" : title(String(t.status)));
  row("Coin & network", `${coinLabel} · ${network}`);
  if (t.crypto_amount) row("You sent", `${t.crypto_amount} ${coinLabel}`);
  if (t.seen_tx) row("Transaction", String(t.seen_tx).slice(0, 40));

  section("Amount & fees");
  row("You sent (gross)", fmt(t.pays_usd));
  const net = Number(t.network_fee_usd || 0);
  const conv = Number(t.conversion_fee_usd || 0);
  const exch = Number(t.exchange_fee_usd || 0);
  if (net > 0) row("Network fee", fmt(net));
  if (conv > 0) row("Conversion fee", fmt(conv));
  if (exch > 0) row("Exchange fee", fmt(exch));
  row("Total fees", fmt(net + conv + exch));
  row(credited ? "Credited to your balance" : "Will be credited", fmt(t.amount_usd), true);

  doc.moveDown(1.2);
  doc.font("Helvetica").fontSize(8.5).fillColor(INK.faint).text(
    `SafeDeal is operated by ${legalName}. Your balance is held securely in escrow (in USDT). Network/exchange fees cover the on-chain cost of moving your deposit into custody; you were credited the full amount you asked to add. This receipt reflects the record at the time it was generated.`,
    { width: W }
  );
  doc.end();
  return doc;
}
