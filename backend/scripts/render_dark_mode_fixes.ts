/**
 * Render the REAL email builders touched by the dark-mode fix to HTML files
 * (nothing is sent — DISABLE_OUTBOUND_EMAIL + EMAIL_DUMP_DIR are forced).
 * Run: cd backend && EMAIL_DUMP_DIR=/tmp/email_dark/html DISABLE_OUTBOUND_EMAIL=true \
 *      node_modules/.bin/ts-node --transpile-only scripts/render_dark_mode_fixes.ts
 */
import * as fs from "fs";
import * as path from "path";

process.env.DISABLE_OUTBOUND_EMAIL = "true";
const OUT = process.env.EMAIL_DUMP_DIR || "/tmp/email_dark/html";
process.env.EMAIL_DUMP_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const main = async () => {
  const { sendRefereeInviteEmail, sendRefereeCodeReminderEmail, sendPaymentLinkReminderEmail } = await import("../services/email/linkCampaignEmails");
  const { buildRefundEmail, buildMerchantRefundEmail } = await import("../services/refund/refundEmailTemplates");
  const { sendSubscriptionCreatedEmail } = await import("../services/email/billingReportEmails");

  await sendRefereeInviteEmail("moxx@example.com", "REF-4B9444E9", "50.00" as unknown as number, 30, "unsub-token");
  await sendRefereeCodeReminderEmail("moxx@example.com", "REF-4B9444E9", 50, 30, 12, "week2", "unsub-token");
  await sendPaymentLinkReminderEmail("buyer@example.com", "Acme Store", "49.00", "USD", "Design retainer — June", "https://dynopay.com/pay?d=rNtQRX", new Date(Date.now() + 36e5 * 30), "final", "tok");
  for (const L of ["de", "fr", "es", "pt", "nl"]) {
    await sendPaymentLinkReminderEmail(`buyer-${L}@example.com`, "Acme Store", "49.00", "EUR", "Design retainer — June", "https://dynopay.com/pay?d=rNtQRX", new Date(Date.now() + 36e5 * 30), "final", "tok", L);
    await sendPaymentLinkReminderEmail(`buyer-${L}@example.com`, "Acme Store", "49.00", "EUR", null, "https://dynopay.com/pay?d=rNtQRX", null, "reminder1", "tok", L);
  }
  await sendPaymentLinkReminderEmail("buyer@example.com", "Acme Store", "49.00", "USD", null, "https://dynopay.com/pay?d=rNtQRX", new Date(Date.now() + 36e5 * 5), "reminder2", "tok", "en");
  try {
    await sendSubscriptionCreatedEmail("buyer@example.com", null, "merchant@example.com", "Merchant", "Pro plan", "29.00", "USD", "month", "12 July 2026", "Acme Store");
  } catch (e) { console.log("subscription email skipped:", (e as Error).message); }

  const refunds = [
    ["refund-forwarding", buildRefundEmail({ refund_amount: 0.5, asset: "BTC", chain: "BTC" }, "forwarding")],
    ["refund-completed", buildRefundEmail({ refund_amount: 10, asset: "USDT", chain: "USDT-ERC20", forward_txid: "0xfeedface" }, "completed")],
    ["refund-merchant-copy", buildMerchantRefundEmail({ refund_amount: 10, asset: "USDT", chain: "USDT-ERC20", forward_txid: "0xfeedface", refund_id: "rf_test123", customer_email: "buyer@example.com" })],
  ] as const;
  for (const [slug, r] of refunds) fs.writeFileSync(path.join(OUT, `${Date.now()}_${slug}.html`), `<!-- subject: ${r.subject} -->\n${r.html}`);

  // Wallet OTP content (same helpers as the live controller, without DB writes).
  const { dynoPayEmailTemplate } = await import("../services/email/emailShared");
  const { p, infoBox, dataRow, mono, otpBlock } = await import("../utils/emailTemplate");
  const { t } = await import("../utils/emailI18n");
  const otp = `${p(t("walletOtp.intro", "en", { currency: "<strong>BTC</strong>" }))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dataRow(t("walletOtp.walletAddress", "en"), mono("bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"))}${dataRow(t("walletOtp.currency", "en"), "<strong>BTC</strong>", true)}</table>`)}
    ${otpBlock("482913")}
    ${p(t("walletOtp.expiry", "en", { minutes: "<strong>5</strong>" }), "font-size: 14px; color: #6b7280; text-align: center; margin: 0;")}`;
  fs.writeFileSync(path.join(OUT, `${Date.now()}_wallet-otp.html`), dynoPayEmailTemplate(t("walletOtp.heading", "en"), otp, false, "", "", "", "en", "key"));

  console.log("rendered:", fs.readdirSync(OUT).join(", "));
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
