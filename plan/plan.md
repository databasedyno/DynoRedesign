# Dynopay — Email Content Audit & Improvement Plan

## Objective
Review every email Dynopay sends (merchant, customer/payer, contributor and internal admin emails) against four criteria — clarity, expected details, conciseness, premium quality — and deliver a concrete, approvable set of improvements: rewritten subject lines, preheaders and body copy, plus a short style guide so future emails stay consistent.

Work is split in two parts. Part 1 (the audit and recommendations) is what this plan approves. Part 2 (applying the approved rewrites to the live templates) starts only after the report is reviewed.

## Scope
Roughly 70 distinct email templates, in these groups:

| Group | Examples | Audience |
|---|---|---|
| Account & security | Welcome, verify-email OTP, login OTP, password reset OTP, password changed, profile updated, email changed, new sign-in, failed logins, security alert | Merchant |
| Company & onboarding | Profile complete, add-wallet reminder, company updated, contact-person welcome, activation nudges (day 1/3/7), setup gate (brand / wallet / KYC) | Merchant |
| Wallet | Wallet OTPs (add / edit / delete / update), wallet added / updated / removed / active, withdrawal OTP & submitted, exchange OTP | Merchant |
| Payments | Payment pending, confirming, received, partial, partial expired, failed/underpaid, overpayment, large payment, auto-conversion payout, transaction confirmed | Merchant (+ customer for failed) |
| Customer-facing | Payment receipt (with PDF), order confirmation, order shipped / expired / refunded, download reminder, subscription confirmed / cancelled / payment failed, contribution thank-you, campaign update | Payer / buyer / contributor |
| Growth & reporting | Weekly summary, weekly payout digest, weekly conversion report, volume-tier upgrade, payment link created, crowdfunding live, referral invite & reminders, invoice generated, API key created/regenerated | Merchant |
| KYC | Required, started, approved, rejected, resubmission | Merchant |
| Internal admin | New registration, onboarding stuck / completed, first payment, new visitor, fee received / sweep, webhook disabled | Dynopay team |

English copy is the source of truth; five other languages (DE, ES, FR, NL, PT) are translated from it. Some emails (creator handle, admin notifications, order/refund emails) carry English copy directly in code rather than in the translation files — these are in scope for content review and will be flagged.

## Evaluation criteria (how each email is scored)
Each email is scored 1–5 on each criterion, with the specific problem quoted.

1. **Clarity** — Can the reader tell in one glance what happened, whether money moved, and what (if anything) they must do? Is the subject line specific (amount, company, action) rather than generic?
2. **Expected details** — Does it contain what a recipient of that email type expects: amounts in both crypto and fiat, company name, transaction reference, date with time zone, status, next step, where to get help? Does it omit details that are irrelevant to that recipient?
3. **Conciseness** — No filler ("Great news!", "You're so close!"), no repeated sentences, no lists of every possibility when only one applies, no sign-off ceremony on machine notifications.
4. **Premium quality** — Consistent voice, no emoji in subject lines or body, correct typography (one dash style, proper casing), professional greeting/sign-off, no clichés, statements that are factually correct for a crypto (not card) payment product, no wording that talks down to the reader.

## Preliminary findings (first read — the full audit will confirm and extend these)

Cross-cutting
- Subject lines mix three separators: `Payment received - 50 USDT`, `Partial payment received — action needed`, `Invoice 1234 - Dynopay`. Some carry a `- Dynopay` suffix, most do not. The sender name already says Dynopay, so the suffix wastes preview space.
- Greeting is inconsistent: "Hey {{name}}," in most emails, "Hi {{name}}," in the creator-handle email, "Hello," in the company-contact welcome. Sign-off has two variants ("Thanks," and "Best regards,") and is appended even to OTP codes and admin alerts.
- Preheader (inbox preview text) is supported by the template but effectively unused, so inboxes show the first body sentence ("Hey Alex,") instead of the key fact.
- Dates are rendered in a fixed UK-date / US-time combination ("02 June 2026 at 03:15 PM") with no time zone, regardless of the recipient's language.
- Emoji appear in copy and subjects (🎉 in the welcome promo; 🔴🟡🟠✅🎉👀 in admin subjects).
- Several duplicate or near-duplicate strings exist (two identical default greetings, three variants of "Received amount", fee labels defined twice), which is how inconsistencies creep in over time.
- Footer reads "All Rights reserved" (mis-capitalised) and the tagline "Secure Crypto Payment Gateway" doesn't match the "non-custodial" positioning used in the body copy.
- The HTML document language is always English even when the email is sent in German, French, etc.

Content correctness
- The subscription "payment failed" email tells the customer to "update your payment method" and "contact your bank" — there is no card or bank in a crypto payment; the real fix is to complete a fresh crypto payment.
- The payment-pending email lists estimated confirmation times for BTC, ETH, TRX, LTC and DOGE in every email, even though the payment is on one known chain.
- KYC emails disagree with each other on requirements ("utility bill, bank statement" vs "last 3 months" vs "selfie verification") and on timing ("about 5 minutes" vs "reviewed within 24–48 hours").
- "Password updated" CTA is "View Account Settings"; for a security event the CTA should be the same "This wasn't me — secure my account" pattern used in the sign-in email.
- "Transaction confirmed" email has a raw status in the subject and no company or amount context in the intro.

Tone & filler
- Frequent exclamation-led openers: "Great news!", "Good news!", "Great job!", "You're so close!", "Keep up the momentum!", "Keep growing your business with Dynopay!".
- Clichés: "we've got you covered", "here to help you get paid", "Whether you're a freelancer, business owner, or developer".
- Awkward pluralisation: "{{count}} transaction(s)".

Expected details
- Payment emails to merchants don't consistently show both the crypto amount and the fiat equivalent, nor the network/chain, nor the net amount after Dynopay fee.
- Several time-sensitive emails (pending, confirming, partial) have no button to the transaction, while low-stakes emails (profile updated) do.
- Withdrawal / wallet emails show the address but not the network or an explorer link where one exists.

## Deliverables (Part 1)
1. **Audit report** (`/app/memory/email_audit.md`), organised by group, containing for every email:
   - current subject and a one-line description of the body,
   - scores on the four criteria with quoted evidence,
   - recommended subject line, preheader and rewritten body copy (before/after),
   - which recommendations are copy-only and which need a small data change (e.g. adding chain name or fiat equivalent to the email).
2. **Priority list** — top 15 emails to fix first, ranked by send volume and money-relevance (OTPs, payment received/pending/confirming, customer receipt, welcome, failed/underpaid, weekly digest, KYC required, order confirmation).
3. **One-page email style guide** — voice, greeting/sign-off rule, subject-line pattern, number/date/time-zone formatting, CTA verb list, when to use success/alert/error boxes, emoji policy, preheader rule.
4. **Rendered before/after HTML previews** for the top 15, so the recommendations can be judged visually rather than as raw text.

## Part 2 (after report approval)
Apply the approved rewrites to the English templates and code-embedded copy, add preheaders, fix the content-correctness items above, remove duplicate strings, and re-render all templates to confirm nothing broke. Translation of changed strings into the five other languages is proposed as a separate follow-up (see Decisions).

## Decisions taken (change these if you disagree)
- **Voice:** recommend moving from "Hey {{name}}," to "Hi {{name}}," and a single sign-off "— The Dynopay team", dropped entirely on OTP and admin/system emails. Alternatives will be shown in the report; the default recommendation is the more neutral, finance-grade tone.
- **Subject pattern:** `<What happened> · <key fact>` with one separator throughout, no `- Dynopay` suffix, no emoji. Example: `Payment received · 50 USDT from Acme`.
- **Admin emails are in scope** but scored lightly — recommendations focus on scannability (clear subject, table of facts) rather than polish.
- **Languages:** the audit and rewrites cover English only. Once English is approved, changed strings are translated into DE/ES/FR/NL/PT as a follow-up so all six stay aligned. Until then, other languages keep their current wording.
- **No emails are sent** during the audit or preview rendering; everything is rendered to local HTML files only.
- **Design/layout** (colours, logo, dark mode, button styling) is out of scope; only words, structure and what information appears are reviewed.

## Out of scope
- PDF receipt and PDF invoice content (separate documents; can be a follow-up).
- Email deliverability, sending infrastructure, or notification frequency (e.g. the per-visitor admin email).
- Visual redesign of the template shell.

## Success criteria
- Every email has a score, quoted evidence and a concrete rewrite where needed.
- All content-correctness errors listed above are addressed in the recommendations.
- The style guide is short enough to fit on one page and unambiguous enough that a new email written against it would match the rest.
