# Dynopay — Email Content Audit & Improvement Plan (Part 1)

_Analysis-only deliverable. No production copy or send-path was modified.
SAFE MODE intact (outbound email OFF, prod DB read-only). Prepared 2026-06._

Audit scope (per user): **all ~70 templates** — both the localized copy in
`backend/locales/*/emails.json` (625 EN strings across 25 sections) **and** the
code-embedded strings across the **17 `backend/services/email/*` builders**
(+ `payoutDigestService.ts`, `emailShared.ts`). Ranking of the priority list is
by **impact × frequency** (most-sent / most-visible first).

Criteria applied to every template:
1. **Clarity** — is the message instantly understandable?
2. **Expected details** — does it contain the facts the reader needs (fiat + crypto
   amount, network, next step, fees, dates)?
3. **Conciseness** — no filler, no repetition, scannable.
4. **Premium quality** — voice, subject line, preheader, consistency, trust.

---

## 1. Executive summary

The email system is well-engineered: one shared, dark-mode-aware
`baseEmailTemplate`, a clean i18n layer (`emailI18n.t()`) with EN fallback, and
6 locales (en/pt/es/fr/de/nl). The **chrome** (logo, sign-off, footer, social
row) is consistent and localizes correctly (verified: DE renders "Beste Grüße,"
/ "Das Dynopay-Team").

The problems are almost entirely at the **copy layer**, and they cluster into
five themes:

| # | Theme | Severity | Reach |
|---|-------|----------|-------|
| A | **Content-correctness errors** (wrong KYC threshold, card/bank language on a crypto product, a broken admin email) | **P0** | High-trust emails |
| B | **No preheader on any email** (the single biggest premium-quality gap) | **P1** | ALL ~70 |
| C | **Inconsistent voice & subjects** (Hey/Hi, ` - ` vs ` — ` vs no suffix, stray emoji) | **P1** | ~40 |
| D | **Missing expected details** (fiat value, network, net-after-fee, per-coin ETA) | **P1** | Payment set |
| E | **Duplicate / redundant strings** (cleanup for Part 2) | **P2** | Locale file |

None of these break the money path. They erode the "premium, trustworthy
crypto gateway" impression the brand is going for — most on the highest-volume,
most-visible emails (receipts, payment-received, login).

---

## 2. Theme A — Content-correctness errors (P0, fix first)

### A1. KYC "verification required" quotes the WRONG threshold ($5,000)
- **Where:** `services/email/kycEmails.ts` L25 — `thresholdAmount = '5,000'`.
- **Truth:** `helper/kycEnforcement.ts` `KYC_THRESHOLD_USD = 10000`; the in-app
  activation-gate copy (`activation.gate.kyc.intro`) correctly says
  _"You've processed over $10,000…"_.
- **Impact:** The `kycRequired` email tells merchants verification kicks in at
  **$5,000** while the platform actually enforces it at **$10,000**. This is a
  factual/compliance-adjacent contradiction across the product. HIGH trust cost.
- **Fix (Part 2):** source the number from `KYC_THRESHOLD_USD` (or a shared
  constant) so email == enforcement; add the 90-day grace context.

### A2. Subscription "payment failed" uses card/bank language on a crypto product
- **Where:** `emails.json → merchant.subscriptionPaymentFailed`:
  - `custSteps`: _"1. Update your payment method  2. Ensure sufficient funds are
    available  3. **Contact your bank** if the issue persists"_
  - `custCta`: _"Update Payment"_ ; `custWarn`, `custIntro`.
- **Problem:** Dynopay is a **non-custodial crypto** gateway. There is no card
  on file and no bank to call — a subscriber pays each cycle from a wallet.
  "Update your payment method / contact your bank" is simply wrong and reads as a
  copy-paste from a card processor.
- **Also verify:** `subscriptionCreated.custOutro` — _"You'll be charged
  automatically on each billing date"_ implies a stored mandate. Confirm whether
  crypto subscriptions auto-charge or require re-authorization each cycle, and
  word accordingly.
- **Fix (Part 2):** crypto-accurate steps ("open the payment link and pay in
  crypto / make sure the wallet covers the amount + network fee / reply to the
  merchant for help"), CTA "Complete payment".

### A3. Admin "Platform Fee Received" email is BROKEN (runtime crash)
- **Where:** `services/email/adminOpsEmails.ts` `sendAdminFeeReceivedEmail`.
  Line 120 builds `subject` using `feeFmt`, but `const feeFmt` isn't declared
  until line 131 → **temporal-dead-zone ReferenceError** every call. The `catch`
  swallows it, so the admin fee-received notification **never sends**.
- **Impact:** Admin-only, but it's a real dead send-path (silent). Trivial fix.
- **Fix (Part 2):** move the `feeFmt/merchantFmt/totalFmt` declarations above the
  `subject` line.

### A4. KYC document requirements: inconsistent + possibly inaccurate for Veriff
- **Where:** `kycRequired.need2` = _"Proof of address (utility bill, bank
  statement)"_ vs `kycStarted.need2` = _"Proof of address (last 3 months)"_.
- **Problem:** The two KYC emails ask for different things, and the provider is
  **Veriff** (government ID + selfie/liveness). If proof-of-address isn't actually
  collected, both set the wrong expectation and add friction.
- **Fix (Part 2):** align both to what Veriff actually requires (**product to
  confirm**); make the two emails say the same thing.

### A5. `kycRequired` non-USD phrasing reads oddly
- Renders _"{{symbol}}5,000 USD equivalent"_ → e.g. **"€5,000 USD equivalent"**
  (symbol + "USD equivalent" together). Reword to "the equivalent of $10,000".

---

## 3. Theme B — No preheader on ANY email (P1, highest-reach win)

- `utils/emailTemplate.ts::baseEmailTemplate` **supports** a `preheader` option
  (renders the hidden inbox-preview snippet), but a repo-wide scan shows **zero
  production builders pass one** (only the throwaway `render_email_previews.ts`
  sample does).
- **Effect:** In Gmail/Apple Mail/Outlook the preview line falls back to leaking
  the first visible text (often "Hey {{name}}," or a raw fragment), which looks
  amateurish next to any polished sender.
- **This is the single highest-leverage change** — one preheader per template
  lifts the perceived quality of all ~70 emails and measurably improves open
  rates.
- **Fix (Part 2):** add a purpose-built, ≤90-char preheader to every send
  (examples in the style guide + in the rendered "after" previews).

---

## 4. Theme C — Inconsistent voice, subjects, emoji (P1)

### C1. Greeting is "Hey" in some places, "Hi" in others
- **"Hey {{name}},"** — the locale set (`common.greeting` / `chrome.greeting`).
- **"Hi {{name}},"** — code-embedded builders: wallet sudo OTP, wallet batch
  summary, creator-handle, team-joined, wallet-change alert, wallet-secured.
- Plus "Hey there," vs "Hi," for the no-name fallback. Pick ONE (recommend the
  localized `common.greeting` everywhere; retire the inline "Hi").

### C2. Subject lines have no house style
Observed in the same inbox:
- ` - Dynopay` (hyphen): `paymentConfirming`, `transactionConfirmed`,
  `paymentPartialExpired`, `invoice`…
- ` — Dynopay` (em-dash): `orderReceipt`, `webhook auto-disabled`…
- `- {{companyName}}`: `paymentFailed.subject`.
- No suffix at all: `welcome`, `loginOtp`, most OTPs.
- **Fix:** one rule (recommend: **no "Dynopay" suffix** for merchant/customer
  transactional — the sender name already says Dynopay; reserve a suffix only
  where the recipient context is ambiguous). Standardize on the en-dash `–` or
  plain `—` — not the hyphen `-` — for separators, applied consistently.

### C3. Emoji usage is arbitrary
- Merchant-facing **referral** subjects carry 🎉🚀💸; **admin** subjects carry
  ✅🎉👀⚠️; the welcome body has 🎉 (`merchant.welcome.promo`). Everything else
  (all transactional/security) is emoji-free.
- **Fix:** policy — **no emoji in transactional/security/receipts** (premium,
  trustworthy); **at most one** tasteful mark allowed in lifecycle/marketing
  (referral, welcome) if desired. Make it deliberate, not random.

### C4. CTA capitalization drifts
- "Secure My Account" vs "Secure my account" vs "Reset Password" vs "View
  Transaction" vs "Complete payment". Mixed Title Case / sentence case across
  the set. Pick one (recommend **sentence case** for a modern, non-shouty feel)
  and apply to every button.

---

## 5. Theme D — Missing expected details (P1, payment set)

### D1. `paymentReceived` (merchant) doesn't show fiat value or net-after-fee
- Shows amount + currency + txid; the fiat (USD) value and the **net you keep
  after the Dynopay fee** only appear via the referral-credit line. Merchants
  most want: **fiat value**, **network**, and **net settled**. The sample preview
  proves the design supports two stat cards (Received / Payout) + a fee table —
  production should use them.

### D2. `paymentPending` shows a hardcoded 5-coin ETA table for every payment
- The estimated-confirmation table always lists BTC/ETH/TRX/LTC/DOGE regardless
  of the coin actually being paid. A USDC-on-Polygon payer is shown "BTC: 10–60
  min". **Show only the relevant network's ETA** (the builder already receives
  the currency).

### D3. `transactionConfirmed` is too thin
- Body is just id/amount/status; heading upper-cases `{{status}}` while the intro
  lower-cases it ("Transaction Confirmed" vs "…has been confirmed"). No next step
  for non-confirmed states. Add fiat/network + a clear CTA.

### D4. Payment amounts rarely confirm the fiat equivalent to the customer
- The customer receipt shows crypto + the merchant's display currency, which is
  good — but several merchant/customer payment emails omit the "$X USD" anchor
  that makes a crypto number legible at a glance.

---

## 6. Theme E — Duplicate / redundant strings (P2, Part-2 cleanup)

- `common.greeting` **==** `chrome.greeting` ("Hey {{name}},")
- `common.team` **==** `chrome.teamSignature` ("The Dynopay Team")
- `common.greetingNoName` **==** `common.greetingDefault` **==**
  `chrome.greetingNoName` ("Hey there,")
- `receipt.merchantReceives / platformFee / feePaidByMerchant / feePaidByCustomer`
  duplicate the identical `labels.*` keys.
- **Two different `walletOtp` blocks:** top-level `walletOtp` ("Wallet
  Verification Code", validate-address flow) vs `merchant.walletOtp` ("Confirm
  your payout wallet"). Similar names, different copy → maintenance trap.
- Top-level `invoice` (PDF invoice strings) vs `merchant.invoice` (invoice-email
  strings) — both legit but confusingly named.
- **Fix:** collapse the exact duplicates to a single source, and rename the two
  `walletOtp` blocks so intent is obvious. Do this only in Part 2 to avoid
  churning all 6 locales before copy is approved.

---

## 7. Priority list — Top 15 (by impact × frequency)

Volume/visibility first; correctness bugs folded in where they land on a
high-traffic template. Each row states the concrete fix.

| # | Email (builder) | Why it ranks | Primary fixes |
|---|-----------------|--------------|---------------|
| 1 | **Customer payment confirmation / receipt** (`customerReceiptEmail.ts`) | Buyer-facing, every successful payment, external brand impression, has PDF | Add preheader; tighten intro; confirm fiat anchor; sentence-case; keep PDF line only when attached (already conditional ✔) |
| 2 | **Payment received — merchant** (`paymentEmails.ts`) | Every payment | Add preheader; add fiat value + **net-after-fee** stat cards + network row (D1) |
| 3 | **Login OTP** (`accountEmails.ts`) | Every login | Add preheader ("Expires in 5 min · never share"); add "Dynopay will never ask for this code" |
| 4 | **Payment pending** (`paymentEmails.ts`) | Every crypto payment while confirming | Add preheader; **show only the paid coin's ETA** (D2); add fiat |
| 5 | **Welcome** (`accountEmails.ts`) | Every signup | Add preheader; tighten intro2; verify promo wording vs landing/fees |
| 6 | **Order receipt — buyer** (`orderEmails.ts`) | Every product sale | Add preheader ("Order {{ref}} · {{total}}"); unify greeting (uses inline) |
| 7 | **KYC required** (`kycEmails.ts`) | High trust, moderate volume | **Fix $5,000 → $10,000 (A1)**; fix non-USD phrasing (A5); add grace context; preheader |
| 8 | **Withdrawal OTP + success** (`walletEmails.ts`) | Payout flow | Preheader; "never share" on OTP; consistent greeting |
| 9 | **Wallet added / wallet-change alert** (`walletEmails.ts`, `walletSecurityEmails.ts`) | Security-sensitive, common in onboarding | Preheader; switch inline "Hi" → "Hey" (C1) |
| 10 | **Subscription payment failed** (`billingReportEmails.ts`) | Correctness | **Remove card/bank language → crypto steps (A2)**; CTA "Complete payment"; preheader |
| 11 | **Auto-conversion payout** (`conversionEmails.ts`) | Frequent for auto-convert merchants | Preheader ("Converted to {{target}} · sent to your wallet") |
| 12 | **Payment failed / underpaid** (`paymentEmails.ts`) | Customer + merchant | Preheader; clearer single next step |
| 13 | **Weekly payout digest** (`payoutDigestService.ts`) | Weekly, every active merchant | Preheader; otherwise strong |
| 14 | **Password reset OTP + password changed** (`accountEmails.ts`) | Security | Preheader; "never share"; sentence-case CTA |
| 15 | **Payment link created + reminders** (`linkCampaignEmails.ts`) | Common merchant action + customer nudges | Preheader; unify subject style; reminder urgency tone |

> Correctness bug **A3** (broken admin fee email) is a must-fix in Part 2 but is
> admin-only, so it is not in the merchant/customer-facing Top 15.

---

## 8. Rendered before/after previews

Faithful HTML (uses the real `baseEmailTemplate` + helpers) is generated by
`backend/scripts/email_audit_preview.ts` into `/tmp/email_audit_preview/`:

- **English before/after** for the Top 15 (current copy vs proposed rewrite,
  each with the proposed preheader visible in a debug banner).
- **German (de) current-state** for 3 representative emails (payment received,
  login OTP, customer receipt) to **sanity-check that the shared i18n chrome
  localizes** (greeting, sign-off, footer) — confirmed rendering
  "Beste Grüße," / "Das Dynopay-Team".
- Open `/tmp/email_audit_preview/index.html` for the side-by-side gallery.

Regenerate: `cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/email_audit_preview.ts`

---

## 9. Part-2 execution plan (after approval — NOT started)

1. Apply the approved EN rewrites + **preheaders** to `locales/en/emails.json`
   and the code-embedded copy (subjects, CTAs, greetings).
2. Fix the content-correctness items **A1–A5** (KYC threshold from the shared
   constant, crypto subscription copy, `feeFmt` ordering bug, KYC doc alignment,
   non-USD phrasing).
3. De-duplicate the redundant strings (Theme E); rename the two `walletOtp`
   blocks.
4. Enforce the subject / greeting / CTA / emoji house style from the style guide.
5. Re-render all touched templates locally to confirm nothing broke; then
   translate the changed strings into de/es/fr/nl/pt (P1 follow-up).
6. (Future) PDF receipt & PDF invoice content audit.

---

# Part 2 — Rewrites Applied (2026-06)

Approved and applied per user choices **1a / 2a / 3a / 4b**. SAFE MODE intact — nothing was sent. `tsc --noEmit` clean, all 6 locale files valid JSON, live EN+DE render verified.

## Correctness (P0)
- **A1 — KYC threshold:** now sourced from `KYC_THRESHOLD_USD` (**$10,000**). Subject/intro use a `{{threshold}}` placeholder so all 6 languages show the correct figure automatically.
- **A2 — Subscriptions are crypto, not cards/banks:** `subscriptionPaymentFailed` steps rewritten (secure pay-link → wallet balance incl. network fees → contact merchant), CTA → **"Complete payment"**. `subscriptionCreated` outro now says a secure crypto pay-link is sent each cycle (no "charged automatically").
- **A3 — Admin fee email crash:** `sendAdminFeeReceivedEmail` used `feeFmt` before its declaration (TDZ → never sent). Declarations moved above the subject.
- **A4 — KYC documents:** both KYC emails now list **government photo ID + quick selfie for liveness + ~5 min** (no proof-of-address), consistent with the Veriff flow.

## Premium / consistency (P1)
- **Preheaders on every customer/merchant-facing email** — template helpers extended; 41 locale-driven call sites wired + 47 preheader keys added across all 6 languages; code-embedded emails got inline preheaders.
- **Subject house-style** applied to all subjects in all 6 languages (dropped " - Dynopay", normalised to en-dash); 4 vague subjects reworded for clarity.
- **Greeting** unified to "Hey"; **emoji** stripped from `welcome.promo` (kept in referral/marketing per 3a).
- **payoutDigest** chrome now localized (`lang` forwarded) + preheaders added.

## Verification
- `backend/scripts/apply_part2_wiring.py` (41/41 call sites), `apply_part2_locales.py` (6 locales), `verify_part2_render.ts` → `memory/email_previews_v2/` (live EN+DE render, assertions passed).

## Known follow-up (deferred, P1)
- `dynoPayEmailTemplate` does **not** forward `lang` to the base template, so the shared **sign-off/footer** ("Best regards, / The Dynopay Team", tagline, links) still renders in **English on non-English emails** (body, subject and preheader ARE localized). Fix = add a `lang` param + append it at ~40 call sites (same mechanical pattern). Pre-existing and outside the approved Part-2 list — flagged for approval.
- P2: de-dupe redundant keys (`common.*` == `chrome.*`, `receipt.*` == `labels.*`, the two `walletOtp` blocks).
