# Dynopay Email Style Guide (one page)

_The house rules for every Dynopay email. Premium, trustworthy, crypto-native._

## Voice
- **Warm, plain, confident.** Speak to one person. Short sentences.
- **Crypto-native, never card-native.** Never say "card", "bank", "payment
  method on file", "billing details". Say "wallet", "on-chain", "network fee",
  "the payment link".
- **Lead with the outcome**, then the detail. ("You've been paid." → amounts.)

## Greeting (pick ONE, everywhere)
- Known name: **`Hey {{firstName}},`** (localized via `common.greeting`).
- No name: **`Hey there,`** (`common.greetingDefault`).
- ❌ Retire the inline "Hi {{name}}," / "Hi," used in some code builders.
- Never greet by raw email address (helper already guards this — keep it).

## Subject lines
- **≤ 55 characters**, front-load the value. Include the key number when useful.
- **No " - Dynopay" / " — Dynopay" suffix** on transactional & customer emails
  (the sender name is already "Dynopay"). Use a suffix only when recipient
  context is otherwise ambiguous.
- Use an **en-dash `–` with spaces** as the only separator; never the hyphen `-`.
- Sentence case. One idea per subject.
- Examples:
  - ✅ `You've been paid 0.0042 BTC` · `Your login code (expires in 5 min)`
  - ✅ `Payment confirmed – receipt from Acme` · `Verification required at $10,000`
  - ❌ `Payment received - 0.0042 BTC - Dynopay`

## Preheader (REQUIRED on every email)
- The hidden inbox-preview line. **Always set it** (the template supports it;
  today none do).
- ≤ 90 chars, **adds** info the subject doesn't repeat, no "Hey {{name}}" leak.
- Examples: `Settled to your payout wallet · net $257.45 after fees` ·
  `Never share this code — Dynopay staff will never ask for it.`

## Body
- **First line = the point.** Then a scannable detail box (`infoBox`/`dataRow`).
- **Always show fiat + crypto** for money ("0.0042 BTC · ≈ $261.37"), plus the
  **network** and, for merchants, the **net after fee**.
- One primary action. Keep it to a single CTA button.
- Cut filler ("We're excited to inform you that…"). 3–5 short paragraphs max.

## CTAs (buttons)
- **Sentence case**, verb-first, ≤ 3 words: `View transaction`, `Add wallet`,
  `Complete payment`, `Secure my account`. Apply consistently (no "View
  Transaction" / "Secure My Account" mixing).

## Emoji
- **None** in transactional, security, receipts, KYC, wallet, admin emails.
- **At most one** tasteful mark allowed in lifecycle/marketing (welcome,
  referral) — deliberate, not decorative. Default to none if unsure.

## Numbers, dates, money
- Crypto: trim trailing zeros (`formatMoneyForEmail`) — "3.20", not "3.20000000".
- Fiat/stablecoins: exactly 2 decimals with symbol + code ("$257.45 USD").
- Dates: "05 June 2026 at 2:31 PM" (already the house format) — keep consistent.
- Thresholds/fees must come from the **single source of truth in code**
  (e.g. `KYC_THRESHOLD_USD`), never hardcoded in copy.

## Security & OTP emails
- State the **expiry** and add: **"Dynopay will never ask you for this code."**
- Every "was this you?" email needs a clear, single "this wasn't me" action.

## Localization
- All merchant/customer copy goes through `emailI18n.t()` in the 6 locales
  (en/pt/es/fr/de/nl). New EN strings ship with all 6 translated in the same PR.
- The shared **chrome** (sign-off, footer, greeting) is already localized — reuse
  it; don't hardcode English chrome in a builder.

## Consistency checklist (before shipping any email)
- [ ] Preheader set (≤90 chars, non-repetitive)
- [ ] Subject ≤55 chars, sentence case, en-dash, no "Dynopay" suffix
- [ ] Greeting = "Hey …"; no raw-email greeting
- [ ] Fiat + crypto + network shown for money; net-after-fee for merchants
- [ ] One sentence-case CTA
- [ ] No card/bank language; crypto-native throughout
- [ ] No stray emoji (unless approved lifecycle/marketing)
- [ ] Numbers/thresholds sourced from code, not hardcoded
- [ ] Translated into all 6 locales
