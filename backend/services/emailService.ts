/**
 * Dynopay Unified Email Service — FACADE
 *
 * R2 refactor (2026-08): the former 3.6K-line god file was extracted verbatim into
 * domain modules under services/email/ (strangler pattern — zero behavior change).
 * This facade preserves every import path and the default-export object shape, so
 * all existing importers (`import emailService from "./emailService"` and named
 * imports) keep working unchanged.
 *
 * Modules:
 *   emailShared          — template helpers, escapeHtml, FRONTEND_BASE_URL, sendEmail
 *   accountEmails        — welcome, OTPs, security, login, volume-tier upgrade
 *   companyEmails        — company profile lifecycle
 *   walletEmails         — wallet OTPs / lifecycle / withdrawal / exchange
 *   paymentEmails        — payment lifecycle (received…failed, customer confirmation)
 *   adminOpsEmails       — large-tx alert, webhook disabled, admin fee received/sweep
 *   conversionEmails     — auto-conversion payout, weekly conversion summary
 *   linkCampaignEmails   — payment links, crowdfunding, expiring, reminders
 *   kycEmails            — KYC lifecycle
 *   billingReportEmails  — weekly summary, invoices, API keys, subscriptions
 *   adminNotificationEmails — new-user / onboarding / first-payment / visitor admin mails
 *   orderEmails          — product-catalog order receipts / shipping / refunds
 */

export * from "./email/emailShared";
export * from "./email/accountEmails";
export * from "./email/companyEmails";
export * from "./email/walletEmails";
export * from "./email/paymentEmails";
export * from "./email/adminOpsEmails";
export * from "./email/conversionEmails";
export * from "./email/linkCampaignEmails";
export * from "./email/kycEmails";
export * from "./email/billingReportEmails";
export * from "./email/adminNotificationEmails";
export * from "./email/orderEmails";
export * from "./email/referralEmails";
export * from "./email/walletSecurityEmails";
export * from "./email/securityEmails";

import {
  dynoPayEmailTemplate,
  dynoPayGreetingTemplate,
  formatAmountWithCurrency,
  sendEmail,
} from "./email/emailShared";
import {
  sendWelcomeEmail,
  sendVolumeTierUpgradeEmail,
  sendEmailVerificationOTPEmail,
  sendLoginOTPEmail,
  sendPasswordChangedEmail,
  sendUserProfileUpdatedEmail,
  sendCreatorHandleUpdatedEmail,
  sendSecurityAlertEmail,
  sendLoginNotificationEmail,
  sendFailedLoginAttemptsEmail,
} from "./email/accountEmails";
import {
  sendCompanyProfileCreatedEmail,
  sendCompanyContactWelcomeEmail,
  sendCompanyProfileUpdatedEmail,
} from "./email/companyEmails";
import {
  sendWalletUpdateOTPEmail,
  sendWalletDeletedEmail,
  sendAddWalletReminderEmail,
  sendWalletAddedEmail,
  sendWalletUpdatedEmail,
  sendWithdrawalOTPEmail,
  sendWithdrawalSuccessEmail,
  sendExchangeOTPEmail,
  sendWalletDeleteOTPEmail,
} from "./email/walletEmails";
import {
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendCustomerPaymentConfirmationEmail,
} from "./email/paymentEmails";
import {
  sendLargeTransactionAlertEmail,
  sendWebhookDisabledEmail,
  sendWebhookRedirectEmail,
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
} from "./email/adminOpsEmails";
import {
  sendAutoConversionPayoutEmail,
  sendWeeklyConversionSummaryEmail,
} from "./email/conversionEmails";
import {
  sendPaymentLinkCreatedEmail,
  sendCrowdfundingCampaignCreatedEmail,
  sendRefereeCodeReminderEmail,
  sendRefereeInviteEmail,
  sendPaymentLinkReminderEmail,
} from "./email/linkCampaignEmails";
import {
  sendKYCRequiredEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendKYCStartedEmail,
  sendKYCResubmissionRequiredEmail,
} from "./email/kycEmails";
import {
  sendInvoiceGeneratedEmail,
  sendApiKeyCreatedEmail,
  sendSubscriptionCreatedEmail,
  sendSubscriptionCancelledEmail,
} from "./email/billingReportEmails";
import {
  sendNewUserAdminNotification,
  sendOnboardingStuckAdminEmail,
  sendOnboardingCompletedAdminEmail,
  sendFirstPaymentAdminEmail,
  sendNewVisitorAdminEmail,
} from "./email/adminNotificationEmails";
import {
  sendOrderReceiptEmail,
  sendOrderReceiptMerchantEmail,
  sendOrderExpiredEmail,
  sendOrderRefundedEmail,
  sendOrderShippedEmail,
  sendDigitalDownloadReminderEmail,
} from "./email/orderEmails";

// ============================================================
// EMAIL EXPORTS (default object — identical shape to pre-refactor)
// ============================================================

export default {
  // Template helpers
  dynoPayEmailTemplate,
  dynoPayGreetingTemplate,
  formatAmountWithCurrency,
  // Generic
  sendEmail,
  // User & Auth
  sendWelcomeEmail,
  sendEmailVerificationOTPEmail,
  sendLoginOTPEmail,
  sendPasswordChangedEmail,
  sendUserProfileUpdatedEmail,
  sendCreatorHandleUpdatedEmail,
  sendSecurityAlertEmail,
  sendLoginNotificationEmail,
  sendFailedLoginAttemptsEmail,
  // Company
  sendCompanyProfileCreatedEmail,
  sendCompanyContactWelcomeEmail,
  sendCompanyProfileUpdatedEmail,
  // Wallet
  sendWalletUpdateOTPEmail,
  sendWalletDeletedEmail,
  sendAddWalletReminderEmail,
  sendWalletAddedEmail,
  sendWalletUpdatedEmail,
  sendWithdrawalOTPEmail,
  sendWithdrawalSuccessEmail,
  sendExchangeOTPEmail,
  sendWalletDeleteOTPEmail,
  // Payment lifecycle
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendCustomerPaymentConfirmationEmail,
  sendLargeTransactionAlertEmail,
  sendWebhookDisabledEmail,
  sendWebhookRedirectEmail,
  // Admin
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
  // Auto-conversion
  sendAutoConversionPayoutEmail,
  sendWeeklyConversionSummaryEmail,
  // Marketing & Reminders
  sendPaymentLinkCreatedEmail,
  sendCrowdfundingCampaignCreatedEmail,
  sendRefereeCodeReminderEmail,
  sendRefereeInviteEmail,
  sendPaymentLinkReminderEmail,
  // KYC
  sendKYCRequiredEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendKYCStartedEmail,
  sendKYCResubmissionRequiredEmail,
  // Summary & Invoice
  sendInvoiceGeneratedEmail,
  // API Key & Subscriptions
  sendApiKeyCreatedEmail,
  sendSubscriptionCreatedEmail,
  sendSubscriptionCancelledEmail,
  // Admin notifications
  sendNewUserAdminNotification,
  sendOnboardingStuckAdminEmail,
  sendOnboardingCompletedAdminEmail,
  sendFirstPaymentAdminEmail,
  sendNewVisitorAdminEmail,
  // Volume-based fee tier
  sendVolumeTierUpgradeEmail,
  // Product Catalog (Phase 1)
  sendOrderReceiptEmail,
  sendOrderReceiptMerchantEmail,
  sendOrderExpiredEmail,
  sendOrderRefundedEmail,
  sendOrderShippedEmail,
  sendDigitalDownloadReminderEmail,
};
