/**
 * Invoice PDF chrome — brand palette, logo lookup, header (title / number /
 * date / PAID stamp) and footer. Pure drawing helpers with NO money math, so
 * services/pdfService.ts can stay focused on the invoice body + FX logic
 * (and under the 500-line budget for new backend files).
 */
import path from "path";
import fs from "fs";
import { t } from "../../utils/emailI18n";

/** Brand palette — aligned with the PDF receipt + email chrome (indigo / greys). */
export const INK = {
  brand: "#4338CA",   // indigo accent (links, top bar)
  text: "#111827",    // primary text
  body: "#374151",    // secondary text
  muted: "#6B7280",   // eyebrows / notes
  faint: "#9CA3AF",   // footer meta
  hairline: "#E5E7EB",
  paidBg: "#ECFDF5",
  paidInk: "#047857",
  paidLine: "#10B981",
};

/** Uppercase, letter-spaced eyebrow options shared by the table header. */
export const EYEBROW = { characterSpacing: 0.7, lineBreak: false } as const;

/** First existing Dynopay logo path (bundled asset), or "" when none is found. */
export const resolveDynopayLogoPath = (): string => {
  const candidates = [
    path.join(__dirname, "../../assets/dynopay-logo.png"),
    path.join(__dirname, "../../../assets/dynopay-logo.png"),
    path.resolve("/app/backend/assets/dynopay-logo.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "";
};

/**
 * Top accent bar + logo. Returns the Y where the provider block may start
 * (below the logo when one was drawn).
 */
export const drawInvoiceBrandBar = (doc: PDFKit.PDFDocument): number => {
  // Indigo accent bar (matches the receipt + email top bar)
  doc.rect(0, 0, doc.page.width, 6).fill(INK.brand).fillColor(INK.text);

  let logoY = 50;
  const logoPath = resolveDynopayLogoPath();
  if (logoPath) {
    try {
      // `fit` preserves the source aspect ratio inside a 120×42 box — crisp 3:1 logo on print and screen.
      doc.image(logoPath, 50, 50, { fit: [120, 42] });
      logoY = 95;
    } catch (err) {
      console.error("Error adding logo to PDF:", err);
    }
  }
  return logoY;
};

/**
 * Right-aligned header: INVOICE title, number, date — and for post-settlement
 * (v2) invoices a PAID stamp, because the fee was already collected from the
 * transaction proceeds (the old "Payment due upon receipt" read like an open bill).
 */
export const drawInvoiceHeader = (
  doc: PDFKit.PDFDocument,
  L: string,
  opts: { invoiceNumber: string; dateLabel: string; settled: boolean }
): void => {
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .fillColor(INK.text)
    .text(t("invoice.title", L), 50, 50, { align: "right" })
    .fontSize(10)
    .font("Helvetica")
    .fillColor(INK.body)
    .text(t("invoice.number", L, { number: opts.invoiceNumber }), 50, 80, { align: "right" })
    .text(t("invoice.date", L, { date: opts.dateLabel }), 50, 95, { align: "right" })
    .fillColor(INK.text);

  if (opts.settled) {
    const paidLabel = t("invoice.paid", L).toUpperCase();
    doc.font("Helvetica-Bold").fontSize(8.5);
    const pillW = doc.widthOfString(paidLabel, { characterSpacing: 0.8 }) + 22;
    const pillX = 550 - pillW;
    const pillY = 113;
    doc.roundedRect(pillX, pillY, pillW, 18, 9).lineWidth(1).fillAndStroke(INK.paidBg, INK.paidLine);
    doc.fillColor(INK.paidInk).text(paidLabel, pillX, pillY + 5, { width: pillW, align: "center", characterSpacing: 0.8, lineBreak: false });
    doc.font("Helvetica").fillColor(INK.text);
  }
};

/** Provider ("From") block with the Dynopay legal name + clickable domain. */
export const drawInvoiceProvider = (doc: PDFKit.PDFDocument, L: string, startY: number): void => {
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(t("invoice.from", L), 50, startY)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Dynopay Innovations, LTD", 50, startY + 20)
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(INK.brand)
    .text("dynopay.com", 50, startY + 35, { link: "https://dynopay.com" })
    .fillColor(INK.text);
};

/** Centered footer: transaction reference, thank-you line, brand link. */
export const drawInvoiceFooter = (doc: PDFKit.PDFDocument, L: string, transactionId: number | string): void => {
  const footerY = 730;
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#999999")
    .text(t("invoice.transactionReference", L, { id: transactionId }), 50, footerY, { align: "center" })
    .fontSize(9)
    .fillColor("#333333")
    .text(t("invoice.thankYou", L), 50, footerY + 20, { align: "center" })
    .fontSize(8)
    .fillColor(INK.brand)
    .text("Dynopay \u00B7 dynopay.com", 50, footerY + 35, { align: "center", link: "https://dynopay.com" })
    .fillColor("#000000");
};
