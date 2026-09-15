# Phase 1 audit — emails, public pages, hosted checkout, creator pages (June 2026)

**Gallery (browsable, click any thumbnail):** `<preview-url>/audit/index.html` · this report: `/app/plan/audit_phase1.md`
(also served at `/audit/audit_phase1.md`). Everything was rendered in SAFE MODE — nothing sent, nothing mutated.

## 1. What was done
- **Emails:** built `backend/scripts/audit_render_all_emails.ts` — calls **every** sender (110 functions across 21 files) with
  realistic sample data → 138 HTML renders (`/app/plan/audit/emails/html/`, `manifest.json`) → 828 screenshots at 600 px and
  390 px in light / prefers-dark / Gmail forced-inversion (`scripts/qa/email_dark_shots.mjs --width --full-slug`).
  Structural checks per email (`scripts/qa/audit_email_structure.py` → `email_audit.json`): subject length + placeholders,
  preheader, CTA count/target, local-part greeting, money fields, footer, raw i18n keys, phone height.
- **Pages:** `scripts/qa/audit_page_shots.mjs` — 65 routes (public 27 · buyer 16 · creator 5 · in-app 17) × 390/820/1366/1920
  × light/dark = 520 full-page shots + per-shot audit (horizontal overflow, clipped text, raw i18n keys, JS errors, 502).
  Hosted checkout "awaiting" state uses the SAFE-MODE mock recipe (no address reserved); cart/checkout use the localStorage cart.
- **Gallery/report generators:** `scripts/qa/build_audit_gallery.py`, `scripts/qa/build_audit_report.py`; verdicts live in
  `/app/plan/audit/findings.json`. `public/audit/` is git-ignored.

## 2. Blockers found — and FIXED during Phase 1 (decision 0.3)
| # | Blocker | Fix |
|---|---|---|
| B1 | **Merchant "Payment received" showed no money path** (no fee, net, network fee, destination wallet, forward tx). | New **"Payment settled"** layout: `sendPaymentReceivedEmail(..., moneyPath)` + `services/email/paymentSettled.ts` (gross + fiat-at-detection, Dynopay fee tier % + amount + payer, network fee + who bore it, net forwarded, masked destination (+tag), forward tx + explorer link **or** "Forwarding now — appears in Payouts", asset · network, paid for, masked customer, reference, detected time, CTA → `/transactions?tx=<id>` opens the drawer). Auto-convert and below-minimum variants handled. Wired at `chainVerification.ts` (all vars in scope), sweep recovery (`merchantPoolSweep.ts`, reads pool-tx row + payout wallet) and the test hook. `paymentSettled.*` strings in all 6 languages (`scripts/inject_payment_settled_i18n.py`). |
| B2 | **Login-OTP and e-mail-verification OTP subjects shipped literally as `{{code}} is your Dynopay login code`** (`accountEmails.ts`; live callers `authLogin.ts:239`, `onboarding.ts:405`, `registrationEmail.ts:121`). | `t(..., { code: otpCode })` — subject now "482913 is your Dynopay login code". |
| B3 | Webhook paused / webhook redirect emails **greeted twice** ("Hey Alex, Hey Alex,"). | Removed the inline greeting (template already greets). |

Verified: backend `tsc` 0 errors, `check-email-dark-mode.mjs` OK, harness re-rendered 138/138 with 0 raw keys, settled email
checked visually in light + Gmail-inversion at 600/390. No live send possible in SAFE MODE (outbound mail off).

## 2b. Cross-cutting findings (apply to most emails — Wave 4 "one shared template" item)
- **Footer** has Privacy · Terms · Support + socials, but **no "why you received this", no notification-settings link, no legal
  entity name + address** (95/138 merchant emails lack any settings/unsubscribe link). Standard A1 requires all four.
- **Preheader missing on 31 emails** (activation drip/gate, all wallet OTP/wallet-changed family, admin ops, generic sendEmail).
- **Date/time formats differ**: "05 June 2026 at 14:02 UTC" vs "15 September 2026 at 03:01 AM" (no TZ, en-US) vs ISO strings
  (payment link expiry, weekly conversion). Route everything through `formatEmailDateTime`.
- **CTA → list page instead of the object** in 33 emails (transactions / dashboard / invoices). Settled email now deep-links;
  KYC emails should open `/kyc`, subscriptions their own page, payouts `/payouts`.
- **Network/asset vocabulary**: "Network BTC", "Blockchain BTC", "USDT-TRC20" — use `assetNetworkLabel` ("USDT · Tron (TRC-20)").
- **Overlapping senders**: loginNotification ≈ newDeviceAlert; largeTransaction ≈ paymentSettled; orderReceiptMerchant ≈
  paymentSettled (same sale, two emails, the order one without money path); brand `deleted` ≈ brandSoftDeleted; four wallet-OTP
  variants + stepUpCode; addWalletReminder ≈ activation gate/wallet ≈ profileCreated.
- Plain-text part exists (Brevo `textContent` = stripped HTML) — acceptable. Dark mode: guard passes; Gmail inversion legible.
- Sweep artefacts: the Next **dev** server behind the preview ingress intermittently answers **502** under load; such shots are
  marked "502/abort" in the tables and gallery and are **not product defects** (re-shoot before judging those cells).
