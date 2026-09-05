/**
 * Part 2 verification render — builds 4 representative emails from the LIVE
 * locale JSON + real template, EN + DE, and writes HTML for eyeballing.
 * Also prints hard assertions (preheader embedded, corrected copy present).
 */
import * as fs from "fs";
import { t } from "../utils/emailI18n";
import { p, infoBox, dataRow, otpBlock, statusBadge, warnText } from "../utils/emailTemplate";
import { dynoPayEmailTemplate } from "../services/email/emailShared";

const OUT = "/app/memory/email_previews_v2";
fs.mkdirSync(OUT, { recursive: true });

const THRESH = "$10,000";
type Built = { slug: string; subject: string; preheader: string; html: string };

function loginOtp(L: string): Built {
  const content = `${p(t("common.greeting", L, { name: "Alex Morgan" }))}
    ${p(t("merchant.loginOtp.intro", L))}
    ${otpBlock("481902")}
    ${p(t("merchant.loginOtp.expiry", L))}`;
  const pre = t("merchant.loginOtp.preheader", L);
  return { slug: `login_otp.${L}`, subject: t("merchant.loginOtp.subject", L), preheader: pre,
    html: dynoPayEmailTemplate(t("merchant.loginOtp.heading", L), content, false, "", "", pre) };
}

function kycRequired(L: string): Built {
  const content = `${p(t("common.greeting", L, { name: "Alex Morgan" }))}
    ${p(t("merchant.kycRequired.intro", L, { symbol: "$", volume: "12,400", currency: "USD" }))}
    ${p(t("merchant.kycRequired.intro2", L, { threshold: THRESH }))}
    ${infoBox(`
      <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;">${t("merchant.kycRequired.needTitle", L)}</p>
      <table role="presentation" width="100%"><tr><td style="padding:2px 0;font-size:14px;">${t("merchant.kycRequired.need1", L)}</td></tr>
      <tr><td style="padding:2px 0;font-size:14px;">${t("merchant.kycRequired.need2", L)}</td></tr>
      <tr><td style="padding:2px 0;font-size:14px;">${t("merchant.kycRequired.need3", L)}</td></tr></table>
    `)}
    ${p(t("merchant.kycRequired.outro", L))}`;
  const pre = t("merchant.kycRequired.preheader", L, { threshold: THRESH });
  return { slug: `kyc_required.${L}`, subject: t("merchant.kycRequired.subject", L, { threshold: THRESH }), preheader: pre,
    html: dynoPayEmailTemplate(t("merchant.kycRequired.heading", L), content, true, t("merchant.kycRequired.cta", L), "#", pre) };
}

function subFailed(L: string): Built {
  const content = `${p(t("common.greeting", L, { name: "Alex Morgan" }))}
    ${p(t("merchant.subscriptionPaymentFailed.custIntro", L, { planName: "Pro Monthly", companyName: "Acme" }))}
    ${infoBox(`<p style="margin:0;font-size:14px;">${t("merchant.subscriptionPaymentFailed.custSteps", L)}</p>`, "#f59e0b")}
    ${warnText(t("merchant.subscriptionPaymentFailed.custWarn", L))}`;
  const pre = t("merchant.subscriptionPaymentFailed.custPreheader", L);
  return { slug: `sub_failed.${L}`, subject: t("merchant.subscriptionPaymentFailed.custSubject", L, { planName: "Pro Monthly" }), preheader: pre,
    html: dynoPayEmailTemplate(t("merchant.subscriptionPaymentFailed.custHeading", L), content, true, t("merchant.subscriptionPaymentFailed.custCta", L), "#", pre) };
}

function paymentReceived(L: string): Built {
  const content = `${p(t("common.greeting", L, { name: "Alex Morgan" }))}
    ${p(t("paymentReceived.intro", L, { companyName: "Acme" }))}
    ${infoBox(`<table role="presentation" width="100%">
      ${dataRow(t("labels.amount", L), "<strong>250.00 USDC</strong>")}
      ${dataRow(t("labels.status", L), statusBadge(t("statusLabels.received", L), "success"), true)}
    </table>`, "#12B76A")}
    ${p(t("paymentReceived.outro", L))}`;
  const pre = t("paymentReceived.preheader", L);
  return { slug: `payment_received.${L}`, subject: t("paymentReceived.subject", L, { amount: "250.00", currency: "USDC" }), preheader: pre,
    html: dynoPayEmailTemplate(t("paymentReceived.heading", L), content, true, t("paymentReceived.cta", L), "#", pre) };
}

const builds: Built[] = [];
for (const L of ["en", "de"]) {
  builds.push(loginOtp(L), kycRequired(L), subFailed(L), paymentReceived(L));
}

// assertions
let fails = 0;
function assert(cond: boolean, msg: string) { if (!cond) { fails++; console.log("  ASSERT FAIL:", msg); } }
for (const b of builds) {
  assert(b.html.includes(b.preheader) && b.preheader.length > 5, `preheader embedded in ${b.slug}`);
  assert(!b.preheader.includes("."), `preheader not a raw key in ${b.slug} (${b.preheader})`) // keys contain dots
}
const kycEn = builds.find(b => b.slug === "kyc_required.en")!;
assert(/selfie/i.test(kycEn.html), "kyc EN mentions selfie");
assert(!/proof of address/i.test(kycEn.html), "kyc EN has NO 'proof of address'");
assert(kycEn.subject.includes(THRESH), "kyc EN subject shows $10,000");
const subEn = builds.find(b => b.slug === "sub_failed.en")!;
assert(!/bank|card|payment method/i.test(subEn.html), "sub-failed EN has no bank/card/payment-method");
assert(subEn.html.includes("Complete payment"), "sub-failed EN CTA = Complete payment");

// write gallery
const cards = builds.map(b => `
  <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:0 0 20px;">
    <div style="padding:10px 14px;background:#0a0a0a;color:#fff;font:600 13px system-ui;">${b.slug}</div>
    <div style="padding:8px 14px;background:#f8fafc;font:12px system-ui;color:#334155;border-bottom:1px solid #e5e7eb;">
      <b>Subject:</b> ${b.subject}<br/><b>Preheader:</b> <span style="color:#059669;">${b.preheader}</span></div>
    <iframe srcdoc="${b.html.replace(/"/g, "&quot;")}" style="width:100%;height:560px;border:0;"></iframe>
  </div>`).join("");
fs.writeFileSync(`${OUT}/index.html`, `<!doctype html><meta charset=utf-8><body style="margin:0;padding:24px;background:#eef2f7;font-family:system-ui;"><h2>Part 2 — live render (EN + DE)</h2>${cards}</body>`);
for (const b of builds) fs.writeFileSync(`${OUT}/${b.slug}.html`, b.html);

console.log(`rendered ${builds.length} emails to ${OUT}/ ; assertion failures = ${fails}`);
process.exit(fails ? 1 : 0);
