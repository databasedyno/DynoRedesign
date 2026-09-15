# Emails, public pages, checkout & creator pages — audit and fix plan (APPROVED, June 2026)

Status: **Phase 1 (audit) NOT STARTED — context gathered, harness designed, nothing coded.**
Previous proposal (dashboard Command Centre, Waves 1–3) is archived at `/app/plan/dashboard_command_centre_plan.md`
(tracker: `/app/plan/wave_execution_plan.md`). Waves 1–3 are built; the E2E test sweep for Waves 2–3 stays
**deferred until the user asks** (may be folded into Wave 4 testing).

## 0. User decisions taken on this plan (ask_human, June 2026) — binding
1. **Deliverable format (1a):** Markdown report at `/app/plan/audit_phase1.md` **plus a browsable HTML gallery served
   from the preview URL** at `<REACT_APP_BACKEND_URL>/audit/index.html` → generate into `/app/public/audit/`
   (Next.js serves `/app/public` statically). **Add `public/audit/` to `.gitignore`** so shots never ship to prod.
   Page shots at 390 / 820 / 1366 / 1920, light + dark. Email shots at 600 px + 390 px, light + dark + Gmail-inversion.
2. **Email scope (2a):** EVERY sender (~110 across 21 files). Merchant/buyer-facing emails scored in full against
   standard A1; admin/ops-only emails listed with a lighter keep / fix / retire verdict.
3. **Blockers (3b):** **Fix blockers as they are found during Phase 1** (money info wrong/missing in emails,
   dead-end states, unusable on phone). Everything else waits for its wave. First blocker to fix = the merchant
   "Payment received" email (§6).
4. Respond in **English**.

## 1. Scope (from the approved proposal)
1. Every email the platform sends — fix the "payment received" gap (fee taken, amount forwarded) and audit all
   others against what a payments company is expected to send.
2. Landing page + all public pages, hosted checkout + every buyer-facing page — content, usability, and layout on
   phone / tablet / laptop / desktop.
3. Pages not touched by Waves 1–3 — public creator page (tips), store, product, cart, store checkout, remaining
   in-app pages.

Two phases: **Phase 1 = written audit** (findings + screenshots at four widths, every email rendered) for review;
**Phase 2 = fixes in waves** (4 → 8), each shippable and reviewed on its own.

## Part A — Emails
### A1. Standard a payment-gateway email is held to
- One purpose, one primary button. Subject ≤ 50 chars carrying the fact ("Payment settled · $120.00 from Acme");
  preheader carries the second fact (net amount / what is needed).
- Brand header, facts table, short "what happens next / nothing to do" sentence, one button opening the exact
  object (this payment, this wallet) — not a list page.
- Footer: why you received it, how to change notification settings, support contact, legal name + address.
- Single column ≤ 600 px, body ≥ 14 px, contrast ≥ 4.5:1, status never by colour alone, button ≥ 44 px tall,
  renders in dark mode, plain-text alternative.
- Times "14:02 UTC (16:02 Berlin)" in recipient timezone; amounts formatted identically everywhere (crypto
  precision per asset, fiat 2 dp).
- **Merchant money emails show the full money path:** gross received (crypto + fiat value at detection = the figure
  to book for tax); Dynopay fee (tier % + amount); network fee + who bore it; net forwarded, destination wallet
  (masked `bc1q…9x2k`), forward tx hash + explorer link — or "forwarding now, visible in Payouts" when not yet
  broadcast; asset + network; what was paid for (link / product / invoice); customer (masked email); reference.
- Buyer emails show what the buyer paid and what they get; never the merchant's fee.

### A2. Findings so far (payment family, read directly from `backend/services/email/paymentEmails.ts`)
| Email | Today | Gap |
|---|---|---|
| Payment received (merchant) `sendPaymentReceivedEmail` | amount, crypto amount, method, status, date, reference; CTA → `/transactions` (list) | **No fee, net, forwarded-to wallet, network, on-chain hash/explorer, "what was paid for", customer, fiat-at-detection.** CTA goes to list not the payment. |
| Payment pending `sendPaymentPendingEmail` | amount, crypto, status, reference | No confirmations required / typical wait, no network, no explicit "nothing to do yet". |
| Payment confirming `sendPaymentConfirmingEmail` | progress bar per confirmation | Sent per confirmation step → inbox noise → make opt-in. Also uses hand-rolled inline table styling (not shared helpers). |
| Partial (merchant) / buyer nudge / partial expired / underpaid digest | expected / received / remaining | No fiat equivalent, no network; completed-partial lacks fee / net / forwarded. |
| Customer receipt `customerReceiptEmail.ts` | has explorer link, breakdown, buy-again, receipt link | Verify in Phase 1 against: merchant name+contact, items, crypto+fiat, network, tx link, receipt no., refund-policy link, download/save. |

### A3. Whole-inventory audit (Phase 1) — per email: verdict keep / fix / merge / retire, exact fields to add /
remove, phone-width + dark-mode render.

### A4. Fixes already decided (Phase 2, Wave 4)
- "Payment received" → **"Payment settled"** with full money path. If forward not yet broadcast: row reads
  "Forwarding to bc1q…9x2k — appears in Payouts"; **no** second "forwarded" email.
- **New "Payout delayed"** email when a forward has not completed within 2 h or failed (amount, destination, what
  Dynopay is doing, support button). Only forward-related email besides settled.
- **Overpaid** (merchant): add if none exists — overpaid by X, buttons "Refund excess" / "Keep as credit".
- Pending gains network + confirmations required + typical wait; confirming emails **off by default** (opt-in in
  Settings → Notifications).
- Partial/underpaid family gains fiat equivalent + network; completed-partial shows fee / net / forwarded.
- Refund emails (buyer + merchant): refunded amount, asset+network, refund tx hash, original reference.
- Auto-convert emails: source amount → rate → converted amount → spread / fee.
- Monthly statement: gross, fees, net by asset, count, CSV link.
- Notification control: every non-critical email switchable off in Settings → Notifications; security + money-
  exception emails cannot. Footer of every email links there.
- Cross-cutting: one shared template; dashboard status vocabulary/colours (`helpers/txStatus.ts`); identical
  amount/time formatting; plain-text part for every email; all new strings in all 6 languages.

## Part B — Public marketing pages
Order: value proposition → trust → proof → how it works → pricing → developers → FAQ → final CTA. Trust is a hero
element. No invented metrics. One primary CTA per screen + one low-friction secondary. Pricing fully transparent.
Phone load < 2 s, no horizontal scroll, correct keyboards/autocomplete.

| Page | Should display | Usability check |
|---|---|---|
| Landing `/` | Outcome headline (accept crypto, non-custodial, paid to own wallet); fee + "no monthly cost" sub-line; primary + secondary CTA; real product visual; trust strip (non-custodial, no card data, KYC/AML posture, status link); coins/networks; three ways to sell (links, page/store, API); how it works ×3; fee summary; dev snippet; social proof only if real; FAQ; final CTA; complete footer. | Above-the-fold answers "what, cost, safe" on every width. |
| Fees `/fees` | Tiers + thresholds + triggers, network-fee policy, auto-convert spread, refunds; worked example ("$100 sale → you receive …"); factual card comparison. | Merchant can compute exact net. |
| About/Company `/about`, `/company` | Who runs it, legal entity + address, custody model, regulatory posture, contact channels + hours, press kit. | Legitimacy answered on one page. |
| How it works `/how-to` | Buyer + merchant journeys as parallel step lists with real screenshots; time to first payment. | Reads < 1 min on phone. |
| For/verticals `/for/[vertical]`, Compare `/compare/[slug]` | Landing skeleton + specifics; factual tables. | One CTA; tables scroll inside container on phone. |
| Documentation `/documentation` | Quick-start, auth, endpoints, webhooks + signature, sandbox, SDKs, changelog; copyable code; sidebar. | Jump-to on phone; no code overflow. |
| Help centre `/help-support`, `/help-support/[slug]` | Categories, top articles, search, contact route + response time. | "My payment is stuck" in two taps. |
| System status `/system-status` | Per-component status, incidents, subscribe. | Reachable from every footer/error state. |
| Blog `/blog`, Press `/press`, Referral program `/referral-program` | Standard layouts; referral states reward, conditions, timing. | Line length ≤ 75 chars desktop. |
| Legal `/terms-conditions`, `/privacy-policy`, `/aml-policy` | TOC, last-updated, plain-language summary. | No pinch-zoom on phone. |
| Auth `/auth/login`, `/auth/register`, `/signup`, `/reset-password`, `/auth/accept-invite`, `/auth/reset-2fa`, `/auth/secure-account` | One-column, social login separated, password rules before failing, inline errors, link to other flow. | One-handed on phone. |
| `/404`, `/_error`, `/unsubscribe` | Plain explanation, search/home, status link, support. | Never a dead end. |

## Part C — Hosted checkout & buyer pages
### C1. Standard
Fiat anchor, crypto secondary with visible rate-lock timer (15–20 min; colour at 5 & 2 min; "refresh price" on
expiry — never dead). Asset/network chooser shows approx network fee + confirmation time per option; cheapest/fastest
pre-selected; stablecoins first. Desktop: QR ≥ 200 px above fold + copy address/amount. Phone: "Open in wallet" first,
full-width copy buttons ≥ 48 px, QR secondary. Persistent 3-state progress waiting → detected (x/y) → confirmed with
tx hash + explorer once detected. Fee disclosure before paying + "send exactly this amount". Edge states with
instructions (underpaid / overpaid / expired / wrong network). Trust at anxiety point (merchant name+logo,
"non-custodial — paid directly to the merchant", AML/terms, support, Dynopay mark). Optional receipt e-mail field,
success page with receipt link, save merchant, back to merchant.

### C2. Pages
| Page | Should display |
|---|---|
| Hosted checkout `/pay?d=` (`Components/Page/Pay3Components/checkout/CleanCheckoutV2.tsx`) | Everything in C1; merchant identity; order summary (item, qty, price, tax); e-mail for receipt; language switch. |
| `/payment/success` | Confirmed amount (fiat + crypto), merchant, order/receipt no., tx link, what next, receipt link, save merchant, return. |
| `/payment/failed` | Plain-words state (expired / underpaid closed / rejected), what buyer can do, support, no codes. |
| `/payment/verify` | Same 3-state progress; never a bare spinner. |
| Order status `/order/[publicRef]` | Order summary, payment state, fulfilment state, merchant contact, receipt link. |
| Receipt `/receipt/[token]` | Printable: merchant legal name+contact, buyer, items, fiat+crypto, network, tx hash, date/time+TZ, receipt no., refund policy. |
| Saved merchants `/saved` | Kept; consistent card layout. |
| Pay-side legal `/pay/terms-of-service`, `/pay/aml-policy` | Reachable from checkout footer; plain-language summary. |
| Demos `/pay/demo`, `/pay/donation-demo`, `/pay/payment-states-demo`, `/pay/state-demo`, `/pay/success-demo` | Use for state renders (SAFE MODE: never reserve a real address — mock `POST /api/pay/addPayment` + `verifyCryptoPayment`). |

## Part D — Public creator pages (Ko-fi / BMAC / Gumroad / Shopify practice)
| Page | Should display | Usability |
|---|---|---|
| Creator `/[handle]` (`pages/[handle].tsx`) | Cover, avatar, name, bio, socials; **tip block** (3 presets + custom + optional message + one "Tip" button); optional opt-in supporter wall; store link + top 3 products; share; "powered by Dynopay" + non-custodial note. | Tip in 3 taps; primary button in first screen. |
| Store `/[handle]/shop` | Grid: cover, title, price, availability, one tap; category filter > 8; cart indicator; search > 20. | 1 col phone / 2 tablet / 3–4 desktop; images never crop titles. |
| Product `/[handle]/p/[slug]` | Above fold: cover, title, price, who for, Buy; then what's included, delivery type, refund policy, FAQ, related. | Buy visible without scroll on phone; sticky buy bar. |
| Cart `/[handle]/cart` | Items + qty controls, subtotal, tax/shipping, total, single Checkout, continue shopping. | Editable in place. |
| Store checkout `/[handle]/checkout` (`Components/Page/Shop/CheckoutOrderSummary.tsx` + `InlineTipCheckout.tsx`) | Buyer details only when needed, then the hosted checkout in the same shell — one experience. | Same trust cues/states as `/pay`. |

## Part E — Remaining in-app pages (not in Waves 1–3)
| Page | Change proposed |
|---|---|
| Create payment link `/create-pay-link` | Single scrolling form + live preview; amount/open amount, asset restrictions, expiry, buyer info, redirect, tax; review step. |
| Link detail `/pay-links/[slug]` | Header: status, 30-day paid count + volume, funnel views→checkouts→paid; share tools (copy, QR, embed); recent payments; edit/disable. |
| Products `/pay-links/products/*` | Editor + live product-page preview, inventory, delivery type, files; orders list w/ fulfilment actions + buyer contact. |
| Your page → Page tab (tips settings) `/storefront` | Presets, custom-amount toggle, thank-you message, supporter wall on/off, goal — with live preview. |
| Profile `/profile` | Lean: identity, email, avatar, password, 2FA entry point. |
| KYC `/kyc`, `/kyc/complete` | Status timeline, deadline, documents, consequences. |
| Help & Support in-app | Pre-filled payment reference, article search, ticket status. |
| Legacy wallet `/wallet` | If duplicate of Payout wallets → redirect (same as old wallet-security). |
| Redirect pages `/creator`, `/wallet/security` | Confirm redirects only. (`/wallet-security` is the PUBLIC email "revert change" page — keep.) |

## Part F — Responsive standard (four widths, light + dark)
| Class | Test size | Rules |
|---|---|---|
| Phone | 390 × 844 | Single column; primary action in first screen + sticky where page has one job; taps ≥ 44 px; numeric keyboard for amounts; tables → cards; no horizontal page scroll. |
| Tablet | 820 × 1180 (+ landscape) | Two columns only for list+detail / form+preview; marketing = two-up; checkout centred single column max 480. |
| Laptop | 1366 × 768, 1440 × 900 | Content ≤ 1200 px; lines ≤ 75 chars; checkout max 520 + summary alongside. |
| Desktop | 1920 × 1080 | Content 1320–1440 px centred; extra width → margins/visual; nothing scales past laptop size. |
Plus WCAG 2.2 AA contrast + visible focus, alt text, CWV targets (LCP < 2.5 s, INP < 200 ms, CLS < 0.1) on landing +
checkout, one non-English sample per page.

## Part G — Deliverables and order
- **Phase 1 audit report** `/app/plan/audit_phase1.md` + gallery `/app/public/audit/index.html`: per email/page →
  shots (pages ×4 widths ×2 themes; emails 600+390, light/dark/gmail), gaps vs A–F, severity **blocker / should fix /
  polish**. Blockers fixed as found (decision 0.3).
- **Phase 2:** Wave 4 Emails → Wave 5 Hosted checkout + buyer pages → Wave 6 Creator public pages (+ tips-settings
  tab) → Wave 7 Public marketing pages → Wave 8 Remaining in-app pages. Each reviewed before the next.

## Part H — Decisions & assumptions (already accepted by user)
One "Payment settled" email per payment; "Payout delayed" only when late (> 2 h) / failed. Confirming emails opt-in.
Dynopay fee as tier % + amount; network fee separate with payer; buyer emails never show merchant fee. Fiat value =
at detection. Buyer emails: merchant name as sender display + "powered by Dynopay" footer; merchant emails Dynopay
branding; existing Brevo transport kept. Marketing pages: content/structure/responsiveness only — brand visuals
unchanged; no unreal metrics. Tip block 3 presets + custom + message; supporter wall opt-in, off by default. Store
checkout reuses hosted checkout. Every new string in all 6 languages (en/de/es/fr/pt/nl). Wave order 4→5→6→7→8.

---

# EXECUTION HANDOFF (what the previous agent found — start here)

## 2. Environment facts
- Stack: Next.js (root `/app`, pages in `/app/pages`, components `/app/Components`) + Express/TS backend
  (`/app/backend`, ts-node on internal 3300 behind a uvicorn proxy; `sudo supervisorctl restart backend` after backend
  edits — no watcher) + PostgreSQL (Sequelize) + Redis. **SAFE MODE on the PRODUCTION DB — read-only preferred.**
- Outbound email OFF (`DISABLE_OUTBOUND_EMAIL=true`); `EMAIL_DUMP_DIR` makes `utils/mailTransporter.ts
  dumpForReview()` write each suppressed email as `${Date.now()}_${subjectSlug}.html` with a first line
  `<!-- to: … | subject: … -->`. Historical dumps of real sends: `/app/memory/email_outbox/*.html` (58 files).
- Playwright chromium: `PLAYWRIGHT_CHROME_EXECUTABLE_PATH=/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell`.
- Credentials: `/app/memory/test_credentials.md` (merchant onarrival21@gmail.com / Katiekendra123@; 2-step login;
  skip MFA interstitial with `sessionStorage.mfa_interstitial_seen='1'`). Live fixtures: `/pay?d=rNtQRX`,
  `/receipt/oN7U2knyNnaQ3NBrfNXL3F`, creator `/devhub`, `/devhub/shop`, storefront cart recipe in that file.
- Themes: in-app `localStorage theme-mode-inapp=dark`; public/checkout `theme-mode-public=dark` (+ cookie).
- Email i18n: `backend/locales/{en,de,es,fr,pt,nl}/emails.json`, `t()` from `backend/utils/emailI18n.ts`
  (`formatEmailDate/DateTime`, `resolveEmailLang` reads tbl_user by email). Template helpers:
  `backend/utils/emailTemplate.ts` (baseEmailTemplate, infoBox, dataRow, statusBadge, feeRow, feeTotalRow, feeTable,
  mono, otpBlock, successBox/alertBox/errorBox/neutralBox, statCard, twoColumnStats, ctaButton),
  `backend/services/email/emailShared.ts` (dynoPayEmailTemplate, dynoPayGreetingTemplate, greetingLine,
  formatMoneyForEmail, brandSubject, escapeHtml, FRONTEND_BASE_URL). Explorer links: `explorerTxUrl` in
  `backend/services/receiptLinkService.ts`; chain meta `getChainMeta` in `backend/services/refund/refundChains.ts`.
- Merchant notification prefs gate: `dispatchCompanyEmail(companyId, "payments", {email,name}, sender)` in
  `backend/services/email/companyDispatch.ts` (Settings → Notifications). Dark-mode guard (pre-commit):
  `node backend/scripts/check-email-dark-mode.mjs` — fails on gradients, unclassed light bgs, hand-rolled buttons,
  local-part greetings.

## 3. Email inventory — 21 files, ~110 senders (full signatures)
Extract again any time with:
```
cd /app/backend && python3 - <<'EOF'
import re,glob
for f in sorted(glob.glob('services/email/*.ts'))+['services/refund/refundEmails.ts','services/refund/refundEmailTemplates.ts']:
    src=open(f).read()
    for m in re.finditer(r'export (?:const|async function|function) (send\w+|build\w+)\s*=?\s*(?:async\s*)?\(([^)]*)\)',src,re.S):
        print(f.split('/')[-1],'::',m.group(1),'(',re.sub(r'\s+',' ',m.group(2)).strip()[:300],')')
EOF
```
Families / audience (M = merchant, B = buyer, A = admin/ops):
- `accountEmails.ts` (M): Welcome, VolumeTierUpgrade, EmailVerificationOTP, LoginOTP, PasswordChanged,
  UserProfileUpdated, CreatorHandleUpdated, SecurityAlert, LoginNotification, FailedLoginAttempts, NewDeviceAlert(opts{ipAddress,device,browser,os,location,at:Date,securityToken,lang}).
- `activationEmails.ts` (M): sendActivationEmail({userId,email,name,companyName,step:'d1'|'d3'|'d7',segment:'madeLink'|'noLink'|'fundraiser',unsubToken,lang}).
- `activationGateEmail.ts` (M): sendActivationGateEmail(userId, gate:'brand'|'wallet'|'kyc', companyId?) — **reads userModel + signupAttributionModel** (read-only; use userId=1).
- `adminNotificationEmails.ts` (A): NewUserAdminNotification, OnboardingStuck, OnboardingCompleted, FirstPaymentAdmin, NewVisitorAdmin, BrandDeletedAdmin, AccountDeletedAdmin (object args, see extract).
- `adminOpsEmails.ts` (M+A): LargeTransactionAlert(M), WebhookDisabled(M), WebhookRedirect(M), AdminFeeReceived(A), AdminFeeSweep(A), TreasuryLowAlert(A), ConversionFailedAdmin(A, ConversionFailedAdminData).
- `billingReportEmails.ts` (M/B): InvoiceGenerated, ApiKeyCreated, ApiKeysHashedNotice, ApiKeyRevoked, SubscriptionCreated(B+M), SubscriptionCancelled.
- `companyEmails.ts` (M): CompanyProfileCreated, CompanyContactWelcome, CompanyProfileUpdated, TeamMemberJoined, CompanyDeleteOTP, CompanyDeleted, BrandSoftDeleted(purgeAt:Date), BrandPermanentlyDeleted, BrandRestored, BrandDeleteReminder(purgeAt,daysLeft).
- `conversionEmails.ts` (M): AutoConversionPayout(data{sourceCurrency,sourceAmount,sourceAmountUsd,targetCurrency,payoutAmount,conversionRate,priceAtConversion,currentPrice,priceMovementPct,marketState,feeTierUsed,transactionId,conversionId,withdrawalTxHash?,platformFeeUsd?,sweepGasFeeUsd?,tradeFeeUsd?,binanceWithdrawalFeeUsd?,grossSaleUsd?,totalReceivedUsd?}), WeeklyConversionSummary(data{periodStart,periodEnd,totalConversions,totalSourceUsd,totalPayoutUsd,totalSavedUsd,totalVolatileConversions,avgPriceMovementPct,cryptoBreakdown[],dailyVolume[]}).
- `customerReceiptEmail.ts` (B): sendCustomerPaymentConfirmationEmail(customerEmail,customerName,companyName,amount,currency,transactionId,description,date,time,cryptoAmount?,cryptoCurrency?,transactionReference?,lang,campaignName?,breakdown?{merchantAmount,feeAmount,feePayer,currency},companyLogo?,company?{companyId,ownerUserId} **← WRITES a receipt-link token via ensureReceiptLink → pass null in the harness**,paymentSourceKey?,buyAgain?{url,kind}); sendBuyerPaymentExpiredEmail.
- `kycEmails.ts` (M): KYCRequired, KYCApproved, KYCRejected, KYCStarted, KYCResubmissionRequired.
- `linkCampaignEmails.ts` (M/B): PaymentLinkCreated, CrowdfundingCampaignCreated, CrowdfundingUpdate, RefereeCodeReminder, RefereeInvite, PaymentLinkReminder(B).
- `orderEmails.ts` (B/M): OrderReceipt(B), OrderReceiptMerchant(M), OrderExpired, OrderRefunded, OrderShipped, DigitalDownloadReminder — `order` shape used: public_ref, order_id, currency, locale, subtotal_cents, shipping_cents, tax_cents, tax_label, tax_rate, tax_inclusive, reverse_charge, total_cents, buyer_email, buyer_phone, shipping_address{…}, merchant_user_id; `items[]`: product_snapshot{title,product_type:'digital'|'physical'}, variant_snapshot{attributes}, quantity, line_total_cents, delivered_payload{asset_deliveries[{download_url,filename}]|license_key|access_url|calendar_url}. Calls `isMerchantIdentityVerified` (read).
- `otpEmails.ts` (M): sendPurposeOTPEmail(email,name,otp,purpose:'login'|'signup'|'emailVerify'|…,lang).
- `paymentEmails.ts` (M/B): PaymentReceived, PaymentPending, PaymentConfirming, PaymentPartial, BuyerUnderpaidNudge(B), PaymentPartialExpired(status 'completed_partial'|'incomplete_expired'), MerchantUnderpaidDigest(rows[]).
- `referralEmails.ts` (M): PayoutReady, AutoPayEnabled, PayoutRequested, PayoutFailed, Accrual, Activated, MonthlyDigest, ShareNudge.
- `securityEmails.ts` (M/B): 2FAEnabled, 2FADisabled, 2FABackupCodesRegenerated, PhoneChanged, AccountDeleted, AccountStatus, PaymentRequest(B, data{companyName,amount,currency,description,expiresAt,payUrl,lang}), AccountDeleteOTP, AccountSoftDeleted, AccountRestored, StepUpCode, 2FAResetLink, 2FAResetDone(freezeUntil:Date).
- `walletEmails.ts` (M): WalletUpdateOTP, WalletBatchSummary, WalletDeleted, AddWalletReminder, WalletAdded, WalletUpdated, WithdrawalOTP, WithdrawalSuccess, ExchangeOTP, WalletDeleteOTP.
- `walletSecurityEmails.ts` (M): WalletChangeAlert(data{companyName,rows[{network,address,actionLabel}],revertUrl}), WalletSecured(data{companyName,networks[]}).
- `refund/refundEmailTemplates.ts` (B/M): buildRefundEmail({refund_amount,asset,chain,forward_txid?,brand_name?}, 'forwarding'|'completed') → {subject,html}; buildMerchantRefundEmail({…,refund_id,customer_email}). (`refundEmails.sendRefundStatusEmail` reads companyModel — call the builders directly.)
- Wallet OTP content lives in `controller/wallet/walletOtp.ts` (see how `render_dark_mode_fixes.ts` renders it without DB).
- Also `emailShared.sendEmail` (generic). Existing sample calls to copy: `backend/scripts/render_dark_mode_fixes.ts`,
  `backend/scripts/render_brand_lifecycle_i18n.ts`, `backend/scripts/verify_footer_lang.ts`, `routes/testRouter.ts:690-740`.

## 4. Harness design (to build — nothing written yet)
1. `backend/scripts/audit_render_all_emails.ts` — force `DISABLE_OUTBOUND_EMAIL=true`, `EMAIL_DUMP_DIR=/app/plan/audit/emails/html`,
   clear dir, then for each sender: snapshot dir → call with realistic sample data (EN; DE for one or two per family to
   catch overflow) → rename the new file(s) to `NN_<family>_<sender>[_variant].html`. Never pass DB-writing params
   (customer receipt `company` = null). Also write a `manifest.json` (slug, family, audience M/B/A, subject, to).
   Run: `cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/audit_render_all_emails.ts`.
2. Screenshots: parametrise `scripts/qa/email_dark_shots.mjs` with `--width=600|390` (currently fixed 700) and run
   for both → `/app/public/audit/emails/<slug>__<width>__<light|dark|gmail>.png`. Replace asset host with
   `--assets=http://localhost:8001`.
3. Pages: extend `scripts/qa/public_sweep.mjs` (no login: public, buyer, creator pages) and
   `scripts/qa/responsive_sweep.mjs` (logged-in in-app pages) — add HEIGHT entries `820:1180, 1366:768, 1440:900`,
   `--shots` full-page at ≤ 820, and both themes → `/app/public/audit/pages/<theme>-<w>-<route>.png`. Keep their
   overflow / clipped-text / raw-i18n-key / JS-error audit output → feeds severity.
   Routes to cover: Part B list, Part C list (use demo pages for states; `/pay?d=rNtQRX` awaiting-phase via the mock
   recipe), Part D (`/devhub`, `/devhub/shop`, `/devhub/p/<slug>` — find a slug via
   `node backend/scripts/ro_query.js "select slug from tbl_product where company_id=1 and status='active' limit 3"`,
   `/devhub/cart` with the localStorage cart recipe, `/devhub/checkout`), Part E in-app routes.
4. Gallery: small Node/Python generator → `/app/public/audit/index.html` (sections Emails / Public / Checkout /
   Creator / In-app; thumbnails linking to full PNGs; per-item verdict + severity pulled from a `findings.json`).
   Add `public/audit/` to `/app/.gitignore`. Verify at `<REACT_APP_BACKEND_URL>/audit/index.html`.
5. Report: `/app/plan/audit_phase1.md` — one table per family/page group: item · audience · verdict · severity ·
   exact fields to add/remove · shot links.

## 5. Page inventory (from `/app/pages`)
Public: `/`, `/fees`, `/about`, `/company`, `/how-to`, `/for/[vertical]`, `/compare/[slug]`, `/documentation`,
`/help-support`, `/help-support/[slug]`, `/system-status`, `/blog`, `/blog/[slug]`, `/press`, `/referral-program`,
`/terms-conditions`, `/privacy-policy`, `/aml-policy`, `/signup`, `/auth/login`, `/auth/register`, `/reset-password`,
`/auth/accept-invite`, `/auth/reset-2fa`, `/auth/secure-account`, `/404`, `/_error`, `/unsubscribe`.
Buyer: `/pay?d=`, `/pay/demo`, `/pay/donation-demo`, `/pay/payment-states-demo`, `/pay/state-demo`, `/pay/success-demo`,
`/payment/success`, `/payment/failed`, `/payment/verify`, `/order/[publicRef]`, `/receipt/[token]`, `/saved`,
`/pay/terms-of-service`, `/pay/aml-policy`, `/wallet-security` (public revert page).
Creator: `/[handle]`, `/[handle]/shop`, `/[handle]/p/[slug]`, `/[handle]/cart`, `/[handle]/checkout`.
In-app not in Waves 1–3: `/create-pay-link`, `/pay-links/[slug]`, `/pay-links/products/*`, `/storefront` (Page tab),
`/profile`, `/kyc`, `/kyc/complete`, `/help-support` (in-app), `/wallet`, `/creator` (redirect), `/wallet/security`
(redirect), `/get-started`, `/QA`, `/quality`.

## 6. FIRST BLOCKER FIX — "Payment settled" email (decision 0.3 → do during Phase 1)
Call site with all money-path data in scope: `backend/controller/payment/settlement/chainVerification.ts` ≈ L1780
(`dispatchCompanyEmail(... sendPaymentReceivedEmail(...))`). Variables available there:
- gross crypto `totalAmountReceived` (L488), asset `tempCurrency`, fiat at detection `receivedUSD` (base currency
  `customerData?.base_currency`), Dynopay fee crypto `adminAmountToSend`, effective fee % `feePercentage`
  (`toFixedStr(feePercentage*100,2)`), `fee_payer` ('company'|'customer', L514), net `userAmountToSend` /
  post-gas `actualMerchantAmount` (L928), gas `adminTransferResult.gasFunded`, forward hash `outgoingMerchantTxHash`
  (L935, may be null → "Forwarding … appears in Payouts"), merchant destination `walletData.dataValues.wallet_address`
  (+ `destination_tag`, ≈L824), auto-convert `autoConvertEnabled` / `autoConvertTargetCurrency` /
  `originalUserAmount`, customer `customerData?.email`, `campaignName`, `paymentSourceKey`, `referralCreditAppliedUsd`,
  payment row id `tempData.user_tx_id || unique_tx_id || payment_id` (use for a deep-link CTA
  `${FRONTEND_BASE_URL}/transactions?open=<id>` instead of the list). Network label: derive from `getChainMeta` /
  existing `AssetNetworkChip` vocabulary ("USDT · TRC-20").
- Other callers to update with the same payload: `services/merchantPool/merchantPoolSweep.ts:1124` (sweep-recovery
  path), `routes/testRouter.ts:700` (test hook), `scripts/verify_footer_lang.ts:53`. Re-exported via
  `helper/sendEmail.ts`, `helper/index.ts`, `services/emailService.ts`.
- Implementation: change `sendPaymentReceivedEmail` to accept an additional `moneyPath?` object (keep positional args
  for compatibility), render gross / fee (tier % + amount) / network fee + payer / net forwarded / destination masked
  + explorer link (or forwarding note) / asset·network / paid for / customer masked / reference; subject
  "Payment settled · {amount} from {brand}" (≤ 50 chars, `brandSubject`); heading key `paymentSettled.*` in all 6
  `emails.json`; CTA to the payment. Run `check-email-dark-mode.mjs`, backend tsc, then render via the harness.
- Related decided items that are NOT blockers (Wave 4): Payout-delayed email, overpaid email, confirming opt-in,
  pending network/confirmations, partial family fiat+network.

## 7. Order of work for the next agent
1. Build the email harness (§4.1) → render all ~110 → shots (§4.2).
2. Page shots (§4.3) for all routes in §5 at 390/820/1366/1920 × light/dark.
3. Gallery (§4.4) + `.gitignore` entry; verify it loads from the preview URL.
4. Write `/app/plan/audit_phase1.md` (§4.5) with severities; list blockers found.
5. Fix blockers (§6 first; then any dead-end/unusable-on-phone findings) — backend tsc + frontend tsc + dark-mode
   guard; self-test via harness/screenshots; testing_agent only if a fix touches flows.
6. `finish` with the report link; user reviews → then Wave 4.
