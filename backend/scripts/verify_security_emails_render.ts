/**
 * Renders every NEW email from the 2026-09 email-action audit (security.* + paymentRequest.*)
 * through the REAL builders with outbound email suppressed, dumping HTML to
 * memory/email_previews_v4/ for review. Run:
 *   DISABLE_OUTBOUND_EMAIL=true EMAIL_DUMP_DIR=/app/memory/email_previews_v4 \
 *     npx ts-node --transpile-only scripts/verify_security_emails_render.ts
 */
import * as fs from "fs";
import * as path from "path";
import {
  send2FAEnabledEmail,
  send2FADisabledEmail,
  send2FABackupCodesRegeneratedEmail,
  sendPhoneChangedEmail,
  sendAccountDeletedEmail,
  sendAccountStatusEmail,
  sendPaymentRequestEmail,
} from "../services/email/securityEmails";
import { sendPasswordChangedEmail, sendUserProfileUpdatedEmail } from "../services/email/accountEmails";
import { sendWalletBatchSummaryEmail } from "../services/email/walletEmails";

const OUT = process.env.EMAIL_DUMP_DIR || "/app/memory/email_previews_v4";
const TO = "render-check@example.com";
const NAME = "Alex Morgan";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

  for (const L of ["en", "de"]) {
    await send2FAEnabledEmail(TO, NAME, L);
    await send2FADisabledEmail(TO, NAME, L);
    await send2FABackupCodesRegeneratedEmail(TO, NAME, L);
    await sendPhoneChangedEmail(TO, NAME, { action: "changed", phone: "8801712345678" }, L);
    await sendPhoneChangedEmail(TO, NAME, { action: "added", phone: "13025141000" }, L);
    await sendPhoneChangedEmail(TO, NAME, { action: "removed" }, L);
    await sendAccountDeletedEmail(TO, NAME, L);
    await sendAccountStatusEmail(TO, NAME, { status: "suspended", reason: "Chargeback investigation" }, L);
    await sendAccountStatusEmail(TO, NAME, { status: "banned", reason: "Terms of service violation" }, L);
    await sendAccountStatusEmail(TO, NAME, { status: "active" }, L);
    await sendPaymentRequestEmail(TO, { companyName: "The Dev Store", amount: "49.00", currency: "USD", description: "Invoice #1042 — design sprint", expiresAt: new Date(Date.now() + 3 * 864e5), payUrl: "https://dynopay.com/abc123", lang: L });
    await sendPasswordChangedEmail(TO, NAME, "09 September 2026", "12:00 PM", L);
    await sendUserProfileUpdatedEmail(TO, NAME, ["Email address: Updated"], "old-address@example.com", L);
  }
  await sendWalletBatchSummaryEmail(TO, NAME, { companyName: "The Dev Store", added: ["BTC"], updated: ["ETH"], removed: ["LTC"] });

  const files = fs.readdirSync(OUT).sort();
  let bad = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(OUT, f), "utf8");
    const rawKeys = html.match(/\b(security|paymentRequest|merchant|labels|common)\.[a-zA-Z.]+\b/g) || [];
    const hero = /\/api\/static\/email\/hero\/[a-z-]+\.png/.test(html);
    const cta = /<a [^>]*href=/.test(html);
    const ok = rawKeys.length === 0 && hero && cta;
    if (!ok) bad++;
    console.log(`${ok ? "OK  " : "FAIL"} ${f}${rawKeys.length ? " raw-keys=" + rawKeys.join(",") : ""}${hero ? "" : " NO-HERO"}${cta ? "" : " NO-CTA"}`);
  }
  console.log(`\n${files.length} emails rendered, ${bad} problems -> ${OUT}`);
  process.exit(bad ? 1 : 0);
})();
