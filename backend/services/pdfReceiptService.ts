/**
 * Dynopay PDF Receipt Service
 * Generates branded PDF receipts for customer payments
 */

import PDFDocument from "pdfkit";
import path from "path";
import { t, normalizeLang } from "../utils/emailI18n";

// Logo configuration - using local asset
// LOGO_PATH and LOGO_URL removed - not used

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
}

/**
 * Generate a branded PDF receipt for a payment
 * Returns a Buffer containing the PDF data
 */
export const generatePaymentReceipt = async (data: ReceiptData): Promise<Buffer> => {
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

      // Dynopay Logo/Text
      doc.fontSize(28)
        .fillColor("#ffffff")
        .text("Dyno", 50, 45, { continued: true })
        .fillColor(BRAND_COLORS.accent)
        .text("Pay", { continued: false });

      // Receipt label
      doc.fontSize(12)
        .fillColor("#ffffff")
        .text(t("receipt.title", L), 50, 80);

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
      doc.fontSize(14)
        .fillColor("#ffffff")
        .text(`\u2713 ${t("receipt.successful", L)}`, 50, 132, { align: "center", width: pageWidth });

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
        .text(`${data.amount} ${data.currency}`, 70, yPos + 35);

      if (data.cryptoAmount && data.cryptoCurrency) {
        doc.fontSize(14)
          .fillColor(BRAND_COLORS.text)
          .text(t("receipt.crypto", L, { amount: data.cryptoAmount, currency: data.cryptoCurrency }), 70, yPos + 75);
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
      // MERCHANT & CUSTOMER INFO
      // ============================================
      doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).stroke(BRAND_COLORS.border);
      yPos += 20;

      // Two columns
      const colWidth = (pageWidth - 30) / 2;

      // Merchant column
      doc.fontSize(12)
        .fillColor(BRAND_COLORS.primary)
        .text(t("receipt.paidTo", L), 50, yPos);
      
      doc.fontSize(14)
        .fillColor(BRAND_COLORS.dark)
        .text(data.companyName, 50, yPos + 20);

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

      doc.fontSize(16)
        .fillColor("#ffffff")
        .text("Dyno", 50, footerY + 25, { continued: true })
        .fillColor(BRAND_COLORS.accent)
        .text("Pay", { continued: false });

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
