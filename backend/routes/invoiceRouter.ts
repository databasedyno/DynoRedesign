import express from "express";
import invoiceController from "../controller/invoiceController";
import authMiddleware from "../middleware/authMiddleware";

const invoiceRouter = express.Router();

// Get invoice for a specific transaction
invoiceRouter.get(
  "/transactions/:id/invoice",
  authMiddleware,
  invoiceController.getTransactionInvoice
);

// READ-ONLY: preview computed invoice figures for a transaction (no persist,
// no email). Used to verify fee/VAT math without triggering invoice creation.
invoiceRouter.get(
  "/transactions/:id/invoice-preview",
  authMiddleware,
  invoiceController.previewTransactionInvoice
);

// READ-ONLY: preview the "Payment Received" email amounts for a transaction
// (no email sent). Verifies the fiat/crypto figures shown to the merchant.
invoiceRouter.get(
  "/transactions/:id/payment-email-preview",
  authMiddleware,
  invoiceController.previewPaymentReceivedEmail
);

// Get all invoices for user
invoiceRouter.get(
  "/invoices",
  authMiddleware,
  invoiceController.getAllInvoices
);

// Get tax report (aggregated)
invoiceRouter.get(
  "/invoices/tax-report",
  authMiddleware,
  invoiceController.getTaxReport
);

// Export tax report as CSV
invoiceRouter.get(
  "/invoices/tax-report/csv",
  authMiddleware,
  invoiceController.exportTaxReportCSV
);

// Get specific invoice by invoice ID
invoiceRouter.get(
  "/invoices/:id",
  authMiddleware,
  invoiceController.getInvoiceById
);

// Download invoice as PDF
invoiceRouter.get(
  "/invoices/:id/pdf",
  authMiddleware,
  invoiceController.downloadInvoicePDF
);

export default invoiceRouter;
