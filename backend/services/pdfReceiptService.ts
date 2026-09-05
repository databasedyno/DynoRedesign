/**
 * Dynopay PDF Receipt Service
 * Generates branded PDF receipts for customer payments
 */

import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import { t, normalizeLang } from "../utils/emailI18n";
import { formatMoneyForEmail } from "./email/emailShared";

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
  border: "#e5e7eb",       // Border color
};

interface ReceiptData {
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
}

/**
 * Generate a branded PDF receipt for a payment
 * Returns a Buffer containing the PDF data
 */
export const generatePaymentReceipt = async (data: ReceiptData): Promise<Buffer> => {
  // Resolve the merchant brand logo up-front (best-effort) so rendering stays sync.
  const merchantLogoBuf = await loadImageBuffer(data.companyLogo);
  return new Promise((resolve, reject) => {
    try {
      const L = normalizeLang(data.lang);
      const dateLocale = L === "en" ? "en-US" : L;
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
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

      const pageWidth = doc.page.width - 100; // Account for margins

      // ============================================
      // HEADER SECTION
      // ============================================
      
      // Indigo accent bar (matches the email template's neon top bar)
      doc.rect(0, 0, doc.page.width, 6).fill(BRAND_COLORS.primary);
      // Header background (near-black, matches the email header band)
      doc.rect(0, 6, doc.page.width, 114).fill(BRAND_COLORS.dark);

      // Dynopay logo (white wordmark on the dark band) — falls back to text.
      let headerLogoDrawn = false;
      if (DYNOPAY_LOGO_PATH) {
        try {
          doc.image(DYNOPAY_LOGO_PATH, 50, 40, { fit: [150, 38] });
          headerLogoDrawn = true;
        } catch {
          /* fall back to the text wordmark below */
        }
      }
      if (!headerLogoDrawn) {
        doc.fontSize(28)
          .fillColor("#ffffff")
          .text("Dyno", 50, 45, { continued: true })
          .fillColor(BRAND_COLORS.accent)
          .text("Pay", { continued: false });
      }

      // Receipt label
      doc.fontSize(12)
        .fillColor("#ffffff")
        .text(t("receipt.title", L), 50, 88);

      // Receipt number on right
      doc.fontSize(10)
        .fillColor("#ffffff")
        .text(t("receipt.receiptNo", L, { number: data.transactionId.substring(0, 8).toUpperCase() }), 400, 50, { align: "right", width: 150 });

      // Date on right
      const formattedDate = data.paymentDate.toLocaleDateString(dateLocale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(formattedDate, 400, 70, { align: "right", width: 150 });

      // ============================================
      // STATUS BANNER
      // ============================================
      doc.rect(0, 120, doc.page.width, 40).fill("#10b981"); // Green for success
      // Draw a crisp vector check + centered label (pdfkit's core font can't
      // render a ✓ glyph — the old \u2713 rendered as a stray apostrophe).
      const bannerLabel = t("receipt.successful", L);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#ffffff");
      const bannerLabelW = doc.widthOfString(bannerLabel);
      const bannerGap = 13;
      const bannerStartX = (doc.page.width - (bannerLabelW + bannerGap)) / 2;
      const bannerTextY = 132;
      doc.save();
      doc.lineWidth(2).strokeColor("#ffffff").lineJoin("round").lineCap("round");
      doc
        .moveTo(bannerStartX, bannerTextY + 8)
        .lineTo(bannerStartX + 4, bannerTextY + 12)
        .lineTo(bannerStartX + 10, bannerTextY + 3)
        .stroke();
      doc.restore();
      doc.fillColor("#ffffff").text(bannerLabel, bannerStartX + bannerGap, bannerTextY);
      doc.font("Helvetica");

      // ============================================
      // MAIN CONTENT
      // ============================================
      let yPos = 190;

      // Payment Amount Section
      doc.roundedRect(50, yPos, pageWidth, 100, 8)
        .fillAndStroke(BRAND_COLORS.lightBg, BRAND_COLORS.border);

      doc.fontSize(12)
        .fillColor(BRAND_COLORS.text)
        .text(t("receipt.amountPaid", L), 70, yPos + 15);

      doc.fontSize(36)
        .fillColor(BRAND_COLORS.primary)
        .text(`${formatMoneyForEmail(data.amount, data.currency)} ${data.currency}`, 70, yPos + 35);

      if (data.cryptoAmount && data.cryptoCurrency) {
        doc.fontSize(14)
          .fillColor(BRAND_COLORS.text)
          .text(t("receipt.crypto", L, { amount: formatMoneyForEmail(data.cryptoAmount, data.cryptoCurrency), currency: data.cryptoCurrency }), 70, yPos + 75);
      }

      yPos += 120;

      // ============================================
      // TRANSACTION DETAILS
      // ============================================
      doc.fontSize(14)
        .fillColor(BRAND_COLORS.primary)
        .text(t("receipt.transactionDetails", L), 50, yPos);

      yPos += 25;

      // Details table
      const details = [
        { label: t("receipt.transactionId", L), value: data.transactionId },
        ...(data.transactionReference ? [{ label: t("receipt.reference", L), value: data.transactionReference }] : []),
        { label: t("receipt.paymentMethod", L), value: data.paymentMethod || t("receipt.cryptocurrency", L) },
        { label: t("receipt.status", L), value: data.status || t("receipt.completed", L) },
        { label: t("receipt.dateTime", L), value: data.paymentDate.toLocaleString(dateLocale, {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        })},
      ];

      details.forEach((item, index) => {
        const rowY = yPos + (index * 30);
        
        // Alternating background
        if (index % 2 === 0) {
          doc.rect(50, rowY - 5, pageWidth, 28).fill("#fafafa");
        }
        
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.text)
          .text(item.label, 60, rowY + 3);
        
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.dark)
          .text(item.value, 250, rowY + 3, { width: 280, align: "left" });
      });

      yPos += details.length * 30 + 20;

      // ============================================
      // PAYMENT BREAKDOWN (you paid / merchant receives / Dynopay fee)
      // ============================================
      if (data.breakdown) {
        doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke(BRAND_COLORS.border);
        yPos += 20;
        doc.fontSize(14).fillColor(BRAND_COLORS.primary).text(t("receipt.breakdown", L), 50, yPos);
        yPos += 25;
        const feeNote = t(data.breakdown.feePayer === "customer" ? "receipt.feePaidByCustomer" : "receipt.feePaidByMerchant", L);
        const paidValue = data.cryptoAmount && data.cryptoCurrency
          ? `${formatMoneyForEmail(data.cryptoAmount, data.cryptoCurrency)} ${data.cryptoCurrency}`
          : `${formatMoneyForEmail(data.amount, data.currency)} ${data.currency}`;
        const rows = [
          { label: t("receipt.youPaid", L), value: paidValue },
          { label: t("receipt.merchantReceives", L), value: data.breakdown.merchantReceives },
          { label: t("receipt.platformFee", L), value: `${data.breakdown.platformFee}  (${feeNote})` },
        ];
        rows.forEach((item, index) => {
          const rowY = yPos + index * 30;
          if (index % 2 === 0) doc.rect(50, rowY - 5, pageWidth, 28).fill("#fafafa");
          doc.fontSize(11).fillColor(BRAND_COLORS.text).text(item.label, 60, rowY + 3);
          doc.fontSize(11).fillColor(BRAND_COLORS.dark).text(item.value, 250, rowY + 3, { width: 280, align: "left" });
        });
        yPos += rows.length * 30 + 20;
      }

      // ============================================
      // MERCHANT & CUSTOMER INFO
      // ============================================
      doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke(BRAND_COLORS.border);
      yPos += 20;

      // Two columns
      const colWidth = (pageWidth - 30) / 2;

      // Merchant column — brand logo badge + name (premium "Paid to" block)
      doc.fontSize(12)
        .fillColor(BRAND_COLORS.primary)
        .text(t("receipt.paidTo", L), 50, yPos);

      const badgeSize = 42;
      const badgeX = 50;
      const badgeY = yPos + 18;
      const nameX = badgeX + badgeSize + 12;
      const nameW = colWidth - badgeSize - 12;

      let brandDrawn = false;
      if (merchantLogoBuf) {
        try {
          doc.save();
          doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 11).clip();
          doc.image(merchantLogoBuf, badgeX, badgeY, {
            cover: [badgeSize, badgeSize],
            align: "center",
            valign: "center",
          });
          doc.restore();
          doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 11)
            .lineWidth(1)
            .stroke(BRAND_COLORS.border);
          brandDrawn = true;
        } catch {
          brandDrawn = false;
        }
      }
      if (!brandDrawn) {
        // Monogram fallback — first letter of the brand on a soft indigo tile.
        const letter = ((data.companyName || "M").trim().charAt(0) || "M").toUpperCase();
        doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 11)
          .fillAndStroke(BRAND_COLORS.lightBg, BRAND_COLORS.border);
        doc.fontSize(21)
          .font("Helvetica-Bold")
          .fillColor(BRAND_COLORS.primary)
          .text(letter, badgeX, badgeY + 11, { width: badgeSize, align: "center" })
          .font("Helvetica");
      }

      doc.fontSize(14)
        .fillColor(BRAND_COLORS.dark)
        .text(data.companyName, nameX, badgeY + 8, { width: nameW });

      // Identity-verified marker — a small drawn green check (pdfkit's default
      // font can't render a ✓ glyph) + localized label, matching the on-screen
      // and email receipts. Only shown for a KYC-verified merchant.
      if (data.merchantVerified) {
        const vy = badgeY + 27;
        doc.save();
        doc.lineWidth(1.6).strokeColor("#12B76A").lineJoin("round").lineCap("round");
        doc.moveTo(nameX, vy + 4).lineTo(nameX + 3.5, vy + 7.5).lineTo(nameX + 9, vy).stroke();
        doc.restore();
        doc.fontSize(10)
          .fillColor("#12B76A")
          .text(t("receipt.verifiedMerchant", L), nameX + 14, vy);
        doc.fillColor(BRAND_COLORS.text);
      }

      // Customer column
      doc.fontSize(12)
        .fillColor(BRAND_COLORS.primary)
        .text(t("receipt.customer", L), 50 + colWidth + 30, yPos);
      
      doc.fontSize(14)
        .fillColor(BRAND_COLORS.dark)
        .text(data.customerName || data.customerEmail, 50 + colWidth + 30, yPos + 20);

      if (data.customerName) {
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.text)
          .text(data.customerEmail, 50 + colWidth + 30, yPos + 40);
      }

      yPos += 80;

      // ============================================
      // DESCRIPTION (if provided)
      // ============================================
      if (data.description) {
        doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke(BRAND_COLORS.border);
        yPos += 20;

        doc.fontSize(12)
          .fillColor(BRAND_COLORS.primary)
          .text(t("receipt.description", L), 50, yPos);
        
        doc.fontSize(11)
          .fillColor(BRAND_COLORS.text)
          .text(data.description, 50, yPos + 20, { width: pageWidth });

        yPos += 60;
      }

      // ============================================
      // FOOTER
      // ============================================
      const footerY = doc.page.height - 120;

      doc.rect(0, footerY, doc.page.width, 120).fill(BRAND_COLORS.dark);

      let footerLogoDrawn = false;
      if (DYNOPAY_LOGO_PATH) {
        try {
          doc.image(DYNOPAY_LOGO_PATH, 50, footerY + 22, { fit: [112, 30] });
          footerLogoDrawn = true;
        } catch {
          /* fall back to the text wordmark */
        }
      }
      if (!footerLogoDrawn) {
        doc.fontSize(16)
          .fillColor("#ffffff")
          .text("Dyno", 50, footerY + 25, { continued: true })
          .fillColor(BRAND_COLORS.accent)
          .text("Pay", { continued: false });
      }

      doc.fontSize(10)
        .fillColor("#9ca3af")
        .text(t("receipt.tagline", L), 50, footerY + 50);

      doc.fontSize(9)
        .fillColor("#9ca3af")
        .text(t("receipt.rights", L, { year: new Date().getFullYear() }), 50, footerY + 70);

      doc.text(t("receipt.autoGenerated", L), 50, footerY + 85);

      // Links on right
      doc.fontSize(9)
        .fillColor("#9ca3af")
        .text("dynopay.com", 400, footerY + 50, { align: "right", width: 150, link: "https://dynopay.com" })
        .text("Help & Support", 400, footerY + 65, { align: "right", width: 150, link: "https://dynopay.com/help-support" });

      // End document
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
