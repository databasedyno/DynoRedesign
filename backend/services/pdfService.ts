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
  
  // Determine the display currency
  const displayCurrency = invoiceData.base_currency || 'USD';
  const displayAmount = invoiceData.total_amount || invoiceData.total_usd;
  const currencySymbol = getCurrencySymbol(displayCurrency);

  // Helper function to format currency
  const formatCurrency = (amount: number | string, currency: string = displayCurrency): string => {
    const symbol = getCurrencySymbol(currency);
    const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return `${symbol}${numAmount.toFixed(2)} ${currency}`;
  };

  // Helper function to format date
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // --- Add DynoPay Logo ---
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

  // --- Provider (From) with full DynoPay branding ---
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
  if (numTxFeePercent > 0 || numFixedFee > 0) {
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
  const numDisplayAmount = typeof displayAmount === 'string' ? parseFloat(displayAmount) || 0 : displayAmount;
  const numVatAmount = typeof invoiceData.vat_amount === 'string' ? parseFloat(invoiceData.vat_amount) || 0 : invoiceData.vat_amount;
  const subtotal = numDisplayAmount - numVatAmount;
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
    .text("Powered by DynoPay - dynopay.com", 50, footerY + 35, { align: "center" })
    .fillColor("#000000");

  // Finalize PDF
  doc.end();

  return doc;
};

export default {
  generateInvoicePDF,
};
