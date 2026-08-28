/**
 * Verify onboarding emails no longer mention the deprecated "$500 fee-free balance"
 * and DO mention the first-payment-platform-fee-free perk.
 *
 * Renders the ACTUAL emails by capturing the HTML passed to mailTransporter
 * (mocked here so nothing is sent). Run:
 *   node_modules/.bin/ts-node --transpile-only scripts/verify_onboarding_emails.ts
 */

// Mock mailTransporter BEFORE requiring the email modules (shared module cache).
const mtMod: any = require("../utils/mailTransporter");
const captured: { subject: string; body: string }[] = [];
mtMod.default = async (opts: any) => {
  captured.push({ subject: String(opts.subject || ""), body: String(opts.body || "") });
};

const admin = require("../services/email/adminNotificationEmails");
const account = require("../services/email/accountEmails");

const PERK_PHRASES = [
  "platform-fee-free",          // en
  "libre de comisiones",        // es
  "isento de taxas",            // pt
  "sans frais de plateforme",   // fr
  "plattformgebührenfrei",      // de
  "zonder platformkosten",      // nl
];

async function main() {
  await admin.sendNewUserAdminNotification({
    name: "QA Merchant",
    email: "qa-verify@example.com",
    mobile: null,
    login_type: "EMAIL",
    user_id: 999999,
    company_name: "QA Co",
  });

  for (const lng of ["en", "es", "pt", "fr", "de", "nl"]) {
    await account.sendWelcomeEmail("qa-verify@example.com", "Alex", lng);
  }
  await new Promise((r) => setTimeout(r, 250));

  const adminEmail = captured.find((c) => /New Merchant Registration/i.test(c.subject));
  const welcomeEmails = captured.filter((c) => !/New Merchant Registration/i.test(c.subject));

  let fail = 0;
  const check = (name: string, cond: boolean) => {
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
    if (!cond) fail++;
  };

  // --- Admin new-user notification ---
  check("admin email captured", !!adminEmail);
  if (adminEmail) {
    const b = adminEmail.body;
    check("admin: no '$500'", !b.includes("$500"));
    check("admin: no 'Fee-Free Balance'", !b.includes("Fee-Free Balance"));
    check("admin: no '(trial)'", !b.includes("(trial)"));
    check("admin: has 'First payment platform-fee-free'", b.includes("First payment platform-fee-free"));
  }

  // --- Welcome emails (all locales) ---
  check("welcome emails captured (6)", welcomeEmails.length === 6);
  for (const w of welcomeEmails) {
    check(`welcome: no '$500' (subject="${w.subject}")`, !w.body.includes("$500"));
  }
  const perkPresent = welcomeEmails.some((w) => PERK_PHRASES.some((p) => w.body.includes(p)));
  check("welcome: first-payment-fee-free perk rendered in at least one locale", perkPresent);

  const fs = require("fs");
  fs.mkdirSync("/tmp/onboarding_emails", { recursive: true });
  if (adminEmail) fs.writeFileSync("/tmp/onboarding_emails/admin_new_user.html", adminEmail.body);
  welcomeEmails.forEach((w, i) => fs.writeFileSync(`/tmp/onboarding_emails/welcome_${i}.html`, w.body));

  console.log(`\nRendered ${captured.length} emails to /tmp/onboarding_emails/`);
  console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} CHECK(S) FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify script error:", e);
  process.exit(2);
});
