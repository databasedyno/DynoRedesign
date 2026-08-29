# REFACTOR STATUS

---

# 📋 IMPLEMENTATION PLAN — Referral Revenue-Share Rewards (added 2026-06, pod eddcc06a)

> STATUS: PLAN ONLY — not yet built. Awaiting go-ahead. Money-path feature; prod Railway DB in SAFE MODE
> (background jobs OFF), so accrual + payout crons will NOT run in preview — they run on the prod leader only.

## 0. Decision (from user)
- Reward model: **recurring revenue share** — referrer earns **25% of the platform fees Dynopay collects
  from each merchant they referred, for 12 months** from activation.
- Payout: **real crypto payout to the referrer's wallet** (with a minimum threshold).
- Activation gate: **keep** the existing "referred merchant's first $100+ successful payment" rule.
- Invitee reward is UNCHANGED: they still get 50% off fees for 30 days at signup.
- What this REPLACES: the old broken referrer reward ("50% off / 30d, no stacking, no extension, often $0"
  granted by `referralService.processReferrerReward`). Referrer now gets cash revenue share instead of a
  fee discount.

## 1. Code-review findings (money path — verified)
- Per-transaction platform fee is stored on **tbl_user_transaction**: `transaction_fee` (percent-fee portion)
  + `fixed_fee` (fixed portion), both in the transaction's `base_currency`; `usd_value` holds the USD value;
  `status` gates settlement. `blockchain_buffer_fee` is a NETWORK pass-through, NOT platform margin → EXCLUDE.
- Canonical USD fee-collected formula (already used by `services/payoutDigestService.ts` L176-177):
  `(COALESCE(transaction_fee,0) + COALESCE(fixed_fee,0)) * (COALESCE(usd_value,0) / NULLIF(base_amount,0))`.
  → This is the exact base the 25% is taken from. Because a discounted merchant's stored `transaction_fee`
    is ALREADY the discounted amount, 25% of it is automatically correct (no double-pay).
- **tbl_customer_transaction** has NO fee columns (buyer-side: base_amount/paid_amount/status). Use it ONLY
  for the $100 activation gate (the existing cron already does: `referralRewardMonitor.processPendingReferrerRewards`).
- Settled-status definition: reuse the app-wide `PROCESSED_STATUS_SQL` (utils/processedVolume.ts) that
  dashboard/wallet already use, so referral revenue reconciles with the merchant's reported fees.
- Existing schema to reuse:
  - `tbl_referral` (referrer_user_id, referred_user_id, status pending|active|rewarded|expired, activated_at,
    referred_at, expires_at). Currently `bonus_amount` DECIMAL(10,2) default 10.00 — unused for revenue share.
  - `tbl_referral_reward` (reward_id, referral_id, user_id, reward_type: 'bonus_credit'|'discount'|'commission',
    amount DECIMAL(10,2), currency, status: 'pending'|'credited'|'withdrawn', transaction_id, credited_at,
    withdrawn_at). `reward_type='commission'` ALREADY exists → perfect for this.
  - Endpoints already present: `GET /api/referral/my-code`, `/list`, `/earnings` (reads tbl_referral_reward),
    `/discount-status`. Frontend `hooks/useDashboardData` action-counts already exposes `referrals_pending`.
  - Cron: `utils/crons/referralRewardMonitor.ts` (every 15 min, leader-only via registerLeaderCronJobs, OFF when
    ENABLE_BACKGROUND_JOBS=false). Extend this rather than add a new cron.
- OPEN ITEM to confirm at build time: `processReferrerReward` (referralService.ts) currently GRANTS a referrer
  fee discount and has a "only if no active discount" guard (the no-stacking bug). This must be REPURPOSED to
  "activate + open the 12-month commission window" and must NOT grant a fee discount anymore.

## 2. Reward math (precise)
- On activation (first $100+ settled payment by the referred merchant, on/after `referred_at`):
  - `referral.status = 'active'`, `referral.activated_at = now`.
  - Open commission window: `commission_window_ends_at = activated_at + 12 months`.
- Accrual (periodic, per active referral, while `now < commission_window_ends_at`):
  - `feesUSD = SUM( (transaction_fee + fixed_fee) * usd_value/NULLIF(base_amount,0) )`
    FROM tbl_user_transaction WHERE user_id = referred_user_id AND <PROCESSED_STATUS_SQL>
    AND "createdAt" > last_accrual_at AND "createdAt" <= LEAST(now, commission_window_ends_at).
  - `commissionUSD = round(feesUSD * 0.25, 2)`; add to running accrued balance; advance `last_accrual_at`.
- Payout: when accrued-unpaid balance ≥ MIN_PAYOUT_USD (default $25), pay it out in crypto to the referrer's
  chosen wallet; mark the corresponding `tbl_referral_reward` rows `status='withdrawn'`, store the crypto tx hash.

## 3. Schema changes (migration — versioned boot migration, create-only in prod)
Add to **tbl_referral**:
- `commission_rate DECIMAL(5,4) DEFAULT 0.2500`
- `commission_window_ends_at TIMESTAMP NULL`
- `commission_accrued_usd DECIMAL(14,2) DEFAULT 0`  (lifetime accrued for this referral)
- `commission_paid_usd DECIMAL(14,2) DEFAULT 0`     (lifetime paid out)
- `last_accrual_at TIMESTAMP NULL`                   (accrual watermark; init = activated_at)
Add a payout-preference (referrer-level) — reuse existing merchant wallet or add:
- `tbl_user.referral_payout_wallet_type` / `referral_payout_address` (nullable) OR reuse a selected reusable
  wallet. DECISION at build: prefer letting the referrer pick one of their existing verified wallet addresses.
Optionally add to **tbl_referral_reward**: `period_start`, `period_end`, `tx_hash` (for payout audit); or store
tx hash in the existing `transaction_id` column and periods in a JSON `notes`. (Keep model < schema churn.)

## 4. Backend build (phased for money-safety)
PHASE 1 — Accrual + visibility (NO money movement, safe to ship first):
1. Migration: add the tbl_referral columns above (bootMigrations.ts).
2. `referralService.ts`:
   - Repurpose `processReferrerReward()` → `activateReferral()`: set status='active', activated_at,
     commission_window_ends_at = +12mo, last_accrual_at = activated_at. REMOVE the referrer fee-discount grant.
   - New `accrueReferralCommission(referral)`: run the accrual SQL above, upsert a running 'commission'
     `tbl_referral_reward` row (status='pending'), bump `commission_accrued_usd`, advance `last_accrual_at`,
     increment `User.referral_bonus_earned`. Idempotent via the watermark.
   - New `getReferrerCommissionSummary(userId)`: per-referral + totals (accrued / pending-unpaid / paid).
3. `utils/crons/referralRewardMonitor.ts`: keep `processPendingReferrerRewards` for ACTIVATION; add
   `accrueActiveReferralCommissions()` that loops active, in-window referrals and calls accrueReferralCommission.
4. Endpoints: extend `GET /api/referral/earnings` to include the running commission summary + 12-month
   window countdown; keep response backward-compatible.
PHASE 2 — Crypto payout (guarded; ship after Phase 1 is verified in prod):
5. `POST /api/referral/payout/request` — referrer requests payout of unpaid balance (≥ MIN_PAYOUT_USD) to a
   chosen verified wallet. Gate with the SAME OTP/2FA the withdrawal flow uses (controller/wallet/withdrawals.ts,
   walletOtp.ts). Idempotency key per request. Creates a payout record (pending).
6. Payout execution (leader cron or admin approval): platform-funded crypto send from an admin/treasury wallet
   to the referrer address (reuse the Tatum send + admin fee wallet infra). On success: set referral_reward rows
   'withdrawn', store tx_hash, bump `commission_paid_usd`. On fail: retry/backoff, never double-send.
7. Admin surface: optional manual approve/deny + a treasury-balance guard so payouts can't exceed funds.

## 5. Frontend build
- `pages/referrals` (or Referrals section): show per-referred-merchant commission (accrued, this-month, window
  days remaining), lifetime paid, and a "Withdraw to wallet" button (Phase 2) with wallet picker + OTP modal.
- Dashboard "Referral Earnings" card (the P1 backlog item): now shows REAL pending commission (USD) with a CTA.
  Data from the extended `/api/referral/earnings`. Add data-testids.
- Copy: explain "Earn 25% of the fees from every merchant you refer, for 12 months. Paid in crypto."

## 6. Risks / guardrails
- MONEY PATH: Phase 2 moves real funds out of a treasury wallet → must have: min threshold, OTP/2FA, idempotency,
  treasury-balance check, admin approval option, full audit (tx_hash), and reconciliation vs commission_accrued.
- Accrual must be idempotent (watermark) so a cron re-run never double-credits.
- Window boundary: cap accrual at `commission_window_ends_at`; after it, referral → 'rewarded'/'expired' (closed).
- Fee discounts on the referred merchant are already baked into stored `transaction_fee` → no double counting.
- SAFE MODE: crons don't run in preview; test Phase 1 accrual with a manual invoke script against a scratch
  referral, or on a staging DB — DO NOT hand-mutate prod referral rows.
- Chargeback/refund: if a referred merchant's payment is later reversed, the accrued fee should be clawed back;
  Phase 1 note — only accrue on terminally-settled statuses (PROCESSED_STATUS_SQL) to minimise this.

## 7. Suggested ship order
P1 (safe, visible value): §3 migration → §4 Phase 1 (activation repurpose + accrual + earnings endpoint) →
§5 dashboard Referral Earnings card + referrals breakdown.  ← delivers real, growing numbers with zero fund risk.
P2 (funds movement): §4 Phase 2 crypto payout with OTP + treasury guard + admin approval.

## 8. DISCUSSION NOTES & OPEN DECISIONS (2026-06 — read before building Phase 2)

### 8.1 Audience (confirmed by user)
Referrers will be a MIX of (a) existing Dynopay merchants who transact and (b) affiliates/agencies/influencers
who do NOT run their own payments. Consequence: a single pure model fails half the audience — merchants won't
bother to cash out, affiliates can't use fee credit. → Points to a BLENDED delivery model.

### 8.2 Recommended delivery model (user still deciding — "keep discussing"; NOT locked)
Decouple ACCOUNTING from PAYOUT: accrue the 25%/12mo as ONE USD balance per referrer (build once). Then:
- DEFAULT = auto fee-credit — the USD balance auto-reduces the referrer's own Dynopay fees at settlement.
  Zero friction, no funds leave the business, reuses the existing fee_discount machinery. Serves merchant-referrers.
- OPT-IN cash-out — for referrers whose balance outgrows their own fees (affiliates). Gated (threshold +
  verification + OTP). Serves affiliate-referrers.
This is self-protecting: merchants stay on the cheap credit path; only those who can't consume credit cash out,
and that path is gated. NOTE: unlike the OLD reward (use-it-or-lose-it 50%/30d), a credit BALANCE doesn't expire
and stacks per referral — strictly better even before adding cash-out.

### 8.3 KEY ECONOMIC INSIGHT (settles the "what does it cost me" worry)
Revenue-share is SELF-FUNDING — it pays back a slice of fees ALREADY collected into treasury. Margin is
IDENTICAL whether delivered as credit or cash: credit → forgo 25% of the fee (keep 75%); cash → collected 100%
into treasury, send back 25% (keep 75%). Same 75% either way. So credit-vs-cash is NOT a P&L question — it's a
risk / operations / cash-flow-timing question. You can never pay out more than you earned from that merchant
(ignoring on-chain network fee + fraud).

### 8.4 PAYOUT MECHANICS — verified against the codebase (for Phase 2 cash-out)
- FUNDING SOURCE: the platform's collected fees. Fees are skimmed into treasury wallets defined as
  `FEE_WALLETS` / `ADMIN_WALLETS` in `services/merchantPool/merchantPoolConfig` (per-transaction fee events are
  also logged in `tbl_admin_fee_transaction`, amount_in_usd). Pay referral cash-outs FROM this treasury.
- TWO EXISTING PAYOUT RAILS already in the code:
  1. ON-CHAIN via Tatum — the SAME rail merchant withdrawals use: `controller/wallet/withdrawals.ts` →
     `tatumClient.assetBatchAddressesToOtherAddress` (+ `tatumClient.batchFeeEstimation`), gated by a Redis
     withdrawal-OTP (`<email>-withdrawal-otp`). RECOMMENDED: send USDT direct from treasury to the referrer's
     saved address. Cheapest, no exchange dependency.
  2. BINANCE API withdrawal — `services/conversionService.ts` already does exchange-based payouts
     (trade → binanceWithdrawal, tracks binanceWithdrawalFee). Only needed if you want to CONVERT mixed fee
     coins → USDT before paying. Adds Binance KYC/API-key/geo dependency (Binance WS is already geo-blocked in
     this infra — see binanceService.detectBinanceAccess).
- CURRENCY: default USDT (balance accrues in USD → stablecoin = zero FX drift). CHAIN: TRC-20 (Tron) for ~$1
  network fee (ERC-20 would eat small payouts). Optionally let referrer pick from supported chains later.
- LIQUIDITY GOTCHA: treasury holds MIXED coins (whatever merchants paid in). To pay USDT you must either
  (a) keep USDT liquidity in treasury, or (b) convert collected fees → USDT on demand via the Binance
  conversion rail. Decide before Phase 2.
- AUTO vs MANUAL: referrer saves a payout address once; can auto-send when balance ≥ threshold. Fully-auto
  on-chain sends are the highest fraud surface → recommended: auto-accrue always, but first-ever cash-out
  passes OTP/verification (reuse withdrawal OTP); can go auto after the referrer is trusted.
- FRAUD is self-limiting: to accrue anything a fraudster must push real $100+ settled payments through Dynopay
  and pay 75% of the fee to claw back 25% — a losing game. Still gate cash-out (threshold + verification + OTP).

### 8.5 OPEN QUESTIONS — still UNANSWERED by user (get these before implementing Phase 2)
Q1 Reward delivery final call: fee-credit only / cash-only / BLENDED (recommended). (User: "keep discussing".)
Q2 Payout rail: (a) Tatum on-chain USDT-TRC20 from treasury [recommended] / (b) Binance API / (c) decide at P2.
Q3 Cash-out trigger: (a) auto to saved wallet w/ first-time OTP [recommended] / (b) always user-initiated+OTP /
   (c) fully automatic.
Q4 Treasury USDT liquidity: (a) keep USDT in treasury / (b) convert on demand via Binance / (c) revisit at P2.
Q5 Ship order: (a) Phase 1 fee-credit now, cash-out later [recommended] / (b) both now / (c) discuss more.

### 8.6 WHAT THE NEXT AGENT CAN SAFELY BUILD NOW (independent of Q1–Q5)
Phase 1 is safe regardless of the payout decision because it moves NO funds:
1. Migration: add tbl_referral columns from §3 (commission_rate, commission_window_ends_at,
   commission_accrued_usd, commission_paid_usd, last_accrual_at).
2. referralService: repurpose `processReferrerReward` → `activateReferral` (status='active', activated_at,
   commission_window_ends_at = +12mo, last_accrual_at = activated_at; REMOVE the referrer fee-discount grant +
   its "only if no active discount" no-stacking guard). Add idempotent `accrueReferralCommission` (watermark
   SQL from §2 over tbl_user_transaction, PROCESSED_STATUS_SQL) writing a running 'commission'
   tbl_referral_reward row. Add `getReferrerCommissionSummary`.
3. Cron: extend `utils/crons/referralRewardMonitor.ts` with `accrueActiveReferralCommissions()`.
   (Runs leader-only, ENABLE_BACKGROUND_JOBS=true — NOT in this SAFE-MODE preview. Test accrual via a manual
   invoke script against a SCRATCH referral or staging DB — DO NOT hand-mutate prod referral rows.)
4. Endpoint: extend `GET /api/referral/earnings` with the commission summary + 12-month window countdown
   (backward-compatible).
5. Frontend: real dashboard "Referral Earnings" card + per-referred-merchant breakdown (accrued / this-period /
   window days left), data-testids. Copy: "Earn 25% of the fees from every merchant you refer, for 12 months."
DEFER to Phase 2 (needs Q1–Q4): the actual cash-out endpoint, treasury send, OTP payout, admin approval,
liquidity/conversion.

---


_Last updated: 2026-08-28_

## Context
The husky `pre-commit` hook (`backend/scripts/check-file-size.mjs`, R2 budget from
`memory/ENGINEERING_STRATEGY_REVIEW_2026-08.md`) blocks any commit / Save-to-GitHub when a
**NEW** backend `.ts` file exceeds **500 lines**. Legacy files listed in
`backend/scripts/file-size-baseline.json` are grandfathered and only WARN when they grow.

## DONE — Save-to-GitHub blocker fix (2026-06)
- **Problem:** `backend/controller/customerDirectoryController.ts` = 583 lines → hook exit 1 → GitHub save blocked.
- **Fix (strangler pattern — split, do NOT grandfather):**
  - Extracted the data layer into `backend/controller/customerDirectoryService.ts` (398 lines):
    types, constants, helpers, `resolveCompanyScope`, `TX_QUERY`, `buildDirectory` (all exported).
  - Controller reduced to the two route handlers + imports (204 lines).
- **Behavior:** identical — pure code move, no route/logic/API-shape change; `apiRouter.ts` default import unchanged.
- **Verified:** `tsc --noEmit` clean · full `.husky/pre-commit` green (preflight-tsc OK, file-size OK, secrets OK) →
  EXIT 0 · both endpoints work read-only on live prod DB (`hostbay@moxx.co`):
  `GET /api/userApi/customers/directory` (total 9, aggregates present),
  `GET /api/userApi/customers/directory/detail?key=anon:api` (payments_total 533).

## DONE — Buyer Payment-Receipt email capture + Confirmation browser alert (2026-08-26)
Feature request: (1) buyers get an emailed receipt right after payment confirms; (2) a browser
notification when the payment confirms so they can switch tabs. User choices: email field on the
currency-select step of BOTH main crypto checkout + creator tip; browser alert on all 3 checkout
surfaces (store checkout already collects email → field hidden there).
- **Finding:** the receipt-email backend ALREADY fires on settlement (`sendCustomerPaymentConfirmationEmail`
  + `sendOrderReceiptEmail`); the gap was that the public checkout never captured a buyer email, so
  anonymous payers on a shared link got nothing.
- **New backend:** `POST /api/pay/setCustomerEmail` — `paymentLinkController.setCustomerEmail` (route in
  `paymentRouter.ts`, paymentRateLimiter + customerAuthMiddleware). Validates email (400 invalid / 404 no
  session) and merges it into the SAME Redis checkout session `customer-<ref>` that settlement reads
  (`customerData?.email`). No money-path change — contact info only.
- **New frontend (shared):** `hooks/usePaymentNotification.ts` (Notifications API wrapper, no VAPID/SW) +
  `Components/Page/Pay3Components/checkoutExtras.tsx` (`ReceiptEmailField` + `NotifyMeInline`).
- **Wired:** `CleanCheckoutV2.tsx` (email field + notify opt-in + fire-on-confirm),
  `InlineTipCheckout.tsx` (same, new `collectReceiptEmail` prop; covers tips AND store checkout),
  `pages/[handle]/checkout.tsx` (`collectReceiptEmail={false}`). i18n keys added to all 6 landing.json locales.
- **File-size note:** all edits landed in GRANDFATHERED legacy files (paymentLinkController +11,
  paymentController +3); the two NEW files are FRONTEND (hooks/, Components/) so the R2 backend budget does
  not apply. No new backend file → no 500-line blocker introduced.
- **Verified:** frontend+backend `tsc` EXIT 0 · backend curl e2e (login → QA link → getData →
  setCustomerEmail 200 → invalid 400 → QA link deleted) · testing_agent iteration_89 = 100% (field renders
  desktop+mobile, valid save → 200 + confirmation, invalid → error, 0 console errors). CANNOT e2e in preview:
  live email delivery (`DISABLE_OUTBOUND_EMAIL=true`) + notification firing on `confirmed` (needs real
  on-chain confirmation) — both code+compile verified, fire in production.

## NOTE — "Save to GitHub didn't commit" (2026-08-26 investigation)
User suspected a >500-line file blocked the GitHub save. **Confirmed NOT the cause:** the R2 file-size check
is warn-only for legacy files and exits 0 (only NEW backend `.ts` > 500 lines block). Ran the full commit
gates on the receipt/notify changes: file-size PASS (exit 0), `tsc` clean, secrets guard OK (17 staged files,
no live key patterns — the lone `GOCSPX-…` hit in PRD.md is a redacted placeholder). Most likely real cause
is platform/GitHub-side (push protection GH013 scanning history, expired GitHub auth, or repo perms) — routed
to support_agent; asked user for the exact Save-to-GitHub error to confirm.

## NEXT ACTION ITEMS (from finish handoff — not started)
Priority order; each is independently shippable.

- [ ] **P0 — Frontend Verification (Customers page):** Run the frontend testing agent on the
      re-imagined Customers page to confirm all UI states, the detail drawer (bottom sheet on mobile),
      search + sort + CSV export, segment chips, and the "Request payment" → `/create-pay-link?email=<x>`
      prefill. Verify at 390 / 768 / 1024 / 1920 in dark + light. (Was awaiting user approval.)
- [ ] **P1 — Status Page Polish:** Add 90-day uptime history bars to the public status page so
      customers see per-service reliability at a glance.
- [ ] **P2 — Checkout Currency Memory:** Let returning buyers see prices in the currency they picked
      last time without re-selecting it.
- [ ] **Spark — Referral Earnings Card:** Show merchants their pending 50% referral rewards right on
      the dashboard.

## Watchlist — legacy files that grew past baseline (WARN-only, non-blocking)
These do NOT block commits, but each is a candidate to refactor down and remove from
`file-size-baseline.json` (never let them regress once reduced). Extract a module instead of extending:
- `controller/dashboardController.ts` — 1441 (baseline 1334)  ← largest drift
- `services/webhookProcessor.ts` / `webhooks/index.ts` — grew (~736 vs 717)
- `controller/product/productController.ts` — 873 (baseline 784)
- `controller/product/cartController.ts` — 890 (baseline 832)
- `controller/payment/settlement/settleTransaction.ts` — 1110 (baseline 1082)
- plus small +1..+11 drifts across apis/tatumApi.ts, adminController, apiController, companyController,
  invoiceController, kycController, cryptoCheckout, feeController, chainVerification, paymentController,
  paymentLinkController (2723 vs baseline 2712, +11 from setCustomerEmail),
  publishableKeyController, referralController.
- Rule: only files NOT in the baseline block; the above are all grandfathered.

## How to re-check locally
```
cd /app/backend && node scripts/check-file-size.mjs        # exits 1 on a NEW >500-line file
cd /app && git add -A && sh .husky/pre-commit              # full hook (tsc + size + secrets + contrast)
```

# ============================================================================
# 2026-08-27 — NEXT ACTIONS + DIGITALOCEAN DEPLOY FIX (pod f431e319)
# ============================================================================

## DigitalOcean deployment — ROOT CAUSE FOUND + FIXED (pending GitHub push)
- DO App Platform app "dynopay" (id f86b27dc-feb0-4a44-a4e9-ebd2053e0468, region ams,
  ingress https://dynopay-bcibf.ondigitalocean.app). Single Docker service "dynoredesign"
  built from GitHub databasedyno/DynoRedesign @ branch `Improvement`, /Dockerfile → `yarn build`.
- Two consecutive deploys FAILED (`BuildJobExitNonZero`):
    a56bdb19 (commit f110178) and 13f98059 (commit 5db543c).
- BUILD LOG root cause: `next build` type-check failed (next.config has
  typescript.ignoreBuildErrors:false):
    ./Components/Page/API/ApiKeysPage.tsx:311  `<ApiKeyCardSubTitle component="div">`
    Type error: Property 'component' does not exist on styled(Typography) props.
  The `component="div"` (added to fix invalid <div>-in-<p> DOM nesting) type-errors because
  `ApiKeyCardSubTitle = styled(Typography)(...)` didn't declare a `component` prop. Preview
  (`next dev`) doesn't strict type-check, so it slipped through until DO's `yarn build`.
- FIX (Components/Page/API/styled.tsx): `import type { ElementType } from "react"` +
  `styled(Typography)<{ component?: ElementType }>(...)` so TS accepts the polymorphic prop
  (runtime already honored it). VERIFIED: `tsc --noEmit` = 0 errors project-wide.
- ESLint note: next.config eslint.ignoreDuringBuilds:false (errors block builds). `next lint`
  CLI flags Components/UI/Sparkline.tsx (react-hooks/rules-of-hooks) but that file AND
  .eslintrc.json are BYTE-IDENTICAL to the last GREEN build (312681d, 6/6 steps) → Next's
  build-time lint does NOT treat it as blocking. So no lint blocker remains.
- ⚠️ REMAINING ACTION: the fix is in the working tree only. Push it to GitHub via the
  "Save to GitHub" feature → DO auto-deploys the new commit on `Improvement` → build should
  go GREEN. Do NOT re-trigger a DO deploy of 5db543c (still has the bug).

## DONE — COPY_AUDIT Phase 2 + Phase 3 copy work (2026-08-28, pod 6fe4ee0c)
Full detail in `memory/COPY_AUDIT.md` + `memory/CHANGELOG.md`. Highlights:
- **i18n migrations:** about.tsx / ExitIntentModal / blog CTA + blog index Head → landing.json
  keys (6 locales, check-i18n green); email gaps closed (volumeTierUpgrade + referee reminder/
  invite → 42 keys × 6 in emails.json). Latent bugs fixed: reminder subjects hardcoded "50%" /
  "3 days" → parameterized.
- **Voice passes:** documentation.tsx (4 dev-tone fixes), 46 email-string fixes (casing,
  puffery, sentence-case subjects), _app.tsx JSON-LD speed-claim fixes, last "DynoPay" casing
  bugs in frontend catalogs (18 strings).
- **New /press page:** press.* keys × 6, downloadable logos in `public/press/`, Company
  mega-menu entry. All NEW files are frontend or scripts → R2 backend budget not applicable.
- **Verified:** backend testing agent 5/5 + 8/8 (read-only on live prod DB, SAFE MODE);
  `tsc --noEmit` clean; screenshots for /about EN+DE, /press EN+DE, /blog DE.

## Next Actions (current, prioritized)
### Carried over (pre-2026-08-28, still open)
- [ ] **P0 Deploy**: Save to GitHub to push the styled.tsx fix → confirm DO build goes ACTIVE.
      (2026-08-28 work is also working-tree-only until the next Save to GitHub.)
- [x] **P1 Receipt/Invoice PDF locale** (2026-08-29): invoice PDF (`services/pdfService.ts` +
      `controller/invoiceController.ts`) now localizes all 21 labels + date via `emailI18n` `invoice.*`
      keys × 6 locales; merchant lang resolved via `resolveLangByEmail`. VERIFIED by generating real PDFs
      EN/DE/PT and extracting text (RECHNUNG/Zwischensumme/Gesamtbetrag/Vielen Dank; FATURA/Valor total/Obrigado).
      Receipt PDF (`pdfReceiptService.ts`) was already localized.
- [x] **P1 Relative-time coverage** (2026-08-29): shared `hooks/useRelativeTime.ts` (`relativeTime.*` in
      common.json ×6). Migrated 6 hardcoded-English `timeAgo`/`relativeFromNow` sites: RateFreshness,
      LivePaymentFeed, DonorWallV2, donationCampaign, NotificationPage (keeps 7-day→absolute fallback),
      Payouts. ActiveSessions/LoginActivity already used t(). tsc 0; i18next resolution verified all 6 locales.
- [ ] **P1 Locale QA screens**: PT (and other langs) side-by-side screenshots of key pages.
      NOTE: external-preview screenshots blank (Cloudflare→headless timing) — used i18next resolution + SSR/compile.
- [ ] **P2 Deep read-only page sweep**: safe click-through of logged-in pages for console errors.
- [ ] **P2 tsc-in-preview guard**: consider a pre-Save `tsc --noEmit` gate so a dev-only type
      error can never reach a DO build again (this exact class of failure).

### New (from 2026-08-28 finish handoff — not started)
- [ ] **P1 Real Testimonials** (BLOCKED on user input): landing-page section with real customer
      quotes — user must paste actual quotes first, nothing fabricated (COPY_AUDIT rule).
- [x] **P1 Non-EN email subject sweep** (2026-08-29): audited all ~60 subject keys ×5 non-EN locales.
      Translations were mostly native/formal already. Fixed 16 outliers: NL welcome MEANING BUG
      ("laten we u laten betalen" = "let's make you pay" → "tijd om betaald te worden"); DE welcome
      awkward "Bezahltwerden" → "Zeit, bezahlt zu werden"; es lone-informal → formal (crowdfundingCreated
      "Tu"→"Su", volumeTierUpgrade, 5× referral); pt BR-style → European-pt formal (volumeTierUpgrade
      "Você"→dropped, 5× referral: "chance"→"oportunidade", "esperando"→"à espera", "seu/sua"→"o seu/a sua").
      Donor/contributor family left informal (deliberate warm voice). JSON valid ×5, placeholders intact ×0 mismatch.
- [ ] **P2 Press OG image**: branded social-preview image for /press (og:image + twitter:card),
      drop into `public/og/`, reference from press.tsx Head.
- [ ] **P2 Locale parity fix**: de/es/fr/nl/pt `emails.json` miss EN key
      `merchant.locked.suspendedLine` (pre-existing; falls back to EN today) — translate ×5.


# ============================================================================
# 2026-06 — CHECKOUT REFACTOR (all phases) — pod fork continuation
# ============================================================================

## Background
Three large "god-components" own the checkout surfaces and each grew its own data + helper layer:
- `Components/Page/Pay3Components/cryptoTransfer.tsx` (2,563 lines) — the crypto **checkout** widget
  (data layer: `axiosBaseApi` + Redux `useDispatch`; endpoints configuredCurrencies / getCurrencyRates /
  addPayment / verifyCryptoPayment).
- `Components/Page/Creator/InlineTipCheckout.tsx` (1,234 lines) — inline creator tip / donation / link
  **checkout** (data layer: raw `fetch()` with explicit Bearer, deliberately never touches localStorage).
- `Components/Page/CreatePaymentLink/index.tsx` (~2,082 lines) — a merchant **creation FORM** (NOT a
  checkout display; only truly-common helpers overlap).
`CleanCheckoutV2.tsx` was already modularised in a prior session into the shared `checkout/*` modules:
`checkoutTypes.ts` (Meta / CryptoInfo / Phase / PaymentUri), `checkoutConstants.ts` (MONO / LIME / INK /
ON_BRAND / PREF_* / CRYPTO_INFO), `checkoutHelpers.ts` (formatCryptoAmount / buildPaymentUri /
copyToClipboard / read+writeCheckoutPref), `checkoutApi.ts` (checkoutApi / fetchReceiptBlob),
`checkoutPrimitives.tsx` (CheckoutStatusTimeline / PanelShell).

User steer (ask_human, this fork): **implement Phase A only**; document all phases here after.
Overriding rule for every phase: **ZERO behaviour change on the revenue path** — only swap logic that is
*functionally identical* to the shared version; never force divergent implementations together.

## Phase A — Extract shared PURE logic — ✅ DONE (2026-06)
Goal: point the god-components at the shared `checkout/*` modules for logic they *identically* re-implement.

What was actually de-duped (after a line-by-line equivalence check):
- **InlineTipCheckout.tsx** — removed its local `MONO`, `LIME (= BRAND_ACCENT)`, `INK` constants and its
  local `Phase` union + `CryptoInfo` interface; now imports `{ MONO, LIME, INK }` from
  `checkout/checkoutConstants` and `type { Phase, CryptoInfo }` from `checkout/checkoutTypes`. The shared
  values/shapes are byte-for-byte equivalent (Phase = same 9 members, union order irrelevant; CryptoInfo =
  same 7 fields/types). Also dropped the now-unused `BRAND_ACCENT` import. ~30 lines of duplication removed;
  all 26 `MONO/LIME/INK` references + all `Phase`/`CryptoInfo` usages compile unchanged.

What was deliberately **NOT** touched (would have changed behaviour — Phase A must not):
- **cryptoTransfer.tsx `walletUri`** intentionally DIVERGES from shared `buildPaymentUri`: it also emits
  `ethereum:?value=<wei>` (via a local pure `toWei` string-math helper) and `tron:` deep-links, and encodes
  the *raw* amount string; the shared helper deliberately returns `null` for EVM/TRON/token chains and runs
  the amount through `formatCryptoAmount`. Merging them would drop ETH/TRX deep-links → left as-is.
- **cryptoTransfer.tsx `formatAmount`** already delegates to the *richer* shared `formatCryptoAmount` in
  `utils/currencyFormat.ts` (handles fiat + chain-suffixed codes) — a different, more capable single source
  than the checkout copy. Swapping to the checkout one would lose capability → left as-is.
- **Both components' clipboard** already use the global `@/helpers/copyToClipboard` (not the checkout copy).
- **Meta** shapes differ per surface (InlineTip's is narrower + has campaign fields) → left local.
- **CreatePaymentLink** is a creation form → out of scope for checkout-display de-dup.
Net honest finding: the prior refactor had already routed cryptoTransfer's big shared helpers through global
utils, so the only *safe, identical* remaining duplication lived in InlineTipCheckout (done).

Verified: `tsc --noEmit` EXIT 0 (proves shared Phase/CryptoInfo/constants are compatible across every usage);
live render smoke test on `/devhub` → opened the "Support me" widget → InlineTipCheckout mounts and reaches
the `currency_select` phase ("Pick a crypto to pay $10.00", full coin grid via shared CRYPTO_INFO, receipt
field), no error boundary, no console crash. No money-path/API/UI change.

## Phase B — Unify the API call sites — ✅ DONE (2026-06)
Goal: route all checkout surfaces through ONE module (`checkout/checkoutApi.ts`) so every pay call lives in
one place — while preserving each surface's auth model EXACTLY.
- The module now holds BOTH transports:
  - `checkoutApi()` / `fetchReceiptBlob()` — the fetch/Bearer client that NEVER reads localStorage (the
    anonymous-customer auth model). Used by `CleanCheckoutV2` (already) and now `InlineTipCheckout`.
  - NEW `payAxios` — thin wrappers over the app-wide `axiosBaseApi` (interceptors + localStorage token, the
    merchant-session auth model). Used by the legacy `cryptoTransfer`.
- `InlineTipCheckout.tsx`: deleted its LOCAL `api()` fetch wrapper (which was byte-identical to `checkoutApi`)
  and now imports `{ checkoutApi as api }` — so all 8 call sites are unchanged and the two fetch surfaces
  share one client. Exact parity (same URL base, headers, envelope, no-localStorage rule).
- `cryptoTransfer.tsx`: replaced its 5 `axiosBaseApi.get/post(API_ENDPOINTS.pay.*)` sites with
  `payAxios.{getConfiguredCurrencies|getCurrencyRates|addPayment|verifyCryptoPayment}(...)`. The wrappers are
  literal pass-throughs returning the raw `AxiosResponse` and throwing on non-2xx exactly like axios, so every
  `response.data?.data` and `catch (e){ e.response.status/.data.message }` behaves identically. Removed the now
  -unused `axiosBaseApi` + `API_ENDPOINTS` imports (only a dead commented block still references them).
- Auth models preserved EXACTLY: fetch/Bearer/no-localStorage for the public surfaces; axios/interceptor for
  cryptoTransfer. No endpoint, payload, response-shape, or error-handling change.

Verified: `tsc --noEmit` EXIT 0. Live smoke on the TWO ACTIVE surfaces:
- InlineTipCheckout (`/devhub` → "Support me") reaches `currency_select` ("Pick a crypto to pay $10.00", full
  coin grid, receipt field) — its `api('/pay/getData')` through the shared client succeeded; no error boundary.
- CleanCheckoutV2 (`/pay/demo` mirror, which imports the extended `checkoutApi.ts`) renders the full waiting
  state with a live rate + QR ("Pay 0.40707496 LTC on Litecoin") — proving `payAxios` + the axios import did
  NOT break the anonymous checkout chunk. No error boundary.
- ⚠️ cryptoTransfer is the DORMANT fallback (only mounts when `NEXT_PUBLIC_CLEAN_CHECKOUT_V2=false`, a
  build-time env with no runtime/query override) so it could NOT be e2e-rendered in preview. Its rewrite is
  behaviour-preserving by construction (pass-through wrappers) + tsc-clean; verify in prod if the flag is ever
  flipped.

## Phase C — Single server-state (SWR) data layer — ✅ IMPLEMENTED on CleanCheckoutV2, FLAG-GATED (2026-06 fork)
User steer (ask_human): "a" — complete Phase C properly, flag-gated, then user does a live real-payment test
before it becomes default.

FINDING ON RESUME: a prior turn had added ONLY the scaffolding to `CleanCheckoutV2.tsx` — `import useSWR` +
the `SWR_ON` flag resolver — but NO actual `useSWR()` call and NO shared handlers. So the flag did nothing and
the legacy paths still ran for everything (tsc passed only because unused import/var are tolerated). Completed
the real wiring this turn.

WHAT SHIPPED (Components/Page/Pay3Components/CleanCheckoutV2.tsx — flag default OFF):
- Extracted TWO shared result handlers so BOTH paths process identically:
  - `applyMeta(r)` — the /pay/getData meta normalisation + setMeta + setPhase (currency_select | error).
  - `applyVerifyResult(r)` — the /pay/verifyCryptoPayment status machine (remaining_seconds, detected/pending,
    underpaid+partial, confirmed/overpaid → confirmedAmount + onSuccess, expired). Clears pollRef/timerRef on
    terminal states exactly as before.
- Legacy path (flag OFF): the original meta useEffect and the setInterval(10s) verify poll, each now guarded
  with `if (SWR_ON) return` and calling the shared handler. Byte-for-byte the old behaviour.
- SWR path (flag ON): `metaSwr = useSWR(SWR_ON ? ['checkout/getData', d] : null, …getData, {no focus/reconnect/
  stale revalidate, no retry})` and `verifySwr = useSWR(active ? ['checkout/verify', address, token] : null,
  …verify, { refreshInterval: 10_000, refreshWhenHidden: true, revalidateOnFocus: false, shouldRetryOnError:
  false })`. The verify key nulls out the moment phase leaves awaiting/underpaid (or address/token missing) so
  SWR stops automatically on confirmed/expired — no manual clearInterval. `refreshWhenHidden:true` matches the
  legacy setInterval (which polled even on a hidden tab — needed for the "switch tabs + notify" UX). The
  checkoutApi fetcher never throws (returns {ok:false} on network error) so SWR only ever sees resolved values
  → steady interval-driven polling, error branches handled inside applyVerifyResult.
- FLAG: `SWR_ON` = `NEXT_PUBLIC_CHECKOUT_SWR===true` OR `?swr=1` in the URL. Default OFF (env not set).
- SCOPE: only the meta load + verify polling migrated (as agreed). `reservePayment` (the multi-step address
  reservation) stays imperative — it's a one-shot user-triggered mutation, not a good SWR fit and out of scope.

VERIFIED (testing_agent iteration_95 = 100% frontend, on a FRESH live link created in-pod
d=6dd51132387bb90115c71f895b66f19a734e625c54b433ca so its Redis session exists here):
- Legacy vs SWR render BYTE-IDENTICAL: clean-checkout-h1='Pay The Dev Store', clean-checkout-amount='$20.00 USD',
  network-select='Litecoin', currency-select='LTC', instruction='Pay 0.4078054 LTC on Litecoin', pay-status-strip
  WAITING. Only the reserved address differs (expected — a fresh pool address per load, not a code diff).
- SWR verify-poll cadence: 3 POSTs to /api/pay/verifyCryptoPayment in a 25s window, intervals [10.0s, 10.28s] —
  exactly refreshInterval=10000. No double-fetch/poll when flag on (legacy effects correctly short-circuit).
- ZERO console errors, no error boundary, no clean-checkout-error on either path. frontend tsc EXIT 0.

⚠️ NOT YET DEFAULT: confirmed/underpaid/expired STATE TRANSITIONS need a REAL on-chain confirmation, which
cannot be exercised in preview. The flag stays OFF until the user runs a live real-payment test on the flagged
URL: PREVIEW_URL/pay?d=6dd51132387bb90115c71f895b66f19a734e625c54b433ca&swr=1 (link_id 277, $20, no expiry —
left LIVE on the prod DB specifically for this test).

REMAINING (Phase C extension): ✅ InlineTipCheckout DONE (same flag-gated SWR migration — testing_agent
iteration_96 = 100%: legacy vs ?swr=1 byte-identical status pill, 3 verify POSTs at [10.00s, 10.26s],
zero console errors). Only the DORMANT cryptoTransfer (redux-saga, flag-off, can't be e2e'd in preview)
is left — low priority.

## Phase C extension — SWR on InlineTipCheckout — ✅ DONE (2026-06 fork) — testing_agent iteration_96 = 100%
Applied the EXACT same flag-gated pattern to Components/Page/Creator/InlineTipCheckout.tsx (creator tips +
store checkout): extracted `applyMeta`/`applyVerifyResult` shared handlers; legacy meta useEffect + setInterval
poll each guarded `if (SWR_ON) return`; added `metaSwr=useSWR(['checkout/getData', d])` and
`verifySwr=useSWR(['checkout/verify', address, token], { refreshInterval:10_000, refreshWhenHidden:true,
revalidateOnFocus:false, shouldRetryOnError:false })`. Same `?swr=1` / NEXT_PUBLIC_CHECKOUT_SWR flag, default OFF.
Verified on the /devhub support widget (POST /api/pay/tip → live contribution session): legacy vs SWR render
identically (inline-tip-status-pill byte-identical; only reserved inline-tip-address differs per load — expected),
SWR poll fired 3 verify POSTs at [10.00s, 10.26s] = refreshInterval, zero console errors, no error boundary,
frontend tsc EXIT 0.

# ============================================================================
# 2026-06 — TATUM INTEGRATION BOUNDARY (P1) — controllers off apis/tatumApi — DONE
# ============================================================================
User steer (ask_human): "yes" to option (a) — the SAFE seam swap (not the high-risk full domain-verb rewrite).
GOAL (from handoff P1): "20+ controllers still directly import tatumApi instead of routing through proper
integration boundaries (BlockchainService/PaymentService)."

FINDING: `integrations/tatum/TatumClient.ts` (`export const tatumClient = tatumApi`) and
`services/blockchain/blockchainService.ts` (exposes `tatumClient` via `.client`) are PASS-THROUGH re-export seams
with no domain verbs — so option (a) = repoint controller imports at the seam (runtime-identical, same object).
Also discovered 13 of the 24 controllers had DEAD tatumApi imports (imported, never called).

WHAT SHIPPED (24 controllers, ZERO logic change):
- 11 files that USE it → `import { tatumClient } from "<rel>/integrations/tatum/TatumClient"` + call sites
  `tatumApi.*` → `tatumClient.*` (replace_all): adminController, paymentController,
  payment/settlement/{settleTransaction,chainVerification}, wallet/{cryptoVerify,tempAddress,feesEstimates,
  withdrawals,walletOtp,walletMutations,walletDeleteFlow}.
- 13 files with DEAD imports → import line REMOVED entirely (also resolves the direct import for them):
  payment/settlement/{receipt,verifyPayment}, wallet/{addressBook,analytics,exchange,exchangeConfirm,funding,
  fundingMethods,reusableWallets,transactionsDetail,transactionsList,walletShared,walletRead}.
- RESULT: `grep apis/tatumApi backend/controller/` = NONE; `grep tatumApi. backend/controller/` = NONE. The only
  remaining raw `apis/tatumApi` importers are the integration/infra layer (services/chains/*, services/blockchain,
  services/merchantPool/*, services/keyCustody, utils/tatumAuth, webhooks, apis) — the boundary's implementation,
  correctly left as-is — plus one-off backend/scripts/* + tests (out of scope).

VERIFIED: backend tsc EXIT 0; backend restarted (ts-node, no hot reload) → /health healthy (db+redis connected,
tatum_api operational CLOSED — proves TatumClient resolves at runtime); live curl on 3 migrated endpoints:
POST /api/pay/getData (paymentController) → full meta; GET /api/wallet/network-fees (feesEstimates →
tatumClient.batchFeeEstimation) → live fees; GET /api/wallet/reusable-wallets (dead import removed) → 200.
Behaviour-preserving by construction (tatumClient === default tatumApi). NOT DONE (deferred, high risk):
real domain verbs on BlockchainService + call-site rewrites — money-path, not preview-testable.

## Files touched
- Phase A: `Components/Page/Creator/InlineTipCheckout.tsx` (constants/types de-dup).
- Phase B: `Components/Page/Pay3Components/checkout/checkoutApi.ts` (added `payAxios` transport),
  `Components/Page/Pay3Components/cryptoTransfer.tsx` (5 calls → `payAxios`),
  `Components/Page/Creator/InlineTipCheckout.tsx` (local `api()` → shared `checkoutApi`).
  Shared `checkout/*` type/constant/helper modules otherwise unchanged.
