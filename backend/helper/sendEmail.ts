/**
 * Re-export shim for backwards compatibility.
 * All email functions are now in services/emailService.ts (single source of truth).
 */
export {
  sendEmail,
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
  sendSecurityAlertEmail,
  sendRefereeCodeReminderEmail,
  sendPaymentLinkReminderEmail,
  sendAutoConversionPayoutEmail,
  sendWeeklyConversionSummaryEmail,
  dynoPayGreetingTemplate as dynoPayEmailTemplate,
  formatAmountWithCurrency,
} from "../services/emailService";

export { sendEmail as default } from "../services/emailService";
