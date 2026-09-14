/**
 * Dynopay PDF Receipt Service
 * Generates branded PDF receipts for customer payments
 */

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { t, normalizeLang } from "../utils/emailI18n";
import { formatMoneyForEmail } from "./email/emailShared";
import { renderCurrencyBadgePng } from "../utils/qrCodeWithLogo";
import { getCoinSymbol, getNetworkDisplayName } from "../utils/networkLabels";

// Resolve the white Dynopay logo (used on the dark header/footer bands) once.
const DYNOPAY_LOGO_PATH: string = (() => {
  const candidates = [
    path.join(__dirname, "../assets/dynopay-white-logo.png"),
    path.join(__dirname, "../../assets/dynopay-white-logo.png"),
    path.resolve("/app/backend/assets/dynopay-white-logo.png"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return "";
})();

// PNG (89 50 4E 47) / JPEG (FF D8 FF) are the only raster formats pdfkit embeds.
const isPngOrJpeg = (buf: Buffer): boolean =>
  buf.length > 3 &&
  ((buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff));

/**
 * Load a merchant brand logo into a Buffer (remote URL, data URL, or local path).
 * Never throws — returns null on any failure so the receipt falls back to a
 * monogram badge. Remote fetches are capped at 4s so a slow CDN can't hang the PDF.
 */
const loadImageBuffer = async (src?: string | null): Promise<Buffer | null> => {
  if (!src || typeof src !== "string") return null;
  try {
    if (src.startsWith("data:")) {
      const buf = Buffer.from(src.split(",")[1] || "", "base64");
      return isPngOrJpeg(buf) ? buf : null;
    }
    if (/^https?:\/\//i.test(src)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      try {
        const resp = await fetch(src, { signal: ctrl.signal });
        if (!resp.ok) return null;
        const buf = Buffer.from(await resp.arrayBuffer());
        return isPngOrJpeg(buf) ? buf : null;
      } finally {
        clearTimeout(timer);
      }
    }
    if (fs.existsSync(src)) {
      const buf = fs.readFileSync(src);
      return isPngOrJpeg(buf) ? buf : null;
    }
  } catch {
    /* fall through to null */
  }
  return null;
};

// Brand colors — aligned with the refreshed email template (indigo / near-black)
const BRAND_COLORS = {
  primary: "#4338CA",      // Indigo (matches email CTA + accent bar)
  accent: "#818CF8",       // Indigo-light (wordmark "Pay" on dark bands)
  dark: "#050505",         // Header/footer near-black (matches email header/footer)
  text: "#374151",         // Body text
  lightBg: "#f5f3ff",      // Subtle indigo tint for the amount card
  border: "#e5e7eb",       // Border color / hairlines
};

export interface ReceiptData {
  // Transaction details
  transactionId: string;
  transactionReference?: string;
  
  // Payment details
  amount: string;
  currency: string;
  cryptoAmount?: string;
  cryptoCurrency?: string;
  
  // Merchant details
  companyName: string;
  companyLogo?: string;
  /** True when the merchant is KYC identity-verified — renders a green check on the receipt. */
  merchantVerified?: boolean;
  
  // Customer details
  customerEmail: string;
  customerName?: string;
  
  // Dates
  paymentDate: Date;
  
  // Additional info
  description?: string;
  paymentMethod?: string;
  status?: string;
  // Locale for receipt labels/date formatting (ISO 639-1)
  lang?: string;
  // Exact "merchant receives / Dynopay fee" split (crypto strings, already formatted)
  breakdown?: { merchantReceives: string; platformFee: string; feePayer: "customer" | "company" };
  // Public shareable receipt URL — printed in the footer as "View this receipt online".
  receiptUrl?: string;
}

/**
 * Generate a branded PDF receipt for a payment
 * Returns a Buffer containing the PDF data
 */
export const generatePaymentReceipt = async (data: ReceiptData): Promise<Buffer> => {
  // Resolve the merchant brand logo + coin badge up-front (best-effort) so rendering stays sync.
  const merchantLogoBuf = await loadImageBuffer(data.companyLogo);
  const coinBadge = data.cryptoCurrency ? await renderCurrencyBadgePng(data.cryptoCurrency, 96) : null;
  const coinSymbol = getCoinSymbol(data.cryptoCurrency);
  const networkName = getNetworkDisplayName(data.cryptoCurrency);
  return new Promise((resolve, reject) => {
    try {
      const L = normalizeLang(data.lang);
      const dateLocale = L === "en" ? "en-US" : L;
      // margins.bottom = 0 — pdfkit silently ADDS A PAGE whenever a text run
      // crosses the bottom margin. With the default 50pt margin the footer band
      // (drawn at the very bottom) pushed the receipt across up to 6 pages.
      // Every block below is positioned explicitly and clamped above the footer,
      // so the receipt is always exactly ONE page.
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 50, right: 50 },
        info: {
          Title: `Payment Receipt - ${data.transactionId}`,
          Author: "Dynopay",
          Subject: "Payment Receipt",
          Creator: "Dynopay Payment Gateway",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const PAGE_W = doc.page.width;
      const PAGE_H = doc.page.height;
      const X = 50;
      const W = PAGE_W - 100;
      const FONT = "Helvetica";
      const BOLD = "Helvetica-Bold";
      const MONO = "Courier";
      const MUTED = "#6B7280";
      const FOOTER_H = 92;
      const footerY = PAGE_H - FOOTER_H;
      const CONTENT_BOTTOM = footerY - 14; // nothing may be drawn below this line

      // ---- small drawing helpers -------------------------------------------
      const eyebrow = (text: string, x: number, y: number, color = MUTED, opts: PDFKit.Mixins.TextOptions = {}) =>
        doc.font(BOLD).fontSize(8.5).fillColor(color).text(text.toUpperCase(), x, y, { characterSpacing: 0.8, lineBreak: false, ...opts });
      const sectionTitle = (text: string, y: number) => {
        doc.font(BOLD).fontSize(12).fillColor(BRAND_COLORS.dark).text(text, X, y, { lineBreak: false });
        return y + 20;
      };
      const hairline = (y: number) => doc.moveTo(X, y).lineTo(X + W, y).lineWidth(1).stroke(BRAND_COLORS.border);
      const divider = (y: number) => {
        hairline(y + 10);
        return y + 26;
      };

      // Key/value rows with DYNAMIC height — long blockchain hashes wrap inside
      // their own row (monospace) instead of colliding with the next one.
      const LABEL_W = 140;
      const VALUE_X = X + LABEL_W + 10;
      const VALUE_W = W - LABEL_W - 20;
      type Row = { label: string; value: string; mono?: boolean; note?: string };
      const rowsBlock = (rows: Row[], y: number) => {
        rows.forEach((r, i) => {
          const font = r.mono ? MONO : FONT;
          const size = r.mono ? 9 : 10.5;
          doc.font(font).fontSize(size);
          const h = Math.max(24, doc.heightOfString(r.value, { width: VALUE_W }) + 12);
          if (i % 2 === 0) doc.rect(X, y, W, h).fill("#FAFAFA");
          doc.font(FONT).fontSize(10.5).fillColor(BRAND_COLORS.text).text(r.label, X + 10, y + 6, { width: LABEL_W, lineBreak: false });
          doc.font(font).fontSize(size).fillColor(BRAND_COLORS.dark);
          if (r.note) {
            doc.text(r.value, VALUE_X, y + 6, { width: VALUE_W, continued: true })
              .font(FONT).fontSize(9.5).fillColor(MUTED).text(`  ${r.note}`, { continued: false });
          } else {
            doc.text(r.value, VALUE_X, y + 6 + (r.mono ? 1 : 0), { width: VALUE_W });
          }
          y += h;
        });
        return y;
      };

      // ============================================
      // HEADER — indigo accent bar + near-black band (matches the email chrome)
      // ============================================
      doc.rect(0, 0, PAGE_W, 6).fill(BRAND_COLORS.primary);
      doc.rect(0, 6, PAGE_W, 98).fill(BRAND_COLORS.dark);

      let headerLogoDrawn = false;
      if (DYNOPAY_LOGO_PATH) {
        try {
          doc.image(DYNOPAY_LOGO_PATH, X, 30, { fit: [140, 34] });
          headerLogoDrawn = true;
        } catch {
          /* fall back to the text wordmark below */
        }
      }
      if (!headerLogoDrawn) {
        doc.font(BOLD).fontSize(26).fillColor("#ffffff").text("dyno", X, 34, { continued: true, lineBreak: false })
          .fillColor(BRAND_COLORS.accent).text("pay", { continued: false, lineBreak: false });
      }
      eyebrow(t("receipt.title", L), X, 80, "#C7D2FE");

      const RIGHT_W = 220;
      doc.font(BOLD).fontSize(10).fillColor("#ffffff")
        .text(t("receipt.receiptNo", L, { number: data.transactionId.substring(0, 8).toUpperCase() }), X + W - RIGHT_W, 36, { width: RIGHT_W, align: "right", lineBreak: false });
      const formattedDate = data.paymentDate.toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" });
      doc.font(FONT).fontSize(9.5).fillColor("#9CA3AF")
        .text(formattedDate, X + W - RIGHT_W, 54, { width: RIGHT_W, align: "right", lineBreak: false });

      // ============================================
      // STATUS BANNER — crisp vector check + label (core fonts have no ✓ glyph)
      // ============================================
      const BANNER_Y = 104;
      const BANNER_H = 34;
      doc.rect(0, BANNER_Y, PAGE_W, BANNER_H).fill("#10B981");
      const bannerLabel = t("receipt.successful", L).toUpperCase();
      doc.font(BOLD).fontSize(11.5).fillColor("#ffffff");
      const bannerLabelW = doc.widthOfString(bannerLabel, { characterSpacing: 0.6 });
      const bannerGap = 14;
      const bannerStartX = (PAGE_W - (bannerLabelW + bannerGap)) / 2;
      const bannerTextY = BANNER_Y + 11;
      doc.save();
      doc.lineWidth(2).strokeColor("#ffffff").lineJoin("round").lineCap("round");
      doc.moveTo(bannerStartX, bannerTextY + 6).lineTo(bannerStartX + 3.5, bannerTextY + 9.5).lineTo(bannerStartX + 10, bannerTextY + 2).stroke();
      doc.restore();
      doc.fillColor("#ffffff").text(bannerLabel, bannerStartX + bannerGap, bannerTextY, { characterSpacing: 0.6, lineBreak: false });

      // ============================================
      // AMOUNT CARD
      // ============================================
      let y = BANNER_Y + BANNER_H + 20;
      const CARD_H = 94;
      doc.roundedRect(X, y, W, CARD_H, 10).fillAndStroke(BRAND_COLORS.lightBg, BRAND_COLORS.border);
      eyebrow(t("labels.amountPaid", L), X + 20, y + 16);
      doc.font(BOLD).fontSize(30).fillColor(BRAND_COLORS.primary)
        .text(`${formatMoneyForEmail(data.amount, data.currency)} ${data.currency}`, X + 20, y + 30, { lineBreak: false });
      if (data.cryptoAmount && data.cryptoCurrency) {
        // Coin badge + "0.0031245 BTC · Bitcoin" — reads at a glance which coin/network settled the payment.
        const lineY = y + 66;
        const badgePx = 20;
        let tx = X + 20;
        if (coinBadge) {
          try {
            doc.image(coinBadge, tx, lineY - 3, { width: badgePx, height: badgePx });
            tx += badgePx + 8;
          } catch {
            /* text-only fallback */
          }
        }
        doc.font(BOLD).fontSize(11.5).fillColor(BRAND_COLORS.dark)
          .text(`${formatMoneyForEmail(data.cryptoAmount, data.cryptoCurrency)} ${coinSymbol}`, tx, lineY, { continued: !!networkName, lineBreak: false });
        if (networkName) {
          doc.font(FONT).fontSize(10.5).fillColor(MUTED).text(`  \u00B7  ${networkName}`, { continued: false, lineBreak: false });
        }
      }
      y += CARD_H + 22;

      // ============================================
      // TRANSACTION DETAILS
      // ============================================
      y = sectionTitle(t("receipt.transactionDetails", L), y);
      const details: Row[] = [
        { label: t("labels.transactionId", L), value: data.transactionId, mono: true },
        ...(data.transactionReference ? [{ label: t("labels.reference", L), value: data.transactionReference, mono: true }] : []),
        {
          label: t("receipt.paymentMethod", L),
          value: data.paymentMethod || (data.cryptoCurrency ? `${t("receipt.cryptocurrency", L)} (${networkName ? coinSymbol : data.cryptoCurrency})` : t("receipt.cryptocurrency", L)),
        },
        ...(networkName ? [{ label: t("receipt.network", L), value: networkName }] : []),
        { label: t("labels.status", L), value: data.status || t("receipt.completed", L) },
        {
          label: t("receipt.dateTime", L),
          value: data.paymentDate.toLocaleString(dateLocale, {
            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
          }),
        },
      ];
      y = rowsBlock(details, y);

      // ============================================
      // PAID TO / CUSTOMER
      // ============================================
      y = divider(y);
      const colW = (W - 30) / 2;
      const rightColX = X + colW + 30;

      eyebrow(t("receipt.paidTo", L), X, y);
      const badgeSize = 40;
      const badgeY = y + 16;
      const nameX = X + badgeSize + 12;
      const nameW = colW - badgeSize - 12;

      let brandDrawn = false;
      if (merchantLogoBuf) {
        try {
          doc.save();
          doc.roundedRect(X, badgeY, badgeSize, badgeSize, 10).clip();
          doc.image(merchantLogoBuf, X, badgeY, { cover: [badgeSize, badgeSize], align: "center", valign: "center" });
          doc.restore();
          doc.roundedRect(X, badgeY, badgeSize, badgeSize, 10).lineWidth(1).stroke(BRAND_COLORS.border);
          brandDrawn = true;
        } catch {
          brandDrawn = false;
        }
      }
      if (!brandDrawn) {
        // Monogram fallback — first letter of the brand on a soft indigo tile.
        const letter = ((data.companyName || "M").trim().charAt(0) || "M").toUpperCase();
        doc.roundedRect(X, badgeY, badgeSize, badgeSize, 10).fillAndStroke(BRAND_COLORS.lightBg, BRAND_COLORS.border);
        doc.font(BOLD).fontSize(20).fillColor(BRAND_COLORS.primary).text(letter, X, badgeY + 10, { width: badgeSize, align: "center", lineBreak: false });
      }
      doc.font(BOLD).fontSize(13).fillColor(BRAND_COLORS.dark).text(data.companyName, nameX, badgeY + (data.merchantVerified ? 4 : 12), { width: nameW, lineBreak: false, ellipsis: true });
      if (data.merchantVerified) {
        // Identity-verified marker — drawn green check + localized label (matches the on-screen/email receipts).
        const vy = badgeY + 24;
        doc.save();
        doc.lineWidth(1.6).strokeColor("#12B76A").lineJoin("round").lineCap("round");
        doc.moveTo(nameX, vy + 4).lineTo(nameX + 3.5, vy + 7.5).lineTo(nameX + 9, vy).stroke();
        doc.restore();
        doc.font(FONT).fontSize(9.5).fillColor("#12B76A").text(t("receipt.verifiedMerchant", L), nameX + 14, vy, { lineBreak: false });
      }

      eyebrow(t("labels.customer", L), rightColX, y);
      doc.font(BOLD).fontSize(13).fillColor(BRAND_COLORS.dark)
        .text(data.customerName || data.customerEmail, rightColX, badgeY + (data.customerName ? 4 : 12), { width: colW, lineBreak: false, ellipsis: true });
      if (data.customerName) {
        doc.font(FONT).fontSize(10).fillColor(MUTED).text(data.customerEmail, rightColX, badgeY + 23, { width: colW, lineBreak: false, ellipsis: true });
      }
      y = badgeY + badgeSize;

      // ============================================
      // DESCRIPTION (optional, clamped to two lines so it can never spill)
      // ============================================
      if (data.description && y + 26 + 30 < CONTENT_BOTTOM) {
        y = divider(y);
        eyebrow(t("labels.description", L), X, y);
        doc.font(FONT).fontSize(10.5).fillColor(BRAND_COLORS.text);
        const descH = Math.min(30, doc.heightOfString(data.description, { width: W }));
        doc.text(data.description, X, y + 14, { width: W, height: 30, ellipsis: true });
        y += 14 + descH;
      }

      // "Questions about this purchase? Contact <merchant> directly." — buyers
      // otherwise write to Dynopay for order questions the merchant must answer.
      if (y + 30 < CONTENT_BOTTOM) {
        doc.font(FONT).fontSize(9.5).fillColor(MUTED)
          .text(t("receipt.contactMerchant", L, { company: data.companyName }), X, y + 16, { width: W, lineBreak: false, ellipsis: true });
      }

      // ============================================
      // FOOTER — dark band, localized chrome (same strings as the email footer)
      // ============================================
      doc.rect(0, footerY, PAGE_W, FOOTER_H).fill(BRAND_COLORS.dark);
      let footerLogoDrawn = false;
      if (DYNOPAY_LOGO_PATH) {
        try {
          doc.image(DYNOPAY_LOGO_PATH, X, footerY + 18, { fit: [96, 24] });
          footerLogoDrawn = true;
        } catch {
          /* fall back to the text wordmark */
        }
      }
      if (!footerLogoDrawn) {
        doc.font(BOLD).fontSize(15).fillColor("#ffffff").text("dyno", X, footerY + 20, { continued: true, lineBreak: false })
          .fillColor(BRAND_COLORS.accent).text("pay", { continued: false, lineBreak: false });
      }
      doc.font(FONT).fontSize(9).fillColor("#9CA3AF").text(t("chrome.tagline", L), X, footerY + 50, { lineBreak: false });
      doc.fontSize(8).fillColor(MUTED).text(t("chrome.rights", L, { year: new Date().getFullYear() }), X, footerY + 64, { lineBreak: false });
      doc.fontSize(8).fillColor(MUTED).text(t("receipt.autoGenerated", L), X, footerY + 76, { lineBreak: false });

      doc.fontSize(9).fillColor("#C7D2FE")
        .text("dynopay.com", X + W - RIGHT_W, footerY + 50, { width: RIGHT_W, align: "right", lineBreak: false, link: "https://dynopay.com" })
        .fillColor("#9CA3AF")
        .text(t("chrome.support", L), X + W - RIGHT_W, footerY + 64, { width: RIGHT_W, align: "right", lineBreak: false, link: "https://dynopay.com/help-support" });
      if (data.receiptUrl) {
        doc.fontSize(8.5).fillColor("#C7D2FE")
          .text(t("receipt.viewOnline", L), X + W - RIGHT_W, footerY + 78, { width: RIGHT_W, align: "right", lineBreak: false, link: data.receiptUrl, underline: true });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get receipt filename
 */
export const getReceiptFilename = (transactionId: string): string => {
  const date = new Date().toISOString().split("T")[0];
  return `Dynopay_Receipt_${transactionId.substring(0, 8)}_${date}.pdf`;
};

export default {
  generatePaymentReceipt,
  getReceiptFilename,
};
