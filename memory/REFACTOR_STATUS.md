# REFACTOR STATUS

---

# 🏗️ REFERRAL FEE-CREDIT CONSUMPTION (BLENDED default path) — 2026-06 fork — PHASED BUILD

## Problem verified (this session)
The referral revenue-share `credit` mode (default / opt-out of cash) was a **NO-OP**. Accrual worked and
the UI/email promised "Automatically reduces your own Dynopay fees", but NOTHING consumed the accrued
balance at settlement. Every settlement path (`chainVerification.ts:493`, `cryptoCheckout.ts:1556`,
`paymentController.ts:347`) calls `calculateTransactionFees` (trial fee-free only); the referral balance
and `referral_payout_mode` were never read in the fee path. Cash-out (Binance USDT-TRC20) was the only
delivery ever built.

## Decisions (user)
- **Option 1.a**: reduce the ACTUAL platform fee at settlement so the merchant keeps more of THAT payment.
- Blockchain/gas fee ALWAYS deducted (never touched by credit).
- Only in `credit` mode (opt-out of cash). In `cash` mode the balance is reserved for cash-out (credit = 0).
- Credit **decreases when used**, **increases when earned** — ONE shared pool:
  `unpaid = accrued − cash_paid − credited` (a $ can never be both cashed out AND credited).
- Merchant **payout confirmation email** must reflect when referral credit paid the platform fee (and when it didn't).

## Phase 1 — Accounting core (SAFE, no settlement math change) — ✅ DONE + columns live on prod DB
- Migration **0014** (`bootMigrations.ts`): `tbl_referral += commission_credited_usd DECIMAL(14,2) DEFAULT 0`;
  `tbl_user_transaction += referral_credit_applied_usd DECIMAL(14,2) DEFAULT 0`. Additive/idempotent — applied to live DB.
- `referralModel.ts` + `referralRewardModel.ts` (reward_type union += `commission_credit`; STRING cols, no DB enum).
- `referralCommissionService.getReferrerCommissionSummary`: `unpaid = accrued − paid − credited`; adds
  `total_credited_usd` + per-referral `credited_usd` (backward-compatible).
- NEW `services/referralCreditService.ts`:
  - `getAvailableCreditForFees(userId)` → account unpaid balance usable as fee credit; **0 if mode≠credit**.
  - `consumeReferralCreditForTransaction({userId,maxUsd,transactionRef})` → idempotent (keyed by transactionRef,
    returns prior total on retry), atomic (row-locked txn), distributes oldest-first, bumps `commission_credited_usd`,
    writes per-referral audit rows (`reward_type='commission_credit', status='credited', transaction_id=ref`).
- `referralPayoutCron.applyPayoutToReferrals`: cash unpaid now subtracts `credited` too (no double-spend);
  reward row marked withdrawn when `paid + credited >= accrued`.
- `referralPayoutService.getPayoutOverview`: surfaces `credited_balance_usd` + `available_credit_usd`.
- Gates: backend `tsc` EXIT 0. Verified via reversible live-DB script (see below).

## Phase 2 — Settlement integration (Option 1.a) — ✅ DONE + verified (2026-08-30, pod dynopay-setup)

### 2.0 USER-CONFIRMED DECISIONS (ask_human, 2026-06 — build to exactly this)
- **Injection approach = (a) DIRECT settlement-split** (literal Option 1.a). At settlement, move crypto from the
  admin fee to the merchant: `adminAmountToSend -= c; userAmountToSend += c` (c = usable referral credit USD
  converted to crypto at the payment rate). Merchant receives MORE crypto on-chain in that exact payout.
  User explicitly rejected the safer internal-`incrementUserWallet` top-up alt. ⚠️ This edits the on-chain
  money-path split and is NOT E2E-testable in SAFE-MODE preview (no real payments) — verify on prod.
- **Scope = ALL 3 settlement entry paths in this pass**: `controller/payment/settlement/chainVerification.ts`,
  `controller/payment/cryptoCheckout.ts` (~L1556), `controller/payment/paymentController.ts` (~L347).
- **Guardrail = (a) CAP at that payment's platform-fee portion.** Never make the admin fee negative; if available
  credit > this payment's platform fee, apply only up to the fee and leave the leftover credit for the next payment.
  Blockchain/gas/buffer is NEVER touched (admin never underpaid below the gas/network floor).
- **Testing (SAFE MODE)** = reversible TS-node scripts on the live DB (accounting: credit ↓ on use, ↑ on earn,
  idempotency) + a READ-ONLY settlement-math harness proving the fee reduction + email copy + `testing_agent` for
  overview/email. User ALSO approved **seeding a scratch referral to exercise the full path reversibly** (clean up
  after). Real on-chain send is confirmed on prod only.

### 2.1 EXACT INJECTION MECHANICS (verified against current chainVerification.ts line numbers)
Injection point in `chainVerification.ts`: AFTER the auto-convert block ends (currently ~L636) and BEFORE
`settleCryptoTransaction` (currently L719). Placing it after auto-convert means the `!autoConvertEnabled` gate is
automatic (auto-convert sets `userAmountToSend = 0`, so the `userAmountToSend > 0` guard skips it).
Apply ONLY when: `userAmountToSend > 0 && adminAmountToSend > 0 && !autoConvertEnabled` (i.e. the standard
above-threshold merchant-payout path; under-threshold has `userAmountToSend = 0` → skip).
Steps:
1. `const credit = await getAvailableCreditForFees(verifyUserId)` — `verifyUserId = customerData?.adm_id`
   (the merchant receiving THIS payment == the referrer whose credit we spend). Returns 0 unless mode='credit'.
2. Platform-fee portion in USD for this payment = `totalDeduction` (USD, from `calculateTransactionFees` at L493).
   `applyUsd = min(credit, totalDeduction)` — the CAP (guardrail a).
3. Convert `applyUsd` → crypto at the payment rate: `creditCrypto = applyUsd * (totalAmountReceived / receivedUSD)`
   (receivedUSD is the USD value of totalAmountReceived, computed at L485). Cap `creditCrypto` at `adminAmountToSend`
   (belt-and-suspenders so admin never goes negative).
4. `adminAmountToSend -= creditCrypto; userAmountToSend += creditCrypto;` (re-clamp `userAmountToSend <=
   totalAmountReceived`). Remember `appliedCreditUsd = round2(applyUsd)` for persistence + email.
5. Persist on the tx row: at the tx-record write (currently ~L1126-1140, where `base_amount = userAmountToSend`,
   `transaction_fee = adminAmountToSend`), also set `referral_credit_applied_usd: appliedCreditUsd`. Also set it on
   the zero-merchant-payout UPDATE branch (~L1186-1202) — though that branch has userAmountToSend=0 so credit=0.
6. AFTER the settlement DB write commits (so we don't consume on a failed/deferred settlement), call
   `consumeReferralCreditForTransaction({ userId: verifyUserId, maxUsd: appliedCreditUsd, transactionRef })`.
   It is idempotent by `transactionRef` (returns prior total on retry — no double-spend) and only consumes in
   'credit' mode. Use the SAME `transactionRef` used elsewhere in settlement so retries dedupe.
   ► IMPORTANT ORDERING: capture `appliedCreditUsd` at step 4, but only call `consume...` on the SUCCESS path
     (after `settleCryptoTransaction` succeeded + tx row written). If settlement throws/defers, do NOT consume.

### 2.2 OTHER 2 ENTRY PATHS
- `cryptoCheckout.ts` (~L1556) and `paymentController.ts` (~L347) call `calculateTransactionFees` on their own
  fee-split. Mirror the SAME 6 steps: gate on standard merchant-payout path, cap at that path's platform-fee USD,
  shift admin→merchant, persist `referral_credit_applied_usd`, consume idempotently on success. Verify each file's
  local variable names for the admin/merchant split + the USD basis before editing (do NOT assume identical names).

### 2.3 RISK / SAFETY NOTES
- Modifies on-chain settlement amounts → highest blast radius. Keep the whole block inside a `try/catch` that, on
  ANY error, logs + falls back to the UNMODIFIED split (never block a settlement because credit logic failed).
- Credit consumption MUST be post-success + idempotent (already is) so a settlement retry can't double-spend.
- Do NOT touch the auto-convert path, under-threshold path, or gas/buffer.

### 2.4 BUILD STATUS — ✅ DONE (2026-08-30, pod dynopay-setup)
Built to §2.0–§2.3. Files: `chainVerification.ts` (injection after auto-convert / before settleCryptoTransaction;
persist `referral_credit_applied_usd`; post-commit idempotent `consumeReferralCreditForTransaction`),
`models/userModels/userTransactionModel.ts` (+`referral_credit_applied_usd` DECIMAL(14,2)).
- Persisted/consumed USD = `min(applyUsd, actual-crypto-shifted→USD)` so a belt-and-suspenders admin clamp can
  never over-consume the balance vs the on-chain benefit.
- **SCOPE DECISION (deviation from the 2026-06 "all 3 paths"):** only the PRIMARY path `chainVerification.ts` is
  instrumented. The spec's other two "settlement paths" were stale: `cryptoCheckout.ts:1556` is payment CREATION
  (a quote — consuming there would be a bug), and `controller/paymentController.ts` L347 is also creation. The only
  OTHER real split+settle is `paymentController.ts::processIncompletePayments` (recovery) which works in raw crypto
  units with NO clean USD basis/rate → applying credit there risks underpaying admin. Left UNCHANGED because credit
  is never lost (stays in the balance for the next normal settlement) and consume is idempotent (no double-spend).
- Gates: backend tsc 0, frontend tsc 0, settlement-math harness 19/19 (cap, admin-never-negative, clamp, skip gates),
  backend boots healthy SAFE MODE, deep_testing_backend_v2 5/5 (health SAFE MODE, login, payout/overview now exposes
  credited_balance_usd+available_credit_usd, earnings+my-code regression). Real on-chain fee-shift verified on PROD
  after Save to GitHub (cannot run in SAFE-MODE preview).

## Phase 3 — Merchant payout-confirmation email (Option 1.a) — ✅ DONE (2026-08-30)
Add a conditional line to the merchant payment-received / payout-confirmation email:
- credit applied (>0): "Referral credit covered $X.XX of your DynoPay platform fee on this payment."
- not applied (cash mode, $0 balance, or under-threshold): normal platform-fee line (unchanged).
Locate the merchant-facing settlement email (admin-fee/payment-received notification fired in chainVerification.ts
~L933-975 and/or `services/email/*` — confirm the exact sender used for the MERCHANT, not the admin-ops email).
Pass `appliedCreditUsd` through to the template; add i18n keys ×6 locales (check-i18n must stay CLEAN).

## Phase 3 — Email — ⏳ after Phase 2
`sendPaymentReceivedEmail` (merchant) gets a conditional line: credit applied → "Referral credit covered $X of
your platform fee"; not applied (cash mode / no balance) → normal fee line.

## Phase 4 — UI/overview — ✅ DONE (2026-08-30)
PayoutCard: credit-mode stats panel (available fee credit + credited-to-date; data-testids
payout-credit-available / payout-credited-todate) reading overview.available_credit_usd /
credited_balance_usd. Transactions: TransactionDetailsModal shows a "Referral credit applied"
row (−$X) when tx.referralCreditUsd>0 (mapped from referral_credit_applied_usd via getAllTransactions
`ut.*`→`...rest`). Types + mapping in utils/types/transaction.ts + Components/Page/Transactions/index.tsx.
FE tsc 0. (Frontend testing agent NOT yet run — awaiting user OK; read-only screens on live prod DB.)

---

# 🔎 REFERRAL — SCENARIO + EDGE-CASE AUDIT (2026-06 fork) — read-only + reversible on LIVE prod DB
Method: full static read of every referral file (service/cron/automation/model/controller/email) + two probes
run against the LIVE Railway prod DB with env sourced from the running Node backend (PID on :3300):
`backend/scripts/verify_referral_audit.ts` (READ-ONLY) and `backend/scripts/verify_referral_scenarios.ts`
(REVERSIBLE — seeds scratch referrals for referrer=user 1, runs the REAL services, asserts, then deletes
everything + restores user 1; verified DB returned to 0 referrals / 0 rewards / 0 payouts / user1 mode=credit).

## LIVE DB STATE (important context)
- All Phase-1 columns EXIST on prod: `tbl_referral.{commission_rate,commission_window_ends_at,
  commission_accrued_usd,commission_paid_usd,commission_credited_usd,last_accrual_at}`,
  `tbl_user_transaction.referral_credit_applied_usd`, `tbl_user.{referral_payout_mode,
  referral_payout_trc20_address,referral_payout_address_verified_at,referral_payout_auto,
  referral_payout_auto_min_usd,referral_payout_nudged_at}`.
- **`tbl_referral`, `tbl_referral_reward`, `tbl_referral_payout` are ALL EMPTY on prod.** There are ZERO
  referrals — the revenue-share feature has NEVER been exercised with real data in production. Every bug below
  is therefore LATENT today (no data triggers it), but real in code and will fire the moment referrals accrue.

## ✅ VERIFIED WORKING (Phase 1 accounting core — 14/14 reversible checks passed on live DB)
- S1 accrual visibility: `getReferrerCommissionSummary` unpaid = accrued−paid−credited; `getAvailableCreditForFees`
  returns unpaid in credit mode.
- S2 `consumeReferralCreditForTransaction`: partial consume correct; **idempotent** (re-run same transactionRef
  returns prior total, NO double-spend); credited↑ / unpaid↓.
- S3 **cap guardrail**: requesting more than remaining consumes only the remaining balance; once fully credited,
  further consume = 0.
- S4 **cash-mode gate**: in cash mode `getAvailableCreditForFees`=0 and consume is blocked (balance reserved for
  cash-out) — the credit/cash mutual-exclusion holds.
- S6 **oldest-first distribution**: multi-referral consume drains the oldest `activated_at` first.

## 🐞 FINDINGS (prioritised)

### F1 — [P1, MONEY-PATH DOUBLE-SPEND] Automation SQL ignores `commission_credited_usd` — ✅ FIXED (2026-08-30)
`services/referralPayoutAutomation.ts` computes the payable balance as `SUM(commission_accrued_usd −
commission_paid_usd)` in BOTH `processReferralNudges` (SELECT + HAVING) and `processAutoPayouts` (SELECT +
HAVING). It does NOT subtract `commission_credited_usd`. Every OTHER path (getReferrerCommissionSummary,
requestPayout, referralPayoutCron.applyPayoutToReferrals) correctly uses `accrued − paid − credited`.
- **Harness proof (S5):** with accrued=100, paid=0, credited=100 → automation sees unpaid=$100 while the true
  balance is $0. A referrer who spent their balance as fee-credit (credit mode), then switched to cash + enabled
  auto, would have `processAutoPayouts` create a **$100 payout of already-spent funds** (≥ the $25 min), and the
  cron would send real USDT for it → the referrer gets paid twice for the same accrual. Reconcile
  (`applyPayoutToReferrals`) can only apply against `accrued−paid−credited`=0, so the excess is unreconcilable.
- **FIX (2 queries, both SELECT agg + HAVING):** subtract `COALESCE(commission_credited_usd,0)` in
  `processReferralNudges` and `processAutoPayouts` so all four aggregates match the shared-pool invariant.
- Test after fix: reversible harness scenario S5 should then show automation_unpaid==true_unpaid==0.

### F2 — [P2] Threshold nudge fires for credit-mode referrers AND overstates the amount
`processReferralNudges` has no `referral_payout_mode` filter, so a credit-mode referrer (who cannot cash out) is
emailed "You can cash out $X". Combined with F1 the $X is also overstated (ignores credited). The email copy does
branch on mode (credit → "it's reducing your fees; switch to cash to withdraw"), so it's not wrong-headed, but
the amount is incorrect and arguably a credit-mode user shouldn't be nudged to "cash out" at all. Decide: filter
to `mode='cash'`, or keep cross-mode but fix the amount (F1) + soften copy.

### F3 — [P2] 90-day activation window is NOT enforced
`redeem*` sets `referral.expires_at = referred_at + 90d` ("90 days to complete a qualifying transaction"), but
`processPendingReferrerRewards` activates on ANY $100+ payment regardless of `expires_at`, and no cron ever moves
a stale `pending` referral → `expired`. So the 90-day rule is cosmetic. Decide: enforce (`AND t."createdAt" <=
r.expires_at` in the activation query + an expiry sweep) or drop the copy/claim.

### F4 — [P2] A user can hold TWO pending referrals (two different referrers)
`redeemUserReferralCode` guards only on the (referrer_user_id, referred_user_id) PAIR, whereas
`redeemRefereeCode` guards on referred_user_id in [pending,active,rewarded]. So redeeming two different *organic*
referral codes creates two pending rows from two referrers; activation (`findOne pending`) then activates only
one and the other lingers forever. Rare, but tighten `redeemUserReferralCode` to the same
"any existing referral for this referred_user_id" guard as the referee path.

### F5 — [P3, KNOWN/DOCUMENTED] No clawback on refund/chargeback
Accrual only counts terminally-settled txns (PROCESSED_STATUS_SQL), which minimises this, but a later reversal of
a counted payment is not clawed back from `commission_accrued_usd`. Documented as accepted in §6 of the plan.

### F6 — [P3] Activation threshold compares `base_amount` (base_currency), not USD
`processPendingReferrerRewards`: `t.base_amount >= 100`. For a non-USD `base_currency` the $100 gate drifts.
base_currency is USD for essentially all merchants today → low impact. Normalise to USD if multi-currency grows.

### F7 — [BLOCKER FOR THE PROMISED FEATURE] Settlement still does NOT consume credit (Phase 2 not built)
`consumeReferralCreditForTransaction` works perfectly in isolation, but NOTHING in the money path calls it yet —
the fee reduction at settlement (Phase 2, decisions locked above) is unbuilt. Until Phase 2 ships, `credited`
stays 0 in production and the UI/email promise ("reduces your own DynoPay fees") is still not delivered.
Consequence: F1 is not exploitable in prod TODAY (credited is always 0), but F1 MUST be fixed BEFORE or WITH
Phase 2, otherwise the first credit-then-switch-to-cash user can double-spend.

## CANNOT be verified in SAFE-MODE preview (environmental, not defects) — verify on prod leader
- Real accrual/nudge/auto/payout crons (leader-only, ENABLE_BACKGROUND_JOBS off here).
- Real Binance USDT-TRC20 send (geo-blocked 451 in preview) + outbound emails (DISABLE_OUTBOUND_EMAIL=true).
- Real on-chain settlement fee-split (needs a live payment) — the Phase 2 target.

## Verification artefacts (kept for re-run)
- `backend/scripts/verify_referral_audit.ts` — READ-ONLY inventory/columns/invariant probe.
- `backend/scripts/verify_referral_scenarios.ts` — REVERSIBLE 14-check scenario harness (self-cleaning).
  Run: `cd /app/backend && set -a; while IFS= read -r -d '' l; do export "$l"; done < /proc/<node-pid>/environ;
  set +a; node_modules/.bin/ts-node --transpile-only scripts/verify_referral_scenarios.ts` (node-pid = the
  `ts-node ... server.ts` process listening on :3300, which carries the live DATABASE creds).

---


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

### 9. DECISIONS LOCKED (2026-08-29, pod dynopay-setup) + PHASE 1 KICKOFF
User answered the open questions and refined the cash-out. FINAL, build to this:
- Q1 delivery = **BLENDED**. DEFAULT = fee-credit (accrued USD auto-reduces the referrer's OWN Dynopay fees);
  OPT-IN = cash-out. A referrer only cashes out if they explicitly switch to cash AND have a saved payout address.
- Q2 payout rail = **BINANCE API** (user overrode the §8.4 "Tatum on-chain recommended" default). Reuse the
  EXISTING conversion payout rail: `services/binanceService.ts::submitWithdrawal({ coin, address, amount, network })`
  → POST `/sapi/v1/capital/withdraw/apply`; `getWithdrawalHistory()` to poll; `getAssetBalance("USDT")` treasury
  guard. `services/conversionService.ts::processWithdrawals()` (Phase 3) is the working reference implementation.
- PAYOUT ASSET/CHAIN = **ALWAYS USDT-TRC20** (no user choice). `binanceService.toBinanceNetwork` maps TRC20→"TRX".
  Amount = accrued-unpaid USD (USDT 1:1). Binance auto-deducts its ~1 USDT network fee from the amount (referrer
  bears it — identical to merchant conversion payouts).
- ADDRESS RULE = the referrer MUST have a saved USDT-TRC20 address to opt into cash; no address ⇒ stays on credit.
  ► PHASE 2 UX NOTE (remember): if the referrer ALREADY has a USDT-TRC20 address on file (e.g. an existing
    settlement/reusable wallet), let them SELECT it at opt-in instead of re-typing — only prompt for a new address
    if none exists. Good UX. New/changed address ⇒ OTP-verify (reuse withdrawal OTP `<email>-withdrawal-otp`).
- Q3 cash-out trigger = user-initiated `POST /api/referral/payout/request`, OTP-gated, idempotency key (DEFAULT;
  can add auto-pay later). Q4 liquidity = via Binance (convert-on-demand path already exists). MIN_PAYOUT_USDT
  default **$25** (env-configurable). Q5 ship order = Phase 1 now.

BACKEND UI/API surface (final):
- Phase 1 (THIS SESSION): migration 0011 (tbl_referral commission cols); repurpose processReferrerReward →
  activation (open 12-mo window, NO discount grant); accrueReferralCommission (idempotent watermark) + cron
  accrueActiveReferralCommissions; getReferrerCommissionSummary; extend GET /api/referral/earnings (adds
  `commission` block, backward-compatible).
- Phase 2: add tbl_user cols `referral_payout_mode ENUM('credit','cash') DEFAULT 'credit'`,
  `referral_payout_trc20_address`, `referral_payout_address_verified_at`; endpoints
  `POST /api/referral/payout/opt-in` (validate TRC20 via wallet-address-validator + OTP; or SELECT existing saved
  wallet) and `POST /api/referral/payout/request` (Binance submitWithdrawal, treasury guard, idempotency, tx_hash
  audit on tbl_referral_reward). Leader-cron/prod only; OFF in SAFE-MODE preview.

FRONTEND UI (final):
- Phase 1: Dashboard "Referral Earnings" card + `pages/referrals.tsx` breakdown → REAL accrued commission (USD),
  per-referred-merchant (accrued / this-period / 12-mo window days left). Copy: "Earn 25% of the fees from every
  merchant you refer, for 12 months — as fee credit, or cash out in USDT (TRC-20)." data-testids on all.
- Phase 2: "Payout method" control — Credit (default) vs Cash (USDT-TRC20). Choosing Cash → wallet picker
  (SELECT an existing saved TRC20 address, or add a new one) + OTP modal; "Withdraw to wallet" button appears only
  when mode=cash + verified address + balance ≥ MIN_PAYOUT_USDT.

PHASE 1 STATUS: ✅ DONE (2026-08-29). Backend verified by deep_testing_backend_v2 (5/5 read-only tests
pass: /health SAFE MODE, login regression, GET /api/referral/earnings now returns data.commission
{rate_percent:25, window_months:12, total_accrued_usd, total_paid_usd, unpaid_balance_usd, active_windows,
referrals[]} with data.summary/data.rewards unchanged). Migration 0011 applied on live prod (5 cols on
tbl_referral). Accrual math validated by READ-ONLY dry-run (user_id=1: $814.36 fees → $203.59 @25%).
Frontend: pages/referrals.tsx "Revenue share" card (data-testid=referral-revenue-share-card) shows available
balance / total accrued / paid out / active windows + per-merchant breakdown; en/referrals.json keys added;
/referrals compiles ✓ 200. Cron accrual stays OFF in SAFE-MODE preview (leader/prod only).
NOT yet run through the frontend testing agent (awaiting user OK — LIVE prod DB, read-only screen).
NEXT: Phase 2 (opt-in USDT-TRC20 address — reuse existing saved wallet if present — + Binance payout).

### 10. PHASE 2 — CASH-OUT UX: ACCOUNT-LEVEL PAYOUT, CROSS-COMPANY WALLET REUSE (2026-08-29)
KEY CONSTRAINT (user): the referral reward accrues at the ACCOUNT (tbl_user.user_id) level, but saved
wallets (tbl_user_wallet) are PER-COMPANY (columns: user_id, company_id, wallet_name, wallet_type,
wallet_address, destination_tag). An account can have several companies (e.g. user_id=1 → companies 1, 71),
each with its own settlement wallets. TRON-capable wallet_types present: 'USDT-TRC20' and 'TRX' (same TRON
address format; either can receive USDT-TRC20).

RESOLUTION:
- Payout address is stored ON THE ACCOUNT: tbl_user.referral_payout_trc20_address (+ _mode, _verified_at).
  Decoupled from any company so it survives company/wallet edits.
- Opt-in aggregates EVERY TRON address the account already has across ALL its companies:
  SELECT ... FROM tbl_user_wallet WHERE user_id=:uid AND wallet_type IN ('USDT-TRC20','TRX'); validate each
  with tronweb.utils.address.isAddress; DE-DUPE by address; label = wallet_name + company name + masked addr.
  Selecting an ALREADY-SAVED (already OTP-verified when added) address needs NO fresh OTP. A brand-NEW address
  requires OTP (Redis referral-payout-otp:<userId>, reuse the wallet OTP email). No TRON address anywhere ⇒
  prompt to add one (validate + OTP).
- Each cash-out REQUEST is OTP-gated (recommended). MIN_PAYOUT_USDT default $25 (env REFERRAL_MIN_PAYOUT_USDT).

COPY (account-vs-company explicit):
- Heading: "Cash out — USDT (TRC-20)".
- Explainer: "Referral earnings belong to your account, not a single business. Choose one USDT (TRC-20)
  wallet for all your referral payouts."
- Picker: "Use a wallet you've already saved" (aggregated list) vs "Add a new USDT (TRC-20) address".
- Warning: "Sent on Tron (TRC-20). Double-check it — crypto sent to a wrong address can't be recovered."

BACKEND (Phase 2, this session):
- Migration 0012: tbl_user cols (referral_payout_mode 'credit'|'cash' DEFAULT 'credit',
  referral_payout_trc20_address, referral_payout_address_verified_at) + CREATE tbl_referral_payout
  (payout_id, user_id, amount_usd, trc20_address, status pending|processing|completed|failed,
  idempotency_key UNIQUE, binance_withdrawal_id, tx_hash, withdrawal_fee_usdt, error_message,
  requested_at, completed_at).
- referralPayoutService: getReusableTrc20Wallets(userId) [cross-company, tron-validated, deduped],
  getPayoutOverview, sendPayoutOtp/verify, setPayoutMode (select-saved = no OTP; new = OTP),
  requestPayout (validate mode=cash + verified addr + unpaid ≥ MIN + OTP + idempotency → 'pending' row;
  NO Binance call here), processReferralPayouts (LEADER/PROD cron only: treasury guard getAssetBalance('USDT')
  → binanceService.submitWithdrawal({coin:'USDT', network:'TRC20', address, amount}) → poll
  getWithdrawalHistory(status 6=complete) → bump commission_paid_usd across referrals + mark reward rows
  withdrawn + tx_hash). submitWithdrawal is NEVER called from an API request — cron only.
- Endpoints (authMiddleware): GET /api/referral/payout/overview, POST /api/referral/payout/otp,
  POST /api/referral/payout/opt-in, POST /api/referral/payout/request.
SAFE MODE: cron OFF + Binance geo-blocked + outbound email OFF in preview ⇒ the SEND path and new-address OTP
cannot be E2E-tested here; verified read-only (overview + validation negatives) in preview, real send on prod.

### 10.1 PHASE 2 STATUS: ✅ DONE (2026-06, pod fork) — backend verified read-only on live prod DB
Built exactly to §9/§10. Files:
- `services/referralPayoutService.ts` (NEW, 497 lines — under the R2 500-line hook): getReusableTrc20Wallets
  (cross-company USDT-TRC20/TRX aggregation, tronweb-validated via tatumClient.validateTronAddress, deduped),
  getPayoutOverview, sendPayoutOtp/consumeOtp (Redis `referral-payout-otp:<userId>`, TTL 300s, reuses
  sendWithdrawalOTPEmail), optInPayout (saved address = NO OTP; new address = OTP), requestPayout (OTP-gated +
  idempotency + MIN guard ⇒ 'pending' row, NO Binance call), processReferralPayouts + monitorReferralPayouts
  (LEADER/PROD cron only: treasury guard getAssetBalance('USDT') → submitWithdrawal{coin:USDT,network:TRC20} →
  poll status===6 → applyPayoutToReferrals reconciles commission_paid_usd + marks reward rows 'withdrawn'+tx_hash).
- `controller/referralPayoutController.ts` (NEW) + 4 routes on referralRouter (authMiddleware):
  GET /payout/overview, POST /payout/otp, POST /payout/opt-in, POST /payout/request.
- `referralRewardMonitor.ts` cron: added processReferralPayouts()+monitorReferralPayouts() (leader/prod only,
  OFF in SAFE-MODE preview — setupReferralRewardCron is inside registerLeaderCronJobs).
- MIN_PAYOUT_USDT = env REFERRAL_MIN_PAYOUT_USDT (default $25).
- FILE-SIZE FIX (R2): Phase 1 had grown `services/referralService.ts` to 661 lines (NEW-file blocker). Pure-move
  split → `services/referralCommissionService.ts` (accrueReferralCommission / accrueActiveReferralCommissions /
  getReferrerCommissionSummary), re-exported from referralService for callers. referralService=465, commission=209.
  tsc clean, file-size gate EXIT 0 (Save-to-GitHub unblocked).
- FRONTEND: `Components/Page/Referrals/PayoutCard.tsx` (NEW) mounted on `pages/referrals.tsx` — payout-method
  toggle (Credit default / Cash), saved-wallet picker (reuse) + "add new address" (OTP) flow, "Cash out $X" button
  (only when mode=cash + verified addr + balance ≥ MIN), pending-payout status. data-testids throughout.
  api/endpoints.ts: payoutOverview/Otp/OptIn/Request. Copy: referrals.json referrer reward changed 50%/30d →
  "25% revenue share, 12mo" + 42 payout/revenue-share keys ADDED to ALL 6 locales (check-i18n referrals CLEAN);
  landing.json FAQ a6 rewritten (6 locales).
- VERIFIED (read-only, per user — NO writes to live account): login 200; GET /payout/overview 200 (mode=credit,
  min=25, cross-company wallet aggregated: TRX "The Dev Store" TTve8v6Y…4mAkxR tron-validated); opt-in invalid
  addr→400, opt-in new addr no-otp→400 OTP_REQUIRED, request while credit→400; POST /payout/otp valid new addr→200
  (Redis-only, email SUPPRESSED, log "[ReferralPayout] OTP sent"), invalid addr→400; overview re-checked ⇒ live
  account UNCHANGED (mode still credit). earnings endpoint regression PASS (commission block intact). frontend +
  backend tsc = 0 errors; /referrals compiles+200. NOT E2E'd: the happy-path opt-in/withdraw WRITE paths + real
  Binance send (user chose read-only; Binance geo-blocked + email off in preview) — code+compile verified, run on prod.

### 10.2 PHASE 3 + OPT-OUT + PAYOUT HISTORY: ✅ DONE (2026-06 fork) — E2E'd on live DB (reversible, restored)
User-approved this round: implement Phase 3 execution finish, opt-out (keep wallet on file), payout history + CSV.
- Phase 3 idempotency: `binanceService.submitWithdrawal` now accepts `withdrawOrderId` (Binance rejects dup order ids).
  Execution moved to NEW `services/referralPayoutCron.ts` (processReferralPayouts passes withdrawOrderId=idempotency_key
  + pre-submit guard: getWithdrawalHistory({withdrawOrderId}) adopts an existing withdrawal instead of re-sending;
  monitorReferralPayouts unchanged). referralRewardMonitor cron import repointed to referralPayoutCron. Still leader/prod
  only, OFF in preview. (Split also kept referralPayoutService.ts=452 under the 500 hook.)
- OPT-OUT: optInPayout mode='credit' keeps referral_payout_trc20_address + verified_at on file (wallet stays saved).
  Re-enable: optInPayout mode='cash' with the SAME on-file verified address (or any saved company wallet) needs NO OTP.
- HISTORY: getPayoutHistory + getPayoutHistoryCsv in referralPayoutService; controller payoutHistory/payoutHistoryExport;
  routes GET /payout/history + GET /payout/history/export (text/csv attachment). tronscan tx links.
- FRONTEND PayoutCard: "Turn off cash-out" (opt-out), "Re-enable cash-out" block (shows saved wallet when mode=credit),
  "Cash-out history" list (amount/date/status badge/tronscan link) + "Download CSV" (authenticated blob). 9 new i18n keys
  ×6 locales (check-i18n referrals CLEAN).
- VERIFIED E2E on live prod DB (user approved reversible writes, then FULLY restored — final state = credit/NULL/NULL/0 rows):
  opt-in saved wallet→200 no-OTP; opt-out→200 (verified addr retained); re-enable→200 no-OTP; seeded 2 payout rows →
  GET /payout/history returned both (completed w/ tronscan tx_url + failed); CSV export correct header+rows; cleanup deleted
  rows + reset user. backend+frontend tsc=0, file-size PASS, /referrals compiles+200.
  NOT E2E'd here: the REAL Binance send (geo-blocked in preview) — the withdrawOrderId path is code-verified, runs on prod.

---

## 11. REFERRAL PAYOUT — THRESHOLD NUDGE + AUTO-PAYOUT + TREASURY SAFETY (2026-06 fork) — phased plan
User confirmed (yes-to-all + configurable min). Build phase by phase.

### Phase A — Money-path safety: insufficient-treasury handling + admin alert  [PRIORITY]
- NEW `utils/treasuryAlert.ts` → `alertTreasuryLow({asset,have,need,context})`: Redis-throttled (once per asset per 3h,
  key `treasury-alert:<ASSET>`) → emails `config.adminEmail` via NEW `sendTreasuryLowAlertEmail` (adminOpsEmails.ts).
- Referral payout cron (referralPayoutCron.ts): on low USDT treasury → keep pending (already) + alertTreasuryLow.
- Conversion PHASE 3 `processWithdrawals` (USDT/USDC send-out = the real "treasury" path): STOP burning retry_count /
  no longer marks a merchant payout FAILED for a temporary shortfall — it WAITS for top-up (mirrors referral) + alerts admin.
  NOTE: Phase 2 `processConversions` "insufficient source asset" is a DEPOSIT/SWEEP condition (not treasury) — left as-is.

### Phase B — Threshold nudge (referrer email when balance crosses the minimum)
- Migration 0013: tbl_user += `referral_payout_auto` BOOL default false, `referral_payout_auto_min_usd` DECIMAL null,
  `referral_payout_nudged_at` TIMESTAMP null.
- Accrual cron: after accrual, for referrers whose unpaid ≥ effective-min and `nudged_at` null → send NEW
  `sendReferralPayoutReadyEmail` ("you can cash out $X") + set nudged_at. Reset nudged_at on payout completion so it re-nudges.

### Phase C — Auto-payout (opt-in, standing authorization)
- Enable = OTP-gated ONE-TIME (`POST /referral/payout/auto` {enabled, auto_min_usd, otp}); disable = no OTP.
  Requires mode=cash + verified address. `auto_min_usd` configurable (default = MIN_PAYOUT_USDT $25).
- Cron `processAutoPayouts`: users with auto on + cash + verified + no pending + unpaid ≥ effective-min → create payout row
  (NO per-payout OTP; pre-authorized) → Phase-3 cron sends it.
- Emails: auto-enabled confirmation, payout requested (referrer), payout failed (referrer); success reuses existing template.
- Frontend PayoutCard: "Auto cash-out" toggle (amount + OTP on enable), current auto status. i18n ×6.

Testing: reversible writes on user_id 1 (fully reverted); accrual/auto crons are leader/prod-only so real send can't run in preview.

### 11.4 BUILD STATUS (2026-06 fork, session ended by user after Phase C build)
- **Phase A (treasury safety) — ✅ DONE + verified.** `utils/treasuryAlert.ts` (Redis-throttled 3h/asset) + `sendTreasuryLowAlertEmail`
  (adminOpsEmails). Wired: referralPayoutCron (low USDT → keep pending + alert) and conversionService PHASE 3
  `processWithdrawals` (low USDT/USDC → NO retry-burn/FAIL, waits for top-up + alert). Phase 2 `processConversions`
  left as-is (deposit/sweep, not treasury). Verified: unit test — call 1 composed admin email (SUPPRESSED in preview),
  call 2 throttled via Redis. tsc 0, file-size PASS.
- **Phase B (threshold nudge) — ✅ BUILT, backend-verified (schema/SQL); happy-path email not E2E'd.** Migration 0013
  applied on live DB (referral_payout_auto, referral_payout_auto_min_usd, referral_payout_nudged_at). userModel updated.
  `referralEmails.ts` (4 emails: ready-nudge, auto-enabled, requested, failed) exported via emailService.
  `referralPayoutAutomation.processReferralNudges()` wired into accrual cron. Nudge flag reset on payout completion
  (referralPayoutCron). NOT run: the leader-only nudge email itself (needs a referrer with balance ≥ min).
- **Phase C (auto-payout) — ✅ BUILT, backend-verified (endpoint negatives + overview); happy-path write E2E NOT run
  (session ended).** `setAutoPayout` (OTP-gated enable / no-OTP disable, configurable min ≥ $25) + `POST /referral/payout/auto`
  + `processAutoPayouts()` cron (creates pending row, no per-payout OTP → Phase-3 sends). Idempotent `withdrawOrderId`
  already added (§10.2). Payout history split to `referralPayoutHistory.ts` (R2 file-size). Frontend PayoutCard:
  auto-cash-out toggle (amount + OTP on enable, current status, turn-off) + 10 i18n keys ×6 locales. FE+BE tsc 0,
  file-size PASS, check-i18n clean, /referrals compiles+200.
  Verified via curl: overview exposes auto/auto_min_usd/min; enable-auto while credit → 400; disable-auto → 200.
  Account left UNTOUCHED (mode=credit, no address, auto=false).
- **E2E'd this session (reversible, account restored):** enable-auto happy path (OTP read from Redis → auto=true/min=$50),
  automation nudge+auto queries run clean against the live schema (0 actions — user 1 has $0 referral balance), account fully
  reset to credit/no-address/auto-off. **Still NOT run:** nudge/auto CREATE with real balance (won't fabricate referral
  relationships on prod) + real Binance send (geo-blocked in preview). Both are code+compile verified.
- New/changed backend files: utils/treasuryAlert.ts, services/email/referralEmails.ts, services/referralPayoutAutomation.ts,
  services/referralPayoutHistory.ts, services/referralPayoutService.ts, services/referralPayoutCron.ts,
  services/conversionService.ts, services/binanceService.ts, controller/referralPayoutController.ts, routes/referralRouter.ts,
  migrations/bootMigrations.ts (0013), models/userModels/userModel.ts, utils/crons/referralRewardMonitor.ts.
  Frontend: Components/Page/Referrals/PayoutCard.tsx, api/endpoints.ts, langs/locales/*/referrals.json.


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
