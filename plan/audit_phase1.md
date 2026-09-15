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


## 3. Emails — every sender (138 renders, 21 files)

Shots: `/audit/index.html#emails` (600 + 390 px · light / dark / Gmail-inversion). Verdict keys: keep · fix · merge · retire. Severity: blocker · should fix · polish.


### account

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 1 | `welcome` [shot](/audit/index.html#001_account_welcome) | merchant | Welcome to Dynopay — your first payment is fee-free (51) | keep | polish | CTA opens a list page, not the object | Good. CTA → /dashboard (list). Footer lacks notification-settings link + legal address (cross-cutting). |
| 2 | `welcome` · de [shot](/audit/index.html#002_account_welcome_de) | merchant | Willkommen bei Dynopay — deine erste Zahlung ist gebührenfrei (61) | keep | polish | subject > 60 chars; CTA opens a list page, not the object | Good. CTA → /dashboard (list). Footer lacks notification-settings link + legal address (cross-cutting). |
| 3 | `volumeTierUpgrade` [shot](/audit/index.html#003_account_volumeTierUpgrade) | merchant | Your Dynopay fee is now 1.2% (Growth tier) (42) | keep | polish | CTA opens a list page, not the object | Clear; CTA could open Settings → Plan & fees instead of /dashboard. |
| 4 | `emailVerificationOtp` [shot](/audit/index.html#004_account_emailVerificationOtp) | merchant | 482913 is your Dynopay verification code (40) | fix | blocker | — | FIXED in Phase 1: subject shipped as literal '{{code}} is your Dynopay verification code' (live callers onboarding.ts / registrationEmail.ts). Consider retiring in favour of sendPurposeOTPEmail('emailVerify'). |
| 5 | `loginOtp` [shot](/audit/index.html#005_account_loginOtp) | merchant | 482913 is your Dynopay login code (33) | fix | blocker | — | FIXED in Phase 1: subject shipped as literal '{{code}} is your Dynopay login code' (authLogin.ts resend path). Duplicate of sendPurposeOTPEmail('login') → merge. |
| 6 | `passwordChanged` [shot](/audit/index.html#006_account_passwordChanged) | merchant | Your Dynopay password was changed (33) | keep | polish | — | Date has UTC; fine. |
| 7 | `profileUpdated` · 1 [shot](/audit/index.html#007_account_profileUpdated_1) | merchant | Your account details were changed (33) | fix | polish | — | Field names raw ('name', 'email'); date format 'at 03:01 AM' without TZ — unify with formatEmailDateTime. |
| 8 | `profileUpdated` · 2 [shot](/audit/index.html#008_account_profileUpdated_2) | merchant | Your Dynopay login email was changed (36) | fix | polish | — | Field names raw ('name', 'email'); date format 'at 03:01 AM' without TZ — unify with formatEmailDateTime. |
| 9 | `creatorHandleUpdated` · new [shot](/audit/index.html#009_account_creatorHandleUpdated_new) | merchant | Your handle @acmestore is reserved (34) | keep | polish | — | Date format without TZ. |
| 10 | `securityAlert` [shot](/audit/index.html#010_account_securityAlert) | merchant | Security alert on your account (30) | keep | polish | — | Generic alertType/details; CTA → settings (ok). |
| 11 | `loginNotification` [shot](/audit/index.html#011_account_loginNotification) | merchant | New sign-in to your Dynopay account (35) | merge | should fix | — | Overlaps newDeviceAlert (both fire on sign-in). Keep one: new-device alert with 'sign out everywhere' one-tap. |
| 12 | `failedLoginAttempts` [shot](/audit/index.html#012_account_failedLoginAttempts) | merchant | Multiple failed login attempts on your account (46) | keep | polish | — |  |
| 13 | `newDeviceAlert` [shot](/audit/index.html#013_account_newDeviceAlert) | merchant | New device signed in to your Dynopay account (44) | keep | keep | — | Model email: facts table + one-tap 'sign out everywhere'. |

### activation

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 14 | `drip` · d1_madeLink [shot](/audit/index.html#014_activation_drip_d1_madeLink) | merchant | You're set up — here's how to get your first payment (52) | fix | polish | no preheader | No preheader (uses raw dynoPayEmailTemplate with empty preheader); two links before the CTA (video + unsubscribe) compete with the primary button. |
| 15 | `drip` · d3_madeLink [shot](/audit/index.html#015_activation_drip_d3_madeLink) | merchant | Still here to help you get paid (31) | fix | polish | no preheader | No preheader (uses raw dynoPayEmailTemplate with empty preheader); two links before the CTA (video + unsubscribe) compete with the primary button. |
| 16 | `drip` · d7_madeLink [shot](/audit/index.html#016_activation_drip_d7_madeLink) | merchant | Your Dynopay account is ready when you are (42) | fix | polish | no preheader | No preheader (uses raw dynoPayEmailTemplate with empty preheader); two links before the CTA (video + unsubscribe) compete with the primary button. |
| 17 | `drip` · d1_noLink [shot](/audit/index.html#017_activation_drip_d1_noLink) | merchant | You're set up — here's how to get your first payment (52) | fix | polish | no preheader | No preheader (uses raw dynoPayEmailTemplate with empty preheader); two links before the CTA (video + unsubscribe) compete with the primary button. |
| 18 | `drip` · d3_fundraiser_de [shot](/audit/index.html#018_activation_drip_d3_fundraiser_de) | merchant | Wir helfen Ihnen weiterhin, bezahlt zu werden (45) | fix | polish | no preheader | No preheader (uses raw dynoPayEmailTemplate with empty preheader); two links before the CTA (video + unsubscribe) compete with the primary button. |
| 19 | `gate` · brand [shot](/audit/index.html#019_activation_gate_brand) | merchant | Finish setting up to get paid (29) | fix | polish | no preheader | Same as drip: no preheader; CTA targets /create-pay-link for every gate (wallet gate should deep-link to /wallet, KYC to /kyc). |
| 20 | `gate` · wallet [shot](/audit/index.html#020_activation_gate_wallet) | merchant | Finish setting up to get paid (29) | fix | polish | no preheader | Same as drip: no preheader; CTA targets /create-pay-link for every gate (wallet gate should deep-link to /wallet, KYC to /kyc). |
| 21 | `gate` · kyc [shot](/audit/index.html#021_activation_gate_kyc) | merchant | Finish setting up to get paid (29) | fix | polish | no preheader | Same as drip: no preheader; CTA targets /create-pay-link for every gate (wallet gate should deep-link to /wallet, KYC to /kyc). |

### adminNotif

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 22 | `newUser` [shot](/audit/index.html#022_adminNotif_newUser) | admin/ops | New Merchant Registration — Alex Rivera · DE · email (52) | keep | keep | no preheader | Admin/ops — fine. |
| 23 | `onboardingStuck` [shot](/audit/index.html#023_adminNotif_onboardingStuck) | admin/ops | 🔴 Critical Onboarding Stuck — Alex Rivera at "wallet" (49h) (59) | keep | keep | no preheader | Admin/ops — fine; emoji in subject. |
| 24 | `onboardingCompleted` [shot](/audit/index.html#024_adminNotif_onboardingCompleted) | admin/ops | Onboarded: Alex Rivera (ready to accept payments) (49) | keep | keep | no preheader |  |
| 25 | `firstPayment` [shot](/audit/index.html#025_adminNotif_firstPayment) | admin/ops | First payment: Alex Rivera · 0.0042 BTC (39) | keep | keep | no preheader | Admin/ops; shows raw source key 'payment_link'. |
| 26 | `newVisitor` [shot](/audit/index.html#026_adminNotif_newVisitor) | admin/ops | New Visitor — DE via google.com (31) | retire | polish | no preheader | Admin/ops noise — one email per unique visitor. Recommend retire or daily digest. |
| 27 | `brandDeleted` [shot](/audit/index.html#027_adminNotif_brandDeleted) | admin/ops | Brand deleted — "Acme Store" — restore by 05 July 2026 (54) | keep | keep | — |  |
| 28 | `accountDeleted` [shot](/audit/index.html#028_adminNotif_accountDeleted) | admin/ops | Account deleted — onarrival21@example.com — restore by 05 July 2026 (67) | keep | keep | subject > 60 chars |  |

### adminOps

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 29 | `largeTransaction` [shot](/audit/index.html#029_adminOps_largeTransaction) | merchant | Large payment: 5,200.00 USD (27) | merge | should fix | no preheader; CTA opens a list page, not the object; money: no fee; money: no net; money: no network | Duplicates 'Payment settled' for the same payment with less information (no fee/net/network/hash) and a list-page CTA. Fold into settled email as a 'Large payment' badge, or send with the same money path. |
| 30 | `webhookDisabled` [shot](/audit/index.html#030_adminOps_webhookDisabled) | merchant | Action needed – webhook delivery paused for Acme Store (54) | fix | should fix | — | FIXED in Phase 1: greeting rendered twice ('Hey Alex, Hey Alex,'). Remaining: CTA link /settings/webhooks — verify route exists (developer-keys?). |
| 31 | `webhookRedirect` [shot](/audit/index.html#031_adminOps_webhookRedirect) | merchant | Heads up – your webhook URL redirects (Acme Store) (50) | fix | should fix | — | FIXED in Phase 1: duplicate greeting. Same CTA route check as webhookDisabled. |
| 32 | `adminFeeReceived` [shot](/audit/index.html#032_adminOps_adminFeeReceived) | admin/ops | Platform fee received – 0.000063 BTC (36) | keep | keep | no preheader | Admin/ops; no preheader. |
| 33 | `adminFeeSweep` [shot](/audit/index.html#033_adminOps_adminFeeSweep) | admin/ops | Admin Fee Swept — 0.0412 ETH (28) | keep | keep | no preheader |  |
| 34 | `treasuryLow` [shot](/audit/index.html#034_adminOps_treasuryLow) | admin/ops | Low MATIC treasury — top up Binance (35) | keep | keep | no preheader |  |
| 35 | `conversionFailed` [shot](/audit/index.html#035_adminOps_conversionFailed) | admin/ops | Auto-convert failed — 0.0042 BTC (~$261.37) held for Acme Store (63) | keep | keep | subject > 60 chars; no preheader | Good ops email. NOTE: 'The merchant has not been notified' — Wave 4 'Payout delayed' email covers this gap. |

### billing

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 36 | `invoiceGenerated` [shot](/audit/index.html#036_billing_invoiceGenerated) | merchant | Dynopay fee invoice INV-2026-000481 (35) | fix | polish | CTA opens a list page, not the object | Amount always formatted to 2 dp with a fiat symbol — breaks if currency is a crypto asset (harness showed 'BTC 0.00 BTC'). Production passes fiat, so not live-breaking. |
| 37 | `apiKeyCreated` [shot](/audit/index.html#037_billing_apiKeyCreated) | merchant | New production API key created (30) | keep | keep | — |  |
| 38 | `apiKeysHashedNotice` [shot](/audit/index.html#038_billing_apiKeysHashedNotice) | merchant | Security update: your API keys are now shown only once (54) | keep | keep | — | One-off announcement; long on phone (1351px) but fine. |
| 39 | `apiKeyRevoked` [shot](/audit/index.html#039_billing_apiKeyRevoked) | merchant | production API key deleted — integrations using it will fail (60) | keep | keep | — |  |
| 40 | `subscriptionCreated` · 1 [shot](/audit/index.html#040_billing_subscriptionCreated_1) | buyer | New subscriber to Pro plan (26) | fix | should fix | CTA opens a list page, not the object | Buyer copy has no CTA and no 'manage subscription' path; merchant copy CTA → /dashboard (no subscriptions page). Subscriptions are billed by emailed pay-link — say so with the first link. |
| 41 | `subscriptionCreated` · 2 [shot](/audit/index.html#041_billing_subscriptionCreated_2) | buyer | You're subscribed to Pro plan (29) | fix | should fix | — | Buyer copy has no CTA and no 'manage subscription' path; merchant copy CTA → /dashboard (no subscriptions page). Subscriptions are billed by emailed pay-link — say so with the first link. |
| 42 | `subscriptionCancelled` · 1 [shot](/audit/index.html#042_billing_subscriptionCancelled_1) | buyer | Pro plan subscription cancelled (31) | fix | polish | — | Merchant CTA → /dashboard (list). |
| 43 | `subscriptionCancelled` · 2 [shot](/audit/index.html#043_billing_subscriptionCancelled_2) | buyer | Jamie Chen cancelled their subscription (39) | fix | polish | CTA opens a list page, not the object | Merchant CTA → /dashboard (list). |

### company

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 44 | `profileCreated` [shot](/audit/index.html#044_company_profileCreated) | merchant | Acme Store · One step left — add a payout wallet to get paid (60) | keep | keep | — | Good next-step email (add wallet). |
| 45 | `contactWelcome` [shot](/audit/index.html#045_company_contactWelcome) | merchant | Acme Store was added to Dynopay (31) | keep | polish | CTA opens a list page, not the object | 'Hello,' greeting (no name); fine for a company contact. |
| 46 | `profileUpdated` [shot](/audit/index.html#046_company_profileUpdated) | merchant | Acme Store · Your brand details were changed (44) | fix | polish | — | Field names raw ('name', 'email'); date format 'at 03:01 AM' without TZ — unify with formatEmailDateTime. |
| 47 | `teamMemberJoined` [shot](/audit/index.html#047_company_teamMemberJoined) | merchant | Sam Okafor joined Acme Store on Dynopay (39) | keep | keep | — |  |
| 48 | `deleteOtp` [shot](/audit/index.html#048_company_deleteOtp) | merchant | Confirm brand deletion – Acme Store (35) | keep | keep | — |  |
| 49 | `deleted` [shot](/audit/index.html#049_company_deleted) | merchant | Brand deleted – Acme Store (26) | merge | polish | CTA opens a list page, not the object | Overlaps brandSoftDeleted / brandPermanentlyDeleted — confirm which path is live; retire the dead one. |
| 50 | `brandSoftDeleted` [shot](/audit/index.html#050_company_brandSoftDeleted) | merchant | Your brand "Acme Store" was deleted — you have 7 days to restore it (67) | keep | keep | subject > 60 chars | Subject 67 chars. |
| 51 | `brandPermanentlyDeleted` [shot](/audit/index.html#051_company_brandPermanentlyDeleted) | merchant | Your brand "Acme Store" has been permanently deleted (52) | keep | keep | CTA opens a list page, not the object |  |
| 52 | `brandRestored` [shot](/audit/index.html#052_company_brandRestored) | merchant | Good news — your brand "Acme Store" is back (43) | keep | keep | CTA opens a list page, not the object |  |
| 53 | `brandDeleteReminder` [shot](/audit/index.html#053_company_brandDeleteReminder) | merchant | Only 3 days left to restore "Acme Store" (40) | keep | keep | — |  |
| 54 | `brandDeleteReminder` · de [shot](/audit/index.html#054_company_brandDeleteReminder_de) | merchant | Nur noch 1 Tag, um „Acme Store“ wiederherzustellen (50) | keep | keep | — |  |

### conversion

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 55 | `autoConversionPayout` [shot](/audit/index.html#055_conversion_autoConversionPayout) | merchant | Acme Store · Payout Complete — 255.90 USDC from 0.0042 BTC (58) | fix | should fix | CTA opens a list page, not the object | Long (1713px on phone). Has fee breakdown but no destination wallet / withdrawal tx explorer link, CTA → list. Wave 4: source → rate → converted → spread/fee, wallet, tx link. |
| 56 | `weeklyConversionSummary` [shot](/audit/index.html#056_conversion_weeklyConversionSummary) | merchant | Weekly Conversion Report — 6 conversions, $1219.80 paid out (59) | fix | polish | CTA opens a list page, not the object | '$1220' not 2 dp; ISO dates; CTA → /dashboard. |

### receipt

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 57 | `customerConfirmation` [shot](/audit/index.html#057_receipt_customerConfirmation) | buyer | Your payment to Acme Store is confirmed (39) | fix | should fix | buyer: no network | Buyer receipt lacks network and explorer link; 'PDF attached' fine. Real send adds /receipt/<token> link (harness passed company=null). Fee shown only when buyer pays it — correct. |
| 58 | `customerConfirmation` · customerPaysFee_de [shot](/audit/index.html#058_receipt_customerConfirmation_customerPaysFee_de) | buyer | Ihre Zahlung an Acme Store ist bestätigt (40) | fix | should fix | buyer: no network | Buyer receipt lacks network and explorer link; 'PDF attached' fine. Real send adds /receipt/<token> link (harness passed company=null). Fee shown only when buyer pays it — correct. |
| 59 | `customerConfirmation` · contribution [shot](/audit/index.html#059_receipt_customerConfirmation_contribution) | buyer | Thanks for supporting Riverside library roof (44) | fix | should fix | buyer: no network | Buyer receipt lacks network and explorer link; 'PDF attached' fine. Real send adds /receipt/<token> link (harness passed company=null). Fee shown only when buyer pays it — correct. |
| 60 | `buyerPaymentExpired` [shot](/audit/index.html#060_receipt_buyerPaymentExpired) | buyer | Your payment to Acme Store didn't complete (42) | keep | polish | — | No CTA; add 'contact merchant' mailto or checkout link. |

### kyc

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 61 | `required` [shot](/audit/index.html#061_kyc_required) | merchant | Verify your identity to keep accepting payments (47) | fix | polish | CTA opens a list page, not the object | CTA → /dashboard instead of /kyc. |
| 62 | `approved` [shot](/audit/index.html#062_kyc_approved) | merchant | You're verified — no limits on payments (39) | keep | keep | CTA opens a list page, not the object |  |
| 63 | `rejected` [shot](/audit/index.html#063_kyc_rejected) | merchant | We couldn't verify your ID (26) | fix | polish | CTA opens a list page, not the object | CTA → /dashboard instead of /kyc. |
| 64 | `started` [shot](/audit/index.html#064_kyc_started) | merchant | Complete your identity verification (35) | keep | keep | — |  |
| 65 | `resubmissionRequired` [shot](/audit/index.html#065_kyc_resubmissionRequired) | merchant | One more thing for your ID check (32) | fix | polish | CTA opens a list page, not the object | CTA → /dashboard instead of /kyc. |

### links

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 66 | `paymentLinkCreated` [shot](/audit/index.html#066_links_paymentLinkCreated) | merchant | Link ready: 100.00 USD (22) | keep | polish | — | Link shown twice (row + CTA); 'No description provided' placeholder from caller. |
| 67 | `crowdfundingCampaignCreated` [shot](/audit/index.html#067_links_crowdfundingCampaignCreated) | merchant | Riverside library roof is live — share it (41) | keep | keep | — |  |
| 68 | `crowdfundingUpdate` [shot](/audit/index.html#068_links_crowdfundingUpdate) | buyer | We're 60% there! — update from Riverside library roof (53) | keep | polish | — | Markdown update body rendered as plain text (**bold** markers visible?) — verify renderer. |
| 69 | `refereeInvite` [shot](/audit/index.html#069_links_refereeInvite) | merchant | Get paid in crypto too — 50% off Dynopay fees (45) | keep | polish | no preheader | No preheader. |
| 70 | `refereeCodeReminder` · week2 [shot](/audit/index.html#070_links_refereeCodeReminder_week2) | merchant | 50% off Dynopay fees — claim it (31) | keep | polish | no preheader | No preheader. |
| 71 | `paymentLinkReminder` · reminder1 [shot](/audit/index.html#071_links_paymentLinkReminder_reminder1) | buyer | Complete your payment to Acme Store (35) | keep | keep | — | Good; localized. |
| 72 | `paymentLinkReminder` · final_de [shot](/audit/index.html#072_links_paymentLinkReminder_final_de) | buyer | Zahlung läuft bald ab — Acme Store (34) | keep | keep | — | Good; localized. |

### orders

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 73 | `orderReceipt` [shot](/audit/index.html#073_orders_orderReceipt) | buyer | Your order K7M2QX is confirmed (30) | fix | should fix | buyer: no network | No crypto amount / network / tx link, no merchant contact or refund-policy link; amounts wrap on phone ('$24.00 / USD'). |
| 74 | `orderReceipt` · de [shot](/audit/index.html#074_orders_orderReceipt_de) | buyer | Ihre Bestellung K7M2QX ist bestätigt (36) | fix | should fix | buyer: no network | No crypto amount / network / tx link, no merchant contact or refund-policy link; amounts wrap on phone ('$24.00 / USD'). |
| 75 | `orderReceiptMerchant` [shot](/audit/index.html#075_orders_orderReceiptMerchant) | merchant | Acme Store · New sale – $85.16 USD (34) | fix | should fix | money: no fee; money: no net; money: no network; money: no tx hash | Says 'settled to your wallet' but shows no money path (crypto received, fee, net, wallet, hash) — merchant gets this AND 'Payment settled' for the same sale. Shipping address drops country. CTA is a text link. |
| 76 | `orderExpired` [shot](/audit/index.html#076_orders_orderExpired) | buyer | Your order K7M2QX wasn't completed (34) | keep | keep | — |  |
| 77 | `orderRefunded` [shot](/audit/index.html#077_orders_orderRefunded) | buyer | Refund confirmed for order K7M2QX (33) | fix | should fix | — | No refund amount in crypto, network or refund tx hash (A4 refund standard). |
| 78 | `orderShipped` [shot](/audit/index.html#078_orders_orderShipped) | buyer | Your order K7M2QX has shipped (29) | keep | polish | — | Tracking number not a link. |
| 79 | `digitalDownloadReminder` [shot](/audit/index.html#079_orders_digitalDownloadReminder) | buyer | Your download links expire soon (order K7M2QX) (46) | keep | keep | — |  |

### otp

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 80 | `purposeOtp` · login [shot](/audit/index.html#080_otp_purposeOtp_login) | merchant | 482913 is your Dynopay login code (33) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |
| 81 | `purposeOtp` · signup [shot](/audit/index.html#081_otp_purposeOtp_signup) | merchant | 482913 is your Dynopay sign-up code (35) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |
| 82 | `purposeOtp` · emailVerify [shot](/audit/index.html#082_otp_purposeOtp_emailVerify) | merchant | 482913 is your Dynopay verification code (40) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |
| 83 | `purposeOtp` · passwordReset [shot](/audit/index.html#083_otp_purposeOtp_passwordReset) | merchant | 482913 is your password reset code (34) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |
| 84 | `purposeOtp` · emailChange [shot](/audit/index.html#084_otp_purposeOtp_emailChange) | merchant | 482913 to confirm your new email (32) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |
| 85 | `purposeOtp` · setPassword [shot](/audit/index.html#085_otp_purposeOtp_setPassword) | merchant | 482913 to set your password (27) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |
| 86 | `purposeOtp` · login_de [shot](/audit/index.html#086_otp_purposeOtp_login_de) | merchant | 482913 ist dein Dynopay-Anmeldecode (35) | keep | keep | — | Model OTP family — code in subject, never-share line, localized. |

### payments

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 87 | `paymentSettled` · forwarded [shot](/audit/index.html#087_payments_paymentSettled_forwarded) | merchant | Payment settled · 261.37 USD · Acme Store (41) | keep | keep | money: no tx hash | NEW in Phase 1 (blocker fix): gross + fiat at detection, Dynopay fee % + amount (payer), network fee + who bore it, net, masked destination, forward tx + explorer or 'Forwarding now — appears in Payouts', asset·network, paid for, masked customer, reference, detected time, CTA → /transactions?tx=<id>. Wired at chainVerification.ts + sweep recovery + test hook; 6 languages. |
| 88 | `paymentSettled` · forwarding_customerPaysFee_gas [shot](/audit/index.html#088_payments_paymentSettled_forwarding_customerPaysFee_gas) | merchant | Payment settled · 49.00 USD · Acme Store (40) | keep | keep | money: no tx hash | NEW in Phase 1 (blocker fix): gross + fiat at detection, Dynopay fee % + amount (payer), network fee + who bore it, net, masked destination, forward tx + explorer or 'Forwarding now — appears in Payouts', asset·network, paid for, masked customer, reference, detected time, CTA → /transactions?tx=<id>. Wired at chainVerification.ts + sweep recovery + test hook; 6 languages. |
| 89 | `paymentSettled` · autoConvert_de [shot](/audit/index.html#089_payments_paymentSettled_autoConvert_de) | merchant | Zahlung abgewickelt · 261.37 EUR · Acme Store (45) | keep | keep | money: no tx hash | NEW in Phase 1 (blocker fix): gross + fiat at detection, Dynopay fee % + amount (payer), network fee + who bore it, net, masked destination, forward tx + explorer or 'Forwarding now — appears in Payouts', asset·network, paid for, masked customer, reference, detected time, CTA → /transactions?tx=<id>. Wired at chainVerification.ts + sweep recovery + test hook; 6 languages. |
| 90 | `paymentSettled` · contribution_belowMin [shot](/audit/index.html#090_payments_paymentSettled_contribution_belowMin) | merchant | Payment settled · 2.10 USD · Acme Store (39) | keep | keep | money: no tx hash | NEW in Phase 1 (blocker fix): gross + fiat at detection, Dynopay fee % + amount (payer), network fee + who bore it, net, masked destination, forward tx + explorer or 'Forwarding now — appears in Payouts', asset·network, paid for, masked customer, reference, detected time, CTA → /transactions?tx=<id>. Wired at chainVerification.ts + sweep recovery + test hook; 6 languages. |
| 91 | `paymentReceived` · legacy [shot](/audit/index.html#091_payments_paymentReceived_legacy) | merchant | 261.37 USD received (19) | retire | should fix | CTA opens a list page, not the object; money: no fee; money: no net; money: no network | Legacy layout still used when no moneyPath is passed (verify_footer_lang script only). Remove once all callers pass the money path. |
| 92 | `paymentReceived` · campaign_referralCredit [shot](/audit/index.html#092_payments_paymentReceived_campaign_referralCredit) | merchant | 25.00 USD contribution to Riverside library roof (48) | retire | should fix | CTA opens a list page, not the object; money: no net | Legacy layout still used when no moneyPath is passed (verify_footer_lang script only). Remove once all callers pass the money path. |
| 93 | `paymentReceived` · de [shot](/audit/index.html#093_payments_paymentReceived_de) | merchant | 261.37 EUR erhalten (19) | retire | should fix | CTA opens a list page, not the object; money: no fee; money: no net; money: no network; money: no tx hash | Legacy layout still used when no moneyPath is passed (verify_footer_lang script only). Remove once all callers pass the money path. |
| 94 | `paymentPending` [shot](/audit/index.html#094_payments_paymentPending) | merchant | 261.37 USD incoming for Acme Store — confirming (47) | fix | should fix | CTA opens a list page, not the object; money: no fee; money: no net; money: no network | No network, confirmations required or typical wait; CTA → list. Wave 4. |
| 95 | `paymentConfirming` · 1of3 [shot](/audit/index.html#095_payments_paymentConfirming_1of3) | merchant | 1/3 confirmations (17) | fix | should fix | CTA opens a list page, not the object; money: no fee; money: no net | Sent per confirmation → inbox noise. Make opt-in (Settings → Notifications). Hand-rolled progress bar. |
| 96 | `paymentPartial` [shot](/audit/index.html#096_payments_paymentPartial) | merchant | Short payment: 0.0030 of 0.0042 BTC (35) | fix | polish | CTA opens a list page, not the object; money: no net; money: no network | Add fiat equivalent + network. Wave 4. |
| 97 | `buyerUnderpaidNudge` [shot](/audit/index.html#097_payments_buyerUnderpaidNudge) | buyer | You're almost there — send 0.0012 BTC to finish (47) | keep | polish | buyer: no network | Add network + fiat equivalent. |
| 98 | `paymentPartialExpired` · completed_partial [shot](/audit/index.html#098_payments_paymentPartialExpired_completed_partial) | merchant | Partial payment processed (25) | fix | should fix | CTA opens a list page, not the object; money: no fee; money: no net; money: no network | completed_partial says 'adjusted fees and forwarded' but shows no fee / net / wallet / hash → reuse money path. |
| 99 | `paymentPartialExpired` · incomplete_expired [shot](/audit/index.html#099_payments_paymentPartialExpired_incomplete_expired) | merchant | Partial payment expired (23) | fix | should fix | CTA opens a list page, not the object; money: no fee; money: no net | completed_partial says 'adjusted fees and forwarded' but shows no fee / net / wallet / hash → reuse money path. |
| 100 | `merchantUnderpaidDigest` [shot](/audit/index.html#100_payments_merchantUnderpaidDigest) | merchant | 2 underpaid payment(s) need attention (37) | keep | keep | CTA opens a list page, not the object; money: no fee; money: no net; money: no network; money: no tx hash | Good; deep-links to ?status=underpaid. |

### referral

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 101 | `payoutReady` [shot](/audit/index.html#101_referral_payoutReady) | merchant | $125.50 in referral rewards ready to cash out (45) | keep | keep | — |  |
| 102 | `autoPayEnabled` [shot](/audit/index.html#102_referral_autoPayEnabled) | merchant | Auto cash-out is on for your referral rewards (45) | keep | keep | — |  |
| 103 | `payoutRequested` [shot](/audit/index.html#103_referral_payoutRequested) | merchant | Your $125.50 referral cash-out is on the way (44) | keep | keep | — |  |
| 104 | `payoutFailed` [shot](/audit/index.html#104_referral_payoutFailed) | merchant | Your $125.50 referral cash-out couldn't be sent (47) | keep | keep | — |  |
| 105 | `accrual` [shot](/audit/index.html#105_referral_accrual) | merchant | +$3.92 from Nameword — referral rewards (39) | keep | keep | — |  |
| 106 | `activated` [shot](/audit/index.html#106_referral_activated) | merchant | Nameword took their first payment — you earn 25% of their fees (62) | keep | polish | subject > 60 chars | Subject 62 chars. |
| 107 | `monthlyDigest` [shot](/audit/index.html#107_referral_monthlyDigest) | merchant | May 2026 referrals: $48.20 earned (33) | keep | keep | — |  |
| 108 | `shareNudge` [shot](/audit/index.html#108_referral_shareNudge) | merchant | Earn 25% of every referred merchant's fees for 12 months (56) | keep | keep | — |  |

### security

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 109 | `twoFaEnabled` [shot](/audit/index.html#109_security_twoFaEnabled) | merchant | 2FA is on for your account (26) | keep | polish | — | Date 'at 03:01 AM' without TZ (security family) — unify. |
| 110 | `twoFaDisabled` [shot](/audit/index.html#110_security_twoFaDisabled) | merchant | 2FA was turned off — was that you? (34) | keep | keep | — |  |
| 111 | `backupCodesRegenerated` [shot](/audit/index.html#111_security_backupCodesRegenerated) | merchant | Your 2FA backup codes were replaced (35) | keep | keep | — |  |
| 112 | `phoneChanged` [shot](/audit/index.html#112_security_phoneChanged) | merchant | Phone number updated on your account (36) | fix | polish | — | Phone mask garbles already-masked input ('+491 •••• 4567'). |
| 113 | `accountDeleted` [shot](/audit/index.html#113_security_accountDeleted) | merchant | Your Dynopay account has been deleted (37) | keep | keep | — |  |
| 114 | `accountStatus` · suspended [shot](/audit/index.html#114_security_accountStatus_suspended) | merchant | Your Dynopay account has been suspended (39) | keep | keep | — |  |
| 115 | `paymentRequest` [shot](/audit/index.html#115_security_paymentRequest) | buyer | Acme Store requests 49.00 USD (29) | keep | keep | — | Buyer pay request — good. |
| 116 | `accountDeleteOtp` [shot](/audit/index.html#116_security_accountDeleteOtp) | merchant | Confirm account deletion – Dynopay (34) | keep | keep | — |  |
| 117 | `accountSoftDeleted` [shot](/audit/index.html#117_security_accountSoftDeleted) | merchant | Your Dynopay account is scheduled for deletion (46) | keep | keep | — |  |
| 118 | `accountRestored` [shot](/audit/index.html#118_security_accountRestored) | merchant | Your Dynopay account has been restored (38) | keep | keep | — |  |
| 119 | `stepUpCode` [shot](/audit/index.html#119_security_stepUpCode) | merchant | Your Dynopay verification code (30) | keep | keep | — |  |
| 120 | `twoFaResetLink` [shot](/audit/index.html#120_security_twoFaResetLink) | merchant | Reset your two-step verification (32) | keep | keep | — |  |
| 121 | `twoFaResetDone` [shot](/audit/index.html#121_security_twoFaResetDone) | merchant | Your two-step verification was reset (36) | keep | polish | — | Freeze time in en-US format 'Jun 6, 2026, 2:02 PM UTC' — use formatEmailDateTime. |

### wallet

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 122 | `walletUpdateOtp` [shot](/audit/index.html#122_wallet_walletUpdateOtp) | merchant | Confirm wallet update (21) | merge | polish | no preheader | Three wallet OTP variants (walletUpdateOtp, walletOtp controller, walletDeleteOtp) + stepUpCode — consolidate on stepUpCode/purposeOtp. No preheader. |
| 123 | `walletBatchSummary` [shot](/audit/index.html#123_wallet_walletBatchSummary) | merchant | Acme Store · Your payout wallets were updated (45) | keep | keep | — |  |
| 124 | `walletDeleted` [shot](/audit/index.html#124_wallet_walletDeleted) | merchant | Wallet removed from your account (32) | keep | polish | no preheader | No preheader; 'Network BTC' shows coin not network. |
| 125 | `addWalletReminder` [shot](/audit/index.html#125_wallet_addWalletReminder) | merchant | Acme Store · You're almost ready to accept payments (51) | merge | polish | no preheader | Overlaps activation gate/wallet + profileCreated. No preheader. |
| 126 | `walletAdded` [shot](/audit/index.html#126_wallet_walletAdded) | merchant | Acme Store · Wallet added – BTC (31) | keep | polish | no preheader | No preheader; label 'Blockchain BTC' — use assetNetworkLabel. |
| 127 | `walletUpdated` [shot](/audit/index.html#127_wallet_walletUpdated) | merchant | Acme Store · Wallet updated – BTC (33) | keep | polish | no preheader | As walletAdded; date without TZ. |
| 128 | `withdrawalOtp` [shot](/audit/index.html#128_wallet_withdrawalOtp) | merchant | Confirm your withdrawal (23) | keep | polish | no preheader | No preheader. |
| 129 | `withdrawalSuccess` [shot](/audit/index.html#129_wallet_withdrawalSuccess) | merchant | Withdrawal submitted – 500.00 USDT (34) | fix | should fix | no preheader; CTA opens a list page, not the object; money: no fee; money: no net; money: no tx hash | Money email without tx hash / explorer link or network fee; CTA → transactions list. |
| 130 | `exchangeOtp` [shot](/audit/index.html#130_wallet_exchangeOtp) | merchant | Confirm your exchange (21) | keep | polish | no preheader | No preheader. |
| 131 | `walletDeleteOtp` [shot](/audit/index.html#131_wallet_walletDeleteOtp) | merchant | Confirm wallet deletion (23) | merge | polish | no preheader |  |
| 132 | `walletOtp` · controller [shot](/audit/index.html#132_wallet_walletOtp_controller) | merchant | Confirm your wallet address (27) | merge | polish | no preheader | No greeting, no preheader; full address in mono OK. |

### walletSecurity

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 133 | `walletChangeAlert` [shot](/audit/index.html#133_walletSecurity_walletChangeAlert) | merchant | Your payout wallets were changed (32) | keep | keep | — | Model security email with one-tap undo. |
| 134 | `walletSecured` [shot](/audit/index.html#134_walletSecurity_walletSecured) | merchant | We've secured your account (26) | keep | keep | — |  |

### refund

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 135 | `buyerRefund` · forwarding [shot](/audit/index.html#135_refund_buyerRefund_forwarding) | buyer | Your Dynopay refund of 0.0012 BTC is on its way (47) | fix | polish | — | Raw explorer URL printed under the button; network shown as code 'USDT-TRC20' → 'USDT · Tron (TRC-20)'; no original payment reference. |
| 136 | `buyerRefund` · completed [shot](/audit/index.html#136_refund_buyerRefund_completed) | buyer | Your Dynopay refund of 49 USDT is complete (42) | fix | polish | — | Raw explorer URL printed under the button; network shown as code 'USDT-TRC20' → 'USDT · Tron (TRC-20)'; no original payment reference. |
| 137 | `merchantRefund` · completed [shot](/audit/index.html#137_refund_merchantRefund_completed) | merchant | Refund of 49 USDT to jamie.chen@example.com is complete (55) | fix | polish | money: no fee; money: no net; money: no tx hash | Same as buyerRefund; add original payment reference + network fee. |

### shared

| # | Sender · variant | Audience | Subject (chars) | Verdict | Severity | Auto-flags | Notes / fields to add or remove |
|---|---|---|---|---|---|---|---|
| 138 | `sendEmail` · generic [shot](/audit/index.html#138_shared_sendEmail_generic) | merchant | A note from Dynopay (19) | keep | keep | no preheader | Generic wrapper; no preheader. |

## 4. Public marketing & auth pages

Shots: `/audit/index.html#public` (390 / 820 / 1366 / 1920 · light + dark, full page).

| Route | Final URL | Verdict | Severity | Sweep result (overflow / clipped / raw keys / JS / 502) | Notes |
|---|---|---|---|---|---|
| `/` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No overflow on any width; 60 sub-32px tap targets at 390 (footer link lists). Wave 7: trust strip + fee sub-line above the fold check. |
| `/for/creators` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/documentation` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | 23k chars single page; phone jump-to nav needed. |
| `/help-support` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No <h1>. |
| `/help-support/getting-started-with-dynopay` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No <h1>. |
| `/system-status` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/blog/how-to-accept-crypto-payments-on-your-website` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/press` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/referral-program` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/terms-conditions` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No TOC / last-updated summary. |
| `/auth/login` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/auth/register` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/reset-password` | /auth/login | keep | keep | 8 shots · overflow 0 · clipped 8 · raw-keys 0 · JS 0 · 502/abort 0 | Redirects → /auth/login (reset is a step inside login). |
| `/auth/accept-invite?token=demo` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Invalid-token state 'Invite unavailable' — has explanation; add support link. |
| `/auth/reset-2fa?token=demo` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Invalid-link state; add 'request a new link' route. |
| `/auth/secure-account?token=demo` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Expired-link state; add next step (sign in + change password). |
| `/this-page-does-not-exist` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Plain explanation; add search/status/support links (Part B: never a dead end). |
| `/fees` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Renders; needs worked example ('$100 sale → you receive …') per Part B. |
| `/about` | — | fix | should fix | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 1 | Legal entity + address, custody model, contact hours not on page (Part B legitimacy check). |
| `/company` | /auth/login | keep | keep | 8 shots · overflow 0 · clipped 7 · raw-keys 0 · JS 0 · 502/abort 0 | /company is an in-app redirect → /settings?section=company (login). Not a public page — remove from public inventory. |
| `/how-to` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/compare/coingate` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Check comparison table scrolls inside container at 390. |
| `/blog` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/privacy-policy` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 1 |  |
| `/aml-policy` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | One hydration-mismatch JS error on 820 light (dev-server artefact; re-check in prod build). |
| `/signup` | /auth/register | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Redirects → /auth/register. |
| `/unsubscribe?token=demo` | — | fix | should fix | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | ?token=demo → navigation aborted (server redirect/304 loop?) on every width — confirm the invalid-token state renders a page, not a bare redirect. |

## 5. Hosted checkout & buyer pages

Shots: `/audit/index.html#checkout` (390 / 820 / 1366 / 1920 · light + dark, full page).

| Route | Final URL | Verdict | Severity | Sweep result (overflow / clipped / raw keys / JS / 502) | Notes |
|---|---|---|---|---|---|
| `/pay?d=rNtQRX` | — | fix | should fix | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Coin picker shows no approx network fee / confirmation time per option, no stablecoins-first/cheapest hint, no trust cues (merchant logo, non-custodial note) in first screen; large empty canvas on phone. Wave 5. |
| `/pay/demo` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/pay/donation-demo` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/pay/payment-states-demo` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/payment/success?transaction_id=9f2c1e7a&status=success&payment_type=crypto` | — | fix | should fix | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Only 102 chars of text with query params: no amount, merchant, receipt link, tx link, return-to-merchant (Part C2). |
| `/payment/failed?status=expired&error=Payment%20window%20expired` | — | fix | should fix | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | 61 chars of text — no plain-words state, next step or support route → dead end. |
| `/payment/verify` | — | fix | should fix | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | 23 chars — bare spinner without ?response (never a bare spinner, Part C2). |
| `/order/ab28e53da29ba70b6266b0e0` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Renders order + state; check merchant contact + receipt link. |
| `/saved` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/pay/terms-of-service` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Add plain-language summary. |
| `/pay/aml-policy` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/wallet-security?token=demo` | — | fix | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Invalid token → 'Something went wrong' with no explanation/support route. |
| `/pay?d=rNtQRX` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Good: QR, copy, open-in-wallet, 3-state timeline, rate-updated line, receipt e-mail. Missing: rate-lock countdown colour at 5/2 min and fee disclosure line before paying. |
| `/pay/state-demo` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | One aborted navigation at 1366 dark (dev artefact). |
| `/pay/success-demo` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/receipt/oN7U2knyNnaQ3NBrfNXL3F` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Printable receipt renders. |

## 6. Creator public pages

Shots: `/audit/index.html#creator` (390 / 820 / 1366 / 1920 · light + dark, full page).

| Route | Final URL | Verdict | Severity | Sweep result (overflow / clipped / raw keys / JS / 502) | Notes |
|---|---|---|---|---|---|
| `/devhub` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Tip block in first screen (4 presets + custom + message + button), supporters count, shop, share, powered-by. Full marketing footer is heavy on a creator page; 4 preset chips tight at 390. |
| `/devhub/shop` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No <h1>; check 1-col at 390. |
| `/devhub/p/talk-to-a-developer` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No <h1>; verify Buy visible without scroll at 390 + sticky buy bar (Wave 6). |
| `/devhub/cart` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/devhub/checkout` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Shares PanelShell with hosted checkout. |

## 7. Remaining in-app pages

Shots: `/audit/index.html#inapp` (390 / 820 / 1366 / 1920 · light + dark, full page).

| Route | Final URL | Verdict | Severity | Sweep result (overflow / clipped / raw keys / JS / 502) | Notes |
|---|---|---|---|---|---|
| `/create-pay-link` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Wave 8: single scrolling form + live preview. |
| `/pay-links/rNtQRX` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | No <h1>; Wave 8 header stats + funnel. |
| `/pay-links/products` | /storefront?tab=products | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Redirects → /storefront?tab=products. |
| `/profile` | /settings?section=profile | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Redirects → /settings?section=profile (already lean). |
| `/kyc` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Wave 8: status timeline + deadline + consequences. |
| `/kyc/complete` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/help-support` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Wave 8: pre-filled payment reference. |
| `/wallet` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | /wallet renders 'Wallets' (Payout wallets) — not a duplicate; 17 small taps at 390. |
| `/creator` | /storefront?tab=page | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Redirect confirmed → /storefront?tab=page. |
| `/wallet/security` | /settings?section=security | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Redirect confirmed → /settings?section=security. |
| `/get-started` | /get-started?step=secure | keep | keep | 8 shots · overflow 0 · clipped 8 · raw-keys 0 · JS 0 · 502/abort 0 | → ?step=secure; 'clipped' hit is the hidden <title> mirror <p>, not visible text. |
| `/QA` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Internal QA plan page. |
| `/quality` | — | keep | keep | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Internal. |
| `/pay-links/products/new` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 1 | Two aborted navigations at 390/820 light during retry (dev server); re-verify. |
| `/pay-links/products/9/edit` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Hydration-mismatch JS error on 820 light (dev artefact). |
| `/pay-links/products/9/orders` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 |  |
| `/storefront?tab=page` | — | keep | polish | 8 shots · overflow 0 · clipped 0 · raw-keys 0 · JS 0 · 502/abort 0 | Hydration-mismatch errors in dev on 390 dark / 1366 light; Wave 6 tips-settings tab with live preview. |

## 8. Severity roll-up → Phase 2 waves
**Blockers (3) — all fixed in Phase 1** (see §2). Nothing else met the blocker bar (wrong/missing money info, dead-end money state,
unusable on phone): no horizontal overflow on any route at any width; no raw i18n keys on pages or emails.

**Should fix (Wave 4 — emails):** paymentPending (network + confirmations + wait), paymentConfirming (opt-in), paymentPartialExpired
completed-partial (money path), autoConversionPayout (wallet + tx link, shorter), withdrawalSuccess (hash/explorer), largeTransaction
(merge into settled), orderReceiptMerchant (money path or link to settled), orderReceipt + customerConfirmation (network + tx link,
refund-policy/merchant contact), orderRefunded (refund crypto/network/hash), subscriptionCreated (CTA + manage path), loginNotification
(merge), retire legacy paymentReceived layout, footer (why-received + notification settings + legal address), preheader everywhere,
unified date/time, CTA deep-links. New emails (decided): **Payout delayed**, **Overpaid**, refund/auto-convert/monthly statement
field additions. Notification controls in Settings → Notifications.

**Should fix (Wave 5 — checkout & buyer pages):** `/payment/success`, `/payment/failed`, `/payment/verify` are near-empty without
query context (dead ends / bare spinner); coin picker lacks per-option network fee + confirmation time, stablecoins-first,
trust cues in first screen; rate-lock colour thresholds + fee disclosure line; `/unsubscribe` and `/wallet-security` invalid-token
states need explanation + support route.

**Should fix (Wave 7 — public):** `/about` legitimacy block (legal entity, address, custody, contact hours); `/fees` worked example;
legal pages TOC + summary; 404 links (status/support); auth invalid-link states next steps.

**Polish (Waves 6/8):** creator page footer weight + 4 preset chips at 390; product page sticky buy bar check; docs phone jump-nav;
in-app pages per Part E (create-pay-link live preview, link detail funnel, KYC timeline, help pre-fill).

## 9. Files created / changed in Phase 1
- New: `backend/services/email/paymentSettled.ts`, `backend/scripts/audit_render_all_emails.ts`,
  `backend/scripts/inject_payment_settled_i18n.py`, `scripts/qa/audit_page_shots.mjs`, `scripts/qa/audit_email_structure.py`,
  `scripts/qa/build_audit_gallery.py`, `scripts/qa/build_audit_report.py`, `plan/audit/findings.json`, `plan/audit/audit_phase1_head.md`,
  `plan/audit/audit_phase1_tail.md`, `public/audit/**` (git-ignored).
- Changed: `backend/services/email/paymentEmails.ts` (moneyPath param + settled layout), `accountEmails.ts` (OTP subjects),
  `adminOpsEmails.ts` (duplicate greeting), `controller/payment/settlement/chainVerification.ts` (money path + explorer import),
  `services/merchantPool/merchantPoolSweep.ts` (money path in sweep recovery), `routes/testRouter.ts` (test hook sample),
  `backend/locales/{en,de,es,fr,pt,nl}/emails.json` (+`paymentSettled.*`), `scripts/qa/email_dark_shots.mjs` (--width/--modes/--full-slug),
  `.gitignore` (+`public/audit/`).

## 10. Re-running
```
cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/audit_render_all_emails.ts
cd /app && export PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell
node scripts/qa/email_dark_shots.mjs --in=/app/plan/audit/emails/html --out=/app/public/audit/emails --width=600 --full-slug   # and --width=390
node scripts/qa/audit_page_shots.mjs --base=<preview> --set=public --out=/app/public/audit/pages   # and --set=inapp; add --merge --routes=a,b to re-shoot
python3 scripts/qa/audit_email_structure.py && python3 scripts/qa/build_audit_report.py && python3 scripts/qa/build_audit_gallery.py
```
