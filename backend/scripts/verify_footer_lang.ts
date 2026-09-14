/**
 * Footer-localization + de-dupe verification render.
 *
 * Exercises the REAL sender functions (payment, customer receipt, KYC, wallet OTP,
 * welcome, referral) with the mail transporter STUBBED so nothing is sent — the
 * rendered HTML is captured, asserted and written to memory/email_previews_v3/.
 *
 * Asserts, per language (en de es fr nl pt):
 *   - the shared sign-off + team signature come from chrome.* in THAT language
 *   - <html lang="xx"> follows the recipient language
 *   - no English "Best regards," leaks into a non-English email
 *   - no raw i18n key (chrome.x / common.x / labels.x / receipt.x / merchant.x) leaks
 *   - the code-embedded English referral email stays English end-to-end
 *
 * Run from backend/:  npx ts-node --transpile-only scripts/verify_footer_lang.ts
 */
import * as fs from "fs";
import * as path from "path";

// --- stub the transporter BEFORE importing any sender --------------------------
// eslint-disable-next-line @typescript-eslint/no-var-requires
const transporterMod = require("../utils/mailTransporter");
type Captured = { to: string; subject: string; body: string };
const captured: Captured[] = [];
transporterMod.default = async (opts: { to: string; subject: string; body: string }) => {
  captured.push({ to: opts.to, subject: opts.subject, body: opts.body });
  return { messageId: "stub" };
};

import { t, SUPPORTED_EMAIL_LANGUAGES } from "../utils/emailI18n";
import { sendPaymentReceivedEmail } from "../services/email/paymentEmails";
import { sendCustomerPaymentConfirmationEmail } from "../services/email/customerReceiptEmail";
import { sendKYCRequiredEmail } from "../services/email/kycEmails";
import { sendWalletUpdateOTPEmail } from "../services/email/walletEmails";
import { sendWelcomeEmail } from "../services/email/accountEmails";
import { sendReferralAccrualEmail } from "../services/email/referralEmails";

const OUT = "/app/memory/email_previews_v3";
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    fails++;
    console.log("  ASSERT FAIL:", msg);
  }
};

const RAW_KEY = /\b(chrome|common|labels|receipt|merchant|walletOtp|paymentReceived|customerPaymentConfirmation)\.[a-zA-Z]+\b/;

async function renderFor(L: string) {
  const start = captured.length;
  await sendPaymentReceivedEmail("m@example.com", "Alex Morgan", "250.00", "USD", "Acme", "tx_123456789", "06 Sep 2026", "10:15", L, "0.0031", "BTC");
  await sendCustomerPaymentConfirmationEmail("b@example.com", "Sam Buyer", "Acme", "250.00", "USD", "tx_123456789", "Pro plan", "06 Sep 2026", "10:15", "0.0031", "BTC", "rNtQRX", L,
    undefined, { merchantAmount: 246.25, feeAmount: 3.75, feePayer: "customer", currency: "USD" });
  await sendKYCRequiredEmail("m@example.com", "Alex Morgan", "12,400", "USD", L);
  await sendWalletUpdateOTPEmail("m@example.com", "Alex Morgan", "481902", "0x12…ab", "0x34…cd", "Ethereum", L);
  await sendWelcomeEmail("m@example.com", "Alex Morgan", L);
  const mine = captured.slice(start);
  assert(mine.length === 5, `${L}: 5 emails captured (got ${mine.length})`);

  const regards = t("chrome.bestRegards", L);
  const team = t("chrome.teamSignature", L);
  const slugs = ["payment_received", "customer_receipt", "kyc_required", "wallet_update_otp", "welcome"];
  mine.forEach((m, i) => {
    const slug = `${slugs[i]}.${L}`;
    fs.writeFileSync(path.join(OUT, `${slug}.html`), m.body);
    assert(m.body.includes(regards), `${slug}: footer sign-off is localized ("${regards}")`);
    assert(m.body.includes(team), `${slug}: team signature is localized ("${team}")`);
    assert(m.body.includes(`<html xmlns="http://www.w3.org/1999/xhtml" lang="${L}">`), `${slug}: <html lang="${L}">`);
    if (L !== "en") assert(!m.body.includes("Best regards,"), `${slug}: no English "Best regards," leak`);
    const leak = m.body.match(RAW_KEY);
    assert(!leak, `${slug}: no raw i18n key leaked (${leak && leak[0]})`);
    assert(!RAW_KEY.test(m.subject), `${slug}: subject is not a raw key (${m.subject})`);
  });
}

(async () => {
  for (const L of SUPPORTED_EMAIL_LANGUAGES) await renderFor(L);

  // Code-embedded English email: must stay English even when a lang is passed.
  const start = captured.length;
  await sendReferralAccrualEmail("r@example.com", "Alex Morgan", 12.5, "Acme", 40, "de");
  const ref = captured[start];
  assert(!!ref, "referral accrual captured");
  if (ref) {
    fs.writeFileSync(path.join(OUT, "referral_accrual.en_only.html"), ref.body);
    assert(ref.body.includes("Best regards,") && ref.body.includes("The Dynopay Team"), "referral (English body) keeps English footer");
    assert(ref.body.includes('lang="en"'), "referral <html lang=\"en\">");
  }

  // De-dupe: greeting template + receipt keys no longer exist under chrome/receipt.
  assert(t("chrome.greeting", "en") === "chrome.greeting", "chrome.greeting removed (single source common.greeting)");
  assert(t("receipt.platformFee", "en") === "receipt.platformFee", "receipt.platformFee removed (single source labels.platformFee)");
  assert(t("merchant.walletOtp.subject", "en") === "merchant.walletOtp.subject", "dead merchant.walletOtp block removed");
  assert(t("orderReceipt.preheader", "de", { ref: "AB12" }).includes("AB12"), "orderReceipt.preheader now exists (was a raw key)");

  console.log(`\nrendered ${captured.length} emails -> ${OUT}`);
  console.log(fails === 0 ? "ALL ASSERTIONS PASSED" : `${fails} ASSERTION(S) FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => {
  console.error("verify_footer_lang crashed:", e);
  process.exit(2);
});
