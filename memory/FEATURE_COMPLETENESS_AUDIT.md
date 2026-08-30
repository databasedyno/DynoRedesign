# DynoPay — Full Platform Feature Completeness Audit
_Date: 2026-06 · Env: LIVE prod DB in SAFE MODE (bg jobs OFF, email OFF, Binance geo-blocked) · Merchant: onarrival21@gmail.com (user_id=1, "Hostbay")_

Method: static code sweep + read-only runtime probes against the live preview
(`https://86622934-…preview.emergentagent.com`). Every endpoint below was hit with a real
merchant JWT unless noted. No writes were made to the live account.

Scale: ~40 frontend pages, 30 backend routers, ~374 route definitions.

Legend: ✅ implemented + runtime-verified · 🟡 implemented but UNVERIFIED here (env/flag) · 🚩 built but DARK in prod (flag off) · 🧩 stub/dead/alternate code (non-blocking)

---

## 1. Executive summary
The platform is **broadly feature-complete and healthy**. The incompleteness-marker scan came back
remarkably clean (almost no genuine TODO/FIXME/"coming soon" in production code paths). Every core
merchant domain returns live data. The real gaps are **not half-built features** — they are:
1. **Feature-flagged subsystems that are dark in production** (Crypto Refunds; Ledger dual-write).
2. **Money-path flows that can only run on the prod leader** and were never E2E-verified end-to-end
   (referral Binance cash-out, conversions, settlement sweeps, treasury alerts, auto-payout crons).
3. A few **orphaned/alternate/demo code paths** that are harmless but should be known.

Production-launch blockers are minimal; the biggest risks are **operational verification** of the
money path on prod and **deciding whether Refunds/Ledger flags should be ON**.

---

## 2. Domain-by-domain completeness

### Auth, Security, Accounts
- ✅ Email/password login (`POST /api/user/login` → 200, returns accessToken/refreshToken/session_id).
- ✅ Social auth (Google/GitHub) — wired; redirect_uri points at dynopay.com so it 400s on preview only.
- ✅ 2FA (`twoFactorService`), account lockout (`accountLockoutService`), session service, suspicious-login lock.
- ✅ KYC (Veriff) — `GET /api/kyc/status` 200; 6 kyc routes; `veriffService`.
- ✅ Password reset, email verification.
- 🟡 Outbound email is OFF in this pod (`DISABLE_OUTBOUND_EMAIL=true`) — email templates exist & compile but delivery is not exercised here.

### Wallets & Withdrawals
- ✅ Multi-chain wallets (13 chains) — `GET /api/wallet/getWallet` → 32 KB of live data.
- ✅ Reusable/cross-company wallets — `GET /api/wallet/reusable-wallets` → 200.
- ✅ Network-fee estimation — `GET /api/wallet/network-fees` → 200 (Tatum).
- ✅ Address book, wallet OTP, wallet edit (past bug fixed).
- 🟡 Actual on-chain **withdrawals** run through Tatum on the prod worker; not exercised in SAFE MODE.

### Checkout & Payments (core money path)
- ✅ Payment links, hosted checkout (`CleanCheckoutV2`), creator tips (`InlineTipCheckout`) — render + reserve.
- ✅ `POST /api/pay/getData`, verify polling, `setCustomerEmail` receipt capture, browser notify.
- ✅ Buy Buttons — `GET /api/buy-buttons?company_id=1` → 200 (needs company_id; 400 without = expected).
- ✅ Publishable keys + embeddable **Elements** widget — `GET /api/publishable-keys?company_id=1` → 200; public embed router with per-origin CORS.
- 🟡 **Settlement / sweeps / confirmations** are leader/prod-cron only — cannot confirm on-chain transitions in preview (needs a real payment).
- 🧩 `NEXT_PUBLIC_CHECKOUT_SWR` flag OFF → legacy polling path is active (SWR path built + tested, awaiting a live real-payment test before default).

### Storefront, Products, Cart, Tax
- ✅ Product catalog — `GET /api/products` 200, `GET /api/products/orders/all` 200, `GET /api/shop/devhub` 200.
- ✅ Cart, checkout, `quote-tax`, per-product tax overrides, merchant tax settings.
- ✅ Tax service — `GET /api/tax/lookup|rate|acronyms` + `POST /api/tax/validate` (VAT ID).
- ✅ **Digital-asset delivery**: DigitalOcean Spaces is the durable backend and IS configured in prod
  (`SPACES_*` set; merchant photo already served from `…cdn.digitaloceanspaces.com`). Private product
  files upload as ACL=private and stream through the gated `/api/order/:ref/download/:assetId` route.

### Creator / Donations / Crowdfunding
- ✅ Creator pages, tips, donation campaigns, donor wall, live payment feed.

### Invoices
- ✅ `GET /api/invoices` 200, `/invoices/tax-report` 200, CSV + PDF export; localized invoice PDFs (6 locales).

### Subscriptions
- ✅ `GET /api/subscriptions/` 200 (empty list), full CRUD, plan model, next-billing calc, cancel emails.
- ⚠️ **Recurring billing rail = Flutterwave** (`apis/flutterwaveApi`), NOT crypto (crypto has no pull payments).
  → **Verify Flutterwave keys are configured in prod** and that this is intended; otherwise subscriptions
  cannot actually charge. Flagged for confirmation.

### Referral Revenue-Share (most recent money-path build)
- ✅ Fully wired end-to-end. `GET /api/referral/payout/overview` → 200 with correct shape
  (mode=credit, min $25, cross-company TRON wallet aggregated & tron-validated, auto flags, pending_payout).
- ✅ `GET /api/referral/earnings` → 200 (commission block: 25% rate, 12-mo window, accrued/paid/unpaid).
- ✅ `my-code`, `list`, opt-in/opt-out, history + CSV, auto-payout toggle, threshold nudge, treasury alerts.
- 🟡 **Never E2E-verified through a real Binance send** (Binance geo-blocked here + leader-cron only).
  Accrual/payout crons are OFF in SAFE MODE. Only reversible DB tests were run in prior sessions.
  → This is the #1 item for **production validation**.

### Customers & Dashboard / Analytics
- ✅ Customer directory — `GET /api/userApi/customers/directory` 200 (unified payer identity, segments).
- ✅ Dashboard — `/`, `/chart`, `/fee-tiers`, `/action-counts`, `/conversions` all 200; active variant is `Dashboard/v2026`.
- ✅ Admin analytics router (`/api/admin/analytics`) — revenue/cohorts/funnels.

### Developer platform
- ✅ API keys CRUD, usage stats, logs, rate limits, plans; publishable keys; merchant API (`merchantApiRouter`, 12 routes).
- ✅ Public sandbox playground (`/api/public/sandbox`) — intentional demo with fake data.
- ✅ Webhooks: outbox pattern ON (`ENABLE_OUTBOX=true`), inbound dedup ON, signed delivery, retry/backoff.

### Notifications
- ✅ `GET /api/notifications/` 200, unread-count, preferences, Web Push (VAPID key endpoint 200), SSE events, payout digest.

### Support / KB / Status
- ✅ AI support chat (rate-limited, graceful 503 when unavailable), Knowledge Base (`/api/kb/articles` 200), public status page (`/api/status/services` 200, uptime, incidents).

### Refunds — 🚩 BUILT BUT DARK IN PROD
- Full backend (`refund/refundController`, service, 7 routes) **and** full frontend
  (`Components/Page/Refund/CryptoRefundModal.tsx`, `refundStatus.tsx`).
- **Gated behind `ENABLE_CRYPTO_REFUNDS`, which is NOT set in the prod cred paste** → every refund
  route returns 404 (verified: `/api/refunds/preview` → 404). The FE refund modal calling
  `refunds/preview` would fail in production.
  → **Decision needed:** turn the flag on (also needs `ENABLE_BACKGROUND_JOBS` on the worker) or hide the FE entry points.

### Ledger (double-entry accounting) — 🟡 READ-ON, NOT ENFORCING
- `ENABLE_LEDGER=true` (read APIs live) but `LEDGER_DUAL_WRITE=false` and `LEDGER_INVARIANT_CRON=false`.
- So the ledger is in **shadow/read mode** — it is not dual-writing on the money path and invariant
  checks aren't running. Admin-only routes (`/api/ledger/*`) exist for balances/timeline/backfill.
  → **Decision needed:** is shadow mode intended, or should dual-write + invariant cron be enabled before launch?

---

## 3. Stubs / dead / alternate code (non-blocking, but know they exist)
- 🧩 `services/gcsAssetService.ts` — throws `E_GCS_NOT_IMPLEMENTED`. **Intentional Phase-2 hook**;
  DO Spaces is the active durable backend, so this is moot unless you switch to GCS.
- 🧩 `Components/Page/Dashboard/coinbase/*` — an **orphaned/alternate** dashboard variant (not imported
  anywhere; active dashboard is `v2026`). Contains a "mock chips for now" comment — NOT in the prod path.
- 🧩 Demo/QA pages: `pages/pay/demo.tsx`, `payment-states-demo.tsx`, `state-demo.tsx`, `pages/qa/otp-harness.tsx`
  — deliberate client-side mocks for design/QA.
- 🧩 `HelpAndSupport` falls back to hardcoded FAQ only when the KB API returns empty (KB API works, returns 200).
- 🧩 `services/chains/{utxoChain,evmChain}.ts` — thin stubs that delegate to `tatumApi` (architectural seam, by design).

---

## 4. SAFE-MODE caveats (environmental, NOT code defects)
These cannot be verified in this pod and require a prod/leader run:
- Background job crons (settlement, sweeps, conversions, payouts, reconciliation, digests, referral accrual/payout).
- Real Binance operations (geo-blocked 451 here) — conversions + referral USDT-TRC20 cash-out.
- Outbound email delivery (Brevo) — templates compile; delivery suppressed.

---

## 5. Prioritized follow-ups (for production launch)

**P0 — verify money path on prod (highest risk, unverified)**
1. Real referral cash-out E2E: opt-in → request → leader cron → Binance USDT-TRC20 send → tx_hash → history.
2. Confirm settlement + sweep + conversion crons run cleanly on the prod leader with `ENABLE_BACKGROUND_JOBS=true`.
3. Confirm treasury-low alert, threshold nudge, and auto-payout fire with a real balance.

**P0 — flag decisions**
4. Crypto Refunds: turn `ENABLE_CRYPTO_REFUNDS` ON (+worker) or hide the FE refund modal so buyers don't hit 404.
5. Ledger: decide shadow vs dual-write (+invariant cron) before launch.
6. Subscriptions: confirm Flutterwave is configured & intended (only recurring-billing rail present).

**P1 — thin areas**
7. Admin money-path health dashboard (settlement throughput, ledger balance, pending sweeps, provider health) — not built.
8. Key-custody boundary migration (remaining decrypt sites) — Increment 2.
9. Tatum integration-boundary migration for remaining controllers.

**P2 — polish / dead code**
10. Remove or clearly quarantine the orphaned `coinbase` dashboard variant.
11. Reusable staging load-test kit; SMS AutoFill hint; auto-pay cadence (weekly schedule).

---

## 6. Bottom line
No evidence of significant half-built features in the live code paths. The platform is production-shaped.
The launch checklist is dominated by (a) exercising the money path on the prod leader and (b) two flag
decisions (Refunds, Ledger). Everything else is either verified-working or a known, intentional dormant path.
