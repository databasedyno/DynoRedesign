import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

interface InvoiceData {
  invoice_number: string;
  invoice_date: Date;
  provider_name: string;
  provider_address: string;
  provider_vat_id: string;
  customer_name: string;
  customer_address: string;
  customer_tax_id: string;
  description: string;
  unit_price: number;
  quantity: number;
  vat_rate: number;
  vat_amount: number;
  fixed_fee: number;
  transaction_fee_percent: number;
  blockchain_buffer_percent: number;
  total_usd: number;
  total_amount?: number; // Amount in base_currency (if different from USD)
  base_currency?: string; // Base currency code (e.g., EUR, GBP)
  total_crypto: number;
  crypto_currency: string;
  payment_terms: string;
  transaction_id: number;
  // Session 36 v2 fields — optional so legacy v1 callers still type-check.
  transaction_amount?: number | string;
  invoice_version?: string;
  // "Fiat Everywhere Invoice PDF" — the merchant's chosen DISPLAY currency
  // (Settings → Payments: USD/EUR/GBP/NGN/CAD/AUD) + the USD→display FX rate
  // resolved by the caller. When present, all USD-canonical monetary values
  // (unit_price, vat_amount, fixed_fee, total_usd, transaction_amount) are
  // multiplied by the rate before rendering and the display currency's
  // symbol/code appear on every money line so the invoice reads end-to-end
  // in the merchant's currency. When absent, falls back to the legacy
  // `base_currency`/`total_amount` behaviour so old callers still work.
  display_currency?: string;
  usd_to_display_rate?: number;
}

/**
 * Get currency symbol for a given currency code
 */
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'CHF ',
    CNY: '¥', JPY: '¥', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$',
    BRL: 'R$', NGN: '₦', ZAR: 'R', KES: 'KSh', MXN: 'MX$'
  };
  return symbols[currency?.toUpperCase()] || '';
};

/**
 * Generate PDF invoice
 * @param invoiceData - Invoice data to generate PDF from
 * @returns PDFKit.PDFDocument stream
 */
export const generateInvoicePDF = (invoiceData: InvoiceData): PDFKit.PDFDocument => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  // "Fiat Everywhere Invoice PDF" — prefer the merchant's chosen DISPLAY
  // currency (Settings → Payments) when the caller supplies it. All stored
  // monetary values on the invoice row (`unit_price`, `vat_amount`,
  // `fixed_fee`, `total_usd`, `transaction_amount`) are USD-canonical, so
  // we multiply by the supplied USD→display rate before rendering. When
  // no display currency is passed we fall back to the legacy
  // `base_currency` / `total_amount` behaviour so callers that pre-date
  // this feature continue to render invoices identically.
  const useDisplay =
    typeof invoiceData.display_currency === "string" &&
    invoiceData.display_currency.length > 0 &&
    typeof invoiceData.usd_to_display_rate === "number" &&
    invoiceData.usd_to_display_rate > 0;
  const displayCurrency = useDisplay
    ? (invoiceData.display_currency as string).toUpperCase()
    : invoiceData.base_currency || "USD";
  const fxRate = useDisplay
    ? (invoiceData.usd_to_display_rate as number)
    : 1;

  // Legacy fallback for the "grand total" line item — only used when no
  // display-currency override is supplied.
  const legacyDisplayAmount = invoiceData.total_amount || invoiceData.total_usd;

  // Helper function to format currency. When useDisplay is on AND the
  // caller is rendering in the merchant's display currency (the default),
  // we multiply the USD-canonical value by the FX rate so the whole
  // invoice reads in EUR/GBP/etc. Callers can still pass an explicit
  // `currency` argument (e.g. a crypto code) to bypass the conversion.
  const formatCurrency = (
    amount: number | string,
    currency: string = displayCurrency
  ): string => {
    const symbol = getCurrencySymbol(currency);
    const numAmount =
      typeof amount === "string" ? parseFloat(amount) || 0 : amount;
    const finalAmount =
      useDisplay && currency.toUpperCase() === displayCurrency.toUpperCase()
        ? numAmount * fxRate
        : numAmount;
    return `${symbol}${finalAmount.toFixed(2)} ${currency}`;
  };

  // Helper function to format date
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // --- Add Dynopay Logo ---
  // Try multiple possible logo locations
  const possibleLogoPaths = [
    path.join(__dirname, "../assets/dynopay-logo.png"),
    path.join(__dirname, "../../assets/dynopay-logo.png"),
    path.resolve("/app/backend/assets/dynopay-logo.png"),
  ];
  
  let logoPath = "";
  for (const p of possibleLogoPaths) {
    if (fs.existsSync(p)) {
      logoPath = p;
      break;
    }
  }
  
  let logoY = 50;
  if (logoPath) {
    try {
      // Use `fit` so pdfkit preserves the source aspect ratio inside the box
      // (avoids any subtle stretching that would re-introduce a fuzzy look).
      // The bbox is 120×42 — gives a crisp 3:1 logo on print and screen.
      doc.image(logoPath, 50, 50, { fit: [120, 42] });
      logoY = 95; // Adjust starting position after logo
    } catch (err) {
      console.error("Error adding logo to PDF:", err);
    }
  }

  // --- Header (INVOICE - right aligned) ---
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .text("INVOICE", 50, 50, { align: "right" })
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice #: ${invoiceData.invoice_number}`, 50, 80, { align: "right" })
    .text(`Date: ${formatDate(invoiceData.invoice_date)}`, 50, 95, {
      align: "right",
    });

  // --- Provider (From) with full Dynopay branding ---
  const providerStartY = logoY + 20;
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("From:", 50, providerStartY)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("Dynotech Innovations, LDA", 50, providerStartY + 20)
    .fontSize(9)
    .font("Helvetica")
    .text("Rua Luís de Camões 1017, 7° Dt°", 50, providerStartY + 35)
    .text("Montijo 2870-154", 50, providerStartY + 48)
    .text("Portugal", 50, providerStartY + 61)
    .text("VAT ID: PT518713130", 50, providerStartY + 74)
    .font("Helvetica-Bold")
    .fillColor("#1976D2")
    .text("Dynopay.com", 50, providerStartY + 87)
    .fillColor("#000000");

  // --- Customer (Bill To) ---
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("Bill To:", 320, providerStartY)
    .fontSize(10)
    .font("Helvetica")
    .text(invoiceData.customer_name, 320, providerStartY + 20);

  // Parse and display customer address properly
  const customerAddressLines = invoiceData.customer_address.split("\n").filter(Boolean);
  let customerAddressY = providerStartY + 35;
  customerAddressLines.forEach((line, index) => {
    doc.fontSize(9).text(line.trim(), 320, customerAddressY + (index * 13), { width: 230 });
  });

  // Add Tax ID if provided
  if (invoiceData.customer_tax_id) {
    const taxIdY = providerStartY + 35 + (customerAddressLines.length * 13) + 5;
    doc.fontSize(9).text(`Tax ID: ${invoiceData.customer_tax_id}`, 320, taxIdY);
  }

  // --- Separator Line ---
  const lineY = providerStartY + 120;
  doc
    .strokeColor("#CCCCCC")
    .moveTo(50, lineY)
    .lineTo(550, lineY)
    .stroke()
    .strokeColor("#000000");

  // --- Table Header ---
  const tableTop = lineY + 20;
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("Description", 50, tableTop)
    .text("Qty", 300, tableTop, { width: 50, align: "right" })
    .text("Price", 360, tableTop, { width: 80, align: "right" })
    .text("Amount", 460, tableTop, { width: 90, align: "right" });

  // --- Table Header Line ---
  doc
    .strokeColor("#CCCCCC")
    .moveTo(50, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke()
    .strokeColor("#000000");

  // --- Line Items ---
  let yPosition = tableTop + 30;
  const numUnitPrice = typeof invoiceData.unit_price === 'string' ? parseFloat(invoiceData.unit_price) || 0 : invoiceData.unit_price;
  const numQuantity = typeof invoiceData.quantity === 'string' ? parseInt(invoiceData.quantity) || 1 : invoiceData.quantity;

  // Session 36 v2 invoices carry the gross transaction amount as a separate
  // field so we can render it as a small INFORMATIONAL context row above
  // the actual service-fee line item — legally clearer + easier to reconcile.
  const isV2 = invoiceData.invoice_version === "v2";
  const numTxAmount = typeof invoiceData.transaction_amount === "string"
    ? (parseFloat(invoiceData.transaction_amount) || 0)
    : (invoiceData.transaction_amount || 0);

  if (isV2 && numTxAmount > 0) {
    // Context row: "Underlying transaction (not billed): $X.XX"
    doc
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#888888")
      .text(
        `Underlying transaction (context, not billed): ${formatCurrency(numTxAmount)}`,
        50,
        yPosition,
        { width: 500 }
      )
      .fillColor("#000000")
      .font("Helvetica");
    yPosition += 20;
  }

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#333333")
    .text(invoiceData.description, 50, yPosition, { width: 240 })
    .fillColor("#000000")
    .text(numQuantity.toString(), 300, yPosition, {
      width: 50,
      align: "right",
    })
    .text(formatCurrency(numUnitPrice), 360, yPosition, {
      width: 80,
      align: "right",
    })
    .text(
      formatCurrency(numUnitPrice * numQuantity),
      460,
      yPosition,
      { width: 90, align: "right" }
    );

  yPosition += 30;

  // --- Processing Fee Row (Transaction Fee) ---
  const numTxFeePercent = typeof invoiceData.transaction_fee_percent === 'string' ? parseFloat(invoiceData.transaction_fee_percent) || 0 : invoiceData.transaction_fee_percent;
  const numFixedFee = typeof invoiceData.fixed_fee === 'string' ? parseFloat(invoiceData.fixed_fee) || 0 : invoiceData.fixed_fee;
  // v2: the Transaction Fee row would double-count — unit_price IS the fee.
  // Keep the breakdown row only for legacy v1 invoices.
  if (!isV2 && (numTxFeePercent > 0 || numFixedFee > 0)) {
    const txFeeAmount = numTxFeePercent > 0 
      ? (numUnitPrice * numTxFeePercent) / 100 
      : 0;
    const totalTransactionFee = numFixedFee + txFeeAmount;
    
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Transaction Fee (${numTxFeePercent}%)`, 50, yPosition, { width: 240 })
      .fillColor("#000000")
      .text(
        formatCurrency(totalTransactionFee),
        460,
        yPosition,
        { width: 90, align: "right" }
      );
    yPosition += 20;
  } else if (isV2 && (numTxFeePercent > 0 || numFixedFee > 0)) {
    // v2: show the fee breakdown as a small greyed subtitle beneath the
    // line item (fixed + % component) so the merchant sees what's inside
    // their "processing service" line — but with NO amount in the money
    // column, since it's already summed into unit_price.
    const txFeeAmount = numTxFeePercent > 0
      ? (numTxAmount * numTxFeePercent) / 100
      : 0;
    doc
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#888888")
      .text(
        `  = Fixed ${formatCurrency(numFixedFee)} + ${numTxFeePercent}% of ${formatCurrency(numTxAmount)} (${formatCurrency(txFeeAmount)})`,
        50,
        yPosition,
        { width: 400 }
      )
      .font("Helvetica")
      .fillColor("#000000");
    yPosition += 18;
  }

  // --- Blockchain Buffer Row ---
  const numBlockchainBuffer = typeof invoiceData.blockchain_buffer_percent === 'string' ? parseFloat(invoiceData.blockchain_buffer_percent) || 0 : invoiceData.blockchain_buffer_percent;
  if (numBlockchainBuffer > 0) {
    const bufferAmount = (numUnitPrice * numBlockchainBuffer) / 100;
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text(`Blockchain Buffer (${numBlockchainBuffer}%)`, 50, yPosition, { width: 240 })
      .fillColor("#000000")
      .text(
        formatCurrency(bufferAmount),
        460,
        yPosition,
        { width: 90, align: "right" }
      );
    yPosition += 20;
  }

  // --- Subtotal ---
  yPosition += 15;
  // When useDisplay is on we always want the subtotal math to happen in
  // USD-canonical space (then formatCurrency will convert) so we ignore
  // the legacy `total_amount` (which may already be in a different
  // base_currency and not represent the merchant's display preference).
  const numDisplayAmount =
    useDisplay
      ? (typeof invoiceData.total_usd === "string"
          ? parseFloat(invoiceData.total_usd) || 0
          : invoiceData.total_usd || 0)
      : (typeof legacyDisplayAmount === "string"
          ? parseFloat(legacyDisplayAmount) || 0
          : legacyDisplayAmount || 0);
  const numVatAmount = typeof invoiceData.vat_amount === 'string' ? parseFloat(invoiceData.vat_amount) || 0 : invoiceData.vat_amount;
  // v2: subtotal = unit_price × qty (the service fee itself). v1 legacy math
  // used total_usd − vat which was internally inconsistent when total_usd
  // didn't include the % fee (pre-session-36 rows). Both branches now
  // produce a subtotal that matches the visible line items.
  const subtotal = isV2
    ? numUnitPrice * numQuantity
    : numDisplayAmount - numVatAmount;
  doc
    .strokeColor("#CCCCCC")
    .moveTo(360, yPosition)
    .lineTo(550, yPosition)
    .stroke()
    .strokeColor("#000000");
  
  yPosition += 10;
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#000000")
    .text("Subtotal:", 360, yPosition, { width: 90, align: "right" })
    .text(formatCurrency(subtotal), 460, yPosition, {
      width: 90,
      align: "right",
    });

  // --- VAT ---
  if (numVatAmount > 0) {
    yPosition += 20;
    const numVatRate = typeof invoiceData.vat_rate === 'string' ? parseFloat(invoiceData.vat_rate) || 0 : invoiceData.vat_rate;
    doc
      .fontSize(10)
      .text(`VAT (${numVatRate}%):`, 360, yPosition, {
        width: 90,
        align: "right",
      })
      .text(formatCurrency(numVatAmount), 460, yPosition, {
        width: 90,
        align: "right",
      });
  }

  // --- Total Line ---
  yPosition += 20;
  doc
    .strokeColor("#000000")
    .lineWidth(2)
    .moveTo(360, yPosition)
    .lineTo(550, yPosition)
    .stroke()
    .lineWidth(1)
    .strokeColor("#000000");

  // --- Total (Amount Due) ---
  yPosition += 12;
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("Total Amount:", 360, yPosition, { width: 90, align: "right" })
    .text(formatCurrency(numDisplayAmount), 460, yPosition, {
      width: 90,
      align: "right",
    });

  // --- Crypto Equivalent ---
  if (invoiceData.total_crypto && invoiceData.crypto_currency) {
    yPosition += 22;
    const numTotalCrypto = typeof invoiceData.total_crypto === 'string' ? parseFloat(invoiceData.total_crypto) || 0 : invoiceData.total_crypto;
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("Crypto Equivalent:", 360, yPosition, { width: 90, align: "right" })
      .text(
        `${numTotalCrypto.toFixed(8)} ${invoiceData.crypto_currency}`,
        460,
        yPosition,
        { width: 90, align: "right" }
      )
      .fillColor("#000000");
  }

  // --- Payment Terms ---
  yPosition += 50;
  if (yPosition > 650) {
    // Add new page if needed
    doc.addPage();
    yPosition = 50;
  }

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#000000")
    .text("Payment Terms:", 50, yPosition)
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#333333")
    .text(invoiceData.payment_terms, 50, yPosition + 18, { width: 500 })
    .fillColor("#000000");

  // --- Footer ---
  const footerY = 730;
  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#999999")
    .text(
      `Transaction Reference: ${invoiceData.transaction_id}`,
      50,
      footerY,
      { align: "center" }
    )
    .fontSize(9)
    .fillColor("#333333")
    .text("Thank you for your business!", 50, footerY + 20, { align: "center" })
    .fontSize(8)
    .fillColor("#1976D2")
    .text("Powered by Dynopay - dynopay.com", 50, footerY + 35, { align: "center" })
    .fillColor("#000000");

  // Finalize PDF
  doc.end();

  return doc;
};

export default {
  generateInvoicePDF,
};
