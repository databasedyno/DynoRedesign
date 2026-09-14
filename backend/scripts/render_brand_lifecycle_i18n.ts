/**
 * Render the brand-lifecycle + new-device emails in all 6 languages to HTML files
 * (nothing is sent — DISABLE_OUTBOUND_EMAIL + EMAIL_DUMP_DIR are forced) and fail
 * on any raw i18n key leaking into subject/body.
 * Run: cd backend && node_modules/.bin/ts-node --transpile-only scripts/render_brand_lifecycle_i18n.ts
 */
import * as fs from "fs";
import * as path from "path";

process.env.DISABLE_OUTBOUND_EMAIL = "true";
const OUT = process.env.EMAIL_DUMP_DIR || "/tmp/email_brand_i18n/html";
process.env.EMAIL_DUMP_DIR = OUT;
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));

const LANGS = ["en", "de", "es", "fr", "pt", "nl"];
const RAW_KEY = /\b(merchant|labels|common)\.[A-Za-z]+(\.[A-Za-z]+)?\b/;

const main = async () => {
  const { sendBrandSoftDeletedEmail, sendBrandPermanentlyDeletedEmail, sendBrandRestoredEmail, sendBrandDeleteReminderEmail } = await import("../services/email/companyEmails");
  const { sendNewDeviceAlertEmail } = await import("../services/email/accountEmails");

  const purgeAt = new Date(Date.UTC(2026, 8, 19, 12, 0, 0));
  const at = new Date(Date.UTC(2026, 5, 14, 18, 12, 0));
  for (const L of LANGS) {
    const to = `merchant-${L}@example.com`;
    await sendBrandSoftDeletedEmail(to, "Katie Kendra", "Acme & Sons", purgeAt, L);
    await sendBrandPermanentlyDeletedEmail(to, "", "Acme & Sons", L);
    await sendBrandRestoredEmail(to, "Katie Kendra", "Acme & Sons", L);
    await sendBrandDeleteReminderEmail(to, "Katie Kendra", "Acme & Sons", purgeAt, 2, L);
    await sendBrandDeleteReminderEmail(to, "Katie Kendra", "Acme & Sons", purgeAt, 1, L);
    await sendNewDeviceAlertEmail(to, "Katie Kendra", { ipAddress: "203.0.113.7", device: "Desktop", browser: "Chrome", os: "macOS", location: null, at, securityToken: "tok", lang: L });
  }

  const files = fs.readdirSync(OUT).sort();
  let bad = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(OUT, f), "utf8");
    const subject = (html.match(/subject: (.*?) -->/) || [])[1] || "";
    const leak = html.match(RAW_KEY);
    if (leak) { bad++; console.log(`RAW KEY in ${f}: ${leak[0]}`); }
    console.log(`${leak ? "FAIL" : "ok  "} ${subject}`);
  }
  console.log(`\nrendered ${files.length} emails (${LANGS.length} langs), raw-key leaks: ${bad}`);
  process.exit(bad ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
