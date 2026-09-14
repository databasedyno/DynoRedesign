# DynoPay — Industry-Standard Improvements: Recommendation & Build Plan

## Objective
Turn the earlier review into concrete, industry-aligned recommendations and a phased build.
Five areas are covered. For each: what DynoPay does today, what the industry standard is
(and who does it that way), the recommendation, and the decisions that are yours to make.

Nothing here changes how funds move in production until the flagged economic decision
(Area 1) is confirmed.

---

## Proposed scope & priority (you approve or re-pick)
The five areas are independent and can ship in any order. Recommended sequence by
value-for-effort:

- **Phase 1 — Smart minimums + payer checkout** (Areas 1 + 4 combined; highest product value)
- **Phase 2 — Merchant webhook self-service UI** (Area 2; high value, low risk)
- **Phase 3 — Admin Live Console** (Area 3; self-contained operational win)
- **Phase 0 — Setup speedup** (Area 5; ~5 min change, can go anytime)

You may approve the whole sequence, pick one phase, or re-order.

---

## Area 1 — Per-crypto minimums & the "funds below threshold" problem  *(highest value)*

**Today.** There are two unrelated notions of "minimum", and they don't line up:
- *Buy/pay minimum* is hard-coded and inconsistent per surface: **store $10**, **API checkout $5**,
  **buy-button $5 floor**, **donations/payment-links $1 default** (merchant can raise the last two).
- *The amount we can actually forward on-chain* is a separate, invisible, USD threshold per chain
  (roughly **$2 / $5 / $10** by network-fee class, env-tunable). When a received payment nets below
  that threshold, **the merchant currently receives nothing and the funds are credited to DynoPay's
  admin wallet.** A small order paid on an expensive network (e.g. a $6 order in USDT-TRC20, which
  needs ~$10 to forward) can silently disappear from the merchant's side.

**Industry standard.**
- **NOWPayments**: never hard-codes minimums; fetches a **dynamic minimum per currency pair** (live
  network fees + market), and **shows it to the payer before checkout** so a payment that can't be
  forwarded is never offered.
- **BitPay / Coinbase Commerce**: enforce the minimum **at invoice creation**, based on the current
  cost to settle on the chosen chain.
- Common rule across all: **verify the per-coin minimum before displaying the coin as payable.**

**Recommendation.**
1. Compute a **per-coin minimum** for each order (from live network fee + the forwarding threshold)
   and expose it to the checkout.
2. At checkout, **only offer coins the payer can actually complete** for that order amount; show the
   minimum next to each coin; nudge low-fee coins for small orders. This makes the silent-loss case
   effectively impossible going forward.
3. Give merchants **one per-brand "minimum order / tip / donation" setting**, with a system-computed
   floor they can raise but not drop below.
4. **Consolidate** the four scattered hard-coded floors into a single source of truth so "store $10 /
   API $5 / donation $1" stop contradicting each other.

**Decisions that are yours:**
- **(Please confirm — economic/founder call)** The default proposal only *prevents* sub-threshold
  payments at checkout. It does **not** change how funds already received below threshold are handled
  (today they go to the admin wallet). Changing that routing needs your explicit sign-off. Options:
  keep current routing (default), refund the payer, or hold for manual review.
- Allow merchants to set their own minimum **above** the system floor? *(assumed: yes)*
- **Dynamic** (live-fee) minimums vs **static** USD thresholds shown honestly? *(assumed: dynamic where
  a live fee source is available, static fallback otherwise)*

---

## Area 2 — Webhooks *(already strong; close the gaps)*

**Today.** The system is genuinely production-grade in both directions: inbound events go through a
queue with retry, backoff and a dead-letter queue; outbound merchant webhooks use a transactional
outbox with idempotency, HMAC signing, an 8-attempt retry schedule, auto-disable after repeated
failures, and opt-in event types per merchant.

**Industry standard.** The **Standard Webhooks** spec (Svix, Resend) and **Stripe**:
- Signature over `msg-id . timestamp . payload`, verified against raw bytes with constant-time compare.
- A **timestamp / replay window** (e.g. 5 minutes) to block replay attacks.
- **Two active signing secrets** so merchants can rotate with zero downtime.
- A **dashboard with per-delivery logs and a manual "resend"** so merchants recover from their own
  outages without contacting support.

**Recommendation.**
1. Add a **merchant-facing webhook page**: delivery log with per-attempt status, **manual resend**, and
   a "send test event" button (the delivery data is already recorded — this is mostly surface).
2. **Signing-secret rotation** (two active secrets) + a documented replay window.
3. Adopt Standard-Webhooks header conventions, **added alongside the current headers** so existing
   merchant integrations keep working.
4. Confirm the outbox path is switched **on** in production, and that the inbound provider signature is
   verified on the raw body.

**Decisions that are yours:**
- Build the merchant webhook UI in this round? *(assumed: yes)*
- **(Please confirm)** Signature changes are **additive only** (new headers next to old) to avoid
  breaking anyone currently consuming DynoPay webhooks. *(assumed: additive)*

---

## Area 3 — Admin real-time runtime-log viewer

**Today.** The admin panel has no log view. Logs go to files and an error monitor; an admin has no
in-product way to watch what the system is doing.

**Industry standard.** Two distinct tools:
- **SSE "live tail"** viewers for a lightweight, real-time operational admin UI (no heavy infra).
- **Hosted platforms** (Better Stack, Datadog, Grafana Loki) for long-term searchable history, dashboards
  and alerting.
The 2026 consensus: use an SSE tailer for the in-app live view; add a hosted backend later only if you
need long retention and alerting.

**Recommendation.** Build an in-app **"Live Console"** in the admin panel: live stream of structured
log lines, filter by level and source, search/highlight, pause/resume with jump-to-latest, colour-coded
severity, a small health pulse (error rate, counters), expandable detail, and links to the related
payment/transaction. No new vendor, no recurring cost, no keys.

**Decisions that are yours:**
- **In-house console** (default, no cost) vs a **hosted platform** (needs an account, API keys, and a
  recurring bill)?
- Retention expectation: **live + recent buffer only** (default) vs **long-term searchable history**
  (points toward a hosted backend)?

---

## Area 4 — Customer (payer) pages UX

**Today.** Payers touch the hosted checkout, the storefront (product/cart/checkout), order tracking, and
the receipt. The flow works but is closer to "functional" than "obvious"; the store minimum, for example,
just disables the button rather than guiding the buyer.

**Industry standard (2026 crypto checkout).**
- Show **both fiat and crypto amounts** prominently.
- Present the **asset and network as one unit** (e.g. "USDT TRC-20") and **don't force non-technical users
  to pick a chain** — default to a fast, low-fee network.
- A **price-lock countdown** that stays calm until the final couple of minutes.
- A **three-state status timeline** — *detected → confirming → paid* — instead of a generic spinner.
- **Large QR** on desktop, **wallet deep-links** on mobile, one-tap copy of address and exact amount.
- **Explicit under/overpayment policy** messaging, and a **"refresh quote"** on an expired invoice rather
  than restarting checkout.

**Recommendation.** Apply these across the payer surfaces, starting with the hosted checkout plus the
smart coin picker from Area 1, then the storefront checkout, then order-tracking/receipt polish.

**Decisions that are yours:**
- Which surfaces in the first pass? *(assumed: hosted checkout first, then storefront)*
- **(Please confirm)** The real under/overpayment policy today (auto-credit the difference? refund the
  overpayment? manual review?) so the on-screen wording matches what actually happens.

---

## Area 5 — Setup speed *(already diagnosed)*

**Today.** A cold pod takes ~8.5 minutes to become ready, dominated by a ~7-minute backend dependency
install that effectively runs one-and-a-half times because of a network-retry stall.

**Recommendation.** Two low-risk changes: make installs prefer the local cache (removes the network
stall and the double-install), and run the two installs in parallel with separate caches. Expected
result: **~8.5 min → ~2.5–3 min**.

**Decision that is yours:** apply both (default) or the cache change only.

---

## Assumptions (chosen unless you say otherwise)
- Phase 1 (smart minimums + payer checkout) goes first.
- Sub-threshold funds keep their current routing until you decide otherwise; we only prevent the case at
  checkout.
- Merchants can set a minimum above the system floor.
- Webhook signature changes are additive and backward-compatible; the merchant webhook UI is in scope.
- Admin logs are an in-house SSE console, live + recent buffer, no hosted vendor.
- Setup speedup applies both changes.

## Out of scope (unless you ask)
- Replacing DynoPay's own settlement with a third-party gateway (NOWPayments, etc.) — the plan borrows
  their *patterns*, not their service.
- Rolling out a full hosted observability platform.
- Changing fee percentages or fee tiers.


---

# BUILD LOG — execution against this plan

## 2026-09-13 — Phase 0 (setup speedup) — DONE
- Added `--prefer-offline` to every yarn install path (`scripts/start-frontend.sh`,
  `backend/server.py`, `scripts/pod-bootstrap.sh`). Removes the "network retry" fetch
  stall + the incomplete-first-pass double install (~8.5min → ~2.5–3min expected).
- DECISION CHANGE vs plan: applied the **cache change only**, NOT parallel-with-separate-caches.
  Reason: the yarn cache (/usr/local/share/.cache/yarn) is persistent on this pod, so
  splitting caches would discard the warm cache (net-harmful). "Cache change only" was an
  approved option for Area 5. Safe: these paths run only when node_modules is missing.

## 2026-09-13 — Phase 1a (smart minimums + coin picker) — DONE (pending final UI test)
Backend (tested 21/21 for the initial flat model; re-verify after the live-fee change):
- NEW `backend/services/checkout/checkoutMinimums.ts` — single source of truth for the
  per-coin minimum.
- `getData` (`/api/pay/getData`) + `getConfiguredCurrenciesForCheckout`
  (`/api/pay/configured-currencies`) return additive `coin_minimums` {coin:usd},
  `min_order_usd`, and (configured-currencies) `transaction_amount_usd` (order value in USD).
- `createCryptoPayment` (`/api/pay/createCryptoPayment`) blocks a coin with HTTP 400
  BEFORE reserving any address when the order's expected USD < that coin's minimum.
  No fund-routing change (sub-threshold funds still follow the existing admin path —
  founder decision still pending).
Frontend (`Components/Page/Pay3Components/cryptoTransfer.tsx`):
- Coin tiles the payer can't complete are greyed/disabled with a red "Min $X" badge; a
  banner shows if the amount is below every coin's minimum. Network tiles (USDT TRC20/
  ERC20/POLYGON, RLUSD XRPL/ERC20) are individually greyed with "· min $X". Safe fallback:
  when the order's USD value is unknown (0), nothing is greyed (backend guard still blocks).

### How the coin minimum is determined (FOUNDER DECISION 2026-09-13)
Two economic costs exist: (1) the on-chain forwarding cost per chain, and (2) the platform
fee ($1 fixed + 1.5%). The flat $3 `{CHAIN}_THRESHOLD` ignored both the per-chain variance
(USDT-TRC20/ERC-20 ≫ XRP) and the fee.
- **Decision 1 = (b) LIVE gas.** N(coin) is driven by the real-time per-chain network fee
  from `services/blockchainFeeService.getBlockchainNetworkFee` (feeInUSD).
- **Decision 2 = (b) minimum = N(coin).** The checkout minimum IS N(coin); the platform fee
  comes out of it (we do not layer per-fee-payer math). Simpler for merchants to reason about.
- Formula: `N(coin) = ceil( liveFeeUSD × CHECKOUT_MIN_FEE_MULTIPLE )`, floored at $1.
  `CHECKOUT_MIN_FEE_MULTIPLE` defaults to **2** (env-tunable) to match the existing static
  "~2× typical gas" sweep floors. 60s in-memory cache so checkout stays fast.
- FALLBACK: if the live fee is unavailable (0 / lookup error) → static per-chain sweep floor
  (`getMinSweepUSD`: $10 high-fee token / $5 native / $2 cheap). Checkout never blocks on a
  bad lookup.
- Net effect: e.g. a $6 order greys USDT-TRC20/ERC-20 (min ≈ live-fee×2, typically ~$8–12)
  while XRP stays available (~$1–2). Checkout is intentionally stricter than the settlement
  gate ($3 flat); aligning settlement + sweep to the same live source is a separate,
  founder-signed change (touches fund routing).

## 2026-09-13 — Phase 1b (consolidate minimums + per-brand setting) — DONE (backend verified)
- NEW `backend/services/checkout/orderMinimums.ts` = single source of truth:
  SURFACE_DEFAULT_MIN_USD { store:10, api:5, buy_button:5, payment_link:1 } (env-tunable),
  getEffectiveMinOrderUsd(surface, merchantMin), getMerchantMinOrderUsdByCompanyId (60s cache).
- Migration `0026_company_min_order_usd` (bootMigrations.ts) — nullable DECIMAL(10,2)
  tbl_company.min_order_usd (APPLIED on boot). NULL = inherit defaults; merchant may only RAISE.
- Consolidated the scattered magic numbers: merchantApiRouter (3 createPayment checks) +
  buyButtonController now read the module defaults (behavior unchanged).
- Per-brand ENFORCEMENT + SURFACING: createCryptoPayment guard blocks below
  max(perCoinMin, merchantMin) ("This merchant's minimum order is $X"); getData +
  configured-currencies raise coin_minimums / min_order_usd by the merchant floor so the
  checkout greys accordingly.
- Settings API: updateCompany accepts/validates min_order_usd (""/null=clear; 1..100000; 2dp)
  + cache invalidation. Settings UI: "Minimum order amount" field in the Payments section
  (CompanySettingsDialog + PaymentToleranceSection.tsx).
- Verified: orderMinimums unit 21/21; settings API CRUD+validation 7/7; enforcement code
  confirmed; backend healthy. Left for FRONTEND test: the settings field + picker greying by merchant min.
- NOTE: the payment-link `?? 1` display defaults and the store frontend MIN_ORDER_CENTS=1000
  constant remain as-is (documented here as the canonical defaults); the universal floor is
  enforced at pay time. Full store-side merchant-min enforcement is a small follow-up.


## 2026-09-14 — STATUS RECONCILIATION (codebase audit)
Audited the live code against this plan. Several phases were built and verified in
git history but never recorded here. Corrected status below.

### Phase 2 — Merchant webhook self-service UI — DONE (one gap)
Verified in code:
- `Components/Page/API/WebhookConsoleSection.tsx` — merchant Webhook Console: configure
  endpoint URL, view/regenerate signing secret (shown once), fire a **test event**,
  delivery log (event, status, HTTP code, latency, retries) with per-attempt drill-down,
  and circuit-breaker pause / one-click re-enable.
- **Webhook Signature V2** (`backend/webhooks/index.ts`): Stripe/Standard-Webhooks style
  `X-Dynopay-Signature-V2: t=<ts>,v1=<hmac>` HMAC over `"<t>.<rawBody>"` (raw bytes),
  sent **additively** alongside the legacy `X-DynoPay-Signature` (v1). Also emits
  `X-DynoPay-Timestamp` and `X-DynoPay-Webhook-Id`. Unsigned only when no real secret set.
- **Idempotency-Key middleware** (`backend/middleware/idempotencyMiddleware.ts`): inert
  without the header; same key+body → original response; same key+different body → 409.
- **Events API**: `GET /events` (paged list) + `POST /events/:id/resend`
  (`backend/routes/merchantApiRouter.ts`), resend uses the company's current secret.
- REMAINING (P2/P3): (a) **two active signing secrets** for zero-downtime rotation — NOT
  built (only single regenerate today); (b) a **documented replay/timestamp-tolerance
  window** on the verify side; (c) an in-**console** "resend" button (the resend API
  exists, but the Console UI surfaces only test-event + logs, no per-delivery resend
  button); (d) verification chore: confirm the transactional outbox is switched ON in
  prod and the inbound provider signature is verified on the raw body.

### Phase 3 — Admin Live Console — DONE
- Frontend: `pages/admin/live-console.tsx`, `Components/Page/Admin/LiveConsole/index.tsx`,
  `useAdminLogStream.ts` (SSE). Backend: `backend/routes/adminLogsRouter.ts` →
  `GET /api/admin/logs/stream` (SSE live tail) + `GET /api/admin/logs/health` (health
  pulse), wired at `routes/index.ts`. Decision landed as **in-house SSE, no hosted vendor**
  (Area 3 default). Long-term searchable history / hosted backend intentionally NOT added.

### Area 4 — Customer (payer) pages UX — DONE on hosted checkout (storefront follow-up)
Verified in `Components/Page/Pay3Components/CleanCheckoutV2.tsx` + `checkout/`:
- Three-state **status timeline** (waiting → detected → confirming → paid) via
  `CheckoutStatusTimeline`; **asset+network as one unit** via `AssetNetworkChip`.
- **Wallet deep-links + URI QR** (`buildPaymentUri`), **one-tap copy** (`copyToClipboard`),
  **price-lock countdown** (reservation window), **fiat+crypto dual amounts**
  (`buildFiatRows`), **over/underpayment** messaging with refund hint, and an
  **expired → "refresh quote"** button (`checkout-refresh-quote-btn`, `expiredBodyRefresh`).
- REMAINING: full **storefront** (product/cart) checkout parity + order-tracking/receipt
  polish — hosted checkout is the surface that shipped.

### Phase 1a / 1b — DONE + enforcement live
- Per-brand min enforced at pay time in `backend/controller/payment/cryptoCheckout.ts`
  and surfaced via `feeController.ts` (raises `min_order_usd` by the merchant floor);
  Settings CRUD + validation in `companyController.ts`; `min_order_usd` column
  (migration 0026) on `companyModel.ts`; checkout greying in `cryptoTransfer.tsx`.
- STILL OPEN: the documented small follow-up — **storefront (cart) merchant-min UI
  enforcement** (`MIN_ORDER_CENTS`, payment-link `?? 1` display defaults). Final
  frontend UI test of the Settings field + picker greying not recorded as run.

### Still genuinely PENDING (unchanged)
- **Area 1 founder call — sub-threshold fund routing** (keep admin-wallet / refund /
  hold): no code change yet; economic sign-off outstanding.
- **Align settlement + sweep to the same live-fee source** as checkout (founder-signed;
  touches fund routing) — checkout is intentionally stricter than the $3 flat settlement
  gate today.

## 2026-09-14 — Phase 2 gaps + storefront min + settlement alignment — DONE
Founder decisions (this session): Area 1 sub-threshold routing = KEEP admin wallet (no
change); settlement/sweep alignment = YES; two-secret rotation grace = 24h auto-expiry.

**A. Two-secret webhook rotation (24h grace) — DONE.**
- Migration `0027_company_webhook_secret_rotation` (bootMigrations.ts) adds nullable
  `webhook_secret_previous` + `webhook_secret_previous_expires_at` to tbl_company
  (ADD COLUMN IF NOT EXISTS — applied on live DB, verified in boot logs).
- `updateWebhookSettings` (companyController): on `webhook_secret:'generate'` with an
  existing secret, the OLD secret is parked in `webhook_secret_previous` with a 24h
  expiry; response + `getWebhookSettings` now return `previous_secret_valid_until`.
- Outbound co-signing (`webhooks/index.ts`): during the grace window the COMPANY URL's
  `X-Dynopay-Signature-V2` carries a SECOND `v1=` computed with the previous secret
  (`t=<ts>,v1=<current>,v1=<previous>`), so a merchant verifies with either while they
  swap. Per-request/payment-link secrets are unaffected (isCompanyUrl gate).

**B. Console per-delivery resend button — DONE.**
- New dashboard endpoint `POST /company/webhook-history/:id/resend/:logId`
  (`companyController.resendWebhookDelivery`, companyRouter) reusing `redeliverWebhook`
  and the company's current secret. Endpoint const `webhookHistoryResend` in api/endpoints.
- `WebhookConsoleSection.tsx`: "Re-send this event" button in the delivery-detail modal
  (`data-testid="webhook-detail-resend-btn"`), with spinner + success/failure toast.

**C. Replay/timestamp window — DOCUMENTED.**
- `DEVELOPER_INTEGRATION_GUIDE.md` §"Handle Webhooks" rewritten with the header table,
  a full V2 verify example (raw body, multi-`v1=` acceptance for rotation), the **5-min
  (300s) replay window**, the 24h rotation grace, and the manual-resend note.

**D. Verify outbox-on + inbound raw-body signature — DONE (one fix).**
- Verified `ENABLE_OUTBOX=true` in prod env (transactional outbox is ON).
- FIX: inbound Tatum verifier (`routes/index.ts`) was HMAC-ing `JSON.stringify(req.body)`
  (a re-serialization) instead of the true bytes. Now verifies against `req.rawBody`
  (captured by express.json's `verify` hook in server.ts), falling back to stringify only
  if the buffer is missing. Removes a real false-reject hazard on genuine webhooks.

**E. Storefront (cart) merchant-min enforcement — DONE.**
- `cartController.startCheckout` now rejects a cart whose subtotal (USD; converted when
  priced in another currency) is below the effective 'store' minimum
  (`getEffectiveMinOrderUsd('store', merchantMin)`, default $10, merchant may raise)
  BEFORE any stock is decremented — clear message instead of only /pay coin greying.

**F. Align settlement + sweep to checkout's live-fee source — DONE (gated).**
- `feeService.getBlockchainConfig` now sets `min_forwarding_amount =
  max(staticThreshold, checkoutMinimums.getCoinMinimumUsd(chain))` — the SAME live-gas
  source the checkout coin-picker uses — so the settlement/sweep "below threshold" gate
  and the coin-picker agree. `max()` means a gas spike can RAISE the bar but the historic
  flat floor is never lowered (never forward a payment that can't cover its own sweep).
  Kill-switch: `ALIGN_SETTLEMENT_MIN_TO_CHECKOUT` (default on).

Verification: backend `tsc --noEmit` clean; migration 0027 applied on live DB; backend
healthy (db/redis/tatum OK). NOT exercised against the live DB by mutating a real
merchant's webhook secret (SAFE MODE — would touch a production integration); logic
covered by tsc + code review. Frontend TS checked.

