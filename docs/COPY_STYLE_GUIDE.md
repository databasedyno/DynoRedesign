# DynoPay — UX Copy Style Guide

A short, practical guide for writing product copy (buttons, labels, helper text,
errors, empty states). Keep it consistent so the product feels calm and trustworthy —
merchants are moving money, so clarity beats cleverness.

---

## 1. Voice & tone
- **Friendly, plain, confident.** Talk like a helpful colleague, not a bank or a bro.
- **Second person.** Address the merchant as "you" / "your". Never "the user".
- **Reassure around money & security.** When the copy touches funds, custody, or
  irreversible actions, be explicit and calm (e.g. "we never hold your funds",
  "transactions can't be reversed").
- **No hype, no fake stats.** Only claim what's verifiable. Avoid exclamation-heavy
  marketing inside the app.

## 2. Casing
- **Buttons & CTAs → sentence case.** "Create payment link", "Add wallet",
  "Verify & log in". Not Title Case, not ALL CAPS.
- **Labels & field titles → sentence case.** "Wallet address", "Communication language".
- **Headings/titles → sentence case.** "Create your account", "Payment settings".
- **Proper nouns keep their case.** DynoPay, USDT, TRC-20, Google.
- **Product brand is always `DynoPay`** (capital D, capital P) in prose. Lowercase only
  in URLs/handles (`dynopay.com`).

## 3. Buttons / CTAs
- **Lead with a verb.** "Add wallet", "Copy link", "Send verification code".
- **Be specific over generic** where it helps: "Verify & create account" beats "Submit".
- **One primary action per view.** Secondary actions use the outlined/ghost variant.
- **Match the outcome.** If it opens a step, say "Continue"; if it finishes, say "Done".
- **Loading states** describe what's happening: "Creating…", "Verifying…" (with ellipsis `…`).

## 4. Helper text
- **Explain the why, not the obvious.** Good: "A label just for you — customers never
  see it." Avoid: "Enter the wallet name."
- **Teach the next action** in empty states ("Add a wallet to start receiving payments").
- Keep it to one short sentence. Put it directly under the field.

## 5. Error messages
- **Say what happened + how to fix it.** "Please enter a valid email" beats "Invalid input".
- **No blame, no jargon, no codes** in user-facing text.
- **Actionable & specific.** "This email already has an account — enter the code to log in."

## 6. Punctuation & formatting
- Use the real ellipsis character `…` (not `...`) for loading/truncation.
- Use an em dash `—` for asides.
- No trailing periods on button labels or short field labels; do use them in helper
  text and multi-sentence copy.
- Numbers & symbols: "USDT-TRC20", "0.8%", "$500".

## 7. i18n rules (non-negotiable)
- **Every user-facing string goes through `t("key")`.** No hardcoded English in JSX.
- **No `t("key") || "English"` fallbacks.** If a key can be missing, add it to the
  `en` source instead. `scripts/check-i18n.mjs` enforces completeness across all locales.
- **Add new keys to `langs/locales/en/<namespace>.json` first**, then translate to
  pt / es / fr / de / nl. Run `node scripts/check-i18n.mjs` before committing.
- Use interpolation (`{{count}}`, `{{name}}`) instead of string concatenation so
  translators can reorder.

## 8. Terminology (canonical terms)
| Use | Not |
|---|---|
| payment link | pay link, paylink |
| wallet | address book, account |
| verification code | OTP (in UI copy) |
| log in (verb) / login (noun) | signin |
| sign up (verb) | register (in CTAs; "Create your account" preferred) |
| customer | client (except the existing "Client name" field) |
| settle / settlement | payout (when referring to the on-chain transfer to the merchant) |

---

*Applied so far to the highest-traffic screens: auth (register/login), Add-wallet modal,
and the Create-payment-link settings. Extend to remaining screens as they're touched.*
