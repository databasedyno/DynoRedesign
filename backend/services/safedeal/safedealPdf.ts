/**
 * SafeDeal deal summary PDF — a party's record of the agreement, money,
 * delivery proof, dispute outcome and full timeline. Text-only (no logo file
 * for SafeDeal); same indigo/grey palette as the invoice chrome.
 */
import PDFDocument from "pdfkit";
import { INK } from "../pdf/invoiceChrome";
import { computeFeeBreakdown } from "../../controller/escrow/escrowShared";
import type { AttachmentPublic } from "./safedealAttachments";

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
}

export function generateDealSummaryPdf({ deal: d, buyerEmail, sellerEmail, attachments, legalName }: DealPdfInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `SafeDeal #${d.escrow_id} — ${d.title}` } });
  const b = computeFeeBreakdown({ amount: d.amount, currency: d.currency, feePercent: d.fee_percent, feeMinUsd: d.fee_min_usd, feePayer: d.fee_payer, payoutCoin: d.seller_payout_coin, fundingCoin: d.funding_coin, acceptedCoins: d.accepted_coins });
  const W = doc.page.width - 96;

  // Brand bar + header
  doc.rect(0, 0, doc.page.width, 6).fill(INK.brand);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(INK.brand).text("SafeDeal", 48, 36);
  doc.font("Helvetica").fontSize(9).fillColor(INK.muted).text(`Escrow deal summary · generated ${when(new Date())}`, 48, 58);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(INK.text).text(d.title, 48, 84, { width: W });
  doc.font("Helvetica").fontSize(10.5).fillColor(INK.body).text(`Deal #${d.escrow_id} · Status: ${title(String(d.status))}${d.deal_type ? ` · Type: ${title(String(d.deal_type))}` : ""}`);
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

  section("Money");
  row("Deal amount", fmt(b.amount, d.currency));
  for (const c of b.costItems || []) row(c.label, fmt(c.amount, d.currency));
  row("Buyer pays", fmt(b.buyerPays, d.currency), true);
  row("Seller receives", fmt(b.sellerReceives, d.currency), true);
  if (d.custody_amount_stable != null) row("Held in custody", `${fmt(d.custody_amount_stable, d.custody_stablecoin || "USDT")}${d.funding_method ? ` · via ${d.funding_method}` : ""}`);
  if (d.settlement_note) row("Settlement", String(d.settlement_note));

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
    `SafeDeal is operated by ${legalName}. Funds are held in USDT by Dynopay until the deal completes. This summary reflects the deal record at the time it was generated; the online deal page is the source of truth.`,
    { width: W }
  );
  doc.end();
  return doc;
}
