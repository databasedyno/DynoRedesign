import { raw as envRaw } from "../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import { Op, fn, col, literal } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { IUserType } from "../utils/types";
import invoiceModel from "../models/invoiceModel";
import taxRateModel from "../models/taxRateModel";
import { userTransactionModel, companyModel, userModel, customerTransactionModel } from "../models";
import { buildPaymentReceivedDisplay } from "../utils/paymentAmountDisplay";
import { apiLogger } from "../utils/loggers";
import { generateInvoicePDF } from "../services/pdfService";
import { sendInvoiceGeneratedEmail } from "../services/emailService";
import { getFeeTiers, getTransactionFeePercent, FeeTier } from "../utils/feeConfigUtils";
import {
  getCompanyBaseCurrency,
  getCurrencySymbol,
  convertToFiat,
  getUserDisplayCurrency,
  getUsdToFiatRate,
} from "../utils/currencyUtils";
import { EU_COUNTRIES, FALLBACK_TAX_RATES } from "../utils/taxData";

/**
 * Resolve the flat (fixed) fee for a USD amount from the configured fee tiers.
 *
 * The fee tiers (FEE_TIER_*_MIN/MAX) are ALWAYS denominated in USD. Callers
 * MUST pass a USD amount here — never a raw `base_amount` which may be in a
 * crypto currency (e.g. 0.00058 BTC), because that would fall below the lowest
 * tier and silently return $0.00.
 *
 * Matching strategy (mirrors feeService.findMatchingTier so the invoice fixed
 * fee equals what the merchant was actually charged):
 *   1. Exact tier match (min <= amount <= max).
 *   2. Gap / out-of-range fallback: the highest tier whose `min` <= amount
 *      (handles amounts that land between two tiers, e.g. $100.50 in the gap
 *      between tier1 max=100 and tier2 min=101).
 *   3. If the amount is below every tier minimum, use the lowest tier.
 * Returns 0 only for non-positive amounts or when no tiers are configured.
 */
const resolveFixedFee = (tiers: FeeTier[], usdAmount: number): number => {
  if (!tiers.length || !(usdAmount > 0)) return 0;

  const exact = tiers.find(
    (t) => usdAmount >= t.min && (t.max === null || usdAmount <= t.max)
  );
  if (exact) return exact.fixed;

  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const belowOrEqual = [...sorted].reverse().find((t) => usdAmount >= t.min);
  return (belowOrEqual || sorted[0]).fixed;
};

interface InvoiceFigures {
  usdAmount: number;
  baseCurrency: string;
  transactionFeePercent: number;
  fixedFeeUSD: number;
  transactionFeeUSD: number;
  vatRate: number;
  vatAmountUSD: number;
  preferredCurrency: string;
  displayCurrency: string;
  displayBaseAmount: number;
  displayFixedFee: number;
  displayTransactionFee: number;
  displayVatAmount: number;
  displayServiceFee: number;
  unitPrice: number;
  totalAmount: number;
}

/**
 * Compute all monetary figures for a completed transaction's invoice.
 *
 * Shared by `autoGenerateInvoice` (which persists the result), the read-only
 * preview endpoint, and the historical backfill script (scripts/
 * backfill_invoice_fees.ts) — so all three paths use IDENTICAL math.
 * Performs NO database writes.
 *
 * All fee math is done in USD (the fee-tier currency) and only the final
 * display figures are converted USD → the company's preferred currency.
 */
export const computeInvoiceFigures = async (
  txData: Record<string, any>,
  companyData: Record<string, any>,
  companyId: number | string
): Promise<InvoiceFigures> => {
  // ── Determine the transaction's USD value ─────────────────────────────
  // CRITICAL: `base_amount` is denominated in the transaction's
  // `base_currency`, which is very often a CRYPTO (e.g. 0.00058 BTC for a
  // ~$37 payment). The fee tiers (FEE_TIER_*_MIN/MAX) are defined in USD, so
  // the tier lookup MUST use the USD value — never the raw crypto
  // `base_amount`, otherwise a 0.00058 BTC amount falls below the lowest
  // tier (min=$1) and the fixed fee silently collapses to $0.00.
  const baseAmount = parseFloat(txData.base_amount || 0);
  const baseCurrency = txData.base_currency || "USD";

  // Canonical USD amount used for ALL fee math.
  let usdAmount = parseFloat(txData.usd_value || 0);
  if (!(usdAmount > 0)) {
    // usd_value missing/zero — best-effort convert base_amount → USD.
    if (baseCurrency === "USD") {
      usdAmount = baseAmount;
    } else {
      try {
        const conv = await convertToFiat(baseCurrency, "USD", baseAmount);
        usdAmount = conv?.amount || baseAmount;
      } catch {
        usdAmount = baseAmount;
      }
    }
    apiLogger.info(`[Invoice] usd_value missing, derived USD amount: ${usdAmount}`);
  }

  const transactionFeePercent = getTransactionFeePercent();
  const feeTiers = getFeeTiers();

  // Fixed fee via USD tier lookup, WITH a gap/out-of-range fallback (see
  // resolveFixedFee) so the invoice fixed fee always matches what the
  // merchant was actually charged (the $1 fixed fee is bundled into the tx
  // `transaction_fee`). Both the crypto `base_amount` bug and the tier-gap
  // bug previously produced fixed_fee = $0.00 here.
  const fixedFeeUSD = resolveFixedFee(feeTiers, usdAmount);
  const transactionFeeUSD = (usdAmount * transactionFeePercent) / 100;

  // Calculate VAT (if applicable) — computed in USD, on Dynopay's SERVICE
  // revenue (fixed + %fee), unless INVOICE_VAT_ON_GROSS=true (legacy mode).
  let vatRate = 0;
  let vatAmountUSD = 0;

  if (companyData.vat_verified && companyData.country) {
    // VAT applies to EU countries
    if (EU_COUNTRIES.includes(companyData.country)) {
      // Get VAT rate from tbl_tax_rate dynamically
      try {
        const taxRate = await taxRateModel.findOne({
          where: { country_code: companyData.country },
        });

        if (taxRate) {
          const taxData = taxRate.dataValues;
          vatRate = parseFloat(taxData.standard_rate || 0);
          apiLogger.info(`VAT rate for ${companyData.country}: ${vatRate}% (from tbl_tax_rate)`);
        } else {
          // Use per-country FALLBACK_TAX_RATES instead of a hard-coded 23%
          // for the whole EU (23% is Portugal's rate — DE=19, HU=27, LU=17…).
          vatRate = FALLBACK_TAX_RATES[companyData.country] ?? 23;
          apiLogger.info(`Using fallback VAT rate for ${companyData.country}: ${vatRate}% (per-country FALLBACK_TAX_RATES)`);
        }
      } catch (error) {
        apiLogger.error("Error fetching VAT rate:", error);
        vatRate = FALLBACK_TAX_RATES[companyData.country] ?? 23;
      }

      // VAT is applied on the SERVICE FEE (Dynopay's revenue = fixed_fee +
      // %fee), NOT the transaction amount that merely passes through the
      // platform. Legacy gross behavior via INVOICE_VAT_ON_GROSS=true.
      const vatBaseUSD =
        envRaw("INVOICE_VAT_ON_GROSS") === "true"
          ? usdAmount
          : fixedFeeUSD + transactionFeeUSD;
      vatAmountUSD = (vatBaseUSD * vatRate) / 100;
    }
  }

  // Get company's preferred display currency and convert FROM USD (the
  // canonical fee currency) → preferred. The fixed fee is a flat USD amount,
  // so it must be scaled by the USD→preferred rate — NOT the crypto→fiat
  // rate (which previously would have exploded a $1 fee by ~64000×).
  const preferredCurrency = await getCompanyBaseCurrency(companyId);

  let rate = 1;
  let displayCurrency = "USD";
  if (preferredCurrency && preferredCurrency !== "USD") {
    try {
      const result = await convertToFiat("USD", preferredCurrency, 1);
      if (result && result.amount) {
        rate = result.amount;
        displayCurrency = preferredCurrency;
      }
    } catch (convErr) {
      apiLogger.warn(
        `[Invoice] Currency conversion USD→${preferredCurrency} failed, using USD amounts`
      );
    }
  }

  const displayBaseAmount = usdAmount * rate;
  const displayFixedFee = fixedFeeUSD * rate;
  const displayTransactionFee = transactionFeeUSD * rate;
  const displayVatAmount = vatAmountUSD * rate;

  // v2 SEMANTICS:
  //   transaction_amount = the GROSS transaction amount (context, not summed)
  //   unit_price         = Dynopay's SERVICE REVENUE = fixed_fee + %fee
  //   total_usd          = unit_price + vat_amount (proper service-invoice math)
  const displayServiceFee = displayFixedFee + displayTransactionFee;
  const unitPrice = displayServiceFee;
  const totalAmount = displayServiceFee + displayVatAmount;

  return {
    usdAmount,
    baseCurrency,
    transactionFeePercent,
    fixedFeeUSD,
    transactionFeeUSD,
    vatRate,
    vatAmountUSD,
    preferredCurrency,
    displayCurrency,
    displayBaseAmount,
    displayFixedFee,
    displayTransactionFee,
    displayVatAmount,
    displayServiceFee,
    unitPrice,
    totalAmount,
  };
};

/**
 * Shared sanitizer for invoice rows exposed via the public API.
 *
 * Hides the internal fee-breakdown fields (`fixed_fee`,
 * `transaction_fee_percent`, `blockchain_buffer_percent`) — the merchant
 * only needs to see a single `processing_fee` total. Also exposes v2
 * fields (`transaction_amount`, `invoice_version`) so the UI can render
 * the gross transaction amount as context alongside the service fee.
 *
 * For v2 rows (`invoice_version === "v2"`), `processing_fee` is the
 * ACTUAL service revenue = `unit_price` = `fixed_fee + txFeeAmount`.
 * For legacy v1 rows, `processing_fee` is just `fixed_fee` (best-effort;
 * they never had `txFeeAmount` broken out).
 */
const sanitizeInvoice = (invoiceData: Record<string, unknown>) => {
  const version = (invoiceData.invoice_version as string) || "v1";
  const fixedFee = parseFloat(String(invoiceData.fixed_fee ?? "0")) || 0;
  const unitPrice = parseFloat(String(invoiceData.unit_price ?? "0")) || 0;
  const processingFee = version === "v2" ? unitPrice : fixedFee;

  return {
    invoice_id: invoiceData.invoice_id,
    invoice_number: invoiceData.invoice_number,
    transaction_id: invoiceData.transaction_id,
    company_id: invoiceData.company_id,
    provider_name: invoiceData.provider_name,
    provider_address: invoiceData.provider_address,
    // FIX (BUG E): model field is `provider_vat_id`, not `provider_tax_id`.
    provider_vat_id: invoiceData.provider_vat_id,
    customer_name: invoiceData.customer_name,
    customer_address: invoiceData.customer_address,
    customer_tax_id: invoiceData.customer_tax_id,
    description: invoiceData.description,
    // For v2: unit_price is Dynopay's service revenue (fixed + %fee).
    // For v1: unit_price is the gross transaction amount (legacy).
    unit_price: invoiceData.unit_price,
    quantity: invoiceData.quantity,
    // v2 context — the underlying transaction amount (null on v1 rows).
    transaction_amount: invoiceData.transaction_amount ?? null,
    invoice_version: version,
    vat_rate: invoiceData.vat_rate,
    vat_amount: invoiceData.vat_amount,
    processing_fee: parseFloat(processingFee.toFixed(2)),
    total_usd: invoiceData.total_usd,
    total_crypto: invoiceData.total_crypto,
    crypto_currency: invoiceData.crypto_currency,
    payment_terms: invoiceData.payment_terms,
    invoice_date: invoiceData.invoice_date,
    status: invoiceData.status,
    createdAt: invoiceData.createdAt,
  };
};

/**
 * Generate invoice number
 * Format: INV-YYYYMMDD-XXXXX
 */
const generateInvoiceNumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const datePrefix = `INV-${year}${month}${day}`;

  // Get count of invoices created today (using correct Sequelize Op syntax)
  const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  const count = await invoiceModel.count({
    where: {
      invoice_date: {
        [Op.gte]: todayStart,
        [Op.lt]: todayEnd,
      },
    },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${datePrefix}-${sequence}`;
};

/**
 * Auto-generate invoice for a transaction
 * Called internally when transaction is completed
 * 
 * @param transactionId - The transaction ID
 * @param companyId - The company ID
 */
export const autoGenerateInvoice = async (
  transactionId: number,
  companyId: number
): Promise<unknown> => {
  try {
    // Check if invoice already exists
    const existingInvoice = await invoiceModel.findOne({
      where: { transaction_id: transactionId },
    });

    if (existingInvoice) {
      apiLogger.info(`Invoice already exists for transaction ${transactionId}`);
      return existingInvoice;
    }

    // Get transaction details
    const transaction = await userTransactionModel.findOne({
      where: { transaction_id: transactionId },
    });

    if (!transaction) {
      apiLogger.error(`Transaction ${transactionId} not found`);
      return null;
    }

    const txData = transaction.dataValues;

    // Get company details for customer info
    const company = await companyModel.findOne({
      where: { company_id: companyId },
    });

    if (!company) {
      apiLogger.error(`Company ${companyId} not found`);
      return null;
    }

    const companyData = company.dataValues;

    // Provider details (Dynopay Innovations, LDA)
    const providerInfo = {
      provider_name: "Dynopay Innovations, LDA",
      provider_address: "Rua Luís de Camões 1017, 7° Dt°\nMontijo 2870-154\nPortugal",
      provider_vat_id: "PT518713130",
    };

    // Customer details from company profile
    const customerAddress = [
      companyData.address_line1,
      companyData.address_line2,
      companyData.city,
      companyData.state,
      companyData.country,
      companyData.zip_code,
    ]
      .filter(Boolean)
      .join("\n");

    // Calculate all monetary figures (fees, VAT, currency conversion).
    // Shared with the read-only preview endpoint via computeInvoiceFigures.
    const {
      transactionFeePercent,
      vatRate,
      preferredCurrency,
      displayBaseAmount,
      displayFixedFee,
      displayVatAmount,
      unitPrice,
      totalAmount,
    } = await computeInvoiceFigures(txData, companyData, companyId);

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Create invoice record
    const invoiceData = {
      invoice_number: invoiceNumber,
      transaction_id: transactionId,
      company_id: companyId,
      ...providerInfo,
      customer_name: companyData.company_name,
      customer_address: customerAddress,
      customer_tax_id: companyData.vat_number || null,
      description: `Payment processing service - Transaction ${txData.transaction_reference || transactionId}`,
      unit_price: unitPrice,
      quantity: 1,
      vat_rate: vatRate,
      vat_amount: displayVatAmount,
      fixed_fee: displayFixedFee,
      transaction_fee_percent: transactionFeePercent,
      blockchain_buffer_percent: 0,
      // v2 additions: expose the underlying tx amount + tag the semantics
      // so the PDF/API can render it as an informational context row.
      transaction_amount: displayBaseAmount,
      invoice_version: "v2",
      total_usd: totalAmount,
      total_crypto: parseFloat(txData.crypto_amount || 0) || totalAmount,
      crypto_currency: txData.crypto_currency || preferredCurrency,
      payment_terms: "Payment due upon receipt",
      invoice_date: new Date(),
    };

    const invoice = await invoiceModel.create(invoiceData);

    apiLogger.info(`Invoice ${invoiceNumber} generated for transaction ${transactionId}`);

    // Send invoice notification email
    try {
      const user = await userModel.findOne({
        where: { user_id: txData.user_id },
      });

      if (user) {
        const userData = user.dataValues;
        const invoiceUrl = `${envRaw("SERVER_URL")}/api/invoices/${invoice.dataValues.invoice_id}`;
        
        await sendInvoiceGeneratedEmail(userData.email, userData.name, {
          invoice_number: invoiceNumber,
          transaction_id: transactionId,
          total_usd: totalAmount,
          currency: preferredCurrency,
          invoice_date: new Date(),
          invoice_url: invoiceUrl,
        });

        apiLogger.info(`Invoice email sent to ${userData.email}`);
      }
    } catch (emailError) {
      apiLogger.error("Failed to send invoice email:", emailError);
      // Don't fail invoice generation if email fails
    }

    return invoice;
  } catch (error) {
    apiLogger.error("Error generating invoice:", error);
    apiLogger.error(
      `Failed to generate invoice for transaction ${transactionId}`,
      { transactionId, companyId },
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
};

/**
 * Get invoice for a transaction
 * GET /api/transactions/:id/invoice
 */
const getTransactionInvoice = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    // Get transaction to verify ownership
    const transaction = await userTransactionModel.findOne({
      where: {
        transaction_id: id,
        user_id: userData.user_id,
      },
    });

    if (!transaction) {
      return errorResponseHelper(res, 404, "Transaction not found");
    }

    // Get invoice
    const invoice = await invoiceModel.findOne({
      where: { transaction_id: id },
    });

    if (!invoice) {
      // Try to generate invoice if it doesn't exist and transaction is completed
      const txData = transaction.dataValues;
      if ((txData.status === "done" || txData.status === "successful") && txData.company_id) {
        const generatedInvoice = await autoGenerateInvoice(
          parseInt(id),
          txData.company_id
        );

        if (generatedInvoice) {
          return successResponseHelper(
            res,
            200,
            "Invoice generated successfully",
            (generatedInvoice as unknown as { dataValues: Record<string, unknown> }).dataValues
          );
        }
      }

      return errorResponseHelper(
        res,
        404,
        "Invoice not found. Invoices are generated for completed transactions."
      );
    }

    successResponseHelper(
      res,
      200,
      "Invoice retrieved successfully",
      invoice.dataValues
    );
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * READ-ONLY invoice figures preview for a completed transaction.
 *
 * Computes fees / VAT / currency EXACTLY like autoGenerateInvoice (via the
 * shared computeInvoiceFigures) but does NOT persist an invoice row and does
 * NOT send email. Safe to call repeatedly on live data. Enables verifying the
 * fixed-fee fix (crypto base_amount + tier-gap) without triggering a payment.
 *
 * GET /api/transactions/:id/invoice-preview
 */
const previewTransactionInvoice = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    // Verify ownership (merchant can only preview their own transactions).
    const transaction = await userTransactionModel.findOne({
      where: { transaction_id: id, user_id: userData.user_id },
    });
    if (!transaction) {
      return errorResponseHelper(res, 404, "Transaction not found");
    }

    const txData = transaction.dataValues;
    if (!txData.company_id) {
      return errorResponseHelper(res, 400, "Transaction has no associated company");
    }

    const company = await companyModel.findOne({
      where: { company_id: txData.company_id },
    });
    if (!company) {
      return errorResponseHelper(res, 404, "Company not found");
    }

    const fig = await computeInvoiceFigures(
      txData,
      company.dataValues,
      txData.company_id
    );

    return successResponseHelper(res, 200, "Invoice preview computed", {
      transaction_id: parseInt(id),
      base_currency: fig.baseCurrency,
      usd_value: fig.usdAmount,
      display_currency: fig.displayCurrency,
      // Service-invoice figures (in display currency):
      transaction_amount: fig.displayBaseAmount,
      fixed_fee: fig.displayFixedFee,
      transaction_fee_percent: fig.transactionFeePercent,
      transaction_fee_amount: fig.displayTransactionFee,
      unit_price: fig.unitPrice,
      vat_rate: fig.vatRate,
      vat_amount: fig.displayVatAmount,
      total_usd: fig.totalAmount,
      invoice_version: "v2",
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * READ-ONLY preview of the "Payment Received" email amounts for a transaction.
 *
 * Computes the fiat-primary + crypto-secondary figures EXACTLY like the crypto
 * settlement / sweep notification path (via buildPaymentReceivedDisplay), so we
 * can verify the merchant email shows the correct fiat amount (e.g. ~$100 for a
 * 0.00156 BTC payment) and NEVER a wrong "$1.00"/crypto-as-fiat figure.
 * Sends NO email, persists NOTHING. Ownership-checked.
 *
 * GET /api/transactions/:id/payment-email-preview
 */
const previewPaymentReceivedEmail = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    const transaction = await userTransactionModel.findOne({
      where: { transaction_id: id, user_id: userData.user_id },
    });
    if (!transaction) {
      return errorResponseHelper(res, 404, "Transaction not found");
    }
    const txData = transaction.dataValues;

    // The merchant's fiat request lives on the customer_transaction (base_amount
    // is fiat there) — matched by shared transaction_reference. Mirrors what the
    // settlement email uses as its primary fiat source when available.
    let knownFiatAmount: number | null = null;
    let knownFiatCurrency: string | null = null;
    if (txData.transaction_reference) {
      const custTx = await customerTransactionModel.findOne({
        where: { transaction_reference: txData.transaction_reference },
      });
      if (custTx) {
        knownFiatAmount = custTx.dataValues.base_amount ?? null;
        knownFiatCurrency = custTx.dataValues.base_currency ?? null;
      }
    }

    const display = await buildPaymentReceivedDisplay({
      companyId: txData.company_id,
      usdValue: txData.usd_value,
      cryptoAmount: txData.crypto_amount ?? txData.base_amount,
      cryptoCurrency: txData.crypto_currency ?? txData.base_currency,
      knownFiatAmount,
      knownFiatCurrency,
    });

    return successResponseHelper(res, 200, "Payment-received email preview", {
      transaction_id: parseInt(id),
      usd_value: txData.usd_value,
      // What the email renders:
      amount: display.fiatAmount, // primary fiat amount
      currency: display.fiatCurrency, // primary fiat currency
      crypto_amount: display.cryptoAmount, // secondary
      crypto_currency: display.cryptoCurrency, // secondary
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * Get all invoices for a user/company
 * GET /api/invoices
 */
const getAllInvoices = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { company_id, page = 1, limit = 10 } = req.query;

  try {
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build where clause
    const whereClause: Record<string, unknown> = {};

    // Get user's companies to filter invoices
    const companies = await companyModel.findAll({
      where: { user_id: userData.user_id },
      attributes: ["company_id"],
    });

    const companyIds = companies.map((c: { dataValues: { company_id: number } }) => (c as unknown as { dataValues: { company_id: number } }).dataValues.company_id);

    // If user has no companies, return empty result
    if (companyIds.length === 0) {
      return successResponseHelper(res, 200, "Invoices retrieved successfully", {
        invoices: [],
        pagination: {
          total: 0,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: 0,
        },
      });
    }

    if (company_id) {
      // Verify user owns this company
      if (!companyIds.includes(parseInt(company_id as string))) {
        return errorResponseHelper(res, 403, "Access denied to this company");
      }
      whereClause.company_id = parseInt(company_id as string);
    } else {
      whereClause.company_id = { [Op.in]: companyIds };
    }

    // Get invoices with pagination
    const { count, rows } = await invoiceModel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit as string),
      offset: offset,
      order: [["invoice_date", "DESC"]],
    });

    const invoices = rows.map((row: { dataValues: Record<string, unknown> }) => {
      const raw = (row as unknown as { dataValues: Record<string, unknown> }).dataValues;
      // FIX (BUG F): sanitize list items to match `getInvoiceById`. Previously
      // this returned full `dataValues` — leaking internal fee-breakdown
      // fields (`fixed_fee`, `transaction_fee_percent`, `blockchain_buffer_percent`).
      return sanitizeInvoice(raw);
    });

    successResponseHelper(res, 200, "Invoices retrieved successfully", {
      invoices,
      pagination: {
        total: count,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
    });
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * Get invoice by invoice ID
 * GET /api/invoices/:id
 */
const getInvoiceById = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    const invoice = await invoiceModel.findOne({
      where: { invoice_id: id },
    });

    if (!invoice) {
      return errorResponseHelper(res, 404, "Invoice not found");
    }

    const invoiceData = invoice.dataValues;

    // Verify user owns the company
    const company = await companyModel.findOne({
      where: {
        company_id: invoiceData.company_id,
        user_id: userData.user_id,
      },
    });

    if (!company) {
      return errorResponseHelper(res, 403, "Access denied");
    }

    // Sanitize response — hide internal fee breakdown details. Uses the
    // shared `sanitizeInvoice` helper so `getAllInvoices` returns the same
    // shape and never leaks internal fee fields (BUG F).
    const sanitizedInvoice = sanitizeInvoice(invoiceData);

    successResponseHelper(
      res,
      200,
      "Invoice retrieved successfully",
      sanitizedInvoice
    );
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * Download invoice as PDF
 * GET /api/invoices/:id/pdf
 */
const downloadInvoicePDF = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    const invoice = await invoiceModel.findOne({
      where: { invoice_id: id },
    });

    if (!invoice) {
      return errorResponseHelper(res, 404, "Invoice not found");
    }

    const invoiceData = invoice.dataValues;

    // Verify user owns the company
    const company = await companyModel.findOne({
      where: {
        company_id: invoiceData.company_id,
        user_id: userData.user_id,
      },
    });

    if (!company) {
      return errorResponseHelper(res, 403, "Access denied");
    }

    // Generate PDF
    // If unit_price is 0, try to recalculate from the transaction
    let pdfData: Record<string, unknown> = { ...invoiceData };
    const storedUnitPrice = parseFloat(invoiceData.unit_price || 0);
    if (storedUnitPrice === 0 || isNaN(storedUnitPrice)) {
      try {
        const transaction = await userTransactionModel.findOne({
          where: { transaction_id: invoiceData.transaction_id },
        });
        if (transaction) {
          const txData = transaction.dataValues;
          let recalcAmount = parseFloat(txData.base_amount || 0);
          if (recalcAmount === 0 || isNaN(recalcAmount)) {
            recalcAmount = parseFloat(txData.usd_value || 0);
          }
          if (recalcAmount > 0) {
            pdfData.unit_price = recalcAmount;
            pdfData.total_usd = recalcAmount + parseFloat(pdfData.fixed_fee as string || "0") + parseFloat(pdfData.vat_amount as string || "0");
            // Also set crypto info from transaction if missing
            if (parseFloat((pdfData.total_crypto as string) || "0") === 0 && txData.crypto_amount) {
              pdfData.total_crypto = parseFloat(txData.crypto_amount);
            }
            if (!pdfData.crypto_currency && txData.crypto_currency) {
              pdfData.crypto_currency = txData.crypto_currency;
            }
            apiLogger.info(`[Invoice PDF] Recalculated amounts for invoice ${invoiceData.invoice_number}: unit_price=${recalcAmount}`);
          }
        }
      } catch (recalcErr) {
        apiLogger.warn(`[Invoice PDF] Could not recalculate amounts: ${recalcErr}`);
      }
    }

    // "Fiat Everywhere Invoice PDF" — resolve the merchant's chosen DISPLAY
    // currency (Settings → Payments: USD/EUR/GBP/NGN/CAD/AUD) + the cached
    // USD→display FX rate and pass them into generateInvoicePDF so every
    // monetary line renders end-to-end in the merchant's currency. Falls
    // back safely to USD @ 1 (identity conversion) if the merchant hasn't
    // picked a preference or the FX call fails.
    try {
      const displayCurrency = await getUserDisplayCurrency(
        userData?.user_id,
        invoiceData.company_id
      );
      const rate = await getUsdToFiatRate(displayCurrency);
      pdfData.display_currency = displayCurrency;
      pdfData.usd_to_display_rate = rate;
    } catch (fxErr) {
      apiLogger.warn(
        `[Invoice PDF] Could not resolve display currency for user ${userData?.user_id}: ${fxErr}`
      );
    }

    const pdfStream = generateInvoicePDF(pdfData as any);

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${invoiceData.invoice_number}.pdf`
    );

    // Pipe PDF stream to response
    pdfStream.pipe(res);
  } catch (e) {

      handleControllerError(res, e, apiLogger);
  }
};

/**
 * Get aggregated tax report
 * GET /api/invoices/tax-report
 * Query: start_date, end_date, company_id, group_by (month|quarter|year)
 */
const getTaxReport = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const {
    start_date,
    end_date,
    company_id,
    group_by = "month",
  } = req.query;

  try {
    // Get user's companies
    const companies = await companyModel.findAll({
      where: { user_id: userData.user_id },
      attributes: ["company_id", "company_name", "country"],
    });

    const companyIds = companies.map(
      (c: { dataValues: { company_id: number } }) =>
        (c as unknown as { dataValues: { company_id: number } }).dataValues
          .company_id
    );

    if (companyIds.length === 0) {
      return successResponseHelper(res, 200, "Tax report generated", {
        summary: { total_revenue: 0, total_tax: 0, total_invoices: 0 },
        by_period: [],
        by_jurisdiction: [],
      });
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {};
    if (company_id) {
      if (!companyIds.includes(parseInt(company_id as string))) {
        return errorResponseHelper(res, 403, "Access denied to this company");
      }
      whereClause.company_id = parseInt(company_id as string);
    } else {
      whereClause.company_id = { [Op.in]: companyIds };
    }

    if (start_date || end_date) {
      const dateFilter: Record<string, unknown> = {};
      if (start_date) dateFilter[Op.gte as unknown as string] = new Date(start_date as string);
      if (end_date) dateFilter[Op.lte as unknown as string] = new Date(end_date as string);
      whereClause.invoice_date = dateFilter;
    }

    // Fetch all matching invoices
    const invoices = await invoiceModel.findAll({
      where: whereClause,
      order: [["invoice_date", "DESC"]],
    });

    const invoiceData = invoices.map(
      (inv: { dataValues: Record<string, unknown> }) =>
        (inv as unknown as { dataValues: Record<string, unknown> }).dataValues
    );

    // Calculate summary
    let totalRevenue = 0;
    let totalTax = 0;
    const periodMap = new Map<
      string,
      { revenue: number; tax: number; count: number; period_label: string }
    >();
    const jurisdictionMap = new Map<
      string,
      { revenue: number; tax: number; count: number; rate: number }
    >();

    // Build company lookup
    const companyLookup = new Map<number, { name: string; country: string }>();
    companies.forEach((c: any) => {
      const cd = c.dataValues;
      companyLookup.set(cd.company_id, {
        name: cd.company_name,
        country: cd.country || "Unknown",
      });
    });

    for (const inv of invoiceData) {
      const revenue = parseFloat((inv.total_usd as string) || "0");
      const tax = parseFloat((inv.vat_amount as string) || "0");
      const vatRate = parseFloat((inv.vat_rate as string) || "0");
      totalRevenue += revenue;
      totalTax += tax;

      // Group by period
      const invDate = new Date(inv.invoice_date as string);
      let periodKey = "";
      let periodLabel = "";

      if (group_by === "year") {
        periodKey = `${invDate.getFullYear()}`;
        periodLabel = periodKey;
      } else if (group_by === "quarter") {
        const q = Math.ceil((invDate.getMonth() + 1) / 3);
        periodKey = `${invDate.getFullYear()}-Q${q}`;
        periodLabel = `Q${q} ${invDate.getFullYear()}`;
      } else {
        // month
        const m = String(invDate.getMonth() + 1).padStart(2, "0");
        periodKey = `${invDate.getFullYear()}-${m}`;
        const monthNames = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        periodLabel = `${monthNames[invDate.getMonth()]} ${invDate.getFullYear()}`;
      }

      const existing = periodMap.get(periodKey) || {
        revenue: 0,
        tax: 0,
        count: 0,
        period_label: periodLabel,
      };
      existing.revenue += revenue;
      existing.tax += tax;
      existing.count += 1;
      periodMap.set(periodKey, existing);

      // Group by jurisdiction (country from company)
      const companyInfo = companyLookup.get(inv.company_id as number);
      const jurisdiction = companyInfo?.country || "Unknown";
      const jExisting = jurisdictionMap.get(jurisdiction) || {
        revenue: 0,
        tax: 0,
        count: 0,
        rate: vatRate,
      };
      jExisting.revenue += revenue;
      jExisting.tax += tax;
      jExisting.count += 1;
      if (vatRate > 0) jExisting.rate = vatRate;
      jurisdictionMap.set(jurisdiction, jExisting);
    }

    // Convert maps to sorted arrays. "Fiat Everywhere" — the on-screen
    // Tax Report tab uses these values, so we convert the USD-canonical
    // totals to the merchant's DISPLAY currency (same USD→fiat rate as the
    // /transactions export + dashboard tiles). Falls back to rate 1 (USD)
    // if the merchant hasn't picked one or the FX call fails.
    const displayCurrency = await getUserDisplayCurrency(
      userData?.user_id,
      typeof company_id === "string" || typeof company_id === "number"
        ? company_id
        : null
    );
    const rate = await getUsdToFiatRate(displayCurrency);
    const currencySymbol = getCurrencySymbol(displayCurrency) || "$";

    const byPeriod = Array.from(periodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        period: key,
        period_label: val.period_label,
        revenue: parseFloat((val.revenue * rate).toFixed(2)),
        tax_collected: parseFloat((val.tax * rate).toFixed(2)),
        invoice_count: val.count,
      }));

    const byJurisdiction = Array.from(jurisdictionMap.entries())
      .sort(([, a], [, b]) => b.tax - a.tax)
      .map(([country, val]) => ({
        country,
        tax_rate: val.rate,
        revenue: parseFloat((val.revenue * rate).toFixed(2)),
        tax_collected: parseFloat((val.tax * rate).toFixed(2)),
        invoice_count: val.count,
      }));

    successResponseHelper(res, 200, "Tax report generated", {
      summary: {
        total_revenue: parseFloat((totalRevenue * rate).toFixed(2)),
        total_tax: parseFloat((totalTax * rate).toFixed(2)),
        total_invoices: invoiceData.length,
        period: {
          start: start_date || "all time",
          end: end_date || "present",
        },
        group_by,
        display_currency: displayCurrency,
        currency_symbol: currencySymbol,
        usd_to_display_rate: rate,
      },
      by_period: byPeriod,
      by_jurisdiction: byJurisdiction,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * Export tax report as CSV
 * GET /api/invoices/tax-report/csv
 */
const exportTaxReportCSV = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { start_date, end_date, company_id } = req.query;

  try {
    // Get user's companies
    const companies = await companyModel.findAll({
      where: { user_id: userData.user_id },
      attributes: ["company_id", "company_name", "country"],
    });

    const companyIds = companies.map(
      (c: any) => c.dataValues.company_id
    );

    if (companyIds.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tax-report.csv"'
      );
      return res.send("No data available");
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {};
    if (company_id) {
      if (!companyIds.includes(parseInt(company_id as string))) {
        return errorResponseHelper(res, 403, "Access denied");
      }
      whereClause.company_id = parseInt(company_id as string);
    } else {
      whereClause.company_id = { [Op.in]: companyIds };
    }

    if (start_date || end_date) {
      const dateFilter: Record<string, unknown> = {};
      if (start_date)
        dateFilter[Op.gte as unknown as string] = new Date(start_date as string);
      if (end_date)
        dateFilter[Op.lte as unknown as string] = new Date(end_date as string);
      whereClause.invoice_date = dateFilter;
    }

    const invoices = await invoiceModel.findAll({
      where: whereClause,
      order: [["invoice_date", "DESC"]],
    });

    // Build company lookup
    const companyLookup = new Map<number, string>();
    companies.forEach((c: any) => {
      companyLookup.set(c.dataValues.company_id, c.dataValues.company_name);
    });

    // "Fiat Everywhere Export" — convert USD-canonical invoice figures into
    // the merchant's chosen DISPLAY currency (Settings → Payments) so the CSV
    // matches the on-screen /invoices tables. Uses the same Redis-cached
    // USD→fiat rate (`fxrate:USD:<CUR>`, ~10 min TTL) as the transactions
    // export, the dashboard, and the tax report summary. Fails safe to
    // USD @ rate 1 so the CSV is never blank.
    const displayCurrency = await getUserDisplayCurrency(
      userData?.user_id,
      typeof company_id === "string" || typeof company_id === "number"
        ? company_id
        : null
    );
    const rate = await getUsdToFiatRate(displayCurrency);

    // Generate CSV
    const header =
      `Invoice Number,Date,Company,Customer,Description,Subtotal (${displayCurrency}),VAT Rate (%),VAT Amount (${displayCurrency}),Processing Fee (${displayCurrency}),Total (${displayCurrency}),Display Currency,Payment Currency\n`;

    const rows = invoices
      .map((inv: any) => {
        const d = inv.dataValues;
        const date = new Date(d.invoice_date).toISOString().split("T")[0];
        const companyName = companyLookup.get(d.company_id) || "";
        const totalUsd = parseFloat(d.total_usd || 0);
        const vatUsd = parseFloat(d.vat_amount || 0);
        // "Processing Fee" column must match the version-aware value the UI
        // shows via `sanitizeInvoice` (Session 36): for v2 service invoices
        // the actual fee is `unit_price` (= fixed_fee + variable %fee), not
        // the raw `fixed_fee` component. v1 legacy rows never had that
        // breakdown so they keep `fixed_fee` as the platform fee. Without
        // this branch a merchant sees $1.87 processing fee on screen but
        // $1.00 (fixed component only) in the CSV.
        const version = (d.invoice_version as string) || "v1";
        const rawFixedFee = parseFloat(d.fixed_fee || 0);
        const rawUnitPrice = parseFloat(d.unit_price || 0);
        const feeUsd =
          version === "v2" ? rawUnitPrice : rawFixedFee;
        // Subtotal in the CSV = pre-VAT billed amount. For v2 this equals
        // `unit_price` (service revenue); math check: total_usd - vat_amount
        // = (unit_price + vat_amount) - vat_amount = unit_price. For v1 it
        // stays the legacy `total_usd - vat_amount` semantic.
        const subtotalUsd = totalUsd - vatUsd;

        return [
          d.invoice_number,
          date,
          `"${companyName}"`,
          `"${d.customer_name || ""}"`,
          `"${(d.description || "").replace(/"/g, '""')}"`,
          (subtotalUsd * rate).toFixed(2),
          parseFloat(d.vat_rate || 0).toFixed(2),
          (vatUsd * rate).toFixed(2),
          (feeUsd * rate).toFixed(2),
          (totalUsd * rate).toFixed(2),
          displayCurrency,
          d.crypto_currency || "USD",
        ].join(",");
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tax-report-${new Date().toISOString().split("T")[0]}.csv"`
    );

    return res.send(header + rows);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

export default {
  getTransactionInvoice,
  previewTransactionInvoice,
  previewPaymentReceivedEmail,
  getAllInvoices,
  getInvoiceById,
  autoGenerateInvoice,
  downloadInvoicePDF,
  getTaxReport,
  exportTaxReportCSV,
};
