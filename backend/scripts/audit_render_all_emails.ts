/**
 * Phase-1 audit harness: render EVERY email sender to HTML with realistic sample data.
 * Nothing is sent — DISABLE_OUTBOUND_EMAIL + EMAIL_DUMP_DIR are forced; no DB writes.
 * Run: cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/audit_render_all_emails.ts
 * Output: /app/plan/audit/emails/html/NN_<family>_<sender>[_variant].html + manifest.json
 */
import * as fs from "fs";
import * as path from "path";

process.env.DISABLE_OUTBOUND_EMAIL = "true";
const OUT = process.env.EMAIL_DUMP_DIR || "/app/plan/audit/emails/html";
process.env.EMAIL_DUMP_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

type Audience = "M" | "B" | "A";
type Row = { n: number; slug: string; family: string; sender: string; variant: string; audience: Audience; to: string; subject: string; file: string; status: "ok" | "no-output" | "error"; error?: string };
const manifest: Row[] = [];
let n = 0;

const M = "onarrival21@example.com";
const B = "jamie.chen@example.com";
const A = "ops@dynopay.com";
const NAME = "Alex Rivera";
const BUYER = "Jamie Chen";
const BRAND = "Acme Store";
const FE = "https://dynopay.com";
const TX = "9f2c1e7a-55d1-4b2e-8c3a-7d1f0b2e9a44";
const DATE = "05 June 2026";
const TIME = "14:02 UTC";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const snapshot = () => new Set(fs.readdirSync(OUT));

async function capture(family: string, sender: string, variant: string, audience: Audience, fn: () => Promise<unknown> | unknown) {
  const before = snapshot();
  let error: string | undefined;
  try { await fn(); await sleep(30); } catch (e) { error = (e as Error).message; }
  const created = fs.readdirSync(OUT).filter((f) => !before.has(f)).sort();
  if (!created.length) {
    n++;
    manifest.push({ n, slug: `${String(n).padStart(3, "0")}_${family}_${sender}${variant ? "_" + variant : ""}`, family, sender, variant, audience, to: "", subject: "", file: "", status: error ? "error" : "no-output", error });
    console.log(`  !! ${family}.${sender} ${variant} → ${error ? "ERROR " + error : "no output"}`);
    return;
  }
  created.forEach((f, i) => {
    n++;
    const suffix = created.length > 1 ? `${variant ? variant + "_" : ""}${i + 1}` : variant;
    const slug = `${String(n).padStart(3, "0")}_${family}_${sender}${suffix ? "_" + suffix : ""}`;
    const src = fs.readFileSync(path.join(OUT, f), "utf8");
    const m = src.match(/^<!--\s*to:\s*(.*?)\s*\|\s*subject:\s*(.*?)\s*-->/);
    const target = `${slug}.html`;
    fs.renameSync(path.join(OUT, f), path.join(OUT, target));
    manifest.push({ n, slug, family, sender, variant: suffix, audience, to: m?.[1] || "", subject: m?.[2] || "", file: target, status: "ok" });
  });
}

function writeBuilt(family: string, sender: string, variant: string, audience: Audience, to: string, subject: string, html: string) {
  n++;
  const slug = `${String(n).padStart(3, "0")}_${family}_${sender}${variant ? "_" + variant : ""}`;
  fs.writeFileSync(path.join(OUT, `${slug}.html`), `<!-- to: ${to} | subject: ${subject} -->\n${html.split("%%TO_EMAIL%%").join(to)}`);
  manifest.push({ n, slug, family, sender, variant, audience, to, subject, file: `${slug}.html`, status: "ok" });
}

const sampleOrder = (over: Record<string, unknown> = {}) => ({
  public_ref: "K7M2QX", order_id: 4821, currency: "USD", locale: "en", crypto_amount: "0.00137", crypto_currency: "BTC", crypto_network: "BTC", subtotal_cents: 6400, shipping_cents: 900, tax_cents: 1216, tax_label: "VAT", tax_rate: 19, tax_inclusive: false, reverse_charge: false, total_cents: 8516,
  buyer_email: B, buyer_name: BUYER, buyer_phone: "+49 170 1234567",
  shipping_address: { name: BUYER, line1: "Torstraße 12", line2: "", city: "Berlin", postal_code: "10119", country: "DE" },
  merchant_user_id: 1, ...over,
});
const sampleItems = [
  { product_snapshot: { title: "Lightroom preset pack — Vol. 2", product_type: "digital" }, variant_snapshot: null, quantity: 1, line_total_cents: 2400, delivered_payload: { asset_deliveries: [{ download_url: `${FE}/api/orders/dl/abc123`, filename: "presets-vol2.zip" }] } },
  { product_snapshot: { title: "Studio tee", product_type: "physical" }, variant_snapshot: { attributes: { Size: "M", Colour: "Black" } }, quantity: 2, line_total_cents: 4000, delivered_payload: null },
];

const main = async () => {
  const acc = await import("../services/email/accountEmails");
  const act = await import("../services/email/activationEmails");
  const admN = await import("../services/email/adminNotificationEmails");
  const ops = await import("../services/email/adminOpsEmails");
  const bill = await import("../services/email/billingReportEmails");
  const co = await import("../services/email/companyEmails");
  const conv = await import("../services/email/conversionEmails");
  const rcpt = await import("../services/email/customerReceiptEmail");
  const kyc = await import("../services/email/kycEmails");
  const link = await import("../services/email/linkCampaignEmails");
  const ord = await import("../services/email/orderEmails");
  const otp = await import("../services/email/otpEmails");
  const pay = await import("../services/email/paymentEmails");
  const ref = await import("../services/email/referralEmails");
  const sec = await import("../services/email/securityEmails");
  const wal = await import("../services/email/walletEmails");
  const wsec = await import("../services/email/walletSecurityEmails");
  const rfd = await import("../services/refund/refundEmailTemplates");
  const shared = await import("../services/email/emailShared");
  const tpl = await import("../utils/emailTemplate");
  const { t } = await import("../utils/emailI18n");

  // ── account ──
  await capture("account", "welcome", "", "M", () => acc.sendWelcomeEmail(M, NAME));
  await capture("account", "welcome", "de", "M", () => acc.sendWelcomeEmail(M, NAME, "de"));
  await capture("account", "volumeTierUpgrade", "", "M", () => acc.sendVolumeTierUpgradeEmail(M, { name: NAME, previousTier: "Starter", previousPercent: 1.5, newTier: "Growth", newPercent: 1.2, totalVolumeUsd: 10240 }));
  await capture("account", "emailVerificationOtp", "", "M", () => acc.sendEmailVerificationOTPEmail(M, NAME, "482913"));
  await capture("account", "loginOtp", "", "M", () => acc.sendLoginOTPEmail(M, NAME, "482913"));
  await capture("account", "passwordChanged", "", "M", () => acc.sendPasswordChangedEmail(M, NAME, DATE, TIME));
  await capture("account", "profileUpdated", "", "M", () => acc.sendUserProfileUpdatedEmail(M, NAME, ["name", "email"], "old@example.com"));
  await capture("account", "creatorHandleUpdated", "new", "M", () => acc.sendCreatorHandleUpdatedEmail(M, NAME, "acmestore", true));
  await capture("account", "securityAlert", "", "M", () => acc.sendSecurityAlertEmail(M, NAME, "Password reset requested", "A password reset was requested from a new IP address (203.0.113.7, Berlin).", DATE, TIME));
  await capture("account", "failedLoginAttempts", "", "M", () => acc.sendFailedLoginAttemptsEmail(M, NAME, 5, "203.0.113.7", DATE, TIME));
  await capture("account", "newDeviceAlert", "", "M", () => acc.sendNewDeviceAlertEmail(M, NAME, { ipAddress: "203.0.113.7", device: "iPhone", browser: "Safari 17", os: "iOS 17", location: "Berlin, Germany", at: new Date("2026-06-05T14:02:00Z"), securityToken: "sec-token-123" }));

  // ── activation drip + gate ──
  for (const step of ["d1", "d3", "d7"] as const) {
    await capture("activation", "drip", `${step}_madeLink`, "M", () => act.sendActivationEmail({ userId: 1, email: M, name: NAME, companyName: BRAND, step, segment: "madeLink", unsubToken: "unsub" }));
  }
  await capture("activation", "drip", "d1_noLink", "M", () => act.sendActivationEmail({ userId: 1, email: M, name: NAME, companyName: BRAND, step: "d1", segment: "noLink", unsubToken: "unsub" }));
  await capture("activation", "drip", "d3_fundraiser_de", "M", () => act.sendActivationEmail({ userId: 1, email: M, name: NAME, companyName: BRAND, step: "d3", segment: "fundraiser", unsubToken: "unsub", lang: "de" }));
  for (const gate of ["brand", "wallet", "kyc"] as const) {
    const L = "en";
    const content = `${tpl.p(t("common.greeting", L, { name: NAME }))}${tpl.p(t(`activation.gate.${gate}.intro`, L))}${tpl.p(t("activation.gate.outro", L))}
      ${gate !== "kyc" ? `<p style="margin:20px 0 4px;font-size:15px;"><a href="${FE}/how-to" class="pill" style="display:inline-block;padding:11px 18px;border-radius:999px;background:#EEF2FF;color:#4338CA;text-decoration:none;font-weight:700;font-size:14px;">${t("activation.common.videoCta", L)}</a></p>` : ""}
      <p style="margin:26px 0 0;font-size:12px;color:#9ca3af;">${t("activation.common.unsubscribe", L)} <a href="#" style="color:#9ca3af;text-decoration:underline;">${t("activation.common.unsubscribeAction", L)}</a>.</p>`;
    writeBuilt("activation", "gate", gate, "M", M, t("activation.gate.subject", L), shared.dynoPayEmailTemplate(t("activation.gate.heading", L), content, true, t(`activation.gate.${gate}.cta`, L), `${FE}/create-pay-link`, "", L, "rocket"));
  }

  // ── admin notifications (A) ──
  await capture("adminNotif", "newUser", "", "A", () => admN.sendNewUserAdminNotification({ name: NAME, email: M, mobile: "+49 170 1234567", login_type: "email", user_id: 512, company_name: BRAND, signup_ip: "203.0.113.7", country: "DE" }));
  await capture("adminNotif", "onboardingStuck", "", "A", () => admN.sendOnboardingStuckAdminEmail({ user_id: 512, name: NAME, email: M, registered_at: "2026-06-03 09:14 UTC", hours_since_registration: 49, stuck_step: "wallet", completed_steps: ["account", "brand"], pending_steps: ["wallet", "first link"] }));
  await capture("adminNotif", "onboardingCompleted", "", "A", () => admN.sendOnboardingCompletedAdminEmail({ user_id: 512, name: NAME, email: M, company_name: BRAND, wallet_count: 3, registered_at: "2026-06-03 09:14 UTC", hours_to_complete: 6.5 }));
  await capture("adminNotif", "firstPayment", "", "A", () => admN.sendFirstPaymentAdminEmail({ user_id: 512, merchant_name: NAME, merchant_email: M, company_name: BRAND, company_id: 77, amount: "0.0042", currency: "BTC", amount_usd: "261.37", payment_method: "payment_link", customer_email: B, transaction_id: TX, registered_at: "2026-06-03", days_since_registration: 2 }));
  await capture("adminNotif", "brandDeleted", "", "A", () => admN.sendBrandDeletedAdminEmail({ companyId: 77, companyName: BRAND, ownerName: NAME, ownerEmail: M, deletedAtStr: "05 June 2026", purgeDateStr: "05 July 2026" }));
  await capture("adminNotif", "accountDeleted", "", "A", () => admN.sendAccountDeletedAdminEmail({ userId: 512, ownerName: NAME, ownerEmail: M, deletedAtStr: "05 June 2026", purgeDateStr: "05 July 2026" }));

  // ── admin ops (M + A) ──
  await capture("adminOps", "webhookDisabled", "", "M", () => ops.sendWebhookDisabledEmail(M, NAME, BRAND, "https://acme.example.com/hooks/dynopay", "payment.confirmed", "HTTP 503 Service Unavailable", 25));
  await capture("adminOps", "webhookRedirect", "", "M", () => ops.sendWebhookRedirectEmail(M, NAME, BRAND, "http://acme.example.com/hooks", "https://acme.example.com/hooks", 301));
  await capture("adminOps", "adminFeeReceived", "", "A", () => ops.sendAdminFeeReceivedEmail(A, "Ops", "0.000063", "BTC", TX, BRAND, "0.004137", "0.0042"));
  await capture("adminOps", "adminFeeSweep", "", "A", () => ops.sendAdminFeeSweepEmail(A, "0.0412", "ETH", "0x8a3f…c21d", "0x71e2…9b04", "0xfeedface1234", "0.00021", "scheduled"));
  await capture("adminOps", "treasuryLow", "", "A", () => ops.sendTreasuryLowAlertEmail(A, "MATIC", 1.2, 5, "gas top-up for POLYGON merchant pool"));
  await capture("adminOps", "conversionFailed", "", "A", () => ops.sendConversionFailedAdminEmail(A, { conversionId: "cv_8812", transactionId: TX, companyId: "77", companyName: BRAND, merchantEmail: M, sourceAmount: "0.0042", sourceCurrency: "BTC", sourceAmountUsd: "261.37", targetCurrency: "USDC", settlementChain: "POLYGON", settlementWallet: "0x71e2…9b04", depositTxHash: "0xfeedface1234", retryCount: 3, reason: "Binance withdrawal suspended for USDC-POLYGON" } as never));

  // ── billing / API keys / subscriptions ──
  await capture("billing", "invoiceGenerated", "", "M", () => bill.sendInvoiceGeneratedEmail(M, NAME, { invoice_number: "INV-2026-000481", transaction_id: 944, total_usd: 261.37, total_amount: 0.0042, currency: "BTC", invoice_date: new Date("2026-06-05T14:02:00Z"), invoice_url: `${FE}/invoices` }));
  await capture("billing", "apiKeyCreated", "", "M", () => bill.sendApiKeyCreatedEmail(M, NAME, "production", "created", "dp_live_…4f9a", DATE, TIME));
  await capture("billing", "apiKeysHashedNotice", "", "M", () => bill.sendApiKeysHashedNoticeEmail(M, NAME));
  await capture("billing", "apiKeyRevoked", "", "M", () => bill.sendApiKeyRevokedEmail(M, NAME, "production", BRAND, "dp_live_…4f9a", DATE, TIME));
  await capture("billing", "subscriptionCreated", "", "B", () => bill.sendSubscriptionCreatedEmail(B, BUYER, M, NAME, "Pro plan", "29.00", "USD", "month", "05 July 2026", BRAND));
  await capture("billing", "subscriptionCancelled", "", "B", () => bill.sendSubscriptionCancelledEmail(B, BUYER, M, NAME, "Pro plan", BRAND, "05 July 2026", "customer"));

  // ── company / brand ──
  await capture("company", "profileCreated", "", "M", () => co.sendCompanyProfileCreatedEmail(M, NAME, BRAND));
  await capture("company", "contactWelcome", "", "M", () => co.sendCompanyContactWelcomeEmail("hello@acme.example.com", BRAND, NAME));
  await capture("company", "profileUpdated", "", "M", () => co.sendCompanyProfileUpdatedEmail(M, NAME, BRAND, ["website", "logo"]));
  await capture("company", "teamMemberJoined", "", "M", () => co.sendTeamMemberJoinedEmail(M, NAME, "Sam Okafor", "sam@acme.example.com", BRAND));
  await capture("company", "deleteOtp", "", "M", () => co.sendCompanyDeleteOTPEmail(M, NAME, "482913", BRAND));
  await capture("company", "deleted", "", "M", () => co.sendCompanyDeletedEmail(M, NAME, BRAND, 2));
  await capture("company", "brandSoftDeleted", "", "M", () => co.sendBrandSoftDeletedEmail(M, NAME, BRAND, new Date("2026-07-05T14:02:00Z")));
  await capture("company", "brandPermanentlyDeleted", "", "M", () => co.sendBrandPermanentlyDeletedEmail(M, NAME, BRAND));
  await capture("company", "brandRestored", "", "M", () => co.sendBrandRestoredEmail(M, NAME, BRAND));
  await capture("company", "brandDeleteReminder", "", "M", () => co.sendBrandDeleteReminderEmail(M, NAME, BRAND, new Date("2026-07-05T14:02:00Z"), 3));
  await capture("company", "brandDeleteReminder", "de", "M", () => co.sendBrandDeleteReminderEmail(M, NAME, BRAND, new Date("2026-07-05T14:02:00Z"), 1, "de"));

  // ── auto-convert ──
  await capture("conversion", "autoConversionPayout", "", "M", () => conv.sendAutoConversionPayoutEmail(M, NAME, BRAND, { sourceCurrency: "BTC", sourceAmount: "0.0042", sourceAmountUsd: "261.37", targetCurrency: "USDC", payoutAmount: "255.90", conversionRate: "62230.95", priceAtConversion: 62230.95, currentPrice: 61980.10, priceMovementPct: -0.4, marketState: "calm", feeTierUsed: "Starter 1.5%", transactionId: TX, conversionId: "cv_8812", withdrawalTxHash: "7c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d", settlementChain: "TRC20", settlementWallet: "TXk4h2vP9fA2mQ7rLw3sN8bZc1yD5eGjKf", platformFeeUsd: 3.92, sweepGasFeeUsd: 0.85, tradeFeeUsd: 0.26, binanceWithdrawalFeeUsd: 0.44, grossSaleUsd: 261.37, totalReceivedUsd: 255.90 }));
  await capture("conversion", "weeklyConversionSummary", "", "M", () => conv.sendWeeklyConversionSummaryEmail(M, NAME, BRAND, { periodStart: "2026-05-29", periodEnd: "2026-06-04", totalConversions: 6, totalSourceUsd: 1240.5, totalPayoutUsd: 1219.8, totalSavedUsd: 18.4, totalVolatileConversions: 2, avgPriceMovementPct: -0.6, cryptoBreakdown: [{ currency: "BTC", count: 3, totalAmount: "0.0126", totalPayoutUsd: 780.2, avgMovementPct: -0.8 }, { currency: "ETH", count: 3, totalAmount: "0.145", totalPayoutUsd: 439.6, avgMovementPct: -0.3 }], dailyVolume: [{ day: "2026-05-29", label: "Fri", payoutUsd: 210 }, { day: "2026-05-30", label: "Sat", payoutUsd: 0 }, { day: "2026-05-31", label: "Sun", payoutUsd: 120 }, { day: "2026-06-01", label: "Mon", payoutUsd: 380 }, { day: "2026-06-02", label: "Tue", payoutUsd: 260 }, { day: "2026-06-03", label: "Wed", payoutUsd: 0 }, { day: "2026-06-04", label: "Thu", payoutUsd: 249.8 }] } as never));

  // ── buyer receipt (company=null → no receipt-token write) ──
  await capture("receipt", "customerConfirmation", "", "B", () => rcpt.sendCustomerPaymentConfirmationEmail(B, BUYER, BRAND, "261.37", "USD", TX, "Design retainer — June", DATE, TIME, "0.0042", "BTC", "rNtQRX", "en", undefined, { merchantAmount: 261.37, feeAmount: 3.92, feePayer: "company", currency: "USD" }, null, null, "paymentLink", { url: `${FE}/pay?d=rNtQRX`, kind: "default" }));
  await capture("receipt", "customerConfirmation", "customerPaysFee_de", "B", () => rcpt.sendCustomerPaymentConfirmationEmail(B, BUYER, BRAND, "265.29", "USD", TX, "Design retainer — June", DATE, TIME, "0.00426", "BTC", "rNtQRX", "de", undefined, { merchantAmount: 261.37, feeAmount: 3.92, feePayer: "customer", currency: "USD" }, null, null, "paymentLink", null));
  await capture("receipt", "customerConfirmation", "contribution", "B", () => rcpt.sendCustomerPaymentConfirmationEmail(B, BUYER, BRAND, "25.00", "USD", TX, null, DATE, TIME, "0.0004", "BTC", "rNtQRX", "en", "Riverside library roof", null, null, null, "donation", { url: `${FE}/pay?d=rNtQRX`, kind: "donation" }));
  await capture("receipt", "buyerPaymentExpired", "", "B", () => rcpt.sendBuyerPaymentExpiredEmail(B, BRAND, "0.0030", "0.0042", "BTC", "rNtQRX"));

  // ── KYC ──
  await capture("kyc", "required", "", "M", () => kyc.sendKYCRequiredEmail(M, NAME, "10,240.00", "USD"));
  await capture("kyc", "approved", "", "M", () => kyc.sendKYCApprovedEmail(M, NAME));
  await capture("kyc", "rejected", "", "M", () => kyc.sendKYCRejectedEmail(M, NAME, "The ID document photo was blurred and the expiry date could not be read."));
  await capture("kyc", "started", "", "M", () => kyc.sendKYCStartedEmail(M, NAME, `${FE}/kyc`));
  await capture("kyc", "resubmissionRequired", "", "M", () => kyc.sendKYCResubmissionRequiredEmail(M, NAME, "Proof of address is older than 3 months."));

  // ── links / campaigns / referral codes ──
  await capture("links", "paymentLinkCreated", "", "M", () => link.sendPaymentLinkCreatedEmail(M, NAME, BRAND, "100.00", "USD", `${FE}/pay?d=rNtQRX`, "Design retainer — June", "2026-07-05T14:02:00Z"));
  await capture("links", "crowdfundingCampaignCreated", "", "M", () => link.sendCrowdfundingCampaignCreatedEmail(M, NAME, BRAND, "Riverside library roof", 5000, "USD", `${FE}/pay?d=rNtQRX`, "Replace the leaking roof before winter"));
  await capture("links", "crowdfundingUpdate", "", "B", () => link.sendCrowdfundingUpdateEmail(B, BUYER, "Riverside library roof", "We're 60% there!", "Thanks to **142 backers** we've raised $3,000. Scaffolding goes up next week.", `${FE}/pay?d=rNtQRX`));
  await capture("links", "refereeInvite", "", "M", () => link.sendRefereeInviteEmail(M, "REF-4B9444E9", 50, 30, "unsub"));
  await capture("links", "refereeCodeReminder", "week2", "M", () => link.sendRefereeCodeReminderEmail(M, "REF-4B9444E9", 50, 30, 12, "week2", "unsub"));
  await capture("links", "paymentLinkReminder", "reminder1", "B", () => link.sendPaymentLinkReminderEmail(B, BRAND, "49.00", "USD", "Design retainer — June", `${FE}/pay?d=rNtQRX`, new Date("2026-06-08T14:02:00Z"), "reminder1", "tok"));
  await capture("links", "paymentLinkReminder", "final_de", "B", () => link.sendPaymentLinkReminderEmail(B, BRAND, "49.00", "EUR", "Design retainer — June", `${FE}/pay?d=rNtQRX`, new Date("2026-06-05T20:00:00Z"), "final", "tok", "de"));

  // ── orders (store) ──
  await capture("orders", "orderReceipt", "", "B", () => ord.sendOrderReceiptEmail(B, BUYER, sampleOrder(), sampleItems, `${FE}/order/K7M2QX`, "DE123456789"));
  await capture("orders", "orderReceipt", "de", "B", () => ord.sendOrderReceiptEmail(B, BUYER, sampleOrder({ locale: "de", currency: "EUR" }), sampleItems, `${FE}/order/K7M2QX`, "DE123456789"));
  await capture("orders", "orderReceiptMerchant", "", "M", () => ord.sendOrderReceiptMerchantEmail(M, NAME, sampleOrder(), sampleItems, `${FE}/order/K7M2QX`, "DE123456789", BRAND));
  await capture("orders", "orderExpired", "", "B", () => ord.sendOrderExpiredEmail(B, BUYER, sampleOrder(), sampleItems, `${FE}/devhub/shop`));
  await capture("orders", "orderRefunded", "", "B", () => ord.sendOrderRefundedEmail(B, BUYER, sampleOrder(), sampleItems, "Item out of stock", `${FE}/order/K7M2QX`));
  await capture("orders", "orderShipped", "", "B", () => ord.sendOrderShippedEmail(B, BUYER, sampleOrder(), { carrier: "DHL", tracking_number: "JD014600003621189912", estimated_delivery: "09 June 2026" }, `${FE}/order/K7M2QX`));
  await capture("orders", "digitalDownloadReminder", "", "B", () => ord.sendDigitalDownloadReminderEmail(B, BUYER, sampleOrder(), sampleItems, `${FE}/order/K7M2QX`));

  // ── OTP purposes ──
  for (const purpose of ["login", "signup", "emailVerify", "passwordReset", "emailChange", "setPassword"] as const) {
    await capture("otp", "purposeOtp", purpose, "M", () => otp.sendPurposeOTPEmail(M, NAME, "482913", purpose));
  }
  await capture("otp", "purposeOtp", "login_de", "M", () => otp.sendPurposeOTPEmail(M, NAME, "482913", "login", "de"));

  // ── payments (merchant + buyer) ──
  const settledMp = { grossCrypto: "0.0042", asset: "BTC", fiatAtDetection: { amount: "261.37", currency: "USD" }, feePercent: 1.5, feeCrypto: "0.000063", feePayer: "company", netCrypto: "0.004137", destinationAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", forwardTxHash: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b", explorerUrl: "https://mempool.space/tx/4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b", paidFor: "Design retainer — June", customerEmail: B, reference: "rNtQRX", txRowId: 944, detectedAt: new Date("2026-06-05T14:02:00Z") };
  await capture("payments", "paymentSettled", "forwarded", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "261.37", "USD", BRAND, TX, DATE, TIME, "en", "0.0042", "BTC", undefined, 0, "paymentLink", settledMp));
  await capture("payments", "paymentSettled", "largePayment", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "5,200.00", "USD", BRAND, TX, DATE, TIME, "en", "0.0834", "BTC", undefined, 0, "paymentLink", { ...settledMp, grossCrypto: "0.0834", feeCrypto: "0.001251", netCrypto: "0.082149", fiatAtDetection: { amount: "5,200.00", currency: "USD" }, largePayment: true }));
  await capture("payments", "paymentSettled", "forwarding_customerPaysFee_gas", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "49.00", "USD", BRAND, TX, DATE, TIME, "en", "49.74", "USDT-TRC20", undefined, 0, "paymentLink", { ...settledMp, grossCrypto: "49.74", asset: "USDT-TRC20", fiatAtDetection: { amount: "49.74", currency: "USD" }, feeCrypto: "0.74", feePayer: "customer", networkFeeCrypto: "0.35", netCrypto: "48.65", destinationAddress: "TXk4h2vP9fA2mQ7rLw3sN8bZc1yD5eGjKf", forwardTxHash: null, explorerUrl: null }));
  await capture("payments", "paymentSettled", "autoConvert_de", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "261.37", "EUR", BRAND, TX, DATE, TIME, "de", "0.0042", "BTC → USDC", undefined, 0.38, "donation", { ...settledMp, autoConvertTarget: "USDC", destinationAddress: null, forwardTxHash: null, explorerUrl: null, fiatAtDetection: { amount: "241.10", currency: "EUR" } }));
  await capture("payments", "paymentSettled", "contribution_belowMin", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "2.10", "USD", BRAND, TX, DATE, TIME, "en", "0.00003", "BTC", "Riverside library roof", 0, "donation", { ...settledMp, grossCrypto: "0.00003", feeCrypto: "0.00003", netCrypto: "0", belowMinimum: true, forwardTxHash: null, explorerUrl: null, fiatAtDetection: { amount: "2.10", currency: "USD" }, paidFor: null }));
  await capture("payments", "paymentReceived", "legacy", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "261.37", "USD", BRAND, TX, DATE, TIME, "en", "0.0042", "BTC", undefined, 0, "paymentLink"));
  await capture("payments", "paymentReceived", "campaign_referralCredit", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "25.00", "USD", BRAND, TX, DATE, TIME, "en", "0.0004", "BTC", "Riverside library roof", 0.38, "donation"));
  await capture("payments", "paymentReceived", "de", "M", () => pay.sendPaymentReceivedEmail(M, NAME, "261.37", "EUR", BRAND, TX, DATE, TIME, "de", "0.0042", "BTC"));
  await capture("payments", "paymentPending", "", "M", () => pay.sendPaymentPendingEmail(M, NAME, BRAND, "261.37", "USD", TX, 1, "en", "0.0042", "BTC", "10–60 min"));
  await capture("payments", "paymentPending", "usdt_trc20_de", "M", () => pay.sendPaymentPendingEmail(M, NAME, BRAND, "49.00", "EUR", TX, 20, "de", "49.74", "USDT-TRC20", "1–3 min"));
  await capture("payments", "paymentConfirming", "1of3", "M", () => pay.sendPaymentConfirmingEmail(M, NAME, BRAND, "261.37", "USD", TX, 1, 3, "en", "0.0042", "BTC"));
  await capture("payments", "paymentPartial", "", "M", () => pay.sendPaymentPartialEmail(M, NAME, BRAND, "0.0030", "0.0042", "0.0012", "BTC", TX, "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", 30, "en", { amount: "186.69", currency: "USD" }));
  await capture("payments", "buyerUnderpaidNudge", "", "B", () => pay.sendBuyerUnderpaidNudgeEmail(B, BUYER, BRAND, "0.0030", "0.0042", "0.0012", "BTC", `${FE}/pay?d=rNtQRX`, 30));
  await capture("payments", "paymentPartialExpired", "completed_partial", "M", () => pay.sendPaymentPartialExpiredEmail(M, NAME, BRAND, "0.0030", "0.0042", "BTC", TX, "completed_partial", "en", { grossCrypto: "0.0030", asset: "BTC", feePercent: null, feeCrypto: "0.000045", feePayer: "company", netCrypto: "0.002955", destinationAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", forwardTxHash: "4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b", explorerUrl: "https://mempool.space/tx/4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b", reference: TX, detectedAt: new Date("2026-06-05T14:02:00Z") }));
  await capture("payments", "paymentPartialExpired", "incomplete_expired", "M", () => pay.sendPaymentPartialExpiredEmail(M, NAME, BRAND, "0.0030", "0.0042", "BTC", TX, "incomplete_expired"));
  await capture("payments", "merchantUnderpaidDigest", "", "M", () => pay.sendMerchantUnderpaidDigestEmail(M, NAME, BRAND, [{ reference: "rNtQRX", received: "0.0030", expected: "0.0042", remaining: "0.0012", currency: "BTC", baseAmount: "261.37", baseCurrency: "USD" }, { reference: "aB12xY", received: "40.00", expected: "49.00", remaining: "9.00", currency: "USDT", baseAmount: "49.00", baseCurrency: "USD" }], 2, `${FE}/transactions?status=underpaid`));

  // ── payouts (new in Wave 4c) ──
  const payout = await import("../services/email/payoutEmails");
  await capture("payouts", "payoutDelayed", "delayed", "M", () => payout.sendPayoutDelayedEmail(M, NAME, BRAND, { amount: "0.0042", asset: "BTC", fiat: { amount: "261.37", currency: "USD" }, targetLabel: "USDT · Tron (TRC-20)", stage: "delayed", reasonKey: "exchange", since: new Date("2026-06-05T12:02:00Z"), reference: TX, conversionId: 8812 }));
  await capture("payouts", "payoutDelayed", "failed_de", "M", () => payout.sendPayoutDelayedEmail(M, NAME, BRAND, { amount: "49.74", asset: "USDT-TRC20", fiat: { amount: "49.74", currency: "USD" }, stage: "failed", reasonKey: "review", since: new Date("2026-06-05T09:02:00Z"), reference: TX }, "de"));
  const over = await import("../services/overpaymentNotifier");
  const overInfo = { paymentId: "pay_8f2c", txId: TX, companyId: 1, currency: "USDT-TRC20", amountExpected: 49, amountReceived: 54, excessAmount: 5, excessAmountUsd: 5, baseCurrency: "USD", customerEmail: B, customerName: BUYER, customerLang: "en", merchantContactEmail: "hello@acme.example.com" };
  const om = over.buildOverpaidMerchantEmail(overInfo, { companyName: BRAND, merchantName: NAME, merchantLang: "en" });
  writeBuilt("payments", "overpaid", "merchant", "M", M, om.subject, om.html);
  const ob = over.buildOverpaidBuyerEmail(overInfo, { companyName: BRAND });
  writeBuilt("payments", "overpaid", "buyer", "B", B, ob.subject, ob.html);
  const obde = over.buildOverpaidBuyerEmail({ ...overInfo, customerLang: "de" }, { companyName: BRAND });
  writeBuilt("payments", "overpaid", "buyer_de", "B", B, obde.subject, obde.html);

  // ── referral programme ──
  await capture("referral", "payoutReady", "", "M", () => ref.sendReferralPayoutReadyEmail(M, NAME, 125.5, "manual"));
  await capture("referral", "autoPayEnabled", "", "M", () => ref.sendReferralAutoPayEnabledEmail(M, NAME, 50, "TXk…9fA2"));
  await capture("referral", "payoutRequested", "", "M", () => ref.sendReferralPayoutRequestedEmail(M, NAME, 125.5, "TXk…9fA2", false));
  await capture("referral", "payoutFailed", "", "M", () => ref.sendReferralPayoutFailedEmail(M, NAME, 125.5, "TXk…9fA2", "Destination address rejected by network"));
  await capture("referral", "accrual", "", "M", () => ref.sendReferralAccrualEmail(M, NAME, 3.92, "Nameword", 129.42));
  await capture("referral", "activated", "", "M", () => ref.sendReferralActivatedEmail(M, NAME, "Nameword"));
  await capture("referral", "monthlyDigest", "", "M", () => ref.sendReferralMonthlyDigestEmail(M, NAME, "May 2026", 48.2, [{ name: "Nameword", usd: 30.1 }, { name: "SMADAV", usd: 18.1 }], "auto"));
  await capture("referral", "shareNudge", "", "M", () => ref.sendReferralShareNudgeEmail(M, NAME, "REF-4B9444E9"));

  // ── security ──
  await capture("security", "twoFaEnabled", "", "M", () => sec.send2FAEnabledEmail(M, NAME));
  await capture("security", "twoFaDisabled", "", "M", () => sec.send2FADisabledEmail(M, NAME));
  await capture("security", "backupCodesRegenerated", "", "M", () => sec.send2FABackupCodesRegeneratedEmail(M, NAME));
  await capture("security", "phoneChanged", "", "M", () => sec.sendPhoneChangedEmail(M, NAME, { action: "changed", phone: "+49 170 ••• 4567" }));
  await capture("security", "accountDeleted", "", "M", () => sec.sendAccountDeletedEmail(M, NAME));
  await capture("security", "accountStatus", "suspended", "M", () => sec.sendAccountStatusEmail(M, NAME, { status: "suspended", reason: "Unusual payout activity — please contact support." }));
  await capture("security", "paymentRequest", "", "B", () => sec.sendPaymentRequestEmail(B, { companyName: BRAND, amount: "49.00", currency: "USD", description: "Design retainer — June", expiresAt: new Date("2026-06-08T14:02:00Z"), payUrl: `${FE}/pay?d=rNtQRX` }));
  await capture("security", "accountDeleteOtp", "", "M", () => sec.sendAccountDeleteOTPEmail(M, NAME, "482913"));
  await capture("security", "accountSoftDeleted", "", "M", () => sec.sendAccountSoftDeletedEmail(M, NAME, "05 July 2026"));
  await capture("security", "accountRestored", "", "M", () => sec.sendAccountRestoredEmail(M, NAME));
  await capture("security", "stepUpCode", "", "M", () => sec.sendStepUpCodeEmail(M, NAME, "482913", "wallet"));
  await capture("security", "twoFaResetLink", "", "M", () => sec.send2FAResetLinkEmail(M, NAME, `${FE}/auth/reset-2fa?token=abc`));
  await capture("security", "twoFaResetDone", "", "M", () => sec.send2FAResetDoneEmail(M, NAME, new Date("2026-06-06T14:02:00Z")));

  // ── wallets ──
  await capture("wallet", "walletUpdateOtp", "", "M", () => wal.sendWalletUpdateOTPEmail(M, NAME, "482913", "bc1q…k4x7", "bc1q…9x2k", "BTC"));
  await capture("wallet", "walletBatchSummary", "", "M", () => wal.sendWalletBatchSummaryEmail(M, NAME, { companyName: BRAND, added: ["BTC", "ETH"], updated: ["USDT (TRC-20)"], removed: ["LTC"] }));
  await capture("wallet", "walletDeleted", "", "M", () => wal.sendWalletDeletedEmail(M, NAME, "bc1q…k4x7", "BTC", DATE, TIME));
  await capture("wallet", "addWalletReminder", "", "M", () => wal.sendAddWalletReminderEmail(M, NAME, BRAND));
  await capture("wallet", "walletAdded", "", "M", () => wal.sendWalletAddedEmail(M, NAME, "bc1q…9x2k", "BTC", BRAND, "Main BTC"));
  await capture("wallet", "walletUpdated", "", "M", () => wal.sendWalletUpdatedEmail(M, NAME, "bc1q…9x2k", "BTC", BRAND, "Main BTC"));
  await capture("wallet", "withdrawalOtp", "", "M", () => wal.sendWithdrawalOTPEmail(M, NAME, "482913", "500.00", "USDT", "TXk…9fA2"));
  await capture("wallet", "withdrawalSuccess", "", "M", () => wal.sendWithdrawalSuccessEmail(M, NAME, "500.00", "USDT-TRC20", "TXk4h2vP9fA2mQ7rLw3sN8bZc1yD5eGjKf", "7c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d"));
  await capture("wallet", "exchangeOtp", "", "M", () => wal.sendExchangeOTPEmail(M, NAME, "482913", "250.00", "BTC", "USDT", "Nameword"));
  await capture("wallet", "walletDeleteOtp", "", "M", () => wal.sendWalletDeleteOTPEmail(M, NAME, "482913", "bc1q…k4x7", "BTC"));
  await capture("walletSecurity", "walletChangeAlert", "", "M", () => wsec.sendWalletChangeAlertEmail(M, NAME, { companyName: BRAND, rows: [{ network: "Bitcoin", address: "bc1q…9x2k", actionLabel: "updated" }, { network: "USDT · TRC-20", address: "TXk…9fA2", actionLabel: "added" }], revertUrl: `${FE}/wallet-security?token=abc` }));
  await capture("walletSecurity", "walletSecured", "", "M", () => wsec.sendWalletSecuredEmail(M, NAME, { companyName: BRAND, networks: ["Bitcoin", "USDT · TRC-20"] }));

  // ── refunds (builders — the sender reads companyModel) ──
  const r1 = rfd.buildRefundEmail({ refund_amount: 0.0012, asset: "BTC", chain: "BTC", brand_name: BRAND }, "forwarding");
  writeBuilt("refund", "buyerRefund", "forwarding", "B", B, r1.subject, r1.html);
  const r2 = rfd.buildRefundEmail({ refund_amount: 49, asset: "USDT", chain: "USDT-TRC20", original_transaction_ref: "9f2c1e7a55d14b2e8c3a7d1f0b2e9a44c0ffee0123456789abcdef0123456789", forward_txid: "7c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d", brand_name: BRAND }, "completed");
  writeBuilt("refund", "buyerRefund", "completed", "B", B, r2.subject, r2.html);
  const r3 = rfd.buildMerchantRefundEmail({ refund_amount: 49, asset: "USDT", chain: "USDT-TRC20", original_transaction_ref: "9f2c1e7a55d14b2e8c3a7d1f0b2e9a44", gas_buffer_native: 1.2, gas_buffer_symbol: "TRX", forward_txid: "7c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d", refund_id: "rf_8f2c1e", customer_email: B, brand_name: BRAND } as never);
  writeBuilt("refund", "merchantRefund", "completed", "M", M, r3.subject, r3.html);

  // ── generic sendEmail ──
  await capture("shared", "sendEmail", "generic", "M", () => shared.sendEmail(M, NAME, "A note from Dynopay", tpl.p("This is the generic sendEmail() wrapper used for ad-hoc messages.")));

  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
  const ok = manifest.filter((m) => m.status === "ok").length;
  console.log(`\nrendered ${ok}/${manifest.length} → ${OUT}`);
  for (const m of manifest.filter((x) => x.status !== "ok")) console.log(`  ${m.status}: ${m.family}.${m.sender} ${m.variant} ${m.error || ""}`);
  process.exit(0);
};
main().catch((e) => { console.error(e); process.exit(1); });
